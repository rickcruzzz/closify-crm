import { QuemEstaDecidindo } from '@/components/dono/quem-esta-decidindo'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'
import { ordenarPorPrioridade } from '@/lib/dono/trial'
import { lerQuemEstaEmTrial } from '@/lib/dono/trial-queries'

/** Ver o comentário em `app/(dono)/dono/page.tsx`: monitoramento com número velho é pior que nenhum. */
export const dynamic = 'force-dynamic'

/**
 * Quem está decidindo agora.
 *
 * ## A lacuna que esta tela fecha
 *
 * A Central sabia **operar** (alertas, dinheiro, consertar assinatura) e sabia
 * **medir** (o funil de ativação agregado). Não sabia responder a pergunta que
 * gera receita: *quem está decidindo neste momento, e como falo com essa
 * pessoa?*
 *
 * Medido em 25/08, antes de existir: **5 empresas em trial ao mesmo tempo**,
 * nenhuma visível em qualquer tela. Sete dias correndo, e nenhuma delas
 * apareceria em lugar nenhum até virar estatística de "não converteu".
 *
 * ## Por que ela vem antes de Ativação na navegação
 *
 * A ordem da Central é a da rotina: primeiro o que quebrou (Alertas), depois
 * quem está decidindo hoje (esta), depois se as pessoas em geral ativam
 * (Ativação), e só então quanto custa trazer mais gente (Anúncio). O funil
 * agregado responde "o produto convence?"; esta responde "e a Maria, que
 * cadastrou doze contatos anteontem e some depois de amanhã?". A segunda é
 * acionável hoje; a primeira orienta o mês.
 */
export default async function PaginaDeTrial() {
  await exigirAmbienteLocal()

  const { empresas, escondidas, lidoEm } = await lerQuemEstaEmTrial()
  const fila = ordenarPorPrioridade(empresas)

  const usando = fila.filter((e) => e.situacao === 'engajado').length
  const acabando = fila.filter((e) => e.diasRestantes < 2).length

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Decidindo agora</h1>
        <p className="text-muted-foreground text-sm">
          Quem está dentro dos sete dias de Pro liberado, o que já fez no produto e como
          falar com a pessoa. Conferido {formatarTempoRelativo(lidoEm)}.
        </p>
      </header>

      {fila.length > 0 ? (
        <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
          <span>
            <span className="text-foreground font-semibold">{fila.length}</span> em trial
          </span>
          <span>
            <span className="text-foreground font-semibold">{usando}</span> usando de verdade
          </span>
          {acabando > 0 ? (
            <span className="text-red-500">
              <span className="font-semibold">{acabando}</span> acabando em menos de 2 dias
            </span>
          ) : null}
        </div>
      ) : null}

      <QuemEstaDecidindo empresas={fila} escondidas={escondidas} />

      {/* A ordem não é óbvia olhando a lista, e um painel cuja ordenação
          ninguém entende vira uma lista que se lê de cima a baixo — o que
          desperdiça justamente o trabalho de priorizar. */}
      {fila.length > 1 ? (
        <p className="text-muted-foreground border-border/60 border-t pt-4 text-xs">
          A ordem põe <strong className="text-foreground">quem usou</strong> antes de quem
          está acabando: uma empresa engajada com cinco dias pela frente vale mais que uma
          que nunca abriu o produto e vence amanhã — a segunda não tem o que decidir,
          porque não viu nada para decidir. Dentro do mesmo grupo, quem está mais perto do
          fim aparece primeiro.
        </p>
      ) : null}
    </div>
  )
}
