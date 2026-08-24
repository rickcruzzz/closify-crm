'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { leadSchema, planilhaSchema } from '@/lib/validations/lead'
import { activitySchema } from '@/lib/validations/activity'
import { uuidSchema } from '@/lib/validations/workspace'
import { canAddLead, remainingLeadSlots } from '@/lib/limits'
import { CSV_MAX_LINHAS } from '@/lib/leads/csv'
import {
  apenasDigitos,
  chaveDeContato,
  contarAvisosDeArquivo,
  interpretarPlanilha,
  type LinhaPlanilha,
  type Mapeamento,
} from '@/lib/leads/planilha'
import { FREE_LEAD_LIMIT } from '@/lib/plans'

async function getActiveWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Mesma resolução que as páginas usam para LER. Precisa ser a mesma: se a
  // tela mostra a empresa escolhida no seletor e a gravação cai na mais
  // antiga, o registro some da vista de quem acabou de criá-lo.
  return resolverWorkspaceAtivo(supabase, user.id)
}

// owner_id não é validado pela RLS de leads (a policy só confere workspace_id
// da linha), sem checar aqui, qualquer membro autenticado poderia atribuir
// um lead a um user_id de fora do workspace, só adivinhando/vazando o UUID.
async function isWorkspaceMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!data
}

/**
 * Já existe alguém com este e-mail ou telefone nesta empresa?
 *
 * Usa a mesma normalização do resto do produto: e-mail em minúsculas, e
 * telefone por `apenasDigitos`, sem o 55 do país e sem o 0 de operadora. Sem
 * isso, `(71) 99999-1001` e `+55 71 99999-1001` entrariam como duas pessoas,
 * que é o jeito mais rápido de sujar um funil.
 *
 * A trava de verdade são os índices únicos da migration 0045: Server Action é
 * endpoint HTTP e quem chama o PostgREST direto pula esta checagem. Isto aqui
 * existe para a MENSAGEM: dizer quem já existe e deixar a tela linkar para
 * ele, em vez de devolver um erro de banco que não diz o que fazer.
 *
 * `ignorarId` é o próprio lead na edição: sem ele, salvar qualquer campo
 * acusaria conflito do lead consigo mesmo.
 */
async function contatoJaCadastrado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  contato: { email: string | null; phone: string | null },
  ignorarId?: string,
): Promise<{ id: string; name: string } | null> {
  // E-mail e telefone são conferidos SEPARADAMENTE, não por `chaveDeContato`.
  //
  // `chaveDeContato` devolve e-mail OU telefone, nunca os dois: é a chave da
  // importação, onde uma linha é um contato. Aqui não serve. Dois leads com
  // e-mails diferentes e o MESMO telefone geram chaves diferentes, a busca não
  // acharia nada, e a pessoa cairia no erro cru do índice ("Já existe um
  // contato...") sem saber quem é. Foi o que aconteceu no primeiro teste.
  //
  // Os índices da 0045 são dois, um por coluna, então a busca precisa cobrir
  // as duas dimensões para a mensagem citar o nome nos dois casos.
  const emailAlvo = contato.email?.trim().toLowerCase() || null
  const telefoneAlvo = contato.phone ? apenasDigitos(contato.phone) : ''
  const temTelefoneUtil = telefoneAlvo.length >= 8

  if (!emailAlvo && !temTelefoneUtil) return null

  // Lê os candidatos por e-mail OU telefone e compara pela chave normalizada
  // no JavaScript. Filtrar por telefone direto no banco não funcionaria: o
  // que está gravado é o texto digitado ("(71) 99999-1001"), e o que se
  // procura é a forma normalizada.
  const filtros: string[] = []
  if (emailAlvo) filtros.push(`email.ilike.${emailAlvo}`)
  // Telefone não dá para filtrar no banco: o que está gravado é o texto
  // digitado ("(71) 98888-7001") e o que se procura é a forma normalizada.
  // Traz quem tem telefone e compara aqui.
  if (temTelefoneUtil) filtros.push('phone.not.is.null')

  let query = supabase
    .from('leads')
    .select('id, name, email, phone')
    .eq('workspace_id', workspaceId)
    .or(filtros.join(','))
    .limit(500)

  if (ignorarId) query = query.neq('id', ignorarId)

  const { data, error } = await query
  if (error) {
    // Não bloqueia o cadastro por falha de leitura: o índice único do banco
    // continua sendo a trava. Aqui só se perde a mensagem boa.
    console.error('contatoJaCadastrado: falha ao procurar contato existente', error)
    return null
  }

  const encontrado = (data ?? []).find((lead) => {
    const mesmoEmail =
      !!emailAlvo && (lead.email?.trim().toLowerCase() || null) === emailAlvo
    const mesmoTelefone =
      temTelefoneUtil && !!lead.phone && apenasDigitos(lead.phone) === telefoneAlvo
    return mesmoEmail || mesmoTelefone
  })
  return encontrado ? { id: encontrado.id, name: encontrado.name } : null
}

/** 23505 = unique_violation. Chega numa corrida entre duas abas, quando a
 *  checagem acima passou e o índice pegou. */
function ehContatoRepetido(codigo?: string) {
  return codigo === '23505'
}

function mensagemDeRepetido(nome?: string) {
  return nome
    ? `Este contato já está cadastrado como ${nome}.`
    : 'Já existe um contato com este e-mail ou telefone.'
}

export async function createLead(values: unknown) {
  const parsed = leadSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  if (!(await isWorkspaceMember(supabase, workspaceId, parsed.data.ownerId))) {
    return { error: 'Responsável inválido.' }
  }

  const limit = await canAddLead(workspaceId)
  if (!limit.allowed) {
    return { error: limit.reason }
  }

  const repetido = await contatoJaCadastrado(supabase, workspaceId, {
    // Vazio e ausente são a mesma coisa aqui: contato em branco não pode
    // casar com outro contato em branco e virar "repetido".
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
  })
  if (repetido) {
    return { error: mensagemDeRepetido(repetido.name), leadExistenteId: repetido.id }
  }

  const { error } = await supabase.from('leads').insert({
    workspace_id: workspaceId,
    name: parsed.data.name,
    // `null`, não string vazia: é assim que a constraint
    // `leads_contato_minimo` (migration 0025) enxerga "sem esse contato", e
    // `coalesce(email,'') <> ''` trata os dois igual de qualquer forma.
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    company: parsed.data.company,
    status: parsed.data.status,
    owner_id: parsed.data.ownerId,
    value: parsed.data.value,
  })

  if (error) {
    // Corrida entre duas abas: a checagem acima passou e o índice único da
    // 0045 pegou. Sem este ramo, a pessoa veria "Não foi possível criar o
    // lead", que não diz o que fazer.
    if (ehContatoRepetido(error.code)) {
      return { error: mensagemDeRepetido() }
    }
    console.error('createLead falhou', error)
    return { error: 'Não foi possível criar o lead.' }
  }

  revalidatePath('/leads')
  return { success: true }
}

export async function updateLead(leadId: string, values: unknown) {
  const parsed = leadSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  if (!(await isWorkspaceMember(supabase, workspaceId, parsed.data.ownerId))) {
    return { error: 'Responsável inválido.' }
  }

  // `leadId` como `ignorarId`: sem isso, salvar qualquer campo acusaria o
  // lead como repetido dele mesmo, e ninguém conseguiria mais editar nada.
  const repetido = await contatoJaCadastrado(
    supabase,
    workspaceId,
    { email: parsed.data.email || null, phone: parsed.data.phone || null },
    leadId,
  )
  if (repetido) {
    return { error: mensagemDeRepetido(repetido.name), leadExistenteId: repetido.id }
  }

  const { error } = await supabase
    .from('leads')
    .update({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      status: parsed.data.status,
      owner_id: parsed.data.ownerId,
      value: parsed.data.value,
    })
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)

  if (error) {
    if (ehContatoRepetido(error.code)) {
      return { error: mensagemDeRepetido() }
    }
    console.error('updateLead falhou', error)
    return { error: 'Não foi possível atualizar o lead.' }
  }

  revalidatePath('/leads')
  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export type ResultadoImportacao = {
  importados: number
  ignorados: number
  duplicados: number
  /** Contatos que já existiam e foram atualizados com os dados da planilha. */
  atualizados: number
  /** Linhas que não couberam no teto do plano Free. */
  foraDoLimite: number
  /** Mensagens por linha descartada, para a pessoa corrigir a planilha. */
  avisos: string[]
}

/**
 * Todos os contatos que já existem no workspace, como chaves de dedupe.
 *
 * Antes isto era `.in('email', [...])` com os e-mails do arquivo. Medido
 * contra produção: `in` com 500 valores vira URL de 25 KB e o gateway devolve
 * 400, e o código não olhava o erro, então `jaExistem` vinha nulo, o conjunto
 * de duplicados saía vazio e a planilha inteira era importada DE NOVO, calada.
 * Ler o workspace por páginas troca uma URL gigante por N requisições curtas.
 *
 * O custo é limitado pelo próprio produto: no Free são no máximo 50 leads, e
 * mesmo um workspace Pro grande cabe em poucas páginas.
 */
async function chavesJaCadastradas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<Map<string, string>> {
  // Guarda o id junto da chave porque a reimportação precisa saber QUAL lead
  // atualizar, não só que ele existe.
  const chaves = new Map<string, string>()
  const tamanhoDaPagina = 1000

  for (let pagina = 0; pagina < 50; pagina++) {
    const inicio = pagina * tamanhoDaPagina
    const { data, error } = await supabase
      .from('leads')
      .select('id, email, phone')
      .eq('workspace_id', workspaceId)
      .range(inicio, inicio + tamanhoDaPagina - 1)

    // Falhar aqui é grave: sem as chaves, tudo pareceria novo e a importação
    // duplicaria a base. Melhor propagar do que importar errado em silêncio.
    if (error) throw error
    if (!data || data.length === 0) break

    for (const lead of data) {
      const chave = chaveDeContato(lead.email, lead.phone)
      if (chave && !chaves.has(chave)) chaves.set(chave, lead.id)
    }

    if (data.length < tamanhoDaPagina) break
  }

  return chaves
}

/**
 * Monta o que muda num lead que já existe, a partir de uma linha da planilha.
 *
 * Duas regras, e as duas existem para não perder dado:
 *
 * 1. Só campo MAPEADO entra. Sem isso, uma planilha sem coluna de Etapa
 *    devolveria o `novo` que `interpretarPlanilha` usa como padrão e jogaria
 *    o pipeline inteiro de volta para a primeira coluna do Kanban.
 * 2. Só campo PREENCHIDO entra. Célula em branco não apaga o que está no CRM,
 *    quem quer limpar um campo faz isso na tela do lead, não por omissão.
 */
type MudancasDoLead = {
  name?: string
  email?: string | null
  phone?: string | null
  company?: string | null
  value?: number
  status?: LinhaPlanilha['status']
}

function mudancasDoLead(linha: LinhaPlanilha, mapeamento: Mapeamento): MudancasDoLead {
  const mudancas: MudancasDoLead = {}

  if (mapeamento.name !== undefined && linha.preenchidos.includes('name')) {
    mudancas.name = linha.name
  }
  if (mapeamento.email !== undefined && linha.preenchidos.includes('email')) {
    mudancas.email = linha.email
  }
  if (mapeamento.phone !== undefined && linha.preenchidos.includes('phone')) {
    mudancas.phone = linha.phone
  }
  if (mapeamento.company !== undefined && linha.preenchidos.includes('company')) {
    mudancas.company = linha.company
  }
  if (mapeamento.value !== undefined && linha.preenchidos.includes('value')) {
    mudancas.value = linha.value
  }
  if (mapeamento.status !== undefined && linha.preenchidos.includes('status')) {
    mudancas.status = linha.status
  }

  return mudancas
}

/**
 * Roda as promessas em blocos.
 *
 * O PostgREST não atualiza N linhas com N valores diferentes numa requisição
 * só, então cada lead atualizado é uma chamada. Trezentas em sequência
 * estourariam o tempo da função na Vercel; todas de uma vez abririam trezentas
 * conexões. Vinte por vez resolve os dois.
 */
async function emBlocos<T, R>(itens: T[], tamanho: number, fn: (item: T) => Promise<R>) {
  const resultados: R[] = []
  for (let i = 0; i < itens.length; i += tamanho) {
    resultados.push(...(await Promise.all(itens.slice(i, i + tamanho).map(fn))))
  }
  return resultados
}

/**
 * Atualiza os contatos que a planilha traz e que já existem no workspace.
 *
 * É o que faz a reimportação parecer uma planilha conectada: a pessoa corrige
 * o arquivo, sobe de novo, e o CRM acompanha, sem que a planilha continue
 * sendo a fonte da verdade.
 *
 * O negócio no Kanban só é atualizado quando o lead tem EXATAMENTE UM. Com dois
 * ou mais, não há como saber qual deles a linha da planilha representa, e
 * escolher errado moveria um negócio de verdade para a etapa errada. Nesse caso
 * o lead é atualizado e o negócio fica como está, com aviso.
 */
async function atualizarRepetidos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  repetidas: { linha: LinhaPlanilha; leadId: string }[],
  mapeamento: Mapeamento,
  avisos: string[],
): Promise<number> {
  if (repetidas.length === 0) return 0

  const comMudanca = repetidas
    .map((item) => ({ ...item, mudancas: mudancasDoLead(item.linha, mapeamento) }))
    .filter((item) => Object.keys(item.mudancas).length > 0)

  if (comMudanca.length === 0) return 0

  const resultados = await emBlocos(comMudanca, 20, async ({ leadId, linha, mudancas }) => {
    const { error } = await supabase
      .from('leads')
      .update(mudancas)
      .eq('id', leadId)
      .eq('workspace_id', workspaceId)

    if (error) {
      avisos.push(`Linha ${linha.linha}: não foi possível atualizar, ${error.message}`)
      return null
    }
    return leadId
  })

  const atualizadosIds = resultados.filter((id): id is string => id !== null)
  if (atualizadosIds.length === 0) return 0

  // Só faz sentido mexer no Kanban se a planilha trouxe valor ou etapa.
  const mexeNoNegocio =
    mapeamento.value !== undefined || mapeamento.status !== undefined
  if (!mexeNoNegocio) return atualizadosIds.length

  const porLead = new Map(comMudanca.map((item) => [item.leadId, item]))
  const negociosPorLead = new Map<string, string[]>()

  // `in` em blocos de 100: são UUIDs de 36 caracteres, e a mesma URL longa que
  // derrubou a deduplicação por e-mail derrubaria esta consulta.
  await emBlocos(
    Array.from({ length: Math.ceil(atualizadosIds.length / 100) }, (_, i) =>
      atualizadosIds.slice(i * 100, i * 100 + 100),
    ),
    1,
    async (bloco) => {
      const { data } = await supabase
        .from('deals')
        .select('id, lead_id')
        .eq('workspace_id', workspaceId)
        .in('lead_id', bloco)

      for (const negocio of data ?? []) {
        if (!negocio.lead_id) continue
        const lista = negociosPorLead.get(negocio.lead_id) ?? []
        lista.push(negocio.id)
        negociosPorLead.set(negocio.lead_id, lista)
      }
    },
  )

  const paraAtualizar: {
    dealId: string
    mudancas: { value?: number; stage?: LinhaPlanilha['status'] }
  }[] = []
  let ambiguos = 0

  for (const [leadId, negocios] of Array.from(negociosPorLead)) {
    if (negocios.length > 1) {
      ambiguos++
      continue
    }
    const item = porLead.get(leadId)
    if (!item) continue

    const mudancas: { value?: number; stage?: LinhaPlanilha['status'] } = {}
    if (mapeamento.value !== undefined && item.linha.preenchidos.includes('value')) {
      mudancas.value = item.linha.value
    }
    if (mapeamento.status !== undefined && item.linha.preenchidos.includes('status')) {
      mudancas.stage = item.linha.status
    }
    if (Object.keys(mudancas).length > 0) {
      paraAtualizar.push({ dealId: negocios[0]!, mudancas })
    }
  }

  await emBlocos(paraAtualizar, 20, async ({ dealId, mudancas }) => {
    await supabase.from('deals').update(mudancas).eq('id', dealId).eq('workspace_id', workspaceId)
  })

  if (ambiguos > 0) {
    avisos.push(
      `${ambiguos} contato(s) têm mais de um negócio no Kanban, os dados do contato foram` +
        ' atualizados, mas nenhum negócio foi movido, para não mexer no negócio errado.',
    )
  }

  return atualizadosIds.length
}

/**
 * Importa leads e negócios de uma planilha (.xlsx ou .csv).
 *
 * O arquivo é lido e mapeado no navegador, o `.xlsx` porque é um ZIP com XML
 * dentro, e o CSV porque a tela precisa mostrar a prévia antes de gravar. O
 * que chega aqui é a matriz de células e a escolha de colunas.
 *
 * NADA disso é confiável: esta função é um endpoint HTTP e pode ser chamada
 * direto, sem passar pela tela. Por isso o servidor reinterpreta a matriz do
 * zero, revalida cada linha, refaz a deduplicação e reaplica o limite do
 * plano. O cliente só transporta.
 *
 * Cria um NEGÓCIO para cada lead importado. Sem isso o Kanban e o dashboard
 * continuavam vazios depois de importar 300 contatos, as duas telas leem
 * `deals`, e a importação antiga só escrevia em `leads`. A pessoa concluía que
 * a importação não tinha funcionado.
 */
export async function importarPlanilha(
  payload: unknown,
): Promise<{ error: string } | ResultadoImportacao> {
  const parsed = planilhaSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Planilha inválida.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sessão expirada.' }
  }

  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  const { linhas, erros } = interpretarPlanilha(
    parsed.data.matriz,
    parsed.data.mapeamento,
    CSV_MAX_LINHAS,
  )
  const avisos = [...erros]

  if (linhas.length === 0) {
    return { error: avisos[0] ?? 'Nenhuma linha válida encontrada na planilha.' }
  }

  let jaCadastradas: Map<string, string>
  try {
    jaCadastradas = await chavesJaCadastradas(supabase, workspaceId)
  } catch (err) {
    console.error('importarPlanilha: falha ao ler contatos existentes', err)
    return { error: 'Não foi possível conferir os contatos já cadastrados. Tente de novo.' }
  }

  const repetidas: { linha: LinhaPlanilha; leadId: string }[] = []
  const novos = linhas.filter((linha) => {
    const leadId = jaCadastradas.get(linha.chave)
    if (!leadId) return true
    repetidas.push({ linha, leadId })
    return false
  })

  let duplicados = 0
  let atualizados = 0

  if (parsed.data.duplicados === 'atualizar') {
    atualizados = await atualizarRepetidos(
      supabase,
      workspaceId,
      repetidas,
      parsed.data.mapeamento,
      avisos,
    )
  } else {
    duplicados = repetidas.length
    for (const { linha } of repetidas) {
      avisos.push(`Linha ${linha.linha}: ${linha.email ?? linha.phone} já está cadastrado.`)
    }
  }

  if (novos.length === 0) {
    if (atualizados > 0) {
      revalidatePath('/leads')
      revalidatePath('/kanban')
      revalidatePath('/dashboard')
      return { importados: 0, ignorados: 0, duplicados, atualizados, foraDoLimite: 0, avisos }
    }
    return { error: 'Todos os contatos da planilha já estão cadastrados nesta empresa.' }
  }

  const vagas = await remainingLeadSlots(workspaceId)
  if (vagas === 0) {
    return {
      error: `Plano Free permite no máximo ${FREE_LEAD_LIMIT} leads. Faça upgrade para o Pro para importar mais.`,
    }
  }

  // Corta no limite em vez de recusar o arquivo inteiro: importar o que cabe
  // e dizer o que ficou de fora é mais útil do que não importar nada.
  //
  // ATENÇÃO: contar e inserir são duas idas ao banco, sem transação entre
  // elas. Duas importações simultâneas no mesmo workspace leem a MESMA
  // contagem e cada uma insere o que acha que cabe, estourando o teto do
  // plano. A checagem abaixo é a primeira barreira; a definitiva é a
  // reconferência depois do insert, que desfaz o excedente.
  const aInserir = vagas === null ? novos : novos.slice(0, vagas)
  let foraDoLimite = vagas === null ? 0 : Math.max(0, novos.length - vagas)
  if (foraDoLimite > 0) {
    avisos.push(
      `O plano Free comporta mais ${vagas} lead(s): ${foraDoLimite} linha(s) ficaram de fora.`,
    )
  }

  const porId = new Map<string, LinhaPlanilha>()

  const { data: inseridos, error } = await supabase
    .from('leads')
    .insert(
      aInserir.map((linha) => ({
        workspace_id: workspaceId,
        name: linha.name,
        email: linha.email,
        phone: linha.phone,
        company: linha.company,
        status: linha.status,
        // Quem importou vira responsável, é membro do workspace por
        // definição, então não precisa da checagem de `isWorkspaceMember` do
        // createLead.
        owner_id: user.id,
        value: linha.value,
      })),
    )
    // Precisa dos ids de volta para criar os negócios e para conseguir
    // desfazer o excedente abaixo.
    .select('id, created_at, email, phone')

  if (error) {
    // 42501 é a trava de limite de plano no banco (migration 0023). Sem tratar
    // o código, a pessoa recebia "Não foi possível importar os leads" e não
    // tinha como saber que era o teto do Free, a mensagem certa existia só
    // dentro do Postgres.
    if (error.code === '42501') {
      return {
        error: `Plano Free permite no máximo ${FREE_LEAD_LIMIT} leads. Faça upgrade para o Pro para importar mais.`,
      }
    }
    console.error('importarPlanilha falhou', error)
    return { error: 'Não foi possível importar os leads.' }
  }

  for (const registro of inseridos ?? []) {
    const chave = chaveDeContato(registro.email, registro.phone)
    const origem = chave ? aInserir.find((l) => l.chave === chave) : undefined
    if (origem) porId.set(registro.id, origem)
  }

  let sobreviventes = inseridos ?? []

  // Fecha a janela entre contar e inserir: se duas importações correram junto,
  // a soma pode ter passado do teto do plano. Reconferimos DEPOIS da escrita e
  // removemos o que sobrou, sempre os mais recentes, desfazer o excedente da
  // própria chamada é melhor do que deixar o workspace acima do limite que ele
  // paga. Só entra no caminho caro quando o estouro de fato aconteceu.
  const restantes = await remainingLeadSlots(workspaceId)
  if (restantes !== null && restantes < 0 && sobreviventes.length > 0) {
    const excedente = Math.min(-restantes, sobreviventes.length)
    const removidos = [...sobreviventes]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, excedente)
    const idsParaRemover = removidos.map((l) => l.id)

    const { error: erroDesfazer } = await supabase
      .from('leads')
      .delete()
      .eq('workspace_id', workspaceId)
      .in('id', idsParaRemover)

    if (erroDesfazer) {
      console.error('falha ao desfazer excedente de importação', erroDesfazer)
    } else {
      const removidosSet = new Set(idsParaRemover)
      sobreviventes = sobreviventes.filter((l) => !removidosSet.has(l.id))
      foraDoLimite += idsParaRemover.length
      avisos.push(
        `${idsParaRemover.length} lead(s) não couberam no limite do plano Free e não foram importados.`,
      )
    }
  }

  // Os negócios entram DEPOIS do acerto do excedente, nunca antes:
  // `deals.lead_id` é `on delete set null`, então apagar um lead excedente que
  // já tivesse negócio deixaria um card órfão no Kanban, sem contato por trás.
  if (sobreviventes.length > 0) {
    const { error: erroDeals } = await supabase.from('deals').insert(
      sobreviventes.map((registro) => {
        const origem = porId.get(registro.id)
        return {
          workspace_id: workspaceId,
          lead_id: registro.id,
          // O título do card é o nome da pessoa; com empresa, os dois, que é
          // como um vendedor procura no board.
          title: origem?.company ? `${origem.name}, ${origem.company}` : (origem?.name ?? 'Negócio'),
          value: origem?.value ?? 0,
          stage: origem?.status ?? ('novo' as const),
          owner_id: user.id,
        }
      }),
    )

    if (erroDeals) {
      // O lead já entrou e é o dado que importa; o negócio é a projeção dele no
      // Kanban. Falhar aqui não desfaz a importação, avisa, para a pessoa não
      // achar que o board quebrou.
      console.error('importarPlanilha: falha ao criar negócios', erroDeals)
      avisos.push(
        'Os contatos foram importados, mas os negócios não puderam ser criados no Kanban.',
      )
    }
  }

  revalidatePath('/leads')
  revalidatePath('/kanban')
  revalidatePath('/dashboard')

  const importados = sobreviventes.length

  return {
    importados,
    // `contarAvisosDeArquivo` desconta as mensagens que falam do ARQUIVO (por
    // exemplo o truncamento em 1.000 linhas) e não de uma linha descartada.
    // Sem isso o total de ignorados ficava maior do que o arquivo tinha.
    ignorados: erros.length - contarAvisosDeArquivo(erros) + (linhas.length - importados),
    duplicados,
    atualizados,
    foraDoLimite,
    avisos,
  }
}

export async function createActivity(leadId: string, values: unknown) {
  const parsed = activitySchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sessão expirada.' }
  }

  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  // Confere que o lead pertence ao workspace ativo antes de gravar,
  // a RLS de activities.insert também confere isso, mas falhar aqui com
  // mensagem clara é melhor do que deixar a RLS rejeitar silenciosamente.
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!lead) {
    return { error: 'Contato não encontrado.' }
  }

  const { error } = await supabase.from('activities').insert({
    workspace_id: workspaceId,
    lead_id: leadId,
    author_id: user.id,
    type: parsed.data.type,
    description: parsed.data.description,
  })

  if (error) {
    console.error('createActivity falhou', error)
    return { error: 'Não foi possível registrar a atividade.' }
  }

  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export async function deleteLead(leadId: string) {
  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('deleteLead falhou', error)
    return { error: 'Não foi possível excluir o lead.' }
  }

  revalidatePath('/leads')
  return { success: true }
}

/**
 * Confere se a pessoa pode mexer numa atividade: precisa ser o autor dela ou
 * admin do workspace.
 *
 * A RLS de `activities` permite update/delete a qualquer membro do workspace,
 * é o isolamento entre EMPRESAS, não entre pessoas da mesma empresa. Sem esta
 * checagem, um colaborador poderia reescrever o registro de ligação feito por
 * outro, e a timeline deixaria de ser prova do que aconteceu.
 */
async function podeEditarAtividade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  activityId: string,
  userId: string,
) {
  const { data: atividade } = await supabase
    .from('activities')
    .select('author_id')
    .eq('id', activityId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!atividade) return { ok: false as const, error: 'Atividade não encontrada.' }
  if (atividade.author_id === userId) return { ok: true as const }

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })
  if (isAdmin) return { ok: true as const }

  return {
    ok: false as const,
    error: 'Só o autor da atividade ou um administrador pode alterá-la.',
  }
}

export async function updateActivity(activityId: unknown, values: unknown) {
  const parsedId = uuidSchema.safeParse(activityId)
  if (!parsedId.success) {
    return { error: 'Atividade inválida.' }
  }

  const parsed = activitySchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) return { error: 'Workspace não encontrado.' }

  const permissao = await podeEditarAtividade(supabase, workspaceId, parsedId.data, user.id)
  if (!permissao.ok) return { error: permissao.error }

  const { data: atualizada, error } = await supabase
    .from('activities')
    .update({ type: parsed.data.type, description: parsed.data.description })
    .eq('id', parsedId.data)
    .eq('workspace_id', workspaceId)
    .select('lead_id')
    .single()

  if (error) {
    console.error('updateActivity falhou', error)
    return { error: 'Não foi possível atualizar a atividade.' }
  }

  revalidatePath(`/leads/${atualizada.lead_id}`)
  return { success: true }
}

export async function deleteActivity(activityId: unknown) {
  const parsedId = uuidSchema.safeParse(activityId)
  if (!parsedId.success) {
    return { error: 'Atividade inválida.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) return { error: 'Workspace não encontrado.' }

  const permissao = await podeEditarAtividade(supabase, workspaceId, parsedId.data, user.id)
  if (!permissao.ok) return { error: permissao.error }

  // Lê o lead antes de apagar: depois do delete não há linha de onde tirar o
  // id para revalidar a página certa.
  const { data: alvo } = await supabase
    .from('activities')
    .select('lead_id')
    .eq('id', parsedId.data)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', parsedId.data)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('deleteActivity falhou', error)
    return { error: 'Não foi possível excluir a atividade.' }
  }

  if (alvo?.lead_id) revalidatePath(`/leads/${alvo.lead_id}`)
  return { success: true }
}
