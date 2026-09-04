import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'
import { chaveDeUtm } from '@/lib/marketing/utm'

/**
 * A página de cadastro continua a promessa do anúncio que trouxe a pessoa.
 *
 * ## O vazamento que isto fecha
 *
 * Os seis criativos carregam seis argumentos diferentes e apontam todos para
 * `/cadastro`, que dizia uma coisa só: **"Criar conta — Comece a organizar seu
 * funil de vendas hoje"**, e mais quatro campos. Medido em 04/09, anúncio por
 * anúncio:
 *
 *     "R$ 49 pela empresa inteira"   -> a pagina nao menciona preco
 *     "traga sua planilha"           -> nao menciona importacao
 *     "gratis ate 50, sem cartao"    -> nao menciona gratis nem cartao
 *     "Veja o funil por dentro"      -> nao mostra nada, pede cadastro
 *
 * Quem clicou por um motivo específico chega e não encontra esse motivo. O H1
 * `Criar conta` descreve o MECANISMO, não o valor — é o rótulo do formulário,
 * não a razão de preenchê-lo.
 *
 * ## Por que aqui, e não numa landing por peça
 *
 * Seis páginas seriam seis coisas para manter, e o teste passaria a comparar
 * página junto com argumento, sem saber qual dos dois moveu o número. Mesma
 * porta, promessa confirmada: a diferença entre as peças volta a ser só o
 * argumento.
 *
 * ## As duas regras que governam o texto
 *
 * **Nunca prometer o que o cadastro grátis não entrega.** `a6_google` vende
 * Agenda e Gmail, que são Pro. Sem dizer isso aqui, a pessoa cria conta grátis
 * e descobre sozinha que não conecta nada — aquisição que garante frustração.
 * O eco dela declara o plano, e a honestidade compra mais do que a omissão.
 *
 * **Todo eco repete o removedor de atrito.** A pessoa está diante de quatro
 * campos: é o ponto do funil onde "grátis, sem cartão" vale mais do que
 * qualquer benefício. Os números vêm de `lib/plans.ts`, nunca escritos à mão —
 * mudar o limite do Free não pode deixar seis textos mentindo.
 */
export type EcoDaPeca = {
  titulo: string
  descricao: string
}

/** O que a página diz para quem não veio de peça nenhuma. */
export const ECO_PADRAO: EcoDaPeca = {
  titulo: 'Criar conta',
  descricao: 'Comece a organizar seu funil de vendas hoje.',
}

const GRATIS = `Grátis até ${FREE_LEAD_LIMIT} contatos, sem cartão.`
const PRO = `O Pro é R$ ${PRO_PLAN_PRICE} por mês pela empresa inteira.`

/**
 * Um eco por peça, na chave normalizada do `utm_content` do anúncio.
 *
 * As chaves são as mesmas seis que `scripts/marketing/criar-anuncios-meta.mjs`
 * escreve nas URLs. Peça sem eco cai no padrão — nunca num texto inventado.
 */
const POR_PECA: Record<string, EcoDaPeca> = {
  // "Cinco vendedores num CRM que cobra por pessoa custam R$ 300 por mês."
  'a1-ancora-preco': {
    titulo: `R$ ${PRO_PLAN_PRICE} pela empresa inteira`,
    descricao: `Com 1 ou com 20 pessoas, o preço é o mesmo. ${GRATIS}`,
  },
  // "42 horas é o tempo médio até a primeira resposta."
  'a2-perda-memoria': {
    titulo: 'Ninguém mais fica esperando resposta',
    descricao: `Cada contato entra com um próximo passo e uma data. ${GRATIS}`,
  },
  // "Traga sua planilha do jeito que ela está."
  'a3-objecao-planilha': {
    titulo: 'Sua planilha vira funil',
    descricao: `Importe o arquivo do jeito que ele está, .xlsx ou .csv. ${GRATIS}`,
  },
  // "É isto: o funil inteiro, com o próximo passo e a data de cada cliente."
  // O anúncio prometeu VER. O texto assume que aqui ainda não mostrou, em vez
  // de fingir que mostrou: promete o minuto que falta, não o que já passou.
  'a4-prova-produto': {
    titulo: 'O funil inteiro, em uma tela',
    descricao: `Sem manual e sem instalar nada — em um minuto ele está montado com os seus. ${GRATIS}`,
  },
  // "Grátis até 50 contatos, sem cartão e sem prazo para decidir."
  'a5-oferta': {
    titulo: `Grátis até ${FREE_LEAD_LIMIT} contatos, sem cartão`,
    descricao: `Sem prazo para decidir. ${PRO} Cancela sem multa.`,
  },
  // "O compromisso cai na sua Agenda do Google e o e-mail sai do seu Gmail."
  // Os dois são Pro (migration 0034). O eco DIZ isso — ver a regra acima.
  'a6-google': {
    titulo: 'Agenda e Gmail, ligados ao seu funil',
    descricao: `Comece grátis; a conexão com Google Agenda e Gmail entra no Pro. ${PRO}`,
  },
}

/**
 * O que escrever no topo de `/cadastro`, dado o `utm_content` da URL.
 *
 * Devolve o padrão para peça desconhecida, ausente ou vazia. Deliberado: um
 * texto genérico e verdadeiro é melhor que um específico e errado, e quem
 * inventa a URL à mão não deve conseguir escolher o que a página promete.
 */
export function ecoDaPeca(utmContent: string | null | undefined): EcoDaPeca {
  return POR_PECA[chaveDeUtm(utmContent)] ?? ECO_PADRAO
}
