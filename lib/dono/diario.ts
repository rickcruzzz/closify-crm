import 'server-only'

import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * O diário do que foi comandado pela Central.
 *
 * ## Por que gravar em arquivo, e não só no console
 *
 * Liberar Pro de cortesia, apagar uma empresa ou mudar o orçamento de uma
 * campanha são decisões de dinheiro que não deixam rastro nenhum: o banco fica
 * igual a uma assinatura paga de verdade, e a Meta não diz quem mandou mudar.
 * Daqui a três meses ninguém lembra se aquela empresa pagou ou ganhou, nem por
 * que o orçamento dobrou numa terça.
 *
 * O terminal onde o `npm run dev` roda some quando a janela fecha. Arquivo
 * local, uma linha JSON por ação, fora do Git (carrega nome e id de cliente
 * real).
 *
 * Extraído de `actions.ts` quando `anuncio-actions.ts` passou a precisar do
 * mesmo registro: duas cópias divergiriam no formato, e um diário com dois
 * formatos é um diário que ninguém consegue ler depois.
 */
const ARQUIVO = join(process.cwd(), '.dono-registro.jsonl')

export async function registrarNoDiario(
  acao: string,
  detalhes: Record<string, unknown>,
): Promise<void> {
  const linha = JSON.stringify({ quando: new Date().toISOString(), acao, ...detalhes })

  try {
    await appendFile(ARQUIVO, `${linha}\n`, 'utf8')
  } catch (err) {
    // Falhar o registro não pode desfazer a ação que já aconteceu — seria pior.
    // Mas precisa aparecer em algum lugar.
    console.error('Central do Dono: não consegui gravar o registro da ação.', err)
  }
}
