// Espelha lib/plans.ts — precisa bater com os limites reais do plano Free
// pros grupos "no teto" fazerem sentido (ver docs/load-test/plano-de-teste.md).
export const FREE_LEAD_LIMIT = 50
export const FREE_MEMBER_LIMIT = 2

export const PASSWORD_PREFIX = 'LoadTest#'
export const EMAIL_DOMAIN = 'velofunil-loadtest.local'

// Distribuição multi-tenant — não é 1000 usuários batendo no mesmo workspace.
// "estresse" existe só pra provar getFunnelCounts/getBoardDeals na escala
// onde o padrão "busca tudo e agrega em JS" (lib/dashboard/queries.ts:55)
// vira gargalo mensurável.
export const GROUPS = [
  {
    key: 'solo',
    workspaces: 700,
    usersPerWorkspace: 1,
    plan: 'free',
    leadsRange: [5, 50],
    dealsRange: [3, 20],
  },
  {
    key: 'time_pequeno',
    workspaces: 120,
    usersPerWorkspace: FREE_MEMBER_LIMIT,
    plan: 'free',
    leadsRange: [5, 50],
    dealsRange: [3, 20],
  },
  {
    key: 'time_pro',
    workspaces: 20,
    usersPerWorkspace: 4,
    plan: 'pro',
    leadsRange: [100, 800],
    dealsRange: [50, 400],
  },
  {
    key: 'estresse',
    workspaces: 10,
    usersPerWorkspace: 2,
    plan: 'pro',
    leadsRange: [3000, 8000],
    dealsRange: [2000, 6000],
  },
]

export const SCALES = {
  // usado pra validar a lógica do seed antes de rodar a escala completa
  small: { multiplier: 1 / 70, minWorkspacesPerGroup: 1 },
  full: { multiplier: 1, minWorkspacesPerGroup: 1 },
}

export function resolveGroupsForScale(scale) {
  const { multiplier, minWorkspacesPerGroup } = SCALES[scale] ?? SCALES.full
  return GROUPS.map((g) => ({
    ...g,
    workspaces: Math.max(minWorkspacesPerGroup, Math.round(g.workspaces * multiplier)),
  }))
}

export const LEAD_STATUSES = [
  'novo',
  'contato_realizado',
  'proposta_enviada',
  'negociacao',
  'fechado_ganho',
  'fechado_perdido',
]

export const DEAL_STAGES = LEAD_STATUSES // mesmo enum deal_stage (migration 0001)

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fabio', 'Gabi', 'Hugo', 'Ivo', 'Julia']
const SOBRENOMES = ['Silva', 'Souza', 'Costa', 'Pereira', 'Lima', 'Alves', 'Ramos', 'Dias']
const EMPRESAS = ['Nexo', 'Vetor', 'Prisma', 'Orbita', 'Zenith', 'Coral', 'Marfim', 'Aurora']

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomLeadName() {
  const n = NOMES[randomInt(0, NOMES.length - 1)]
  const s = SOBRENOMES[randomInt(0, SOBRENOMES.length - 1)]
  return `${n} ${s}`
}

export function randomCompany() {
  return `${EMPRESAS[randomInt(0, EMPRESAS.length - 1)]} ${randomInt(1, 999)}`
}
