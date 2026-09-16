import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { montarPdfDoOrcamento } from '@/lib/deals/orcamento-pdf'
import { podeEmitirOrcamento } from '@/lib/deals/emissor'
import { uuidSchema } from '@/lib/validations/workspace'

/**
 * O PDF do orçamento — e a única linha do Pro deste recurso.
 *
 * ## Por que o PDF é o que se paga, e o resto não
 *
 * O orçamento com prazo é do Free e é ilimitado, de propósito: quem nunca
 * sentiu o produto cobrar o retorno de um orçamento não tem razão para pagar
 * por ele. Medido em 08/09/2026, o problema do Pro não era faltar recurso, era
 * **ninguém nunca experimentar o Pro** — os dois únicos gatilhos de upgrade
 * eram bater em 50 contatos (meses) ou querer Google Calendar/Gmail, que os
 * cinco nichos prospectados não usam.
 *
 * O PDF é a parede certa porque ela é atravessada na PRIMEIRA semana, e porque
 * o que ela cobra tem valor honesto: 43% do mercado que anuncia proposta
 * entrega PDF, e o documento é o que vai para o cliente do cliente. Rastrear é
 * de graça; mandar bonito é o que custa.
 *
 * ## Rota e não Server Action, e o motivo é o corpo
 *
 * A convenção daqui é Server Action para mutação e rota só para
 * webhook/integração. Isto não é nenhum dos dois: é uma LEITURA que devolve
 * bytes binários com `Content-Disposition`. Server Action serializa o retorno
 * pelo protocolo do React — devolver um PDF por lá significaria base64 no meio
 * do payload de RSC, e o navegador não teria como salvar o arquivo direto.
 */
export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: { dealId: string } }) {
  const parsed = uuidSchema.safeParse(params.dealId)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Negócio inválido.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 })
  }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace não encontrado.' }, { status: 403 })
  }

  // O portão, ANTES de qualquer leitura de dado: se a resposta vai ser 402, não
  // há razão para consultar o negócio, o contato e a empresa.
  //
  // `pro_vigente()` e nunca `workspaces.plan`: a coluna é o último valor
  // gravado e não sabe que o tempo passou. É a armadilha que a 0028 pagou —
  // um Pro vencido aceitava o terceiro membro enquanto a trigger de leads
  // recusava o lead dele.
  const { data: temPro } = await supabase.rpc('pro_vigente', {
    target_workspace_id: workspaceId,
  })

  if (!temPro) {
    return NextResponse.json(
      {
        error:
          'O PDF do orçamento é um recurso Pro. Faça upgrade para enviar orçamentos em PDF.',
      },
      { status: 402 },
    )
  }

  // Duas leituras em vez do embed `leads (...)`: `deals.Relationships` é `[]`
  // nos tipos deste projeto (que são ajustados à mão, não gerados crus), então
  // o embed não tem tipo e só compilaria com um `as unknown as`. Uma ida a mais
  // à rede num download de PDF é mais barata que um cast que mente.
  const { data: negocio, error } = await supabase
    .from('deals')
    .select('id, title, value, lead_id, orcamento_validade, orcamento_descricao')
    .eq('id', parsed.data)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('PDF do orçamento: leitura do negócio falhou', error)
    return NextResponse.json(
      { error: 'Não foi possível ler o negócio.' },
      { status: 500 },
    )
  }
  if (!negocio) {
    return NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 })
  }

  // Sem validade não existe orçamento — existe um negócio com valor. Emitir um
  // PDF chamado "Orçamento" sem prazo entregaria ao cliente do cliente um
  // documento que nunca vence, que é o oposto do que este recurso faz.
  if (!negocio.orcamento_validade) {
    return NextResponse.json(
      { error: 'Registre a validade do orçamento antes de gerar o PDF.' },
      { status: 409 },
    )
  }

  // `deals.lead_id` é nullable desde a 0001: negócio sem contato vinculado
  // existe, e o PDF sai com "Cliente" no lugar do nome em vez de falhar.
  const { data: lead } = negocio.lead_id
    ? await supabase
        .from('leads')
        .select('name, company, phone, email')
        .eq('id', negocio.lead_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
    : { data: null }

  const { data: empresa } = await supabase
    .from('workspaces')
    .select(
      'name, nome_fantasia, cnpj, telefone, whatsapp, email_comercial, site, cidade, estado',
    )
    .eq('id', workspaceId)
    .maybeSingle()

  // ## O documento precisa dizer QUEM esta cobrando
  //
  // A regra vive em `lib/deals/emissor.ts`, pura e testada, e nao aqui: rota
  // nao tem teste neste projeto, e esta e uma decisao que fecha (ou abre) o
  // recurso pago para uma parte do publico. Ver la o porque de CNPJ NAO ser
  // exigido.
  const emissor = podeEmitirOrcamento(empresa)

  if (!emissor.pode) {
    return NextResponse.json(
      { error: emissor.motivo, destino: '/settings' },
      { status: 409 },
    )
  }

  const bytes = montarPdfDoOrcamento({
    emissor: {
      // `nome_fantasia` primeiro: é o nome que o cliente do cliente reconhece.
      // `workspaces.name` é como a pessoa chamou a empresa dentro do produto e
      // pode ser um apelido ("Minha empresa").
      //
      // O antigo `|| 'Orçamento'` saiu: ele era a última linha de defesa de um
      // caso que a guarda acima agora recusa antes, e produzia um documento
      // cujo emissor se chamava literalmente "Orçamento".
      nome: emissor.nome,
      cnpj: empresa?.cnpj ?? null,
      telefone: empresa?.telefone || empresa?.whatsapp || null,
      email: empresa?.email_comercial ?? null,
      site: empresa?.site ?? null,
      cidade: empresa?.cidade ?? null,
      estado: empresa?.estado ?? null,
    },
    cliente: {
      nome: lead?.name ?? 'Cliente',
      empresa: lead?.company ?? null,
      telefone: lead?.phone ?? null,
      email: lead?.email ?? null,
    },
    titulo: negocio.title,
    valor: Number(negocio.value),
    validade: negocio.orcamento_validade,
    descricao: negocio.orcamento_descricao,
    emitidoEm: new Date(),
  })

  const nome = `orcamento-${negocio.title}`
    .toLowerCase()
    .normalize('NFD')
    // Tira acento e depois tudo que não for letra, número ou hífen: o nome do
    // arquivo vai num header HTTP, e acento ou aspas ali quebram o
    // `Content-Disposition` em alguns navegadores.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nome || 'orcamento'}.pdf"`,
      // Documento com preço e prazo do cliente: nunca em cache compartilhado.
      'Cache-Control': 'private, no-store',
    },
  })
}
