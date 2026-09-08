import 'server-only'

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { createAdminClient } from '@/lib/supabase/admin'
import { ehDominioExcluido } from '@/lib/inteligencia-de-mercado/dominio/prospeccao'

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

/**
 * As empresas onde a prospecção grava.
 *
 * Restrito por NOME, e não "todos os workspaces", de propósito. A Central lê
 * com `createAdminClient()`, que ignora RLS: sem este filtro, os contatos de um
 * cliente real entrariam na minha fila de prospecção e eu mandaria mensagem
 * fria para a carteira dele. O erro seria silencioso — a linha pareceria só
 * mais um prospect.
 */
const EMPRESAS_DE_PROSPECCAO = ['Prospeccao', 'Orne']

/** O mesmo teto de `queries.ts`, pela mesma razão: o PostgREST corta em 1.000. */
const TETO = 5000

/**
 * Quem pediu para não ser procurado de novo.
 *
 * A primeira mensagem promete, em texto, *"me avisa que não te procuro de
 * novo"*. Sem esta leitura a promessa seria mentira na rodada seguinte — e
 * segunda abordagem depois de um "não" é exatamente o que vira denúncia de
 * spam, que é o que derruba o número do dono.
 *
 * Mesmo arquivo que `scripts/inteligencia/prospectar.mjs` já lê, nunca uma
 * segunda cópia: duas listas divergem, e a que diverge em silêncio é a errada.
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

  const [doCsv, leads, estados, naoPerturbe] = await Promise.all([
    lerTodosOsCsv(),
    lerLeadsDaProspeccao(),
    lerEstados(),
    lerNaoPerturbe(),
  ])

  const todos = mesclar(doCsv, leads, estados)

  let removidosPorNao = 0
  let removidosPorRegra = 0
  const sobrando: Prospect[] = []

  for (const p of todos) {
    if (naoPerturbe.has(p.dominio)) {
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
    sobrando.push(p)
  }

  return {
    prospects: ordenar(sobrando),
    naoPerturbe: removidosPorNao,
    excluidos: removidosPorRegra,
  }
}
