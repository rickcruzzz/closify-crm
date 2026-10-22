import { readFile, writeFile } from 'node:fs/promises'

const aplicar = process.argv.includes('--apply')
if (aplicar === process.argv.includes('--plan'))
  throw new Error('Escolha --plan ou --apply.')
const ref = 'iixntnabssiwoixkvica'
const token = process.env.CLIENTE_SUPABASE_ACCESS_TOKEN
const resend = process.env.RESEND_API_KEY
const destino = new URL(
  process.env.CLIENTE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
)
if (destino.hostname !== `${ref}.supabase.co`)
  throw new Error('Projeto Enterprise incorreto.')
if (!token || !resend)
  throw new Error('Faltam as credenciais de gerenciamento ou Resend.')
if (aplicar && !process.argv.includes(`--confirm-ref=${ref}`))
  throw new Error('Confirme o projeto Enterprise.')

async function api(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Configuração Enterprise: HTTP ${response.status}.`)
  return response.json()
}

const [anterior, template] = await Promise.all([
  api('/config/auth'),
  readFile(
    new URL('../../supabase/email-templates/confirmacao-cadastro.html', import.meta.url),
    'utf8',
  ),
])
const dominios = await fetch('https://api.resend.com/domains', {
  headers: { Authorization: `Bearer ${resend}` },
  signal: AbortSignal.timeout(20_000),
})
if (!dominios.ok) throw new Error(`Verificação Resend: HTTP ${dominios.status}.`)
const lista = await dominios.json()
if (
  !lista.data?.some(
    (domain) => domain.name === 'velofunil.com.br' && domain.status === 'verified',
  )
) {
  throw new Error('Domínio de envio ainda não está verificado no Resend.')
}

const redirects = new Set((anterior.uri_allow_list ?? '').split(',').filter(Boolean))
for (const url of [
  'https://velofunil.com.br/**',
  'https://www.velofunil.com.br/**',
  'https://crm-mega.netlify.app/**',
])
  redirects.add(url)
const alteracoes = {
  site_url: 'https://velofunil.com.br',
  uri_allow_list: [...redirects].join(','),
  external_email_enabled: true,
  mailer_autoconfirm: false,
  smtp_admin_email: 'suporte@velofunil.com.br',
  smtp_sender_name: 'Velo Funil',
  smtp_host: 'smtp.resend.com',
  smtp_port: '465',
  smtp_user: 'resend',
  smtp_pass: resend,
  mailer_subjects_confirmation: 'Confirme seu e-mail no Velo Funil',
  mailer_templates_confirmation_content: template,
}
console.log(
  JSON.stringify({
    projeto: ref,
    confirmacaoObrigatoria: true,
    remetente: alteracoes.smtp_admin_email,
    envio: alteracoes.smtp_host,
    site: alteracoes.site_url,
    aplicar,
  }),
)
if (!aplicar) process.exit(0)

const backup = Object.fromEntries(
  Object.keys(alteracoes).map((key) => [key, anterior[key] ?? null]),
)
try {
  await writeFile(
    new URL('../../.env.enterprise-auth-before.local', import.meta.url),
    JSON.stringify(backup, null, 2),
    { flag: 'wx', mode: 0o600 },
  )
} catch (error) {
  if (error.code !== 'EEXIST') throw error
}
await api('/config/auth', { method: 'PATCH', body: JSON.stringify(alteracoes) })
const final = await api('/config/auth')
for (const [key, value] of Object.entries(alteracoes)) {
  if (key === 'smtp_pass') continue // A API pode devolver a senha mascarada.
  if (String(final[key]) !== String(value))
    throw new Error(`Configuração não confirmada: ${key}.`)
}
console.log(
  'Confirmado: e-mail obrigatório, envio pelo Resend e links no domínio de produção.',
)
