'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { CalendarDays, Loader2, Mail, Plug, Trash2, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { desconectarIntegracao, testarConexaoIntegracao } from '@/lib/integrations/actions'
import type { IntegrationProvider, IntegrationStatus } from '@/types/supabase'

const META: Record<
  IntegrationProvider,
  {
    titulo: string
    descricao: string
    icone: LucideIcon
    conectarHref: string | null
    /** Como nomear o uso pro cliente — singular e plural, linguagem dele, não termo técnico. */
    usoSingular: string
    usoPlural: string
  }
> = {
  google_calendar: {
    titulo: 'Google Calendar',
    descricao: 'Agende reuniões direto do painel do negócio.',
    icone: CalendarDays,
    conectarHref: '/api/integrations/google/connect?provider=google_calendar',
    usoSingular: 'reunião agendada',
    usoPlural: 'reuniões agendadas',
  },
  gmail: {
    titulo: 'Gmail',
    descricao: 'Envie e-mail para o lead sem sair do CRM.',
    icone: Mail,
    conectarHref: '/api/integrations/google/connect?provider=gmail',
    usoSingular: 'e-mail enviado',
    usoPlural: 'e-mails enviados',
  },
}

/**
 * Um card por integração — mesmo componente pros três provedores.
 *
 * `isAdmin` vem do servidor (a página já verificou); aqui só decide o que
 * mostrar, a régua de verdade é a RLS + a checagem repetida nas próprias
 * Server Actions (regra que só vive num lugar não é regra).
 */
export function IntegrationCard({
  provider,
  isAdmin,
  status,
  accountLabel,
  lastError,
  uso,
}: {
  provider: IntegrationProvider
  isAdmin: boolean
  status: IntegrationStatus
  accountLabel: string | null
  lastError: string | null
  /** Quantas vezes essa integração foi usada nos últimos 30 dias. */
  uso: number
}) {
  const [pendente, startTransition] = React.useTransition()
  const info = META[provider]
  const Icone = info.icone
  const conectado = status === 'connected'

  function testar() {
    startTransition(async () => {
      const resultado = await testarConexaoIntegracao(provider)
      if (resultado?.error) toast.error(resultado.error)
      else toast.success('Conexão funcionando.')
    })
  }

  function desconectar() {
    startTransition(async () => {
      const resultado = await desconectarIntegracao(provider)
      if (resultado?.error) toast.error(resultado.error)
      else toast.success(`${info.titulo} desconectado.`)
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Icone aria-hidden className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{info.titulo}</CardTitle>
            <CardDescription>{info.descricao}</CardDescription>
          </div>
        </div>
        <Badge variant={conectado ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
          {conectado ? '✓ Conectado' : status === 'error' ? 'Erro' : 'Não conectado'}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {accountLabel && <p className="text-muted-foreground text-sm">{accountLabel}</p>}

        {/* Só mostra uso pra quem já conectou — card desconectado não tem
            número nenhum pra exibir, e "0" ali só soaria vazio. */}
        {conectado && (
          <p className="text-muted-foreground text-xs">
            {uso === 0
              ? 'Nenhum uso nos últimos 30 dias.'
              : `${uso} ${uso === 1 ? info.usoSingular : info.usoPlural} nos últimos 30 dias.`}
          </p>
        )}

        {status === 'error' && lastError && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {lastError}
          </p>
        )}

        {!isAdmin ? (
          <p className="text-muted-foreground text-xs">
            Só administradores podem gerenciar integrações.
          </p>
        ) : conectado ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={testar}>
              {pendente && <Loader2 className="size-4 animate-spin" />}
              Testar conexão
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={pendente}
              onClick={desconectar}
            >
              <Trash2 className="size-4" />
              Desconectar
            </Button>
          </div>
        ) : info.conectarHref ? (
          <Button className="w-fit" size="sm" render={<a href={info.conectarHref} />}>
            <Plug className="size-4" />
            Conectar {info.titulo}
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">Em breve.</p>
        )}
      </CardContent>
    </Card>
  )
}
