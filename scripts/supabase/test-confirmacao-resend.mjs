import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

// Usa exclusivamente o destinatário de teste documentado pelo Resend.
// Não envia e-mail para clientes e remove somente a conta criada nesta prova.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
assert.equal(new URL(url).hostname, 'iixntnabssiwoixkvica.supabase.co')
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
const resend = process.env.RESEND_API_KEY
assert(anon && admin && resend, 'Credenciais de teste indisponíveis.')
const email = 'delivered@resend.dev'
const password = randomBytes(24).toString('base64url')
const inicio = Date.now()
let criado

async function auth(path, { privileged = false, body, method = 'GET' } = {}) {
  const key = privileged ? admin : anon
  const response = await fetch(`${url}/auth/v1${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
  })
  const data = await response.json()
  return { ok: response.ok, status: response.status, data }
}

async function resendGet(path) {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${resend}` },
    signal: AbortSignal.timeout(20_000),
  })
  assert(response.ok, `Consulta de teste Resend: HTTP ${response.status}.`)
  return response.json()
}

const existing = await auth('/admin/users?page=1&per_page=1000', { privileged: true })
assert(existing.ok, 'Não foi possível verificar as contas de teste existentes.')
assert(
  !existing.data.users?.some((user) => user.email === email),
  'Destinatário de teste já cadastrado; nenhuma conta foi alterada.',
)

try {
  const signup = await auth(
    '/signup?redirect_to=https%3A%2F%2Fvelofunil.com.br%2Fconfirmar',
    {
      method: 'POST',
      body: { email, password, data: { name: 'Prova de confirmação Resend' } },
    },
  )
  assert(
    signup.ok,
    `Cadastro de prova: HTTP ${signup.status}; código ${signup.data.code ?? signup.data.error_code ?? 'indisponível'}.`,
  )
  const user = signup.data.user ?? signup.data
  assert(user.id && user.email === email)
  criado = user.id
  assert(
    !user.email_confirmed_at && !signup.data.access_token,
    'Cadastro não pode confirmar o e-mail automaticamente.',
  )
  const antes = await auth('/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  })
  assert(
    !antes.ok &&
      (antes.data.error_code === 'email_not_confirmed' ||
        antes.data.code === 'email_not_confirmed'),
  )
  console.log('PASS acesso bloqueado antes da confirmação de e-mail')

  let message
  for (let tentativa = 0; tentativa < 6 && !message; tentativa++) {
    if (tentativa) await new Promise((resolve) => setTimeout(resolve, 2_000))
    const list = await resendGet('/emails?limit=100')
    message = list.data?.find(
      (entry) =>
        entry.to?.includes(email) && Date.parse(entry.created_at) >= inicio - 1000,
    )
  }
  assert(message, 'Confirmação de teste não apareceu no Resend.')
  const content = await resendGet(`/emails/${message.id}`)
  assert.match(content.from, /suporte@velofunil\.com\.br/)
  const match = content.html?.match(/href="([^"]*token_hash=[^"]*)"/)
  assert(match, 'E-mail de prova não trouxe o link seguro de confirmação.')
  const link = new URL(match[1].replaceAll('&amp;', '&'))
  assert.equal(link.origin, 'https://velofunil.com.br')
  assert.equal(link.pathname, '/confirmar')
  assert.equal(link.searchParams.get('type'), 'signup')
  console.log(
    'PASS confirmação enviada pelo Resend com remetente e domínio de produção corretos',
  )

  const confirmation = await auth('/verify', {
    method: 'POST',
    body: { token_hash: link.searchParams.get('token_hash'), type: 'signup' },
  })
  assert(confirmation.ok, 'Link de prova não confirmou o endereço.')
  const depois = await auth('/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  })
  assert(depois.ok && depois.data.access_token, 'Login não liberado após confirmação.')
  console.log('PASS confirmação do link libera o login')
} finally {
  if (criado) {
    const deleted = await auth(`/admin/users/${criado}`, {
      privileged: true,
      method: 'DELETE',
    })
    assert(deleted.ok, 'A conta criada pela prova precisa de limpeza manual.')
    console.log('Conta temporária de teste removida; contas de clientes preservadas.')
  }
}
