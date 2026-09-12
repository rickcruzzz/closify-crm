import 'server-only'

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { createAdminClient } from '@/lib/supabase/admin'
// Restrito por NOME, e nao "todos os workspaces": a Central le com
// `createAdminClient()`, que ignora RLS. Sem o filtro, os contatos de um
// cliente real entrariam nesta fila e receberiam mensagem fria. O porque
// inteiro, e por que a lista de LEITURA tem duas empresas enquanto a de
// ESCRITA tem uma, esta em `lib/prospeccao/empresas.ts`.
import { EMPRESAS_DE_PROSPECCAO } from '@/lib/prospeccao/empresas'
import {
  ehDominioExcluido,
  ehNomeInstitucional,
} from '@/lib/inteligencia-de-mercado/dominio/prospeccao'

import { carregarDescadastros } from '@/lib/prospeccao/opt-out-queries'
import { ultimos8 } from '@/lib/prospeccao/opt-out'

import { lerEstados } from './prateleira-estado'
import { exigirAmbienteLocal } from './somente-local'
import {
  lerCsvDoUniverso,
  mesclar,
  ordenar,
  type LeadJaGravado,
  type Prospect,
} from './prateleira'

/**
 * Onde as três fontes da prateleira são lidas.
 *
 * A regra e o porquê de cada uma estão em `prateleira.ts`; aqui fica só o
 * acesso ao disco e ao banco, para o núcleo continuar puro e testável — mesmo
 * desenho de `trial.ts` (puro) e `trial-queries.ts` (I/O).
 */

const PASTA_DO_UNIVERSO = join(process.cwd(), 'docs', 'mercado')
const CAMINHO_NAO_PERTURBE = join(process.cwd(), 'scripts', 'inteligencia', 'nao-perturbe.txt')


/** O mesmo teto de `queries.ts`, pela mesma razão: o PostgREST corta em 1.000. */
const TETO = 5000

/**
 * Quem pediu para não ser procurado de novo, pelo ARQUIVO.
 *
 * Metade da resposta. A outra metade está no banco — ver `carregarDescadastros`
 * logo abaixo, e o porquê de serem duas fontes em `filtrarQuemPediuParaSair`.
 *
 * Mesmo arquivo que `scripts/inteligencia/prospectar.mjs` já lê, nunca uma
 * segunda cópia: duas listas divergem, e a que diverge em silêncio é a errada.
 *
 * **Continua valendo, e não é legado.** Ele é a escotilha manual: o dono
 * acrescenta uma linha e a empresa sai da fila, sem depender de a pessoa ter
 * clicado ou respondido nada.
 */
async function lerNaoPerturbe(): Promise<Set<string>> {
  try {
    const conteudo = await readFile(CAMINHO_NAO_PERTURBE, 'utf8')
    return new Set(
      conteudo
        .split(/\r?\n/)
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l && !l.startsWith('#')),
    )
  } catch {
    // Arquivo ausente é estado válido: ninguém pediu para sair ainda.
    return new Set()
  }
}

async function lerTodosOsCsv(): Promise<Prospect[]> {
  let arquivos: string[]
  try {
    arquivos = (await readdir(PASTA_DO_UNIVERSO)).filter(
      (n) => n.startsWith('universo-') && n.endsWith('.csv'),
    )
  } catch {
    return []
  }

  const listas = await Promise.all(
    arquivos.map(async (nome) => {
      try {
        return lerCsvDoUniverso(await readFile(join(PASTA_DO_UNIVERSO, nome), 'utf8'))
      } catch {
        // Um arquivo ilegível não pode esconder os outros quatro.
        console.error(`prateleira: nao consegui ler ${nome}`)
        return []
      }
    }),
  )
  return listas.flat()
}

async function lerLeadsDaProspeccao(): Promise<LeadJaGravado[]> {
  const supabase = createAdminClient()

  const { data: empresas } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('name', EMPRESAS_DE_PROSPECCAO)
    .limit(TETO)

  const ids = (empresas ?? []).map((e) => e.id)
  if (ids.length === 0) return []

  const { data: leads } = await supabase
    .from('leads')
    .select('id, company, name, phone, email')
    .in('workspace_id', ids)
    .not('company', 'is', null)
    .limit(TETO)

  return (leads ?? [])
    .filter((l): l is typeof l & { company: string } => Boolean(l.company))
    .map((l) => ({
      id: l.id,
      dominio: l.company,
      nome: l.name ?? null,
      telefone: l.phone ?? null,
      email: l.email ?? null,
    }))
}

export type PrateleiraCarregada = {
  prospects: Prospect[]
  /** Quantos foram removidos por já terem dito não. Aparece na tela. */
  naoPerturbe: number
  /** Quantos caíram na regra de sindicato/diretório. */
  excluidos: number
}

export async function carregarPrateleira(): Promise<PrateleiraCarregada> {
  await exigirAmbienteLocal()

  const [doCsv, leads, estados, doArquivo, doBanco] = await Promise.all([
    lerTodosOsCsv(),
    lerLeadsDaProspeccao(),
    lerEstados(),
    lerNaoPerturbe(),
    carregarDescadastros(),
  ])

  const todos = mesclar(doCsv, leads, estados)

  let removidosPorNao = 0
  let removidosPorRegra = 0
  const sobrando: Prospect[] = []

  for (const p of todos) {
    /**
     * ## As DUAS fontes, e por que nenhuma sozinha bastava — 12/09
     *
     * Até aqui a fila consultava só `nao-perturbe.txt`: um arquivo na máquina
     * do dono, alimentado à mão, com **zero linhas** na medição do dia. Quem
     * respondesse "não quero" pelo WhatsApp dependia de alguém abrir o arquivo
     * e digitar o domínio.
     *
     * E a tabela `descadastro_de_prospeccao`, que existe desde a 0080, também
     * não resolvia — ela guardava só `email_hash`, e esta fila casa por
     * DOMÍNIO e por TELEFONE. Não havia um campo em comum: mandá-la ler
     * filtraria zero linhas para sempre, com o alarme calado parecendo
     * resolvido. A 0083 é o que deu à tabela os dois campos que faltavam.
     *
     * ## E o TELEFONE é a metade que o domínio não cobre
     *
     * Quem responde pelo WhatsApp é identificado pelo número, e a mesma pessoa
     * pode ter dois sites: `i9 Acrílicos` e `Fachadas Curitiba » i9` são
     * domínios diferentes com o MESMO telefone, medido em 12/09. Barrar só o
     * domínio mandaria a segunda mensagem para quem acabou de dizer não — pelo
     * outro site dele.
     */
    if (doArquivo.has(p.dominio) || doBanco.dominios.has(p.dominio)) {
      removidosPorNao += 1
      continue
    }
    const oito = ultimos8(p.whatsapp ?? p.telefone)
    if (oito && doBanco.telefones.has(oito)) {
      removidosPorNao += 1
      continue
    }
    // `ehDominioExcluido` recebe URL, não host: ela é fail-closed e devolve
    // `true` para o que não consegue parsear. Passar o domínio nu já excluiu
    // 100% de uma rodada inteira em silêncio, em 07/09.
    if (ehDominioExcluido(`https://${p.dominio}`)) {
      removidosPorRegra += 1
      continue
    }
    // O sufixo nao pega quem se hospeda num `.com.br`: o sindicato ferroviario
    // de BH mora em `adeli.com.br` e recebeu abordagem de venda em 09/09.
    if (ehNomeInstitucional(p.nome)) {
      removidosPorRegra += 1
      continue
    }
    sobrando.push(p)
  }

  return {
    prospects: ordenar(sobrando),
    naoPerturbe: removidosPorNao,
    excluidos: removidosPorRegra,
  }
}
