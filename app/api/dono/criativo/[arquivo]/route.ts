import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { caminhoSeguroDoCriativo } from '@/lib/dono/criativos'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/**
 * Serve as artes de anúncio, que vivem fora de `public/`.
 *
 * ## Por que esta rota precisa existir
 *
 * O Next só serve estáticos de `public/`, e as artes não podem ficar lá: iriam
 * para o build, para o deploy e para uma URL pública (ver o cabeçalho de
 * `lib/dono/criativos.ts`). Esta rota é a ponte — lê do disco e devolve os
 * bytes, atrás do mesmo gate de ambiente do resto da Central.
 *
 * Fora de localhost ela responde 404 como qualquer outra rota da Central, e a
 * validação do nome do arquivo (`caminhoSeguroDoCriativo`) recusa travessia de
 * diretório: sem ela, `../../.env.local` na URL leria o segredo do projeto.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPOS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ arquivo: string }> },
) {
  await exigirAmbienteLocal()

  const { arquivo } = await params
  const caminho = await caminhoSeguroDoCriativo(decodeURIComponent(arquivo))

  if (!caminho) {
    return new Response('Arte não encontrada.', { status: 404 })
  }

  const bytes = await readFile(caminho)

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': TIPOS[extname(caminho).toLowerCase()] ?? 'application/octet-stream',
      // Sem cache: a graça da galeria é ver a arte nova assim que ela cai na
      // pasta, e um cache de navegador mostraria a versão antiga de um arquivo
      // regerado com o mesmo nome.
      'Cache-Control': 'no-store',
    },
  })
}
