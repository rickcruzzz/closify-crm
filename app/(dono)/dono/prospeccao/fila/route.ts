import { NextResponse } from 'next/server'

import { mensagemPara } from '@/lib/dono/prateleira'
import { carregarPrateleira } from '@/lib/dono/prateleira-queries'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/**
 * A fila inteira em JSON, para o enviador rodar sem duplicar a mensagem.
 *
 * ## Por que esta rota existe
 *
 * `scripts/inteligencia/enviar-whatsapp.mjs` precisa de duas coisas: quem
 * ainda não recebeu, e o texto exato de cada um. As duas já existem em
 * `carregarPrateleira` e `mensagemPara` — em TypeScript, com alias `@/`, e
 * este projeto não tem `tsx` instalado para um `.mjs` importá-las.
 *
 * As alternativas eram piores. Reescrever a montagem da mensagem no script é
 * exatamente a armadilha que `docs/estado-atual.md` registra em letras
 * grandes: *"duas cópias divergem, e a que diverge em silêncio é a que você
 * escreveu"* — e aqui o que divergiria é o TEXTO QUE VAI PARA O CLIENTE.
 * Raspar a tela também não serve: ela pagina em 80 e o enviador precisa das
 * 382.
 *
 * Uma rota que devolve o que a tela já mostra mantém uma fonte só.
 *
 * ## O portão é o mesmo da Central inteira
 *
 * `exigirAmbienteLocal` exige `NODE_ENV === 'development'` **e** host de
 * loopback. Em produção isto é 404, como todo o resto de `/dono`. Sem as duas
 * condições, `next dev` escuta em todas as interfaces e qualquer um no mesmo
 * Wi-Fi leria a lista inteira — incluindo telefone e nome de 382 empresas.
 *
 * ## O que ela NÃO faz
 *
 * Não envia, não marca, não escreve nada. É leitura. Quem escreve o estado é
 * o script, no arquivo que `prateleira-estado.ts` já lê — e só depois de a
 * mensagem sair de verdade.
 */
export async function GET(request: Request) {
  await exigirAmbienteLocal()

  const { prospects, naoPerturbe, excluidos } = await carregarPrateleira()

  const somenteNovos = new URL(request.url).searchParams.get('todos') !== '1'

  const fila = prospects
    .filter((p) => (somenteNovos ? p.estado === 'novo' : true))
    .map((p) => {
      const { texto, link } = mensagemPara(p)
      return {
        dominio: p.dominio,
        nome: p.nome,
        vertical: p.vertical,
        pontos: p.pontos,
        estado: p.estado,
        // O número já normalizado por `mensagemPara`, extraído do próprio
        // link: repetir a normalização aqui seria a segunda cópia de novo.
        numero: link ? new URL(link).pathname.slice(1) : null,
        texto,
      }
    })
    // Sem número não há como enviar, e uma linha nula no meio da fila faria o
    // script parar achando que o WhatsApp falhou.
    .filter((p) => p.numero !== null)

  return NextResponse.json({
    total: fila.length,
    naoPerturbe,
    excluidos,
    fila,
  })
}
