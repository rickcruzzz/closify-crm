import { ListaDeAlertas } from '@/components/dono/lista-de-alertas'
import { lerCentral } from '@/lib/dono/central'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/** Ver o comentário em `app/(dono)/dono/page.tsx`: monitoramento com número velho é pior que nenhum. */
export const dynamic = 'force-dynamic'

export default async function PaginaDeAlertas() {
  await exigirAmbienteLocal()

  const dados = await lerCentral()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        <p className="text-muted-foreground text-sm">
          O que está errado agora, em ordem do que custa mais caro ficar parado. Conferido{' '}
          {formatarTempoRelativo(dados.lidoEm)}.
        </p>
      </header>


      <ListaDeAlertas pendencias={dados.pendencias} silenciadas={dados.silenciadas} />

    </div>
  )
}
