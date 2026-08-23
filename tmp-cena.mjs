import { createClient } from '@supabase/supabase-js'
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const email = `combo-${Date.now()}@exemplo-teste.com.br`
const senha = 'Combo!' + Date.now()
const { data: u } = await s.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { name: 'Rick Cruz' } })
const { data: ws } = await s.from('workspaces').insert({ name: 'Acme Corp', plan: 'pro', created_by: u.user.id }).select('id').single()
await s.from('workspace_members').insert({ workspace_id: ws.id, user_id: u.user.id, role: 'admin' })
await s.from('onboarding_state').insert({ user_id: u.user.id, concluido_em: new Date().toISOString() }).select().maybeSingle()
await s.from('leads').insert([
  { workspace_id: ws.id, name: 'Marina Alves', company: 'Padaria Central', phone: '5511911112222', status: 'novo' },
  { workspace_id: ws.id, name: 'Rafael Santos', company: 'Clínica Vida', phone: '5511922223333', status: 'novo' },
  { workspace_id: ws.id, name: 'Bruno Teixeira', company: 'Studio Ampla', phone: '5511933334444', status: 'novo' },
])
console.log(JSON.stringify({ email, senha, ws: ws.id, user: u.user.id }))
