import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { lookup } from 'node:dns/promises'
import { get } from 'node:https'
import { baixarImagemPublica } from './imagem'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
vi.mock('node:https', () => ({ get: vi.fn() }))

const png = Buffer.from('89504e470d0a1a0a00000000', 'hex')
let status: number
let headers: Record<string, string>
let conteudo: Buffer

beforeEach(() => {
  vi.resetAllMocks()
  status = 200
  headers = {}
  conteudo = png
  vi.mocked(lookup).mockResolvedValue([{ address: '1.1.1.1', family: 4 }] as never)
  vi.mocked(get).mockImplementation(((_url: unknown, _options: unknown, callback: Function) => {
    const request = new EventEmitter()
    const response = Object.assign(new EventEmitter(), { statusCode: status, headers, destroy: vi.fn() })
    queueMicrotask(() => {
      callback(response)
      response.emit('data', conteudo)
      response.emit('end')
    })
    return request
  }) as never)
})

describe('download de imagem pública', () => {
  it('aceita bytes PNG e fixa a conexão ao IP validado, inclusive lookup all', async () => {
    expect((await baixarImagemPublica('https://fonte.example/imagem')).tipoMime).toBe('image/png')
    const options = vi.mocked(get).mock.calls[0]![1] as { lookup: Function }
    const callback = vi.fn()
    options.lookup('fonte.example', { all: true }, callback)
    expect(callback).toHaveBeenCalledWith(null, [{ address: '1.1.1.1', family: 4 }])
    options.lookup('fonte.example', {}, callback)
    expect(callback).toHaveBeenLastCalledWith(null, '1.1.1.1', 4)
  })
  it('recusa DNS privado antes de abrir conexão', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '10.0.0.1', family: 4 }] as never)
    await expect(baixarImagemPublica('https://fonte.example/i')).rejects.toThrow('não público')
    expect(get).not.toHaveBeenCalled()
  })
  it('recusa redirecionamento, sem acessar o destino', async () => {
    status = 302
    await expect(baixarImagemPublica('https://fonte.example/i')).rejects.toThrow('302')
    expect(get).toHaveBeenCalledTimes(1)
  })
  it('recusa arquivo maior que o bucket mesmo sem Content-Length', async () => {
    conteudo = Buffer.alloc(524289)
    await expect(baixarImagemPublica('https://fonte.example/i')).rejects.toThrow('512 KB')
  })
  it('recusa HTML disfarçado de imagem', async () => {
    conteudo = Buffer.from('<html>não é uma imagem</html>')
    await expect(baixarImagemPublica('https://fonte.example/i')).rejects.toThrow('Formato não aceito')
  })
  it('recusa HTTP e credenciais embutidas antes da rede', async () => {
    await expect(baixarImagemPublica('http://fonte.example/i')).rejects.toThrow('inválida')
    await expect(baixarImagemPublica('https://user:senha@fonte.example/i')).rejects.toThrow('inválida')
    expect(get).not.toHaveBeenCalled()
  })
})
