import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { getMemberNames } from '@/lib/leads/queries'
import {
  BOM_UTF8,
  montarCsvDeContatos,
  nomeDoArquivo,
} from '@/lib/leads/exportar-csv'
import type { Lead, LeadStatus } from '@/lib/leads/types'

/**
 * Baixa todos os contatos da empresa ativa em CSV.
 *
 * ## Por que rota, e não Server Action
 *
 * Server Action devolve dados para o React, não um arquivo com
 * `Content-Disposition`. Dá para contornar montando um Blob no cliente, e isso
 * traria o CSV inteiro para a memória do navegador antes de salvar — numa base
 * grande é justamente onde a aba trava.
 *
 * ## O teto de 1.000 linhas, que este projeto já pagou três vezes
 *
 * O PostgREST corta em 1.000 e **não devolve erro nenhum**. Medido em 12/08
 * com 1.100 negócios: o app recebe 1.000 e nada avisa.
 *
 * Numa exportação isso seria o pior defeito possível — a pessoa baixa o
 * arquivo, confere as primeiras linhas, e leva embora uma base incompleta
 * achando que levou tudo. É o oposto do que a exportação existe para provar.
 *
 * Por isso o laço abaixo pagina por cursor até a fonte acabar, e não confia em
 * uma consulta só.
 */
export const runtime = 'nodejs'

/** Acima disso, a exportação vira trabalho de fundo — não de uma requisição. */
export const maxDuration = 60

const POR_PAGINA = 1000

/**
 * Teto de segurança.
 *
 * Não é limite de produto: é a linha em que uma requisição HTTP deixa de ser o
 * lugar certo. A maior empresa desta base tem 12 contatos, então ele existe
 * para o dia em que isso mudar — e para não deixar uma consulta acidental
 * varrer a tabela inteira sem fim.
 */
const TETO = 50_000

export async function GET() {
  // ## Resolve a sessão à mão, e não por `getCurrentUserAndWorkspace`
  //
  // Aquele helper faz `redirect('/login')` quando não há sessão, o que é o
  // certo numa PÁGINA e errado numa rota de API: medido em 03/09, a rota
  // devolvia **307 com o HTML do login**. Navegador nenhum reclama, mas um
  // script que exporte por agendamento receberia uma página de login e a
  // salvaria como se fosse a planilha.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)

  if (!workspaceId) {
    return NextResponse.json({ erro: 'Nenhuma empresa ativa.' }, { status: 404 })
  }
  const linhas: Lead[] = []
  let cursor: { createdAt: string; id: string } | null = null

  // ## A leitura passa pelo cliente com SESSÃO, nunca pelo admin
  //
  // `createAdminClient()` ignora RLS por completo. Numa rota que devolve
  // contatos em massa, usá-lo trocaria a única defesa real de isolamento entre
  // empresas por um `.eq('workspace_id', ...)` escrito à mão — e regra que só
  // vive no código da aplicação não é regra, como as migrations 0019 a 0026
  // deste projeto registram.
  while (linhas.length < TETO) {
    let q = supabase
      .from('leads')
      .select('id, name, email, phone, company, status, value, created_at, owner_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(POR_PAGINA)

    if (cursor) {
      q = q.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      )
    }

    const { data, error } = await q

    if (error) {
      console.error('Exportação de contatos falhou', error)
      return NextResponse.json(
        { erro: 'Não foi possível gerar o arquivo.' },
        { status: 500 },
      )
    }
    if (!data || data.length === 0) break

    const ids = Array.from(
      new Set(data.map((l) => l.owner_id).filter((id): id is string => !!id)),
    )
    const nomes = ids.length > 0 ? await getMemberNames(workspaceId, ids) : new Map()

    for (const l of data) {
      linhas.push({
        id: l.id,
        name: l.name ?? '',
        email: l.email ?? '',
        phone: l.phone ?? '',
        company: l.company ?? '',
        status: l.status as LeadStatus,
        owner: l.owner_id ? (nomes.get(l.owner_id) ?? '') : '',
        value: l.value ?? 0,
        createdAt: l.created_at ?? '',
      })
    }

    if (data.length < POR_PAGINA) break

    const ultima = data[data.length - 1]
    cursor = { createdAt: ultima.created_at ?? '', id: ultima.id }
  }

  const csv = BOM_UTF8 + montarCsvDeContatos(linhas)

  return new NextResponse(csv, {
    headers: {
      // `charset=utf-8` junto do BOM: o cabeçalho serve para quem abre no
      // navegador ou por script, o BOM para o Excel, que ignora o cabeçalho.
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomeDoArquivo()}"`,
      // Arquivo de dados de cliente não pode ficar em cache de borda nenhum.
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
