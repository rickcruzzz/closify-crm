import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Execute após todas as migrations: node --env-file=.env.local scripts/supabase/criar-login-enterprise.mjs
// Requer CLIENTE_ENTERPRISE_EMAIL. Aceita CLIENTE_ENTERPRISE_SENHA local.
const projetoUrl = process.env.CLIENTE_SUPABASE_URL ?? process.env.url_supabase
const chaveServico = process.env.CLIENTE_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.supabase_secret_key ?? process.env.supabasase_service_role_key
const chavePublica = process.env.CLIENTE_SUPABASE_ANON_KEY ??
  process.env.supabase_public_key ?? process.env.supbasae_anon_public_key
const email = process.env.CLIENTE_ENTERPRISE_EMAIL?.trim().toLowerCase()
const empresa = process.env.CLIENTE_ENTERPRISE_EMPRESA?.trim() || 'Cliente Enterprise'

if (!projetoUrl || !chaveServico || !chavePublica || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Configure URL, chave pública, chave de serviço e CLIENTE_ENTERPRISE_EMAIL válido.')
}
if (empresa.length > 120) throw new Error('Nome da empresa muito longo.')
const url = new URL(projetoUrl)
if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) {
  throw new Error('URL do projeto Enterprise inválida.')
}

const supabase = createClient(url.origin, chaveServico, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: concessoes, error: erroConcessoes } = await supabase
  .from('enterprise_workspaces').select('workspace_id').eq('active', true).limit(1)
if (erroConcessoes) throw new Error(`Esquema Enterprise indisponível: ${erroConcessoes.message}`)
if (concessoes?.length) throw new Error('Já existe um cliente Enterprise ativo. Nenhuma conta foi criada.')

const senhaInformada = process.env.CLIENTE_ENTERPRISE_SENHA
const senha = senhaInformada || randomBytes(24).toString('base64url')
if (senha.length < 8 || senha.length > 72) throw new Error('A senha Enterprise precisa ter de 8 a 72 caracteres.')
const { data: usuario, error: erroUsuario } = await supabase.auth.admin.createUser({
  email, password: senha, email_confirm: true,
})
if (erroUsuario || !usuario.user) throw new Error(`Não foi possível criar o usuário: ${erroUsuario?.message ?? 'sem retorno'}`)

let workspaceId
try {
  // A mesma RPC do produto cria empresa, dono e trial de modo atômico.
  const comoDono = createClient(url.origin, chavePublica, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: erroLogin } = await comoDono.auth.signInWithPassword({ email, password: senha })
  if (erroLogin) throw new Error(`Sessão inicial: ${erroLogin.message}`)
  const { data: workspace, error: erroWorkspace } = await comoDono.rpc(
    'create_workspace_with_admin', { workspace_name: empresa },
  )
  if (erroWorkspace || !workspace) throw new Error(`Empresa: ${erroWorkspace?.message ?? 'sem retorno'}`)
  workspaceId = workspace

  const { error: erroOnboarding } = await supabase.from('onboarding_state').upsert(
    { user_id: usuario.user.id, status: 'completed', etapa: null, tour_status: 'skipped' },
    { onConflict: 'user_id' },
  )
  if (erroOnboarding) throw new Error(`Onboarding: ${erroOnboarding.message}`)

  const { error: erroEnterprise } = await supabase.from('enterprise_workspaces').insert({
    workspace_id: workspaceId, active: true,
  })
  if (erroEnterprise) throw new Error(`Enterprise: ${erroEnterprise.message}`)
} catch (erro) {
  if (workspaceId) await supabase.from('workspaces').delete().eq('id', workspaceId)
  await supabase.auth.admin.deleteUser(usuario.user.id)
  throw erro
}

process.stdout.write(`Login Enterprise criado para ${email}.\n`)
process.stdout.write(`Empresa: ${empresa}; workspace: ${workspaceId}.\n`)
if (!senhaInformada) process.stdout.write(`Senha temporária gerada: ${senha}\n`)
