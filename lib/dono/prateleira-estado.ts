import 'server-only'

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { exigirAmbienteLocal } from './somente-local'
import type { EstadoNaPrateleira } from './prateleira'

/**
 * Em que prateleira cada empresa está.
 *
 * ## Por que arquivo, e não tabela
 *
 * A mesma decisão de `silenciados.ts`, e pelo mesmo motivo escrito lá: isto é
 * o estado de trabalho de UMA pessoa numa máquina, não dado de produto. Criar
 * tabela obrigaria RLS, policies e uma migration que todo cliente carrega no
 * schema — para guardar "já mandei mensagem para essa empresa".
 *
 * E a prospecção deste projeto já guarda estado em arquivo em dois outros
 * lugares: `scripts/inteligencia/nao-perturbe.txt` e `.rodadas.json`.
 *
 * O dado de ORIGEM continua durável: os CSVs de `docs/mercado/universo-*.csv`
 * estão versionados no Git, e os leads estão no banco. O que este arquivo
 * guarda é só a marca de progresso — se a máquina sumir, a fila volta cheia,
 * o que é chato e não é perda.
 *
 * ## O formato guarda a data, e não só o estado
 *
 * `{ "orkinsp.com.br": { "estado": "enviado", "em": "..." } }`
 *
 * A data existe para a pergunta que aparece depois: *faz quantos dias que eu
 * mandei?* Sem ela, "enviado" é um booleano que não permite priorizar retorno
 * nem medir se a abordagem produziu resposta.
 */
const ARQUIVO = join(process.cwd(), '.dono-prospeccao.json')

export type MarcaNaPrateleira = { estado: EstadoNaPrateleira; em: string }

const ESTADOS: EstadoNaPrateleira[] = ['novo', 'enviado', 'confirmado', 'descartado']

function ehMarca(valor: unknown): valor is MarcaNaPrateleira {
  if (typeof valor !== 'object' || valor === null) return false
  const m = valor as Record<string, unknown>
  return (
    typeof m.estado === 'string' &&
    ESTADOS.includes(m.estado as EstadoNaPrateleira) &&
    typeof m.em === 'string'
  )
}

/**
 * Lê as marcas.
 *
 * Arquivo ausente, corrompido ou editado à mão devolve vazio — que é o padrão
 * SEGURO aqui, porque significa "mostra tudo". Um erro na direção contrária
 * (esconder a fila inteira) seria indistinguível de "acabei de prospectar".
 * Mesma escolha de `lerSilenciados`.
 */
export async function lerMarcas(): Promise<Record<string, MarcaNaPrateleira>> {
  await exigirAmbienteLocal()

  try {
    const bruto = JSON.parse(await readFile(ARQUIVO, 'utf8')) as unknown
    if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return {}

    const saida: Record<string, MarcaNaPrateleira> = {}
    for (const [dominio, marca] of Object.entries(bruto as Record<string, unknown>))
      if (ehMarca(marca)) saida[dominio.toLowerCase()] = marca
    return saida
  } catch {
    return {}
  }
}

/** Só os estados, no formato que `mesclar` consome. */
export async function lerEstados(): Promise<Record<string, EstadoNaPrateleira>> {
  const marcas = await lerMarcas()
  const saida: Record<string, EstadoNaPrateleira> = {}
  for (const [dominio, marca] of Object.entries(marcas)) saida[dominio] = marca.estado
  return saida
}

export async function marcar(dominio: string, estado: EstadoNaPrateleira): Promise<void> {
  await exigirAmbienteLocal()

  const marcas = await lerMarcas()
  const chave = dominio.trim().toLowerCase()

  // `novo` é a ausência de marca, não uma marca. Guardar a linha faria o
  // arquivo crescer com 882 entradas que não dizem nada.
  if (estado === 'novo') delete marcas[chave]
  else marcas[chave] = { estado, em: new Date().toISOString() }

  await writeFile(ARQUIVO, JSON.stringify(marcas, null, 2), 'utf8')
}
