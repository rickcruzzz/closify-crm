import { afterEach, describe, expect, it, vi } from 'vitest'
import { appUrl } from '@/lib/app-url'

afterEach(() => vi.unstubAllEnvs())

describe('URLs dos links de confirmação', () => {
  it('não envia colaboradores para localhost na produção sem variável pública', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(appUrl()).toBe('https://velofunil.com.br')
  })
  it('usa a URL do projeto Netlify e remove a barra final', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('URL', 'https://crm-mega.netlify.app/')
    expect(appUrl()).toBe('https://crm-mega.netlify.app')
  })
  it('preserva a configuração explícita', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://velofunil.com.br///')
    expect(appUrl()).toBe('https://velofunil.com.br')
  })
})
