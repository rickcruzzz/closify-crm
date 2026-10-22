import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/lib/conversas/actions', () => ({ arquivarConversa: vi.fn(), enviarMensagem: vi.fn(), marcarComoRespondida: vi.fn() }))
import { Balao } from '@/components/conversas/conversas-client'
import type { MensagemNaTela } from './queries'

const mensagem: MensagemNaTela = {
  id: '11111111-1111-4111-8111-111111111111', direcao: 'enviada', tipo: 'texto', texto: 'Minha resposta ao cliente',
  midiaChave: null, midiaMime: null, midiaSegundos: null, status: 'enviada', erro: null,
  criadaEm: '2026-10-22T18:00:00Z', enviadaPor: 'usuario-a',
}

describe('mensagens enviadas e áudio no chat', () => {
  it('mostra o texto enviado no lado de quem respondeu', () => {
    const html = renderToStaticMarkup(createElement(Balao, { mensagem }))
    expect(html).toContain('Minha resposta ao cliente')
    expect(html).toContain('justify-end')
  })
  it('renderiza player de áudio recebido sem expor a URL externa', () => {
    const html = renderToStaticMarkup(createElement(Balao, { mensagem: { ...mensagem, tipo: 'audio', direcao: 'recebida', midiaChave: 'https://privado.example/audio.ogg' } }))
    expect(html).toContain('<audio controls=""')
    expect(html).toContain('preload="none"')
    expect(html).toContain(`/api/conversas/mensagens/${mensagem.id}/audio`)
    expect(html).toContain('Reproduzir áudio recebido')
    expect(html).not.toContain('privado.example')
  })
  it('também oferece reprodução para áudio enviado', () => {
    const html = renderToStaticMarkup(createElement(Balao, { mensagem: { ...mensagem, tipo: 'audio' } }))
    expect(html).toContain('Seu áudio')
    expect(html).toContain('Reproduzir áudio enviado por você')
  })
})
