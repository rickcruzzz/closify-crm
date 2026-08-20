'use client'

import * as React from 'react'
import { Activity, ChevronDown, Mail } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { formatarDataComHora } from '@/lib/dono/formato'
import type { EmailEnviado, Resultado } from '@/lib/dono/tipos'
import { cn } from '@/lib/utils'

/**
 * Saúde do sistema: os e-mails que saíram e se chegaram.
 *
 * ## Por que recolhido por padrão
 *
 * É informação de diagnóstico, não de decisão. Quando algo dá errado aqui, o
 * item já sobe para a fila de "precisa da sua atenção" no topo da tela — este
 * bloco existe para quem quiser conferir o detalhe depois de ver o alerta, ou
 * para uma passada de olho ocasional. Aberto por padrão, empurraria o que
 * importa para baixo da dobra todos os dias em troca de nada.
 *
 * ## Por que e-mail é o que está aqui
 *
 * Porque é o ponto cego mais caro do produto. Confirmação de cadastro,
 * recuperação de senha e convite de colaborador passam todos por e-mail, e um
 * que não chega não gera erro em lugar nenhum: a pessoa simplesmente não volta,
 * o que é indistinguível de desistência.
 */
export function BlocoDeSaude({ emails }: { emails: Resultado<EmailEnviado[]> }) {
  const [aberto, setAberto] = React.useState(false)

  const falhados = emails.ok
    ? emails.dados.filter((e) => !e.chegou && e.ultimoEvento !== 'sent').length
    : 0

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setAberto((antes) => !antes)}
        className="hover:text-foreground text-muted-foreground flex cursor-pointer items-center gap-2 text-sm font-medium transition-colors"
        aria-expanded={aberto}
      >
        <Activity aria-hidden className="size-4" />
        Saúde do sistema
        {falhados > 0 && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
            {falhados} e-mail(s) com problema
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={cn('size-4 transition-transform duration-micro', aberto && 'rotate-180')}
        />
      </button>

      {aberto && (
        <Card size="sm">
          <CardContent className="py-4">
            {!emails.ok ? (
              <p className="text-muted-foreground text-sm">{emails.erro}</p>
            ) : emails.dados.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum e-mail enviado ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {emails.dados.map((email) => (
                  <li key={email.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Mail
                        aria-hidden
                        className={cn(
                          'size-4 shrink-0',
                          email.chegou ? 'text-emerald-500' : 'text-amber-500',
                        )}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{email.assunto}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {email.para}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span
                        className={cn(
                          'text-xs',
                          email.chegou ? 'text-muted-foreground' : 'text-amber-500',
                        )}
                      >
                        {email.chegou ? 'chegou' : email.ultimoEvento}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatarDataComHora(email.enviadoEm)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
