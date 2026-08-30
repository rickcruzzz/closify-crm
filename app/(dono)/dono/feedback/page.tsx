import { ListaDeFeedback } from '@/components/dono/lista-de-feedback'
import { lerFilaDeFeedback } from '@/lib/dono/feedback-queries'
import { lerSilenciados } from '@/lib/dono/silenciados'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/** Ver o comentário em `app/(dono)/dono/page.tsx`: monitoramento com número velho é pior que nenhum. */
export const dynamic = 'force-dynamic'

/**
 * O que os clientes escreveram de dentro do produto.
 *
 * ## Por que esta tela não substitui o e-mail
 *
 * Ela só existe em `localhost`: não avisa, precisa ser aberta. Se o dono
 * passar três dias sem abrir, um problema fica três dias sem resposta — que é
 * exatamente o defeito que o WhatsApp pagou, quando a queda de sessão *"nunca
 * chegava a ninguém: só aparecia como texto passivo em Configurações, sem
 * e-mail, sem alerta ativo"*.
 *
 * A divisão é essa: o e-mail (só para "problema") é o sino; esta tela é onde
 * se trabalha — ordena, cruza com empresa e plano, e deixa marcar o que já foi
 * tratado.
 */
export default async function PaginaDeFeedback() {
  await exigirAmbienteLocal()

  const silenciados = await lerSilenciados()
  const fila = await lerFilaDeFeedback(silenciados)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground text-sm">
          O que os clientes escreveram pelo produto. Problema primeiro, sugestão
          depois. Conferido {formatarTempoRelativo(fila.lidoEm)}.
        </p>
      </header>

      <ListaDeFeedback
        relatos={fila.relatos}
        silenciados={fila.silenciados}
        internos={fila.internos}
      />
    </div>
  )
}
