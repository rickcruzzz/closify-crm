import type { Lead, LeadStatus } from '@/lib/leads/types'

/**
 * Gera o CSV dos contatos, no formato que o Excel brasileiro abre sem ajuste.
 *
 * ## Por que isto existe
 *
 * "Vou ficar preso no sistema" é objeção de venda, não de produto — e ela some
 * quando a pessoa vê que os dados saem com um clique. Estava na fila técnica
 * como o próximo item desde 12/08.
 *
 * O produto já IMPORTA planilha desde 11/08. Faltava o caminho de volta, e sem
 * ele a promessa "traga sua planilha" é de mão única.
 *
 * ## As três decisões que fazem o arquivo abrir certo
 *
 * **Separador `;`, não vírgula.** O comentário de `lib/leads/csv.ts` já
 * registra: "Excel em português exporta com `;`, Google Sheets com `,`". Com
 * vírgula, o Excel pt-BR joga a planilha inteira numa coluna só. E o ciclo
 * fecha: `detectarSeparador` aceita `;`, `,` e tab na volta, então o arquivo
 * exportado daqui reimporta aqui.
 *
 * **BOM UTF-8 no começo.** Sem ele o Excel assume Windows-1252 e "José" vira
 * "JosÃ©". É o espelho exato do defeito de 11/08 na importação, quando
 * `File.text()` decodificava tudo como UTF-8 e o CSV do Excel entrava com
 * `Jos� Ant�nio`. Três bytes resolvem, e não atrapalham quem abre no Google
 * Sheets ou num editor.
 *
 * **Valor com vírgula decimal.** `1234.5` vira `1234,50`. Escrever ponto faria
 * o Excel brasileiro ler como texto, e a coluna perderia a soma — que é
 * justamente para o que alguém exporta valor.
 */

/** Rótulos em português, na mesma ordem e nome que a IMPORTAÇÃO reconhece. */
const COLUNAS = [
  'Nome',
  'E-mail',
  'Telefone',
  'Empresa',
  'Etapa',
  'Valor',
  'Responsável',
  'Criado em',
] as const

/**
 * Os mesmos rótulos que a interface mostra.
 *
 * Exportar `fechado_ganho` seria despejar o enum do banco na cara de quem
 * abre a planilha — e é o jargão que a renomeação de 19/08 tirou do produto
 * inteiro.
 */
const ROTULO_DA_ETAPA: Record<LeadStatus, string> = {
  novo: 'Novo',
  contato_realizado: 'Contato realizado',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado ganho',
  fechado_perdido: 'Fechado perdido',
}

/**
 * Escapa uma célula.
 *
 * Aspas viram aspas duplas e o campo inteiro é envolvido quando contém
 * separador, aspas ou quebra de linha — que é o que a RFC 4180 manda e o que
 * `tokenizar` (a leitura deste projeto) espera encontrar.
 *
 * ## O caso que não é sobre CSV, e sim sobre planilha
 *
 * Célula começando com `=`, `+`, `-` ou `@` é interpretada como FÓRMULA pelo
 * Excel e pelo Sheets. Um contato chamado `=cmd|'/c calc'!A1` — nome que
 * qualquer um consegue cadastrar — vira execução de comando na máquina de
 * quem abre o arquivo. É injeção de fórmula (CSV injection), e o alvo não é
 * este servidor: é o cliente que exportou.
 *
 * Prefixar com apóstrofo faz a planilha tratar como texto, e o apóstrofo não
 * aparece na célula.
 */
function celula(valor: string): string {
  let v = valor ?? ''

  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`

  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** `1234.5` -> `1234,50`. Vazio quando não há valor, nunca `0,00`. */
function moeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return ''
  return valor.toFixed(2).replace('.', ',')
}

/** `2026-09-03T14:22:00Z` -> `03/09/2026`, no fuso de São Paulo. */
function data(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // O servidor da Vercel roda em UTC: às 21h de São Paulo já é o dia seguinte
  // lá. É a mesma armadilha que `diaEmSaoPaulo` resolve para as tarefas, e
  // aqui ela deslocaria a data de criação de todo contato do fim do dia.
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * Monta o CSV inteiro.
 *
 * `\r\n` porque é o que a RFC 4180 define e o que o Excel espera; `\n` sozinho
 * funciona na maioria dos casos e falha em versões antigas do Windows.
 */
export function montarCsvDeContatos(contatos: readonly Lead[]): string {
  const linhas = [COLUNAS.join(';')]

  for (const c of contatos) {
    linhas.push(
      [
        celula(c.name),
        celula(c.email),
        celula(c.phone),
        celula(c.company),
        celula(ROTULO_DA_ETAPA[c.status] ?? c.status),
        moeda(c.value),
        celula(c.owner),
        data(c.createdAt),
      ].join(';'),
    )
  }

  return linhas.join('\r\n') + '\r\n'
}

/** O BOM que faz o Excel reconhecer UTF-8. */
export const BOM_UTF8 = '﻿'

/** `contatos-velo-funil-2026-09-03.csv` */
export function nomeDoArquivo(agora: Date = new Date()): string {
  const dia = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
  return `contatos-velo-funil-${dia}.csv`
}
