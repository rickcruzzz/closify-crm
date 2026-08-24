import { Clock, Sparkles } from 'lucide-react'

import { SubscribeButton } from '@/components/settings/subscribe-button'
import { estadoDoTrial, textoDoAviso } from '@/lib/plans/trial'
import { cn } from '@/lib/utils'

/**
 * A faixa que avisa sobre o fim do trial.
 *
 * ## Por que só aparece nos últimos 3 dias
 *
 * Faixa permanente vira paisagem. Nos primeiros dias a pessoa está avaliando —
 * importando contatos, conectando o WhatsApp — e cobrar decisão nessa hora
 * atrapalha justamente a experiência que precisa convencê-la. Ver
 * `AVISAR_A_PARTIR_DE` em `lib/plans/trial.ts`.
 *
 * ## Por que o botão de assinar vem junto
 *
 * Sem ele, o caminho até o pagamento é Configurações → Plano → Assinar → CPF —
 * quatro passos depois de a pessoa já ter decidido. Cada passo perde gente, e
 * este componente aparece exatamente no momento em que a decisão está sendo
 * tomada. O `SubscribeButton` é o mesmo da tela de Plano, não uma cópia: a
 * validação de CPF e o fluxo do Asaas vivem num lugar só.
 *
 * ## Por que não tem botão de fechar
 *
 * "Dispensar" faria a faixa sumir justamente para quem está adiando a decisão —
 * que é quem ela existe para alcançar. Ela some sozinha quando a pessoa assina
 * (`estadoDoTrial` devolve `sem_trial` para quem tem assinatura ativa) ou
 * quando o trial acaba e ela decide ficar no Free.
 */
export function AvisoDeTrial({
  trialAte,
  assinaturaAtiva,
}: {
  trialAte: string | null
  assinaturaAtiva: boolean
}) {
  const estado = estadoDoTrial(trialAte, assinaturaAtiva)
  const texto = textoDoAviso(estado)

  if (!texto) return null

  const acabou = estado.tipo === 'acabou'
  const ultimoDia = estado.tipo === 'em_trial' && estado.diasRestantes === 1

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6',
        acabou || ultimoDia
          ? 'border-amber-500/30 bg-amber-500/10'
          : 'border-primary/20 bg-primary/5',
      )}
    >
      <div className="flex items-start gap-3">
        {acabou ? (
          <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
        )}
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">{texto.titulo}</p>
          <p className="text-muted-foreground text-sm">{texto.detalhe}</p>
        </div>
      </div>

      <SubscribeButton className="w-full shrink-0 sm:w-fit" />
    </div>
  )
}
