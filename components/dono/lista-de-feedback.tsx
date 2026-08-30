'use client'

import * as React from 'react'
import { Bug, Lightbulb, Mail, EyeOff, Undo2 } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { silenciarAlerta, reexibirTodosOsAlertas } from '@/lib/dono/actions'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import type { RelatoNaTela } from '@/lib/dono/feedback-queries'
import { cn } from '@/lib/utils'

/**
 * A fila de relatos do cliente.
 *
 * ## Por que "problema" vem antes, sempre
 *
 * A ordem não é cronológica. Problema é alguém travado, pagando; sugestão
 * espera dias sem custo. Ordenar por data misturaria os dois e faria uma
 * sugestão de hoje empurrar para baixo um problema de ontem que ainda não foi
 * respondido — que é exatamente o item que não pode esperar.
 *
 * ## Por que silenciar existe aqui
 *
 * Mesma razão de `/dono/alertas`: fila que nunca esvazia deixa de ser fila. Um
 * relato já respondido continuar aparecendo treina a ignorar a lista inteira,
 * e junto com ele vai embora o que chegou hoje. Reusa `silenciarAlerta`, que
 * já existe e guarda id, não tipo.
 */
export function ListaDeFeedback({
  relatos,
  silenciados,
  internos,
}: {
  relatos: RelatoNaTela[]
  silenciados: number
  internos: number
}) {
  const [pendente, iniciarTransicao] = React.useTransition()

  const ordenados = React.useMemo(
    () =>
      [...relatos].sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo === 'problema' ? -1 : 1
        return b.criadoEm.localeCompare(a.criadoEm)
      }),
    [relatos],
  )

  if (relatos.length === 0) {
    return (
      <div className="border-border rounded-xl border border-dashed p-8 text-center">
        <p className="text-sm font-medium">Nenhum relato de cliente.</p>
        {/* A distinção importa: "ninguém escreveu" e "está tudo escondido" são
            estados diferentes, e confundi-los faz procurar defeito onde não há
            — o mesmo erro do painel de prazos do dashboard, que dizia "nenhum
            negócio em aberto" havendo quatro. */}
        <p className="text-muted-foreground mt-1 text-sm">
          {silenciados > 0
            ? `${silenciados} silenciado${silenciados > 1 ? 's' : ''} — nada de novo chegou.`
            : 'Ninguém escreveu ainda pelo canal do produto.'}
        </p>
        {silenciados > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={pendente}
            onClick={() => iniciarTransicao(() => void reexibirTodosOsAlertas())}
          >
            <Undo2 className="size-4" />
            Mostrar os {silenciados} silenciados
          </Button>
        )}
        {internos > 0 && (
          <p className="text-muted-foreground mt-4 text-xs">
            {internos} relato{internos > 1 ? 's' : ''} de conta interna, fora da fila.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {ordenados.map((relato) => {
        const problema = relato.tipo === 'problema'
        const Icone = problema ? Bug : Lightbulb

        return (
          <article
            key={relato.id}
            className={cn(
              'border-border bg-card flex flex-col gap-3 rounded-xl border p-4',
              // Faixa só no problema. Cor aqui É informação, não enfeite — a
              // regra que a landing seguiu em 26/08 ao remover oito matizes
              // que não codificavam nada.
              problema && 'border-l-destructive border-l-4',
            )}
          >
            <header className="flex flex-wrap items-center gap-2">
              <Icone
                aria-hidden
                className={cn('size-4 shrink-0', problema ? 'text-destructive' : 'text-primary')}
              />
              <span className="text-sm font-medium">{relato.empresa}</span>
              <span className="text-muted-foreground text-xs">
                {relato.plano === 'pro' ? 'Pro' : 'Grátis'}
              </span>
              {relato.rota && (
                <span className="text-muted-foreground font-mono text-xs">{relato.rota}</span>
              )}
              <span className="text-muted-foreground ml-auto text-xs">
                {formatarTempoRelativo(relato.criadoEm)}
              </span>
            </header>

            {/* `whitespace-pre-wrap`: o relato pode ter parágrafos, e colapsar
                as quebras transformaria um texto estruturado num bloco só —
                justamente o que precisa ser lido com atenção. */}
            <p className="text-sm whitespace-pre-wrap">{relato.mensagem}</p>

            <footer className="flex flex-wrap items-center gap-2">
              {/* Responder é a ação que esta tela existe para provocar, então
                  é o botão de destaque. `mailto` já com assunto: o atrito de
                  escrever o assunto é pequeno, mas é onde a resposta trava. */}
              {/* `buttonVariants` num `<a>` real, não `<Button asChild>`: o
                  Button deste projeto vem do Base UI e não tem `asChild`. E
                  precisa ser âncora de verdade para o `mailto` abrir o cliente
                  de e-mail. */}
              <a
                href={`mailto:${relato.email}?subject=${encodeURIComponent('Sobre o que você nos escreveu — Velo Funil')}`}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-2')}
              >
                <Mail className="size-4" />
                Responder
              </a>
              <span className="text-muted-foreground text-xs">{relato.email}</span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={pendente}
                onClick={() => iniciarTransicao(() => void silenciarAlerta(relato.id))}
              >
                <EyeOff className="size-4" />
                Já tratei
              </Button>
            </footer>
          </article>
        )
      })}

      {(silenciados > 0 || internos > 0) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
          {silenciados > 0 && (
            <button
              type="button"
              className="underline underline-offset-2"
              disabled={pendente}
              onClick={() => iniciarTransicao(() => void reexibirTodosOsAlertas())}
            >
              mostrar {silenciados} silenciado{silenciados > 1 ? 's' : ''}
            </button>
          )}
          {internos > 0 && (
            <span>
              {internos} de conta interna, fora da fila
            </span>
          )}
        </div>
      )}
    </div>
  )
}
