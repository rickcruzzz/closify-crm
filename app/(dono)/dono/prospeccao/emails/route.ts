import { NextResponse } from 'next/server'

import { carregarPrateleira } from '@/lib/dono/prateleira-queries'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'
import { assuntoPara, conferirConformidade, corpoDoEmail } from '@/lib/prospeccao/email-copy'
import { prepararFila, tetoDoDia } from '@/lib/prospeccao/email-frio'
import { hashDoToken, tokenDeSaida } from '@/lib/prospeccao/descadastro'
import { chaveDeEmail } from '@/lib/prospeccao/opt-out'
import { CONTROLADOR } from '@/lib/legal'

/**
 * A fila do e-mail frio, com assunto e corpo prontos.
 *
 * ## Por que uma rota, e não o script montando o texto
 *
 * A mesma razão que `fila/route.ts` já documenta, e aqui ela é mais forte:
 * `email-copy.ts` importa `@/lib/legal` e `@/lib/plans`, e o alias `@/` não
 * resolve num `.mjs` rodado por `node` — medido em 12/09, o import falha com
 * `Cannot find package '@/lib'`.
 *
 * As alternativas eram piores. Reescrever o corpo no script é a armadilha que
 * este projeto registra em letras grandes — *"duas cópias divergem, e a que
 * diverge em silêncio é a que você escreveu"* —, e o que divergiria aqui é o
 * **texto que vai para o cliente**, junto com o CNPJ e o link de saída que a
 * LGPD exige. Um loader de paths seria uma dependência nova para um problema
 * que uma rota de 60 linhas resolve.
 *
 * ## O token de saída nasce AQUI, e é por isso que ele pode nascer
 *
 * `tokenDeSaida` exige o tempero, que vem do ambiente e não tem padrão — valor
 * embutido no código seria o mesmo que não ter tempero, porque o código está no
 * Git. A rota roda com o `.env.local` carregado; o script não precisa conhecer
 * o segredo.
 *
 * ## Ela é LEITURA, e o gate é o da Central inteira
 *
 * Não envia, não marca, não grava. `exigirAmbienteLocal()` devolve 404 fora de
 * `localhost` — e aqui isso protege mais que a Central: a resposta carrega 644
 * endereços de e-mail de empresas que nunca ouviram falar do produto.
 */
export async function GET(request: Request) {
  await exigirAmbienteLocal()

  const tempero = process.env.PROSPECCAO_TEMPERO
  if (!tempero) {
    return NextResponse.json(
      {
        erro:
          'falta PROSPECCAO_TEMPERO. Sem ele o link de saída é adivinhável, e quem obtivesse ' +
          'a tabela reconstruiria a lista testando endereços conhecidos contra os hashes.',
      },
      { status: 503 },
    )
  }

  const { prospects } = await carregarPrateleira()

  // O e-mail alcança quem o WhatsApp não alcança: a prateleira inteira, e não
  // só quem tem telefone. São 66 empresas que hoje são inalcançáveis.
  const comEmail = prospects
    .filter((p) => p.email)
    .map((p) => ({ email: p.email!, empresa: p.nome, dominio: p.dominio }))

  const preparada = prepararFila(comEmail)

  // `prepararFila` devolve `Destinatario`, que não carrega o domínio. O mapa
  // devolve, e é ele que permite o opt-out por domínio e o texto por empresa.
  const porEmail = new Map(comEmail.map((c) => [c.email, c]))

  const dia = Number(new URL(request.url).searchParams.get('dia') ?? '1')

  const fila = preparada.fila.map((d) => {
    const dados = porEmail.get(d.email)
    const dominio = dados?.dominio ?? ''
    const token = tokenDeSaida(d.email, tempero)
    return {
      email: d.email,
      dominio,
      nome: dados?.empresa ?? null,
      assunto: assuntoPara(dominio, dados?.empresa),
      corpo: corpoDoEmail({
        dominio,
        nomeDaEmpresa: dados?.empresa,
        tokenDeSaida: token,
        urlDoProduto: CONTROLADOR.site,
      }),
      // A chave que a tabela guarda: `hashDoToken` é derivado do TOKEN, não do
      // e-mail, e é por isso que a rota de saída consegue gravar sabendo só o
      // token, sem nunca ver o endereço de quem clicou. O script confere
      // contra ela sem conhecer o tempero.
      chaveDoDescadastro: chaveDeEmail(hashDoToken(token)),
    }
  })

  // Conferido no primeiro corpo: as três exigências da LGPD são invisíveis
  // quando faltam. O e-mail sai, chega, e só vira problema quando alguém
  // reclama — um erro aqui é mais barato que uma denúncia à ANPD.
  let conformidade = 'ok'
  if (fila[0]) {
    try {
      conferirConformidade(fila[0].corpo)
    } catch (e) {
      conformidade = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json({
    total: fila.length,
    pessoais: preparada.pessoais,
    papel: preparada.papel,
    recusados: preparada.recusados,
    repetidos: preparada.repetidos,
    dia,
    tetoDoDia: tetoDoDia(dia),
    conformidade,
    fila,
  })
}
