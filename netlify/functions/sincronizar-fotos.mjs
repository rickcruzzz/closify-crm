// Nativo da Netlify: não depende do vercel.json nem abre os crons ao público.
export const config = { schedule: '*/5 * * * *' }

export default async function sincronizarFotos() {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET não configurada nas Functions da Netlify.')
  const rotas = ['/api/cron/buscar-fotos', '/api/cron/fotos-empresas']
  const resultados = await Promise.allSettled(rotas.map(async (rota) => {
    const response = await fetch(`https://crm-mega.netlify.app${rota}`, {
      headers: { authorization: `Bearer ${secret}` },
      redirect: 'error',
      signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) throw new Error(`${rota}: HTTP ${response.status}`)
    const resultado = await response.json()
    if (resultado.ok !== true) throw new Error(`${rota}: sincronização incompleta`)
    console.info('Fotos sincronizadas', { rota, guardadas: resultado.guardadas ?? 0 })
  }))
  const falhas = resultados.filter((resultado) => resultado.status === 'rejected')
  if (falhas.length) throw new Error(`${falhas.length} rotina(s) de fotos falharam; verificar configuração/conexão.`)
}
