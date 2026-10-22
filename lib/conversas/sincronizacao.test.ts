import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { observarConversas } from './sincronizacao'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('atualização do histórico de WhatsApp', () => {
  it('busca novos envios a cada cinco segundos enquanto a tela está visível', () => {
    const pagina = Object.assign(new EventTarget(), { hidden: false })
    const atualizar = vi.fn()
    const parar = observarConversas(atualizar, pagina, new EventTarget())
    vi.advanceTimersByTime(15_000)
    expect(atualizar).toHaveBeenCalledTimes(3)
    parar()
    vi.advanceTimersByTime(10_000)
    expect(atualizar).toHaveBeenCalledTimes(3)
  })
  it('não consulta em segundo plano e reconcilia ao voltar, focar ou reconectar', () => {
    const pagina = Object.assign(new EventTarget(), { hidden: true })
    const janela = new EventTarget()
    const atualizar = vi.fn()
    const parar = observarConversas(atualizar, pagina, janela)
    vi.advanceTimersByTime(20_000)
    expect(atualizar).not.toHaveBeenCalled()
    pagina.hidden = false
    pagina.dispatchEvent(new Event('visibilitychange'))
    janela.dispatchEvent(new Event('focus'))
    expect(atualizar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(600)
    janela.dispatchEvent(new Event('online'))
    expect(atualizar).toHaveBeenCalledTimes(2)
    parar()
    vi.advanceTimersByTime(1000)
    janela.dispatchEvent(new Event('focus'))
    pagina.dispatchEvent(new Event('visibilitychange'))
    expect(atualizar).toHaveBeenCalledTimes(2)
  })
})
