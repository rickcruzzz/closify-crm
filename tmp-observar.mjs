import { createClient } from '@supabase/supabase-js'
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const WS = '5ff1e479-efe1-42f7-8fe3-0bb7d519a5a1'
const base = {}
for (const t of ['leads', 'activities', 'tasks']) {
  const { count } = await s.from(t).select('*', { count: 'exact', head: true }).eq('workspace_id', WS)
  base[t] = count ?? 0
}
console.log('antes -> contatos:', base.leads, '| atividades:', base.activities, '| tarefas:', base.tasks)
console.log('aguardando mensagem de fora (10 min)...\n')
for (let i = 0; i < 120; i++) {
  await new Promise(r => setTimeout(r, 5000))
  const agora = {}
  for (const t of ['leads', 'activities', 'tasks']) {
    const { count } = await s.from(t).select('*', { count: 'exact', head: true }).eq('workspace_id', WS)
    agora[t] = count ?? 0
  }
  if (agora.activities > base.activities || agora.leads > base.leads) {
    console.log('>>> CHEGOU em ' + new Date().toISOString().slice(11, 19))
    console.log('    contatos', base.leads, '->', agora.leads, '| atividades', base.activities, '->', agora.activities, '| tarefas', base.tasks, '->', agora.tasks)
    const { data: at } = await s.from('activities').select('description, integration_provider, created_at').eq('workspace_id', WS).order('created_at', { ascending: false }).limit(3)
    for (const a of at ?? []) console.log('    atividade:', a.integration_provider, '|', String(a.description).slice(0, 80))
    const { data: tk } = await s.from('tasks').select('title, due_at, done_at').eq('workspace_id', WS).is('done_at', null).order('created_at', { ascending: false }).limit(3)
    for (const k of tk ?? []) console.log('    tarefa:', k.title, '| prazo:', String(k.due_at).slice(0, 16))
    const { data: ld } = await s.from('leads').select('name, phone').eq('workspace_id', WS).order('created_at', { ascending: false }).limit(2)
    for (const l of ld ?? []) console.log('    contato:', l.name, '|', l.phone)
    break
  }
}
console.log('\nfim da observacao')
