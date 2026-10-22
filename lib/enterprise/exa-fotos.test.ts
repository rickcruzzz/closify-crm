import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { imagensDaFonte } from './exa'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('imagens da fonte via Exa', () => {
  it('consulta somente a página conhecida e usa a imagem principal, sem retratos extras', async () => {
    vi.stubEnv('EXA_API_KEY', 'chave-exclusiva-do-teste')
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{ image: 'https://fonte.example/marca.png', extras: { imageLinks: ['https://fonte.example/palestrante.jpg'] } }],
    })))
    vi.stubGlobal('fetch', fetcher)
    await expect(imagensDaFonte('https://fonte.example/evento')).resolves.toEqual(['https://fonte.example/marca.png'])
    const [url, options] = fetcher.mock.calls[0]!
    expect(url).toBe('https://api.exa.ai/contents')
    expect(JSON.parse(options.body)).toEqual({ urls: ['https://fonte.example/evento'], highlights: true, extras: { imageLinks: 5 } })
  })
  it('não confunde falha da fonte com ausência de imagem', async () => {
    vi.stubEnv('EXA_API_KEY', 'chave-exclusiva-do-teste')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ statuses: [{ status: 'error' }] }))))
    await expect(imagensDaFonte('https://fonte.example/evento')).rejects.toThrow('não conseguiu')
  })
  it('ignora links HTML ou SVG quando a fonte também oferece PNG compatível', async () => {
    vi.stubEnv('EXA_API_KEY', 'chave-exclusiva-do-teste')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{ image: 'https://fonte.example/marca.svg', extras: { imageLinks: ['https://fonte.example/inscricao/', 'https://fonte.example/banner.png'] } }],
    }))))
    await expect(imagensDaFonte('https://fonte.example/evento')).resolves.toEqual(['https://fonte.example/banner.png'])
  })
  it('não inventa imagem quando a fonte não tem nenhuma', async () => {
    vi.stubEnv('EXA_API_KEY', 'chave-exclusiva-do-teste')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{}] }))))
    await expect(imagensDaFonte('https://fonte.example/evento')).resolves.toEqual([])
  })
})
