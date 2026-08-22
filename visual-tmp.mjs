import { createClient } from '@supabase/supabase-js'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const email = `visual-${Date.now()}@velofunil-teste.local`
const senha = `S${Math.random().toString(36).slice(2)}!aA9`
const { data: novo, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
if (error) throw error
const userId = novo.user.id
const s = createClient(URL, ANON, { auth: { persistSession: false } })
await s.auth.signInWithPassword({ email, password: senha })
const { data: wsId } = await s.rpc('create_workspace_with_admin', { workspace_name: 'Consultoria Aurora' })

const nomes = ['Marina Alves','Rafael Santos','Bruno Teixeira','Carla Dias','Diego Moraes','Elisa Prado','Felipe Nunes','Gabriela Rocha','Hugo Martins','Isabela Cruz','João Ferraz','Lívia Campos']
const etapas = ['novo','contato_realizado','proposta_enviada','negociacao']
const { data: leads } = await admin.from('leads').insert(nomes.map((n, i) => ({
  workspace_id: wsId, name: n, email: `${n.split(' ')[0].toLowerCase()}@exemplo.com.br`,
  phone: `1199${String(100000 + i * 137).slice(0, 6)}`, company: ['Padaria Central','Clínica Vida','Studio Ampla','Imobiliária Norte'][i % 4],
  status: etapas[i % 4], owner_id: userId, value: [4500, 12000, 8200, 25000, 3100, 16800][i % 6],
}))).select('id')

await admin.from('deals').insert(leads.slice(0, 9).map((l, i) => ({
  workspace_id: wsId, lead_id: l.id, title: ['Consultoria trimestral','Projeto de marca','Assessoria mensal','Pacote anual'][i % 4],
  value: [4500, 12000, 8200, 25000][i % 4], stage: etapas[i % 4], owner_id: userId,
})))

const agora = new Date()
await admin.from('tasks').insert(leads.slice(0, 5).map((l, i) => {
  const d = new Date(agora); d.setDate(d.getDate() + (i - 1)); d.setHours(9 + i, 0, 0, 0)
  return { workspace_id: wsId, lead_id: l.id, title: ['Ligar para confirmar proposta','Enviar contrato','Reunião de alinhamento','Retomar contato','Follow-up da reunião'][i],
           due_at: d.toISOString(), assignee_id: userId, created_by: userId, type: ['ligacao','email','reuniao','ligacao','nota'][i] }
}))
await admin.from('onboarding_state').upsert({ user_id: userId, status: 'completed', etapa: null }, { onConflict: 'user_id' })
console.log(JSON.stringify({ email, senha }))
