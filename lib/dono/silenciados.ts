import 'server-only'

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { exigirAmbienteLocal } from './somente-local'

/**
 * Os alertas que o dono mandou parar de mostrar.
 *
 * ## Por que silenciar é obrigatório numa fila de trabalho
 *
 * Uma fila que nunca esvazia deixa de ser fila. Se um alerta que o dono já
 * decidiu conviver (um cliente que sumiu e não vai voltar, um e-mail de um
 * endereço que ele sabe que está morto) continua gritando todo dia, ele para
 * de olhar a lista inteira — e junto com o item chato vai embora o alerta de
 * dinheiro que apareceu hoje. O silêncio seletivo é o que preserva a atenção
 * para o que importa.
 *
 * ## Por que arquivo, e não banco
 *
 * Isto é preferência de uma pessoa numa máquina, não dado de produto. Criar
 * tabela e migration para guardar "não quero ver isso" acopla uma decisão
 * pessoal ao schema que os clientes usam. Arquivo local, fora do Git, some se
 * a máquina sumir — e não faz falta nenhuma.
 */
const ARQUIVO = join(process.cwd(), '.dono-silenciados.json')

export async function lerSilenciados(): Promise<Set<string>> {
  await exigirAmbienteLocal()

  try {
    const conteudo = await readFile(ARQUIVO, 'utf8')
    const lista = JSON.parse(conteudo) as unknown
    // Arquivo editado à mão ou corrompido não pode derrubar a página inteira:
    // sem silenciados é um estado válido, e é o padrão seguro (mostra tudo).
    return Array.isArray(lista) ? new Set(lista.filter((x): x is string => typeof x === 'string')) : new Set()
  } catch {
    // Arquivo ainda não existe na primeira execução — não é erro.
    return new Set()
  }
}

async function gravar(ids: Set<string>): Promise<void> {
  // `Array.from` em vez de espalhar o Set: o `target` do tsconfig deste
  // projeto não habilita `downlevelIteration`.
  await writeFile(ARQUIVO, JSON.stringify(Array.from(ids), null, 2), 'utf8')
}

export async function silenciar(id: string): Promise<void> {
  await exigirAmbienteLocal()
  const ids = await lerSilenciados()
  ids.add(id)
  await gravar(ids)
}

export async function reexibir(id: string): Promise<void> {
  await exigirAmbienteLocal()
  const ids = await lerSilenciados()
  ids.delete(id)
  await gravar(ids)
}

/** Devolve tudo ao normal. O botão de arrependimento. */
export async function reexibirTudo(): Promise<void> {
  await exigirAmbienteLocal()
  await gravar(new Set())
}
