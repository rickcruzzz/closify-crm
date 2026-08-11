// Config compartilhada por todo cenário k6. Falha alto e cedo se faltar
// variável — melhor um erro claro no início do que métricas de "erro 100%"
// no meio de uma execução de 20 minutos.
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
export const SUPABASE_URL = __ENV.SUPABASE_URL
export const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL não definido. Passe com -e SUPABASE_URL=https://<ref>.supabase.co')
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY não definido. Passe com -e SUPABASE_ANON_KEY=...')
}

// Perfis de carga — ver docs/load-test/plano-de-teste.md pra rationale de
// cada estágio. `smoke` é o default deliberado: rodar qualquer cenário sem
// passar -e PROFILE não deve acidentalmente lançar 1000 VUs.
const PROFILES = {
  smoke: { vus: 2, duration: '20s' },
  load: {
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: '2m', target: 250 },
      { duration: '3m', target: 500 },
      { duration: '3m', target: 1000 },
      { duration: '5m', target: 1000 },
      { duration: '3m', target: 0 },
    ],
  },
  spike: {
    stages: [
      { duration: '30s', target: 50 },
      { duration: '10s', target: 1000 },
      { duration: '1m', target: 1000 },
      { duration: '10s', target: 50 },
      { duration: '2m', target: 50 },
    ],
  },
  soak: {
    stages: [
      { duration: '5m', target: 200 },
      { duration: '30m', target: 200 },
      { duration: '5m', target: 0 },
    ],
  },
}

export function currentProfile() {
  const name = __ENV.PROFILE || 'smoke'
  const profile = PROFILES[name]
  if (!profile) {
    throw new Error(`Perfil "${name}" desconhecido. Use um de: ${Object.keys(PROFILES).join(', ')}`)
  }
  return profile
}

// Think time realista — sem isso um VU dispara requisições em loop fechado,
// que não é comportamento humano e infla artificialmente o throughput
// medido. 1-3s cobre "ler a tela antes de clicar em algo".
export function thinkTime(min = 1, max = 3) {
  return min + Math.random() * (max - min)
}
