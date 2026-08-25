import { Clock, Mail, MessageCircle, TrendingUp, UserX, Zap } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import {
  linkDeWhatsapp,
  type EmpresaClassificada,
  type SituacaoNoTrial,
} from '@/lib/dono/trial'
import { cn } from '@/lib/utils'

import { MarcarQueFalei } from './marcar-que-falei'

/**
 * A fila de quem está decidindo, ordenada por quem merece o contato primeiro.
 *
 * ## Por que cartão, e não tabela
 *
 * A Central já tem tabela de clientes, e ela está certa lá: aquela tela é para
 * VARRER a base. Esta é para AGIR sobre três ou quatro linhas, e cada linha
 * carrega um botão que abre o WhatsApp de uma pessoa real. Numa tabela, a ação
 * vira uma coluna estreita no fim da linha, longe do contexto que justifica
 * clicá-la.
 */

const APARENCIA: Record<
  SituacaoNoTrial,
  { rotulo: string; icone: typeof Zap; classe: string }
> = {
  engajado: {
    rotulo: 'Usando',
    icone: TrendingUp,
    classe: 'bg-emerald-500/15 text-emerald-500',
  },
  esfriou: {
    rotulo: 'Esfriou',
    icone: Clock,
    classe: 'bg-amber-500/15 text-amber-500',
  },
  nunca_usou: {
    rotulo: 'Não usou',
    icone: UserX,
    classe: 'bg-muted text-muted-foreground',
  },
}

function Prazo({ dias }: { dias: number }) {
  const inteiro = Math.max(0, Math.floor(dias))
  const acabando = dias < 2

  return (
    <span
      className={cn(
        'shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums',
        acabando ? 'bg-red-500/15 text-red-500' : 'bg-muted text-muted-foreground',
      )}
    >
      {dias < 0
        ? 'venceu'
        : inteiro === 0
          ? 'acaba hoje'
          : `${inteiro} ${inteiro === 1 ? 'dia' : 'dias'}`}
    </span>
  )
}

/**
 * A nota do filtro.
 *
 * Filtro invisível é filtro em que ninguém confia — e este muda o número que
 * decide a quem ligar. Aparece sempre que houver algo escondido, inclusive (e
 * principalmente) quando a lista visível está vazia: sem ela, "ninguém em
 * trial" e "quatro contas de teste em trial" seriam a mesma tela.
 */
function NotaDoFiltro({ quantas }: { quantas: number }) {
  if (quantas === 0) return null

  return (
    <p className="text-muted-foreground text-xs">
      {quantas} {quantas === 1 ? 'conta de teste' : 'contas de teste'} em trial{' '}
      {quantas === 1 ? 'ficou' : 'ficaram'} de fora: domínio descartável ou e-mail seu, na
      lista de <code className="text-[0.9em]">lib/dono/contas-internas.ts</code>.
    </p>
  )
}

export function QuemEstaDecidindo({
  empresas,
  escondidas,
}: {
  empresas: EmpresaClassificada[]
  escondidas: number
}) {
  if (empresas.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Card className="text-muted-foreground p-6 text-sm">
          Nenhum cliente externo em trial agora. Quando alguém de fora criar conta, aparece
          aqui com sete dias de prazo, o que já fez no produto e como falar com a pessoa.
        </Card>
        <NotaDoFiltro quantas={escondidas} />
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {empresas.map((empresa) => {
        const { rotulo, icone: Icone, classe } = APARENCIA[empresa.situacao]
        const zap = linkDeWhatsapp(empresa.whatsapp, empresa.nome)

        return (
          <li key={empresa.workspaceId}>
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{empresa.nome}</span>
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                    classe,
                  )}
                >
                  <Icone aria-hidden className="size-3" />
                  {rotulo}
                </span>
                <span className="grow" />
                <Prazo dias={empresa.diasRestantes} />
              </div>

              <p className="text-sm">{empresa.acao}</p>

              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                <span>
                  {empresa.contatos} {empresa.contatos === 1 ? 'contato' : 'contatos'}
                </span>
                <span>
                  {empresa.negocios} {empresa.negocios === 1 ? 'negócio' : 'negócios'}
                </span>
                <span>
                  {empresa.ultimaAtividade
                    ? `ativo ${formatarTempoRelativo(empresa.ultimaAtividade)}`
                    : 'nunca entrou'}
                </span>
                {empresa.faladoEm ? (
                  <span className="text-emerald-500">
                    você falou {formatarTempoRelativo(empresa.faladoEm)}
                  </span>
                ) : null}
              </div>

              {/* Os dois caminhos de contato ficam lado a lado e sempre
                  visíveis. Esconder atrás de um menu poupa pixel e custa a
                  única coisa que esta tela existe para provocar. */}
              <div className="flex flex-wrap gap-2">
                {zap ? (
                  <a
                    href={zap}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-border hover:bg-accent focus-visible:ring-ring/50 flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3"
                  >
                    <MessageCircle aria-hidden className="size-3.5" />
                    WhatsApp
                  </a>
                ) : null}
                {empresa.emailDoDono ? (
                  <a
                    href={`mailto:${empresa.emailDoDono}`}
                    className="border-border hover:bg-accent focus-visible:ring-ring/50 flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3"
                  >
                    <Mail aria-hidden className="size-3.5" />
                    {empresa.emailDoDono}
                  </a>
                ) : (
                  <span className="text-muted-foreground self-center text-xs">
                    Sem e-mail do dono, conta órfã.
                  </span>
                )}
                <span className="grow" />
                <MarcarQueFalei
                  workspaceId={empresa.workspaceId}
                  nome={empresa.nome}
                  faladoEm={empresa.faladoEm}
                />
              </div>
            </Card>
          </li>
        )
      })}
      {escondidas > 0 ? (
        <li className="pt-1">
          <NotaDoFiltro quantas={escondidas} />
        </li>
      ) : null}
    </ul>
  )
}
