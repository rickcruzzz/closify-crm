import { afterEach, describe, expect, it } from 'vitest'

import { baseDoWebhook, montarUrlDoWebhook } from './webhook-url'

/**
 * O defeito que estes testes travam, medido em produção em 25/08.
 *
 * Uma instância ficou com `http://localhost:3000/...` como webhook. O servidor
 * Evolution roda numa VPS, então postava no próprio localhost dele. A tela
 * dizia "conectado", o número estava pareado de verdade, `LoggedIn` era
 * `true` — e toda mensagem recebida sumia, sem erro em lugar nenhum.
 *
 * É a pior classe de falha deste produto: parece que funciona.
 */

const SEGREDO = 'b09b0795fed6a0790734f955145a16f0'
const EMPRESA = 'a39f3166-424d-4804-add5-69ea5640e095'

function montar(base: string) {
  return montarUrlDoWebhook({ base, workspaceId: EMPRESA, segredo: SEGREDO })
}

describe('montarUrlDoWebhook', () => {
  it('aceita o domínio de produção e monta o caminho completo', () => {
    const r = montar('https://www.velofunil.com.br')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.url).toBe(
        `https://www.velofunil.com.br/api/webhooks/evolution/${EMPRESA}/${SEGREDO}`,
      )
    }
  })

  it('recusa localhost, que foi o caso real', () => {
    const r = montar('http://localhost:3000')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('não alcança')
  })

  it('recusa as faixas privadas, não só o nome localhost', () => {
    // Uma máquina configurada com o próprio IP da rede falha igual e é MAIS
    // convincente, porque o endereço parece externo.
    for (const base of [
      'http://127.0.0.1:3000',
      'http://0.0.0.0:3000',
      'http://192.168.0.15:3000',
      'http://10.0.0.5:3000',
      'http://172.16.4.9:3000',
      'http://172.31.0.1:3000',
      'http://169.254.10.2:3000',
    ]) {
      expect(montar(base).ok, base).toBe(false)
    }
  })

  it('não confunde endereço público que só PARECE privado', () => {
    // 172.15 e 172.32 estão fora da faixa privada; recusá-los bloquearia um
    // servidor legítimo.
    for (const base of ['http://172.15.0.1', 'http://172.32.0.1', 'http://11.0.0.1']) {
      expect(montar(base).ok, base).toBe(true)
    }
  })

  it('recusa quando falta o segredo, e explica o porquê', () => {
    // Sem segredo o servidor não teria como provar que a chamada é dele, e
    // qualquer um poderia injetar mensagem no funil de qualquer empresa.
    // Chamada direta: passar `undefined` para o helper acionaria o parâmetro
    // padrão dele e o teste aprovaria o caso errado.
    const r = montarUrlDoWebhook({
      base: 'https://www.velofunil.com.br',
      workspaceId: EMPRESA,
      segredo: undefined,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('EVOLUTION_WEBHOOK_SECRET')
  })

  it('recusa endereço inválido em vez de montar uma URL torta', () => {
    expect(montar('nao-e-url').ok).toBe(false)
    expect(montar('').ok).toBe(false)
  })

  it('descarta caminho e query que venham na base', () => {
    // `origin` e não a URL crua: uma base com caminho geraria
    // `.../algo/api/webhooks/...`, que não é rota deste projeto.
    const r = montar('https://www.velofunil.com.br/algum/caminho?x=1')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.url).toBe(
      `https://www.velofunil.com.br/api/webhooks/evolution/${EMPRESA}/${SEGREDO}`,
    )
  })
})

describe('baseDoWebhook', () => {
  const original = process.env.EVOLUTION_WEBHOOK_PUBLIC_URL
  afterEach(() => {
    if (original === undefined) delete process.env.EVOLUTION_WEBHOOK_PUBLIC_URL
    else process.env.EVOLUTION_WEBHOOK_PUBLIC_URL = original
  })

  it('usa appUrl quando não há override', () => {
    delete process.env.EVOLUTION_WEBHOOK_PUBLIC_URL
    expect(baseDoWebhook('https://www.velofunil.com.br')).toBe('https://www.velofunil.com.br')
  })

  it('o override ganha, porque é a declaração explícita de destino', () => {
    process.env.EVOLUTION_WEBHOOK_PUBLIC_URL = 'https://tunel.exemplo.com'
    expect(baseDoWebhook('http://localhost:3000')).toBe('https://tunel.exemplo.com')
  })

  it('override vazio ou só espaço não conta como declaração', () => {
    // Variável presente e vazia é o estado normal de um `.env.example` copiado
    // sem preencher. Tratá-la como destino apontaria o webhook para "".
    process.env.EVOLUTION_WEBHOOK_PUBLIC_URL = '   '
    expect(baseDoWebhook('http://localhost:3000')).toBe('http://localhost:3000')
  })
})
