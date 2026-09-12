import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { chaveDeDominio, chaveDeEmail, chaveDeTelefone, ultimos8 } from './opt-out'

/**
 * O acesso ao banco do opt-out. A regra pura mora em `opt-out.ts`.
 *
 * Mesmo desenho de `trial.ts` (puro) e `trial-queries.ts` (I/O), pela razão
 * que já custou caro aqui: `server-only` impede o vitest de importar, e a
 * decisão "isto é um pedido de saída?" precisa de teste.
 *
 * ## Escrita e leitura são de `service_role`, e é por isso que não há policy
 *
 * A 0080 e a 0083 deixam a tabela com RLS ligada e **zero policy**. Quem
 * escreve é a rota `/nao-quero` e o webhook da Evolution; quem lê é o disparo.
 * Nenhum usuário autenticado do produto tem o que fazer aqui, e abrir leitura
 * publicaria a lista de empresas prospectadas — um vazamento criado para
 * atender à LGPD.
 */

/**
 * Teto de leitura.
 *
 * Sem ele o PostgREST corta em 1.000 **sem erro nenhum** — a armadilha
 * medida em 12/08 e já paga três vezes neste projeto. E aqui o corte silencioso
 * seria o pior possível: a fila voltaria a incluir quem pediu para sair, e nada
 * indicaria isso.
 *
 * 5.000 é o mesmo teto de `prateleira-queries.ts`, e o universo inteiro tem 837
 * empresas. Quando a lista de saída passar disso, o problema é outro.
 */
const TETO = 5000

export type Descadastro = {
  /** A empresa inteira sai, inclusive um segundo site do mesmo dono. */
  dominios: Set<string>
  /** Últimos 8 dígitos. Barra o número mesmo quando o domínio é outro. */
  telefones: Set<string>
}

/**
 * A lista inteira, para o disparo filtrar em memória.
 *
 * Em memória e não por `.in()` no banco: a fila tem 837 linhas e mandar 837
 * domínios numa query string faz o gateway recusar — medido em 11/08, 500
 * valores já devolvem 400 e 2.000 devolvem 414. O mesmo padrão que a
 * importação de planilha e a dedupe da prospecção já adotaram.
 *
 * **Falha é ruidosa de propósito.** Um `catch` devolvendo conjuntos vazios
 * deixaria o disparo sair para quem pediu para sair, com a tela dizendo
 * "0 não perturbe" e tudo parecendo normal. O erro sobe; a rodada para.
 */
export async function carregarDescadastros(): Promise<Descadastro> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('descadastro_de_prospeccao')
    .select('dominio, telefone_ultimos8')
    .limit(TETO)

  if (error) throw error

  const dominios = new Set<string>()
  const telefones = new Set<string>()

  for (const linha of data ?? []) {
    if (linha.dominio) dominios.add(linha.dominio.trim().toLowerCase())
    if (linha.telefone_ultimos8) telefones.add(linha.telefone_ultimos8)
  }

  return { dominios, telefones }
}

export type PedidoDeSaida = {
  /** De onde veio o pedido. Quando ele chega por WhatsApp, é o telefone. */
  telefone?: string | null
  /** A empresa, quando a prospecção consegue dizer de quem é o número. */
  dominio?: string | null
  /** O hash do e-mail, quando o pedido chega pelo link do e-mail frio. */
  emailHash?: string | null
  /** `link` (clicou), `resposta` (respondeu pedindo), `bounce`, `manual`. */
  origem: 'link' | 'resposta' | 'bounce' | 'manual'
}

/**
 * Registra o pedido de saída. Idempotente.
 *
 * ## A `chave` decide a identidade, e o telefone vence o domínio
 *
 * Quem responde "não quero" pelo WhatsApp é identificado pelo número — é o
 * único dado que a mensagem carrega com certeza. O domínio entra na MESMA
 * linha quando a prospecção sabe de quem é, e é ele que barra a empresa
 * inteira, inclusive um segundo site do mesmo dono (caso real: `i9 Acrílicos`
 * e `Fachadas Curitiba` compartilham telefone).
 *
 * Sem telefone e sem e-mail, a chave é o próprio domínio — é o caminho do
 * registro manual.
 *
 * ## Repetir não pode falhar
 *
 * Clicar duas vezes no link, ou responder "não quero" duas vezes, é o caso
 * comum. Um erro de chave duplicada mostraria falha para quem fez tudo certo,
 * e no caminho do webhook derrubaria a gravação da mensagem junto.
 */
export async function registrarDescadastro(pedido: PedidoDeSaida): Promise<void> {
  const telefone = ultimos8(pedido.telefone)
  const dominio = pedido.dominio?.trim().toLowerCase() || null

  // O prefixo nunca é escrito à mão aqui: `chaveDe*` é a única regra, e uma
  // segunda cópia do prefixo produziria uma chave que não casa com a gravada
  // pela outra superfície — sem nada falhando.
  const chave =
    (pedido.emailHash ? chaveDeEmail(pedido.emailHash) : null) ??
    chaveDeTelefone(pedido.telefone) ??
    (dominio ? chaveDeDominio(dominio) : null)

  if (!chave) {
    // Sem nenhum identificador não há o que gravar, e uma linha sem chave não
    // responderia pergunta nenhuma. Silencioso porque o chamador (o webhook)
    // não tem o que fazer com o erro — e derrubar a captura da mensagem por
    // causa disso trocaria um problema pequeno por um grande.
    return
  }

  const supabase = createAdminClient()

  const { error } = await supabase.from('descadastro_de_prospeccao').upsert(
    {
      chave,
      dominio,
      telefone_ultimos8: telefone,
      origem: pedido.origem,
    },
    { onConflict: 'chave' },
  )

  if (error) throw error
}
