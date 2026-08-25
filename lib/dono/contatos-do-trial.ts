import 'server-only'

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { exigirAmbienteLocal } from './somente-local'

/**
 * Quando o dono falou com cada empresa em trial.
 *
 * ## Por que registrar, e por que NÃO esconder
 *
 * A tela "Decidindo agora" é uma fila de trabalho, e fila de trabalho sem
 * marcação vira lista que se relê inteira todo dia. Sem isto, a mesma pessoa
 * cobra atenção na segunda, na terça e na quarta, e o dono ou fala duas vezes
 * (o que queima o contato) ou desiste de olhar a tela (o que a torna inútil) —
 * exatamente o que os Alertas já pagaram antes de ganharem "silenciar".
 *
 * Mas aqui **silenciar seria errado**. Falar uma vez com quem está decidindo
 * não encerra o assunto: o trial continua correndo, e o segundo toque perto do
 * fim é justamente o que fecha. Por isso o registro é uma DATA, não um
 * interruptor: a empresa continua na lista, marcada, com prioridade rebaixada
 * enquanto o contato é recente — e volta a subir sozinha quando esfria.
 *
 * ## Por que arquivo, e não banco
 *
 * Mesma razão de `silenciados.ts`: isto é o caderno de uma pessoa numa
 * máquina, não dado de produto. Criar tabela e migration para guardar "falei
 * com fulano" acopla uma anotação pessoal ao schema que os clientes usam.
 * Fora do Git, porque carrega id de empresa real.
 */
const ARQUIVO = join(process.cwd(), '.dono-contatos-do-trial.json')

export type ContatosRegistrados = Record<string, string>

export async function lerContatos(): Promise<ContatosRegistrados> {
  await exigirAmbienteLocal()

  try {
    const conteudo = await readFile(ARQUIVO, 'utf8')
    const bruto = JSON.parse(conteudo) as unknown

    // Arquivo editado à mão ou corrompido não pode derrubar a página: sem
    // registro nenhum é estado válido, e é o padrão seguro (todo mundo aparece
    // como "ainda não falei", que erra para o lado de cobrar demais).
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {}

    const limpo: ContatosRegistrados = {}
    for (const [id, quando] of Object.entries(bruto as Record<string, unknown>)) {
      if (typeof quando === 'string' && !Number.isNaN(Date.parse(quando))) {
        limpo[id] = quando
      }
    }
    return limpo
  } catch {
    // Arquivo ainda não existe na primeira execução — não é erro.
    return {}
  }
}

async function gravar(registro: ContatosRegistrados): Promise<void> {
  await writeFile(ARQUIVO, JSON.stringify(registro, null, 2), 'utf8')
}

/** Marca que o dono falou com esta empresa agora. */
export async function marcarComoFalado(workspaceId: string): Promise<void> {
  await exigirAmbienteLocal()
  const registro = await lerContatos()
  registro[workspaceId] = new Date().toISOString()
  await gravar(registro)
}

/** Desfaz a marcação. O botão de arrependimento, igual ao dos Alertas. */
export async function desmarcarContato(workspaceId: string): Promise<void> {
  await exigirAmbienteLocal()
  const registro = await lerContatos()
  delete registro[workspaceId]
  await gravar(registro)
}
