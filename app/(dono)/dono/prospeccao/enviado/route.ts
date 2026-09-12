import { NextResponse } from 'next/server'

import { EMPRESAS_DE_PROSPECCAO } from '@/lib/prospeccao/empresas'
import { ultimos8 } from '@/lib/prospeccao/opt-out'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * O irmão de ESCRITA da rota `fila`: registra que a abordagem saiu.
 *
 * ## Por que uma rota, e não o script escrevendo direto no banco
 *
 * Pela mesma razão que `fila/route.ts` já documenta: o disparador é `.mjs`,
 * não importa o alias `@/`, e reescrever a regra nele é a armadilha que este
 * projeto registra em letras grandes — *"duas cópias divergem, e a que diverge
 * em silêncio é a que você escreveu"*. Lá o que divergiria era o texto que vai
 * ao cliente; aqui seria a identidade do prospect, que é o que liga a resposta
 * de amanhã à mensagem de hoje.
 *
 * ## Por que o registro precisa existir DE VERDADE, e não só no JSON
 *
 * `.dono-prospeccao.json` guarda o progresso de UMA máquina e continua sendo
 * a verdade do que já saiu. O que ele não consegue ser é alcançável do lado de
 * lá: quem recebe a resposta é o webhook da Evolution, que roda na Vercel, sem
 * disco. Sem esta gravação, a resposta chega e o sistema não sabe de quem é —
 * grava a conversa e perde o nicho, a pontuação e a mensagem que a provocou.
 *
 * ## O portão é o da Central inteira
 *
 * `exigirAmbienteLocal` exige `NODE_ENV === 'development'` **e** host de
 * loopback. Em produção isto é 404. Sem as duas condições, `next dev` escuta em
 * todas as interfaces e qualquer um no mesmo Wi-Fi escreveria na tabela.
 */

type Entrada = {
  dominio?: unknown
  nome?: unknown
  vertical?: unknown
  pontos?: unknown
  numero?: unknown
  texto?: unknown
  /** Quando a mensagem saiu. Ausente vira agora — é o caso do disparo ao vivo. */
  enviadoEm?: unknown
}

const texto = (v: unknown, teto: number): string | null => {
  if (typeof v !== 'string') return null
  const limpo = v.trim()
  return limpo ? limpo.slice(0, teto) : null
}

export async function POST(request: Request) {
  await exigirAmbienteLocal()

  let corpo: { prospects?: Entrada[] }
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 })
  }

  const entradas = Array.isArray(corpo.prospects) ? corpo.prospects : []
  if (entradas.length === 0) {
    return NextResponse.json({ erro: 'nenhum prospect' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // A empresa entra na linha para a atribuição não depender de o prospect
  // virar contato depois. Lida uma vez, não por prospect.
  const { data: empresas } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('name', EMPRESAS_DE_PROSPECCAO)

  const linhas = entradas
    .map((e) => {
      const dominio = texto(e.dominio, 200)?.toLowerCase()
      if (!dominio) return null
      const pontos = Number(e.pontos)
      return {
        dominio,
        telefone_ultimos8: ultimos8(typeof e.numero === 'string' ? e.numero : null),
        nome: texto(e.nome, 200),
        vertical: texto(e.vertical, 60),
        pontos: Number.isFinite(pontos) ? Math.trunc(pontos) : null,
        // O texto EXATO. É o único dado desta linha que deixa de ser
        // recalculável no dia em que `abordagem.ts` mudar uma palavra.
        mensagem_enviada: texto(e.texto, 4000),
        enviado_em: texto(e.enviadoEm, 40) ?? new Date().toISOString(),
        estagio: 'CONTACTED' as const,
        workspace_id: (empresas ?? [])[0]?.id ?? null,
        updated_at: new Date().toISOString(),
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  if (linhas.length === 0) {
    return NextResponse.json({ erro: 'nenhum domínio válido' }, { status: 400 })
  }

  /**
   * `upsert` com `ignoreDuplicates`, e as duas metades importam.
   *
   * Disparar de novo para o mesmo domínio não pode acontecer — o
   * `.dono-prospeccao.json` já barra —, mas a sincronização de retaguarda
   * (`--sincronizar`) reenvia a lista inteira de propósito. Sem `upsert` ela
   * falharia no primeiro domínio repetido e pararia.
   *
   * `ignoreDuplicates` porque quem já tem linha pode ter RESPONDIDO: sobrescrever
   * devolveria o estágio para `CONTACTED` e apagaria `respondido_em`, ou seja, a
   * retaguarda apagaria justamente o dado que esta tabela existe para guardar.
   */
  const { error, count } = await supabase
    .from('prospeccao_prospect')
    .upsert(linhas, { onConflict: 'dominio', ignoreDuplicates: true, count: 'exact' })

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recebidos: linhas.length, gravados: count ?? 0 })
}
