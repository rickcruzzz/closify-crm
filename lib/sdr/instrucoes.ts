import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  FREE_ORCAMENTO_LIMIT,
  PESSOAS_PARA_COMPENSAR,
  PRECO_MEDIANA_POR_USUARIO,
  PRO_ANUAL_PRICE,
  PRO_PLAN_PRICE,
  PRO_WORKSPACE_LIMIT,
} from '@/lib/plans'

/**
 * As instruções do agente que responde quem respondeu à prospecção.
 *
 * ## Por que ele existe, com o número que justifica
 *
 *     responder em 5 min em vez de 30    21x mais chance de qualificar
 *                                        (InsideSales / MIT)
 *     tempo medio de 1a resposta         42 horas
 *                                        (HBR, 2.241 empresas)
 *
 * A vantagem não é a IA ser boa de vendas — é ela estar acordada. Sessenta
 * segundos contra quarenta e duas horas é a diferença entre pegar a pessoa com
 * o problema na cabeça e escrever para quem já esqueceu que perguntou.
 *
 * ## A conversa é INICIADA pelo cliente, e isso muda tudo
 *
 * Quem chega aqui respondeu à mensagem. No WhatsApp isso abre uma *service
 * window*: conversa iniciada pelo cliente é **gratuita e ilimitada**, e não
 * depende de template aprovado nem de opt-in. O agente responde sem custo por
 * mensagem e sem o risco de política que o disparo frio carrega.
 *
 * ## Os fatos vêm de `lib/plans.ts`, nunca do texto
 *
 * É a regra mais importante deste arquivo. Um modelo que "lembra" que o plano
 * custa R$ 49 diria R$ 49 para sempre — e o preço mudou em 10/09. Preço, limite
 * e teto entram no prompt por interpolação, na hora, então a troca da constante
 * atualiza o agente sem ninguém reescrever nada.
 *
 * O mesmo vale para o que ele NÃO pode prometer: a lista de ausências é
 * explícita porque modelo preenche lacuna com plausibilidade, e a lacuna aqui
 * é "o produto tem WhatsApp integrado?" — a resposta é não, e um "sim" custa o
 * cliente no primeiro dia de uso.
 */

export const NOME_DO_AGENTE = 'assistente do Velo Funil'

/** Sinal, no texto do agente, de que a conversa deve ir para o dono. */
export const MARCA_DE_PASSAGEM = '[[PASSAR]]'

export type ContextoDoLead = {
  empresa?: string | null
  vertical?: string | null
  /** O que já foi dito nesta conversa, do mais antigo ao mais novo. */
  historico?: { de: 'cliente' | 'agente'; texto: string }[]
}

/**
 * O que o produto FAZ e o que ele NÃO faz, em texto para o modelo.
 *
 * A segunda lista é mais longa que a primeira de propósito. Este projeto já
 * pagou três vezes pelo mesmo erro — a landing prometendo WhatsApp que saiu de
 * operação, a arte anunciando trial aposentado, a bio com limite antigo — e um
 * modelo de linguagem é a superfície com maior tendência a repetir a promessa
 * errada, porque ela é a mais plausível.
 */
export function fatosDoProduto(): string {
  return [
    'O QUE O VELO FUNIL FAZ:',
    `- Orçamento com prazo: você guarda a validade e o sistema cria sozinho o lembrete de dar o retorno, dois dias antes de vencer. É o recurso central.`,
    '- Funil de vendas em Kanban, arrasta e solta.',
    '- Contatos, tarefas com prazo, e a tela "Hoje" com o que vence.',
    '- Importação de planilha (.csv e .xlsx) e exportação em CSV.',
    '- Painel de resultados e gráfico de funil.',
    '- PDF do orçamento (recurso do plano Pro).',
    '- Google Calendar e Gmail conectáveis (recurso do plano Pro).',
    '- Dados hospedados em São Paulo.',
    '',
    'O QUE O VELO FUNIL NÃO FAZ — nunca diga que faz:',
    '- NÃO tem WhatsApp integrado. Existe só um botão que abre a conversa no WhatsApp a partir do contato. Não recebe, não responde, não automatiza mensagem.',
    '- NÃO tem inteligência artificial dentro do produto.',
    '- NÃO emite nota fiscal e não integra com ERP.',
    '- NÃO tem aplicativo de celular; funciona pelo navegador.',
    '- NÃO faz dimensionamento de energia solar, projeto técnico nem proposta 3D.',
    '- NÃO tem chatbot, telefonia nem discador.',
    '',
    'PLANOS:',
    `- Free, para sempre, sem cartão: até ${FREE_LEAD_LIMIT} contatos, ${FREE_MEMBER_LIMIT} colaboradores, 1 empresa e ${FREE_ORCAMENTO_LIMIT} orçamentos com lembrete ativos ao mesmo tempo.`,
    `- Pro, R$ ${PRO_PLAN_PRICE} por mês pela empresa inteira, não por pessoa: tudo ilimitado, até ${PRO_WORKSPACE_LIMIT} empresas do mesmo dono, mais PDF, Google Calendar e Gmail.`,
    `- Pro anual, R$ ${PRO_ANUAL_PRICE} à vista, que dá dois meses de graça.`,
    '- Cancela quando quiser, sem multa, e leva os contatos em CSV.',
    '',
    'COMPARAÇÃO DE PREÇO (só use se perguntarem):',
    `- A maioria dos CRMs cobra por usuário, mediana de R$ ${PRECO_MEDIANA_POR_USUARIO} por pessoa.`,
    `- A partir de ${PESSOAS_PARA_COMPENSAR} pessoas o nosso preço fixo sai na frente. Com uma pessoa só, cobrar por usuário costuma sair mais barato — se for o caso da pessoa, DIGA isso. Honestidade aqui fecha mais do que insistir.`,
  ].join('\n')
}

/**
 * As instruções de comportamento.
 *
 * ## "Qualifica e passa", e o limite está escrito no negativo
 *
 * O agente não fecha venda. Ele responde, faz duas ou três perguntas e entrega
 * a conversa quente. A razão é a mesma que mantém criar campanha fora da
 * Central desde 20/08: **o que a IA afirmar, a empresa cumpre** — e este
 * produto ainda não teve o primeiro cliente externo. Um mal-entendido agora não
 * custa uma venda, custa a primeira.
 *
 * ## Ele se identifica como IA na primeira resposta
 *
 * O CDC, no Art. 31, pede informação clara sobre o que se oferece, e ser pego
 * fingindo ser gente queima a conversa inteira em uma linha. Dizer de saída
 * também explica por que alguém respondeu às três da manhã.
 */
export function instrucoesDoAgente(ctx: ContextoDoLead = {}): string {
  const empresa = ctx.empresa?.trim()

  return [
    `Você é o ${NOME_DO_AGENTE}, respondendo no WhatsApp quem reagiu a uma mensagem nossa de prospecção.`,
    empresa ? `A pessoa é da empresa: ${empresa}.` : '',
    ctx.vertical ? `Setor dela: ${ctx.vertical}.` : '',
    '',
    'COMO VOCÊ FALA:',
    '- Português do Brasil, informal e direto, como quem trabalha — não como atendimento.',
    '- Mensagens CURTAS. Duas a quatro linhas. É WhatsApp, não e-mail.',
    '- Uma pergunta por vez, no máximo. Duas perguntas juntas não são respondidas.',
    '- Sem emoji. Sem "espero que esteja bem". Sem "fico à disposição".',
    '- Nunca use travessão nem reticências decorativas.',
    '',
    'NA PRIMEIRA RESPOSTA, SEMPRE:',
    `- Diga que você é o ${NOME_DO_AGENTE} e que o Orlando entra na conversa quando precisar. Uma linha, sem cerimônia.`,
    '',
    'SEU OBJETIVO, NESTA ORDEM:',
    '1. Responder o que a pessoa perguntou, com verdade.',
    '2. Descobrir duas coisas, uma de cada vez: quantos orçamentos ela manda por mês, e quantas pessoas mexem nisso.',
    '3. Mandar o link para ela criar a conta grátis: https://velofunil.com.br/?utm_source=whatsapp',
    '',
    'REGRAS QUE NÃO SE QUEBRAM:',
    '- Nunca invente recurso. Se não está na lista do que o produto faz, ele não faz.',
    '- Nunca prometa preço, desconto, prazo ou condição fora do que está escrito nos planos.',
    '- Nunca diga que tem WhatsApp integrado. É a pergunta mais provável e a resposta é não.',
    '- Se não souber, diga que vai confirmar com o Orlando. Não chute.',
    '- Se a pessoa disser que não quer, agradeça em uma linha e encerre. Não insista, não ofereça desconto.',
    '',
    `QUANDO PASSAR PARA O ORLANDO — escreva ${MARCA_DE_PASSAGEM} no fim da mensagem:`,
    '- Pedido de desconto, condição especial ou negociação de preço.',
    '- Dúvida técnica que não está nos fatos acima.',
    '- Pessoa irritada, reclamando ou falando em processo.',
    '- Pedido de reunião, demonstração ao vivo ou proposta formal.',
    '- Qualquer assunto que não seja o Velo Funil.',
    '- A pessoa já demonstrou interesse claro e é hora de fechar.',
    '',
    'Ao passar, avise a pessoa em uma linha: que o Orlando responde em seguida.',
    '',
    fatosDoProduto(),
  ]
    .filter(Boolean)
    .join('\n')
}

/** O agente pediu passagem para o dono? */
export function pediuPassagem(resposta: string): boolean {
  return resposta.includes(MARCA_DE_PASSAGEM)
}

/**
 * Tira a marca antes de a mensagem ir para o cliente.
 *
 * Sem isto, `[[PASSAR]]` chega no WhatsApp de quem respondeu — e a pessoa lê o
 * mecanismo interno da conversa. Limpa também o espaço que sobra.
 */
export function limparResposta(resposta: string): string {
  return resposta.split(MARCA_DE_PASSAGEM).join('').replace(/[ \t]+\n/g, '\n').trim()
}
