import { FREE_LEAD_LIMIT } from '@/lib/plans'
import { PRO_PLAN_PRICE } from '@/lib/plans'
import { CONTROLADOR } from '@/lib/legal'

/**
 * O perfil do Instagram, escrito uma vez e copiado para toda conta.
 *
 * ## Por que isto vive no código, e não num bloco de notas
 *
 * A bio do @velofunil ficou dizendo *"Grátis até 300 contatos"* — a oferta
 * anterior à migration 0051. Desde ela, toda empresa nasce com sete dias de Pro
 * completo, e a landing foi corrigida em 24/08 por causa disso. A bio não foi,
 * porque ninguém lembrou que ela existia: **3.555 pessoas liam uma promessa
 * menor do que o produto entrega.**
 *
 * É a mesma classe de defeito dos prints da landing, que mostravam o jargão que
 * a própria página baniu. Texto de marca que mora fora do repositório não
 * acompanha mudança de produto, e ninguém descobre — porque nenhum `tsc`,
 * `lint` ou `test` lê uma bio de Instagram.
 *
 * Aqui, o preço e o prazo vêm das MESMAS constantes que a landing usa
 * (`FREE_LEAD_LIMIT`, `PRO_PLAN_PRICE`). Mudar o plano muda a bio junto, sem
 * ninguém precisar lembrar.
 *
 * ## Por que uma fonte única para várias contas
 *
 * Quando existe mais de um perfil, "deixar os dois iguais" por conferência
 * manual falha na primeira alteração: um é atualizado, o outro fica para trás,
 * e a divergência só aparece quando um cliente pergunta qual é o verdadeiro.
 * Colando o mesmo texto nos dois, eles ficam idênticos por construção.
 */

/**
 * O endereço da bio: curto no perfil, com atribuição por trás.
 *
 * ## Por que um atalho, e não a URL com as UTMs
 *
 * A versão anterior era a URL completa,
 * `...?utm_source=instagram&utm_medium=bio&utm_campaign=perfil`. Ela media
 * certo e **parecia link de rastreamento** — exatamente o que as pessoas
 * aprenderam a desconfiar. Numa bio, onde o link é a única porta, isso custa
 * clique.
 *
 * `/ig` redireciona para a mesma URL com as UTMs (`next.config.mjs`), então a
 * captura funciona igual e o perfil mostra um endereço limpo.
 *
 * O `www` continua: sem ele são 980ms contra 255ms, por redirecionamento de
 * domínio — medido em 25/08.
 */
export const LINK_DA_BIO = 'https://www.velofunil.com.br/ig'

/**
 * O campo Nome, e por que ele não é só o nome.
 *
 * A busca do Instagram indexa o **username** e o campo **Nome** — não o texto
 * da bio. Deixar "Velo Funil | CRM" em 16 de 30 caracteres desperdiça metade
 * do espaço onde alguém que procura "CRM de vendas" poderia encontrar o perfil.
 *
 * O teto é 30. Passar disso o Instagram corta em silêncio, sem avisar.
 */
export const NOME_DO_PERFIL = 'Velo Funil | CRM de vendas'

/** Teto do Instagram para o campo Nome. */
export const TETO_DO_NOME = 30

/** Teto do Instagram para a bio. */
export const TETO_DA_BIO = 150

/**
 * A bio.
 *
 * Três linhas, nesta ordem, e a ordem é a do Pipedrive na mesma posição:
 * **problema, o que é e quanto custa, oferta**.
 *
 * A primeira é a headline da landing, palavra por palavra. Repetir entre
 * anúncio, bio e página não é preguiça — é o que confirma para quem clicou que
 * chegou no lugar certo. Mensagem diferente entre os dois passos é onde a
 * pessoa desconfia e volta.
 *
 * O preço aparece de propósito. Ele **filtra antes do clique**: quem acha R$ 49
 * caro não entra, e essa visita não é paga. E "pela empresa inteira" é a
 * vantagem que nenhum concorrente mapeado tem — os outros cobram por vendedor,
 * e cinco pessoas dão R$ 265/mês.
 */
export const BIO_DO_PERFIL = [
  'O WhatsApp guarda a conversa. Não guarda o cliente.',
  `CRM brasileiro, R$ ${PRO_PLAN_PRICE}/mês pela empresa inteira.`,
  `Grátis até ${FREE_LEAD_LIMIT} contatos, sem cartão 👇`,
].join('\n')

/**
 * A variante sem preço, para quando o objetivo for volume de clique.
 *
 * Fica registrada em vez de virar decisão tomada de novo do zero toda vez:
 * converte mais clique e menos qualificado. Com seguidor frio, a de preço
 * costuma render mais — mas a escolha é de campanha, não de código.
 */
export const BIO_SEM_PRECO = [
  'O WhatsApp guarda a conversa. Não guarda o cliente.',
  'Saiba com quem falar hoje e quanto tem pra fechar.',
  `Grátis até ${FREE_LEAD_LIMIT} contatos, sem cartão 👇`,
].join('\n')

export type CampoDoPerfil = {
  id: string
  rotulo: string
  valor: string
  /** Teto de caracteres do Instagram, quando existe. */
  teto?: number
  /** Por que este valor, em uma frase. Aparece na tela. */
  porque: string
}

export function camposDoPerfil(): CampoDoPerfil[] {
  return [
    {
      id: 'nome',
      rotulo: 'Nome',
      valor: NOME_DO_PERFIL,
      teto: TETO_DO_NOME,
      porque:
        'A busca do Instagram indexa este campo e o @, nunca a bio. "CRM de vendas" aqui faz o perfil aparecer para quem procura, não só para quem já sabe o nome.',
    },
    {
      id: 'bio',
      rotulo: 'Bio',
      valor: BIO_DO_PERFIL,
      teto: TETO_DA_BIO,
      porque:
        'Primeira linha igual à headline da landing, palavra por palavra: é o que confirma para quem clicou que chegou no lugar certo. O preço filtra antes do clique.',
    },
    {
      id: 'link',
      rotulo: 'Link',
      valor: LINK_DA_BIO,
      porque:
        'Com "www" para matar o redirecionamento (980ms contra 255ms, medido) e com UTM, para a Central conseguir separar quem veio do Instagram de quem veio de anúncio pago.',
    },
    {
      id: 'categoria',
      rotulo: 'Categoria',
      valor: 'Software',
      porque:
        'Aparece abaixo do nome assim que a conta virar profissional. É o sinal mais barato de que existe empresa por trás do perfil.',
    },
    {
      id: 'email',
      rotulo: 'E-mail comercial',
      valor: 'suporte@velofunil.com.br',
      porque:
        'Testado em 25/08 com envio real: entregue em 7 segundos. O mesmo endereço do rodapé do site e dos e-mails de cobrança.',
    },
    {
      id: 'whatsapp',
      rotulo: 'Telefone / WhatsApp',
      valor: CONTROLADOR.whatsapp.exibicao,
      porque:
        'O mesmo número público da landing. Divergir aqui é o tipo de detalhe que faz uma PME desconfiar do site inteiro.',
    },
  ]
}
