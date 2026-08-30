import { CentralDeSuporte } from '@/components/dono/central-de-suporte'
import { lerFilaDeFeedback } from '@/lib/dono/feedback-queries'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/** Ver o comentário em `app/(dono)/dono/page.tsx`: monitoramento com número velho é pior que nenhum. */
export const dynamic = 'force-dynamic'

/**
 * Central de Suporte: tudo que os clientes escreveram pelo produto.
 *
 * ## Por que esta tela não substitui o e-mail
 *
 * Ela só existe em `localhost`: não avisa, precisa ser aberta. Se passarem três
 * dias sem alguém abrir, um problema fica três dias sem resposta — o defeito
 * que o WhatsApp pagou, quando a queda de sessão *"nunca chegava a ninguém: só
 * aparecia como texto passivo em Configurações, sem e-mail, sem alerta
 * ativo"*.
 *
 * A divisão: o e-mail (só para "problema") é o sino; esta tela é onde se
 * trabalha — filtra, busca, registra o que foi feito e guarda a decisão.
 */
export default async function PaginaDeSuporte() {
  await exigirAmbienteLocal()

  const fila = await lerFilaDeFeedback()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Suporte</h1>
        <p className="text-muted-foreground text-sm">
          Tudo que veio do produto: problema, sugestão, quem escreveu e o que foi
          feito. {fila.contagem.aberto > 0
            ? `${fila.contagem.aberto} aguardando você.`
            : 'Nada aguardando.'}{' '}
          Conferido {formatarTempoRelativo(fila.lidoEm)}.
        </p>
      </header>

      <CentralDeSuporte fila={fila} />
    </div>
  )
}
