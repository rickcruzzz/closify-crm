/**
 * Para onde cada painel do dashboard leva.
 *
 * ## Por que existe um arquivo só para montar duas URLs
 *
 * Antes desta rodada, `/dashboard` era quase todo beco sem saída: dos quatro
 * cards de métrica só dois tinham link, as barras do funil não clicavam e
 * nenhuma linha de "Negócios mais próximos do prazo" abria o negócio. Um
 * usuário do produto tentou clicar para ver o detalhe e nada aconteceu.
 *
 * Ligar os painéis espalharia o mesmo endereço por quatro componentes. Aqui
 * ele é escrito uma vez: no dia em que a rota do funil mudar, muda num lugar,
 * e o teste diz na hora quem quebrou.
 *
 * As rotas NÃO foram renomeadas junto com o vocabulário do produto (`/kanban`
 * continua `/kanban` apesar de a tela se chamar "Funil") porque link salvo
 * quebraria para trocar uma palavra que ninguém digita — decisão de 19/08.
 */

import type { DealStage } from '@/lib/deals/types'

/** O board, sem nada em foco. */
export const FUNIL = '/kanban'

/** A lista de contatos. */
export const CONTATOS = '/leads'

/**
 * O board com uma etapa em foco.
 *
 * O board mostra todas as colunas de qualquer jeito; o parâmetro serve para a
 * coluna certa entrar na tela e ficar destacada, em vez de a pessoa cair no
 * quadro inteiro e ter que procurar a etapa em que clicou.
 */
export function hrefDaEtapa(stage: DealStage): string {
  return `${FUNIL}?etapa=${stage}`
}

/**
 * O board com o painel de um negócio já aberto.
 *
 * Abrir o negócio direto é o que fecha o buraco das linhas da tabela de
 * prazos: a pessoa vê "vence em 2 dias" e precisa agir naquele negócio, não
 * procurá-lo no quadro.
 */
export function hrefDoNegocio(dealId: string): string {
  return `${FUNIL}?negocio=${encodeURIComponent(dealId)}`
}
