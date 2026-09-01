/**
 * O cenário de demonstração do produto: uma empresa fictícia com funil cheio.
 *
 * ## Por que isto virou módulo em 01/09
 *
 * Ele nasceu dentro de `scripts/capturar-prints-do-produto.mjs`, que recaptura
 * as imagens da landing. Quando o catálogo de telas para material de marketing
 * passou a precisar do MESMO cenário, havia duas saídas: copiar as ~90 linhas
 * ou extraí-las.
 *
 * Copiar é o defeito que este projeto já pagou várias vezes — duas cópias
 * divergem no primeiro ajuste, e aqui a divergência seria pior que o normal:
 * os prints da landing e o catálogo do designer passariam a mostrar produtos
 * ligeiramente diferentes, sem nada avisar.
 *
 * ## Por que uma conta descartável, e NUNCA produção
 *
 * As telas mostram nome, empresa, telefone e valor de negócio. Printar a conta
 * de um cliente real publicaria dado pessoal de terceiro — é tratamento de
 * dado sem base legal (LGPD), não um detalhe de zelo.
 *
 * `apagarCenario` roda num `finally` em ambos os consumidores, e a limpeza
 * defensiva de `criarCenario` cobre o caso em que uma execução anterior morreu
 * antes disso (Ctrl+C, queda do servidor).
 */
import { createClient } from '@supabase/supabase-js'

export const SENHA = 'CapturaDePrints2026!'

/**
 * Este endereço aparece NO PRINT, no rodapé da barra lateral: o menu de
 * usuário mostra o e-mail de login, não um campo de perfil. Um
 * `captura-1787477116800@…` truncado denuncia a captura sintética e parece
 * defeito para quem está decidindo se cria a conta.
 */
export const EMAIL = 'rick@acmecorp.com.br'

/** Fixo, e usado pela limpeza defensiva para achar empresa de execução morta. */
export const NOME_DA_EMPRESA = 'Acme Corp'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const hora = (h) => new Date(Date.now() + h * 3600000).toISOString()

/** Cria a empresa fictícia. Devolve os ids para o `finally` de quem chamou. */
export async function criarCenario() {
  let userId = null
  let workspaceId = null

const email = EMAIL

  // ## A limpeza defensiva procura por NOME, não só por dono
  //
  // Procurar apenas `created_by` não achava nada enquanto o `insert` não
  // gravava esse campo — e mesmo agora, uma empresa criada por uma versão
  // antiga do script continua com ele nulo. O nome é fixo e só este cenário
  // o usa, então ele encontra as duas gerações.
  const { data: empresasOrfas } = await admin
    .from('workspaces')
    .select('id')
    .eq('name', NOME_DA_EMPRESA)
  for (const w of empresasOrfas ?? []) {
    await admin.from('workspaces').delete().eq('id', w.id)
  }

  const { data: antigos } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const orfao = antigos?.users?.find((x) => x.email === email)
  if (orfao) {
    // ## O erro do `deleteUser` é CHECADO, e foi assim que o defeito apareceu
    //
    // A versão anterior ignorava o retorno. Medido: com a empresa ainda no
    // banco, ele devolve **HTTP 500 com corpo vazio** — e a execução seguinte
    // morria em `createUser` com `email_exists`, uma mensagem que aponta para
    // o lugar errado.
    //
    // Mesma classe do `activities.insert` sem checagem que fez o webhook do
    // WhatsApp perder mensagem em silêncio.
    const { error } = await admin.auth.admin.deleteUser(orfao.id)
    if (error) {
      throw new Error(
        `não foi possível remover a conta órfã ${email} (HTTP ${error.status}). ` +
          'Alguma linha ainda aponta para ela: confira empresas, contatos e ' +
          'tarefas com este dono antes de rodar de novo.',
      )
    }
    console.log('conta órfã de uma execução anterior removida')
  }

const { data: u, error: uErr } = await admin.auth.admin.createUser({
  email,
  password: SENHA,
  email_confirm: true,
  user_metadata: { name: 'Rick Cruz' },
})
if (uErr) throw uErr
userId = u.user.id

const { data: ws, error: wsErr } = await admin
  .from('workspaces')
  .insert({
    name: NOME_DA_EMPRESA,
    // ## `created_by` faltava, e era isso que deixava lixo em produção
    //
    // A limpeza defensiva abaixo procura a empresa órfã por `created_by`, e
    // o `insert` nunca gravava esse campo. Resultado medido em 01/09: toda
    // execução interrompida antes do `finally` (Ctrl+C, timeout de captura,
    // queda do servidor local) deixava uma "Acme Corp" com contatos, negócios
    // e tarefas no banco de PRODUÇÃO, e a execução seguinte não a encontrava.
    created_by: userId,
    plan: 'pro',
    segmento: 'agencia',
    email_comercial: 'contato@acmecorp.com.br',
    cidade: 'São Paulo',
    estado: 'SP',
  })
  .select('id')
  .single()
if (wsErr) throw wsErr
workspaceId = ws.id

await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: userId, role: 'admin' })
// `checklist_oculto` para o dashboard não aparecer com o card de primeiros
// passos por cima das métricas — é o estado de quem já configurou tudo.
await admin.from('onboarding_state').insert({
  user_id: userId,
  status: 'completed',
  tour_status: 'completed',
  checklist_oculto: true,
})

const LEADS = [
  { name: 'Marcos Vinícius', company: 'Agência Nova Era', email: 'marcos@novaera.com.br', phone: '11988887777' },
  { name: 'Juliana Prado', company: 'Clínica Vida Plena', email: 'juliana@vidaplena.com.br', phone: '11977776666' },
  { name: 'Roberto Neves', company: 'Construforte Engenharia', email: 'roberto@construforte.com.br', phone: '11966665555' },
  { name: 'Carla Bastos', company: 'Clínica Bem Estar', email: 'carla@bemestar.com.br', phone: '11955554444' },
  { name: 'Diego Ramalho', company: 'Imóveis Max', email: 'diego@imoveismax.com.br', phone: '11944443333' },
  { name: 'Patrícia Lemos', company: 'Prime Consultoria', email: 'patricia@primecon.com.br', phone: '11933332222' },
  { name: 'Eduardo Salles', company: 'Imobiliária Horizonte', email: 'eduardo@horizonte.com.br', phone: '11922221111' },
  { name: 'Fernanda Rocha', company: 'Studio Alva', email: 'fernanda@studioalva.com.br', phone: '11911110000' },
]
const { data: leads, error: lErr } = await admin
  .from('leads')
  .insert(LEADS.map((l) => ({ ...l, workspace_id: workspaceId, owner_id: userId, status: 'novo', value: 0 })))
  .select('id, company')
if (lErr) throw lErr
const idDa = Object.fromEntries(leads.map((l) => [l.company, l.id]))

// Negócios espalhados pelas 6 etapas: um funil com uma etapa só não mostra
// o formato do produto, que é justamente a distribuição.
const DEALS = [
  { title: 'Plano anual', empresa: 'Agência Nova Era', value: 4500, stage: 'novo', due: dia(6) },
  { title: 'Consultoria de marca', empresa: 'Clínica Vida Plena', value: 5100, stage: 'novo', due: dia(9) },
  { title: 'Pacote trimestral', empresa: 'Construforte Engenharia', value: 22000, stage: 'novo', due: dia(3) },
  { title: 'Gestão de agenda', empresa: 'Clínica Bem Estar', value: 2800, stage: 'contato_realizado', due: dia(4) },
  { title: 'Captação de contatos', empresa: 'Imóveis Max', value: 15000, stage: 'contato_realizado', due: dia(11) },
  { title: 'Reforma de identidade', empresa: 'Prime Consultoria', value: 3600, stage: 'proposta_enviada', due: dia(2) },
  { title: 'Expansão de portfólio', empresa: 'Imobiliária Horizonte', value: 12500, stage: 'proposta_enviada', due: dia(8) },
  { title: 'Ensaio de produto', empresa: 'Studio Alva', value: 7400, stage: 'negociacao', due: dia(5) },
  { title: 'Retenção anual', empresa: 'Agência Nova Era', value: 9800, stage: 'negociacao', due: dia(13) },
  { title: 'Campanha de lançamento', empresa: 'Clínica Vida Plena', value: 11200, stage: 'fechado_ganho', due: dia(-4) },
  { title: 'Consultoria pontual', empresa: 'Prime Consultoria', value: 6800, stage: 'fechado_perdido', due: dia(-9) },
]
const { data: deals, error: dErr } = await admin
  .from('deals')
  .insert(
    DEALS.map((d) => ({
      workspace_id: workspaceId,
      lead_id: idDa[d.empresa],
      owner_id: userId,
      title: d.title,
      value: d.value,
      stage: d.stage,
      due_date: d.due,
    })),
  )
  .select('id, title')
if (dErr) throw dErr
const dealDe = Object.fromEntries(deals.map((d) => [d.title, d.id]))

// Uma tarefa em cada faixa da tela Hoje: atrasada, hoje, próximos dias.
const { error: tErr } = await admin.from('tasks').insert([
  { workspace_id: workspaceId, deal_id: dealDe['Pacote trimestral'], lead_id: idDa['Construforte Engenharia'], assignee_id: userId, created_by: userId, title: 'Ligar para fechar o pacote', type: 'ligacao', due_at: hora(-20) },
  { workspace_id: workspaceId, deal_id: dealDe['Reforma de identidade'], lead_id: idDa['Prime Consultoria'], assignee_id: userId, created_by: userId, title: 'Enviar proposta revisada', type: 'email', due_at: hora(3) },
  { workspace_id: workspaceId, deal_id: dealDe['Ensaio de produto'], lead_id: idDa['Studio Alva'], assignee_id: userId, created_by: userId, title: 'Reunião de alinhamento', type: 'reuniao', due_at: hora(7) },
  { workspace_id: workspaceId, deal_id: dealDe['Gestão de agenda'], lead_id: idDa['Clínica Bem Estar'], assignee_id: userId, created_by: userId, title: 'Confirmar escopo por WhatsApp', type: 'ligacao', due_at: hora(30) },
  { workspace_id: workspaceId, deal_id: dealDe['Captação de contatos'], lead_id: idDa['Imóveis Max'], assignee_id: userId, created_by: userId, title: 'Retomar conversa da semana passada', type: 'nota', due_at: hora(54) },
])
if (tErr) throw tErr

  return { userId, workspaceId, email, idDa, dealDe }
}

/**
 * Apaga tudo. Chamado num `finally`, inclusive quando a captura falha no
 * meio: empresa de teste esquecida no banco vira dado órfão que ninguém sabe
 * de onde veio.
 */
export async function apagarCenario({ userId, workspaceId }) {
  if (workspaceId) await admin.from('workspaces').delete().eq('id', workspaceId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('cenário de demonstração removido')
}
