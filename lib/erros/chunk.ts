/**
 * A família de erro que NÃO é defeito do código: a aba ficou velha.
 *
 * ## O que acontece
 *
 * Cada build gera nomes de chunk novos. Uma aba aberta antes de uma promoção
 * continua com o mapa antigo e, ao navegar, pede um arquivo que não existe
 * mais. O webpack recebe `undefined` no lugar da fábrica do módulo e o
 * sintoma é este, gravado quatro vezes em `/kanban` no `error_logs` de 27/08:
 *
 *     Cannot read properties of undefined (reading 'call')
 *
 * Nada está errado no código, e recarregar resolve — mas quem vê a tela de
 * erro não sabe disso e conclui que o produto quebrou.
 *
 * ## Por que a proteção da Vercel não fecha sozinha
 *
 * O Skew Protection está ligado (`skewProtectionMaxAge: 43200`) e o Next 14
 * pendura `?dpl=<id>` nos assets, o que faz a Vercel servir o chunk da versão
 * certa. Isso cobre **12 horas**. Aba deixada aberta na sexta e retomada na
 * segunda está fora da janela, e o CRM é exatamente o tipo de produto que
 * alguém deixa aberto.
 */

/** Onde fica a marca da última recarga automática. */
export const CHAVE_RECARGA_POR_CHUNK = 'vf_recarga_chunk_v1'

/** Uma recarga por janela. Ver `deveRecarregar`. */
export const JANELA_DE_RECARGA_MS = 10 * 60_000

/**
 * As assinaturas de "o arquivo que a aba pediu não existe mais".
 *
 * A terceira é a mais ampla e a que de fato apareceu em produção. Ela é
 * genérica o bastante para casar com um `TypeError` de verdade, e é por isso
 * que a recuperação NUNCA depende só desta função: `deveRecarregar` limita a
 * uma tentativa por janela, então um defeito real recarrega no máximo uma vez
 * e depois mostra a tela de erro normalmente.
 */
const ASSINATURAS = [
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /reading 'call'/i,
  /undefined is not an object \(evaluating '\w+\.call'\)/i,
]

export function ehErroDeChunk(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false
  const e = erro as { name?: unknown; message?: unknown }
  const texto = `${typeof e.name === 'string' ? e.name : ''} ${
    typeof e.message === 'string' ? e.message : ''
  }`
  return ASSINATURAS.some((r) => r.test(texto))
}

/**
 * Já dá para recarregar de novo?
 *
 * A trava existe porque recarga automática sem limite é a pior falha
 * possível: se o erro voltar depois do reload, a página entra em ciclo de
 * recarregar-quebrar-recarregar e a pessoa não consegue nem ler a mensagem
 * nem sair da tela. Uma por janela transforma o pior caso em "recarregou uma
 * vez à toa".
 *
 * `null` é a primeira vez desta aba — e a primeira sempre pode.
 */
export function deveRecarregar(
  agoraMs: number,
  ultimaTentativaMs: number | null,
  janelaMs: number = JANELA_DE_RECARGA_MS,
): boolean {
  if (ultimaTentativaMs === null || !Number.isFinite(ultimaTentativaMs)) return true
  return agoraMs - ultimaTentativaMs > janelaMs
}
