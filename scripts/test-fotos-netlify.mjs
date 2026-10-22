import assert from 'node:assert/strict'
import { test } from 'node:test'
import sincronizarFotos, { config } from '../netlify/functions/sincronizar-fotos.mjs'

test('agendamento Netlify de fotos, autorização e falhas', async (t) => {
  const fetchOriginal = globalThis.fetch
  const segredoOriginal = process.env.CRON_SECRET
  try {
    assert.equal(config.schedule, '*/5 * * * *')
    await t.test('sem segredo não chama endpoint nem expõe rota', async () => {
      delete process.env.CRON_SECRET
      globalThis.fetch = () => { throw new Error('não deveria chamar fetch') }
      await assert.rejects(sincronizarFotos, /CRON_SECRET/)
    })
    process.env.CRON_SECRET = 'segredo-apenas-do-teste'
    await t.test('chama as duas rotas protegidas no próprio projeto', async () => {
      const urls = []
      globalThis.fetch = async (url, options) => {
        urls.push(url)
        assert.equal(options.headers.authorization, 'Bearer segredo-apenas-do-teste')
        assert.equal(options.redirect, 'error')
        return new Response(JSON.stringify({ ok: true, guardadas: 1 }))
      }
      await sincronizarFotos()
      assert.deepEqual(urls.sort(), ['https://crm-mega.netlify.app/api/cron/buscar-fotos', 'https://crm-mega.netlify.app/api/cron/fotos-empresas'].sort())
    })
    await t.test('ok:false não é contabilizado como sucesso', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }))
      await assert.rejects(sincronizarFotos, /2 rotina/)
    })
    await t.test('401 não passa despercebido', async () => {
      globalThis.fetch = async () => new Response('{}', { status: 401 })
      await assert.rejects(sincronizarFotos, /2 rotina/)
    })
  } finally {
    globalThis.fetch = fetchOriginal
    if (segredoOriginal === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = segredoOriginal
  }
})
