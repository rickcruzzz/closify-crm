import 'server-only'

import type { createClient } from '@/lib/supabase/server'
import { apenasDigitos } from '@/lib/leads/planilha'

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
 *
 * ## Mora aqui, e não em `lib/leads/actions.ts`, desde 22/10
 *
 * O Radar Enterprise passou a criar contato sozinho e precisa da MESMA
 * pergunta. Exportá-la de um arquivo `'use server'` a transformaria em
 * endpoint público; copiá-la criaria a segunda verdade que divergiria da
 * primeira na próxima mudança de normalização.
 */
export async function contatoJaCadastrado(
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
