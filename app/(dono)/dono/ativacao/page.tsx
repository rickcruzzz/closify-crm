import { FunilDeAtivacao } from '@/components/dono/funil-de-ativacao'
import { apenasDosUltimosDias, montarFunilDeAtivacao } from '@/lib/dono/ativacao'
import { lerAtivacao } from '@/lib/dono/ativacao-queries'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/** Ver o comentário em `app/(dono)/dono/page.tsx`: monitoramento com número velho é pior que nenhum. */
export const dynamic = 'force-dynamic'

/**
 * A pergunta que o projeto não conseguia responder.
 *
 * O `CLAUDE.md` registra: *"não existe nada medindo ativação: quantos que criam
 * conta chegam ao primeiro lead é uma pergunta que hoje ninguém responde"*.
 * Esta tela responde, sem instalar rastreador nenhum — o produto já grava cada
 * degrau no banco enquanto funciona.
 *
 * Os dois recortes existem para responder coisas diferentes: **sempre** mede a
 * base inteira, **30 dias** mostra se uma mudança recente moveu a agulha. Sem o
 * recorte curto, uma melhora boa fica diluída em meses de histórico ruim e
 * ninguém consegue atribuir causa a nada.
 */
export default async function PaginaDeAtivacao() {
  await exigirAmbienteLocal()

  const { contas, excluidas, lidoEm } = await lerAtivacao()

  const funilTotal = montarFunilDeAtivacao(contas)
  const recentes = apenasDosUltimosDias(contas, 30)
  const funilRecente = montarFunilDeAtivacao(recentes)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ativação</h1>
        <p className="text-muted-foreground text-sm">
          Quantos que criam conta chegam a usar o produto de verdade, e onde desistem. Conferido{' '}
          {formatarTempoRelativo(lidoEm)}.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">Desde sempre</h2>
          <span className="text-muted-foreground text-sm tabular-nums">
            {contas.length} {contas.length === 1 ? 'cliente externo' : 'clientes externos'}
          </span>
        </div>
        <FunilDeAtivacao funil={funilTotal} excluidas={excluidas} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">Últimos 30 dias</h2>
          <span className="text-muted-foreground text-sm tabular-nums">
            {recentes.length} {recentes.length === 1 ? 'conta' : 'contas'}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Este recorte é o que permite dizer se uma mudança funcionou. Compare com o número de
          cima depois de mexer no produto — na base inteira, uma melhora recente fica diluída em
          meses de histórico e ninguém consegue atribuir causa a nada.
        </p>
        <FunilDeAtivacao funil={funilRecente} excluidas={0} />
      </section>
    </div>
  )
}
