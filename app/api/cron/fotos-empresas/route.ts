import { NextResponse } from 'next/server'
import { rodarFotosDasEmpresas } from '@/lib/enterprise/fotos'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  try { return NextResponse.json(await rodarFotosDasEmpresas()) }
  catch (erro) {
    console.error('Busca de fotos das empresas falhou', erro instanceof Error ? erro.message : 'erro de consulta')
    return NextResponse.json({ ok: false, erro: 'A consulta de fotos será tentada novamente.' }, { status: 503 })
  }
}
