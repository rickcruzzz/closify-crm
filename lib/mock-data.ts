export type Workspace = {
  id: string
  name: string
  plan: 'Free' | 'Pro'
}

export const mockWorkspaces: Workspace[] = [
  { id: 'ws-1', name: 'Agência Nova Era', plan: 'Pro' },
  { id: 'ws-2', name: 'Clínica Bem Estar', plan: 'Free' },
  { id: 'ws-3', name: 'Imobiliária Horizonte', plan: 'Free' },
]

export const mockCurrentUser = {
  name: 'Rick Cruz',
  email: 'rick@closify.com.br',
  initials: 'RC',
}
