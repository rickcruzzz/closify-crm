/**
 * Acesso aos serviços reais usados pelo teste do funil completo.
 *
 * Tudo aqui fala com PRODUÇÃO: banco, Asaas e Resend. É de propósito, é o
 * padrão do projeto ("provar contra produção, não supor", CLAUDE.md). O preço
 * disso é que o teste cria estado real e precisa limpar o que criou, ver
 * `limpeza.ts`.
 *
 * As variáveis vêm do `.env.local`, carregado por
 * `node --env-file=.env.local` na hora de rodar (ver script `test:funil`),
 * mesmo mecanismo dos scripts descartáveis do projeto.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function exigir(nome: string): string {
  const valor = process.env[nome]
  if (!valor || valor.trim() === '') {
    throw new Error(
      `${nome} não está no ambiente. Rode com \`node --env-file=.env.local\` (script test:funil).`,
    )
  }
  return valor.trim()
}

/** Client com service role: enxerga tudo e ignora RLS. Só para setup/prova/limpeza. */
export function bancoAdmin(): SupabaseClient {
  return createClient(exigir('NEXT_PUBLIC_SUPABASE_URL'), exigir('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Chamada à API do Asaas.
 *
 * A chave é limpa de uma barra invertida à esquerda porque o `.env.local`
 * guarda `\$aact_prod_…`: o `$` precisa de escape em alguns shells, e o
 * `--env-file` do Node entrega a barra junto. Em produção (Vercel) o valor é
 * gravado cru e não tem esse problema, confirmado chamando `/myAccount` dos
 * dois jeitos. Sem esta linha o teste falha com 401 e parece chave revogada.
 */
export async function asaas<T>(caminho: string, init?: RequestInit): Promise<T> {
  const bruta = exigir('ASAAS_API_KEY')
  const chave = bruta.startsWith('\\') ? bruta.slice(1) : bruta

  const res = await fetch(`https://api.asaas.com/v3${caminho}`, {
    ...init,
    headers: {
      access_token: chave,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const corpo = await res.text()
  if (!res.ok) {
    throw new Error(`Asaas ${init?.method ?? 'GET'} ${caminho} => ${res.status}: ${corpo.slice(0, 300)}`)
  }
  return (corpo ? JSON.parse(corpo) : {}) as T
}

/** E-mails enviados pelo Resend, é a prova de entrega que o teste usa. */
export async function emailsEnviados(): Promise<
  { id: string; to: string[]; subject: string; last_event: string; created_at: string }[]
> {
  const res = await fetch('https://api.resend.com/emails?limit=50', {
    headers: { Authorization: `Bearer ${exigir('RESEND_API_KEY')}` },
  })
  if (!res.ok) {
    throw new Error(`Resend GET /emails => ${res.status}`)
  }
  const json = (await res.json()) as { data?: typeof emailsEnviados extends never ? never : any[] }
  return (json.data ?? []) as Awaited<ReturnType<typeof emailsEnviados>>
}

export const URL_BASE = process.env.BASE_URL ?? 'https://www.velofunil.com.br'
export const TOKEN_WEBHOOK = () => exigir('ASAAS_WEBHOOK_TOKEN')
