/**
 * A prateleira de prospecção: as empresas que o Exa achou, numa fila só.
 *
 * ## Por que este arquivo existe
 *
 * Em 07/09 o motor de prospecção tinha produzido 510 mensagens prontas e
 * **zero conversas**. O gargalo não era achar empresa — era enviar. O caminho
 * até uma mensagem eram cinco passos (trocar de empresa, Contatos, abrir o
 * contato, rolar a timeline, achar o link), e ninguém repete isso 500 vezes.
 *
 * ## O dado está partido em três lugares, e nenhum é completo
 *
 * Medido em 07/09, contando domínios:
 *
 *     790  no CSV do universo (docs/mercado/universo-*.csv, versionados)
 *     432  leads cujo dominio ESTA no CSV
 *      92  leads cujo dominio NAO esta em CSV nenhum
 *
 * Os 92 vieram das rodadas de 06/09, antes de `--universo` existir. Ler só o
 * CSV perderia 92 empresas já pagas; ler só o banco perderia 358. **O total
 * distinto é ~882**, e ele só existe depois do merge.
 *
 * ## Este arquivo é puro de propósito
 *
 * Nada de `fs`, nada de rede — o mesmo desenho de `trial.ts` e `ativacao.ts`.
 * Quem lê arquivo e banco é `prateleira-queries.ts`. O parser de CSV é onde
 * mora o risco de erro silencioso (separador `;`, BOM, coluna deslocada), e
 * risco silencioso é exatamente o que precisa de teste.
 */

import { montarAbordagem } from '@/lib/inteligencia-de-mercado/dominio/abordagem'
import { normalizarTelefoneBrasileiro } from '@/lib/leads/whatsapp'
import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

/** O piso de pontos do `--topo` do script, repetido aqui como filtro da tela. */
export const PISO_DOS_MELHORES = 10

export type EstadoNaPrateleira = 'novo' | 'enviado' | 'confirmado' | 'descartado'

export type Prospect = {
  /** A chave de tudo: um domínio, uma linha. */
  dominio: string
  /** O título da página, que é como a pessoa reconhece a própria empresa. */
  nome: string | null
  vertical: string
  pontos: number
  motivos: string[]
  /** Já normalizado pelo script quando veio do CSV (`primeiroWhatsapp`). */
  whatsapp: string | null
  telefone: string | null
  email: string | null
  /** Preenchido quando esta empresa já virou contato no CRM. */
  leadId: string | null
  estado: EstadoNaPrateleira
}

/**
 * Uma linha do CSV do universo, já separada.
 *
 * O cabeçalho é `dominio;titulo;vertical;pontos;whatsapp;telefone;email;motivos`
 * e o arquivo nasce com BOM UTF-8 — as duas escolhas vêm de
 * `lib/leads/exportar-csv.ts`, pela mesma razão: com vírgula a planilha vira
 * uma coluna só, e sem BOM "José" vira "JosÃ©" no Excel brasileiro.
 */
const COLUNAS = 8

/**
 * Lê um CSV de universo.
 *
 * **Tolerante por decisão.** Linha com menos colunas que o cabeçalho é
 * ignorada em silêncio em vez de derrubar a página: o arquivo é acrescentado a
 * cada rodada e pode ter sido editado à mão. Perder uma linha é recuperável;
 * uma tela que não abre esconde as outras 881.
 */
export function lerCsvDoUniverso(conteudo: string): Prospect[] {
  const linhas = conteudo.replace(/^﻿/, '').split(/\r?\n/)
  const saida: Prospect[] = []

  // `slice(1)` pula o cabeçalho. Ele é sempre a primeira linha porque o script
  // só o escreve quando o arquivo ainda não existe.
  for (const linha of linhas.slice(1)) {
    if (!linha.trim()) continue
    const campos = linha.split(';')
    if (campos.length < COLUNAS) continue

    const dominio = campos[0].trim().toLowerCase()
    if (!dominio) continue

    const pontos = Number(campos[3])

    saida.push({
      dominio,
      nome: campos[1].trim() || null,
      vertical: campos[2].trim() || 'sem-nicho',
      // `Number('')` é 0 e `Number('abc')` é NaN — os dois viram 0, que é o
      // valor que faz a empresa cair para o fim da fila em vez de sumir dela.
      pontos: Number.isFinite(pontos) ? pontos : 0,
      motivos: campos[7] ? campos[7].split('|').map((m) => m.trim()).filter(Boolean) : [],
      whatsapp: campos[4].trim() || null,
      telefone: campos[5].trim() || null,
      email: campos[6].trim() || null,
      leadId: null,
      estado: 'novo',
    })
  }

  return saida
}

/** O que o banco devolve por lead já gravado, reduzido ao que a fila usa. */
export type LeadJaGravado = {
  id: string
  /** `company` guarda o domínio nas rodadas de prospecção. */
  dominio: string
  nome: string | null
  telefone: string | null
  email: string | null
}

/**
 * Junta CSV e banco numa fila só.
 *
 * ## Três regras, e cada uma corrige um defeito real
 *
 * **Dedupe por domínio, mantendo o MAIOR pontos.** O CSV tem 959 linhas para
 * 790 domínios: 90 empresas aparecem em dois nichos (comunicação visual que
 * também monta estande entra em `eventos-corporativos`) e 79 se repetem dentro
 * de marcenaria, porque `--universo` grava por praça e por variante de consulta
 * sem deduplicar antes de escrever. Somar os pontos transformaria repetição em
 * evidência — o mesmo erro que o corpus de vocabulário já pagou em 07/09.
 *
 * **Lead vence CSV no contato.** Quem já é lead teve o telefone conferido pela
 * trigger `leads_contato_minimo`; o CSV pode ter a coluna vazia.
 *
 * **Lead sem CSV entra assim mesmo.** São os 92 das rodadas de 06/09. Sem esta
 * linha eles sumiriam da tela apesar de já terem sido pagos.
 */
export function mesclar(
  doCsv: Prospect[],
  leads: LeadJaGravado[],
  estados: Record<string, EstadoNaPrateleira>,
): Prospect[] {
  const porDominio = new Map<string, Prospect>()

  for (const p of doCsv) {
    const atual = porDominio.get(p.dominio)
    if (!atual || p.pontos > atual.pontos) porDominio.set(p.dominio, { ...p })
  }

  for (const l of leads) {
    const dominio = l.dominio.trim().toLowerCase()
    if (!dominio) continue

    const atual = porDominio.get(dominio)
    if (atual) {
      atual.leadId = l.id
      atual.nome = atual.nome ?? l.nome
      atual.telefone = atual.telefone ?? l.telefone
      atual.email = atual.email ?? l.email
      continue
    }

    porDominio.set(dominio, {
      dominio,
      nome: l.nome,
      // O nicho não sobreviveu à gravação como lead — `leads` não tem coluna
      // para isso. O gancho da mensagem cai no padrão, que é o de orçamento.
      vertical: 'sem-nicho',
      pontos: 0,
      motivos: [],
      whatsapp: null,
      telefone: l.telefone,
      email: l.email,
      leadId: l.id,
      estado: 'novo',
    })
  }

  const lista = Array.from(porDominio.values())
  for (const p of lista) p.estado = estados[p.dominio] ?? 'novo'
  return lista
}

/**
 * A ordem da fila: pontos primeiro, depois quem tem WhatsApp.
 *
 * O desempate por WhatsApp copia `ordenarPorPropensao` do script, e pela mesma
 * razão: entre dois prospects igualmente promissores, o que se alcança por um
 * clique vale mais que o que exige achar o telefone.
 */
export function ordenar(lista: Prospect[]): Prospect[] {
  return [...lista].sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos
    const wa = Number(Boolean(b.whatsapp || b.telefone)) - Number(Boolean(a.whatsapp || a.telefone))
    if (wa !== 0) return wa
    return a.dominio.localeCompare(b.dominio)
  })
}

/**
 * A mensagem e o link, montados a partir do prospect.
 *
 * ## Por que aqui, e não no servidor
 *
 * São ~882 empresas. Montar o link de todas no servidor e mandar pela prop
 * custaria centenas de KB de HTML — cada `wa.me` carrega a mensagem inteira
 * codificada, e uma mensagem passa de 500 caracteres. Montar no cliente, por
 * linha renderizada, custa CPU e zero rede.
 *
 * ## Por que reusa `montarAbordagem` em vez de escrever o texto aqui
 *
 * Ele é a mensagem do projeto: tem o gancho por nicho, o teto de 560 (acima
 * disso o WhatsApp mostra "Ler mais" e a mensagem morre), e a garantia — com
 * teste — de que a linha de descarte nunca é cortada. Uma segunda versão do
 * texto divergiria da primeira, e a que diverge em silêncio é a errada.
 *
 * ## O número
 *
 * `whatsapp` do CSV já vem normalizado pelo script. `telefone` é o que a página
 * mostrava para humano, e passa por `normalizarTelefoneBrasileiro`, que separa
 * celular de fixo e recusa número estrangeiro do mesmo tamanho — prefixar `55`
 * num número de 11 dígitos transforma telefone dos EUA em brasileiro, e o
 * `wa.me` abriria uma tela de erro que parece defeito nosso.
 */
export function mensagemPara(p: Prospect): { texto: string; link: string | null } {
  const texto = montarAbordagem({
    dominio: p.dominio,
    nome: p.nome,
    vertical: p.vertical,
    motivos: p.motivos,
    precoMensal: PRO_PLAN_PRICE,
    limiteGratis: FREE_LEAD_LIMIT,
  })

  const numero = p.whatsapp ?? normalizarTelefoneBrasileiro(p.telefone)
  return {
    texto,
    link: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null,
  }
}

/**
 * Os motivos que dizem que ela PAGA vêm primeiro.
 *
 * `pontuar` empilha os motivos na ordem em que testa: contato primeiro
 * (WhatsApp, telefone, e-mail), sinal de propensão depois. Mostrando os três
 * primeiros, a linha exibia sempre "WhatsApp direto · telefone · e-mail" —
 * verdadeiro, e a informação menos útil da lista, porque quase toda empresa
 * qualificada tem contato. O que distingue uma linha da outra é "pede
 * orçamento" e "tem equipe de vendas", e eram exatamente esses que ficavam
 * cortados.
 *
 * Achado quando o dono perguntou o que o número verde significava: a legenda
 * dizia "as parcelas estão escritas na linha", e as parcelas visíveis eram as
 * que não explicavam a nota.
 */
const SO_ALCANCE = new Set([
  'WhatsApp direto',
  'telefone na página',
  'e-mail na página',
  'Instagram',
  'domínio .com.br',
])

export function motivosQueExplicam(motivos: string[]): string[] {
  const pagam = motivos.filter((m) => !SO_ALCANCE.has(m))
  const alcance = motivos.filter((m) => SO_ALCANCE.has(m))
  return [...pagam, ...alcance]
}

/** Quantos há em cada prateleira, para os rótulos das abas. */
export function contarPorEstado(lista: Prospect[]): Record<EstadoNaPrateleira, number> {
  const contagem: Record<EstadoNaPrateleira, number> = {
    novo: 0,
    enviado: 0,
    confirmado: 0,
    descartado: 0,
  }
  for (const p of lista) contagem[p.estado] += 1
  return contagem
}
