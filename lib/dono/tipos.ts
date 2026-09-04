/**
 * O vocabulário da Central do Dono.
 *
 * Os nomes aqui são deliberadamente os da TELA, não os do banco: `empresa` e
 * não workspace, `contatos` e não leads, `pagando` e não `active`. A Central é
 * lida às pressas, entre uma coisa e outra, e traduzir jargão na cabeça a cada
 * leitura é atrito que se paga todo dia — a mesma razão registrada em
 * `docs/prd-copy-sem-jargao.md` para a landing.
 */

import type { EstadoDoAcesso, QuadroDeReceita } from './receita'

/** Como uma empresa aparece na lista. */
export type EmpresaNaCentral = {
  id: string
  nome: string
  /** Nome do dono (quem criou), vindo de `auth.users`. Pode faltar. */
  dono: string | null
  /** E-mail do dono. É o que o dono da plataforma usa para entrar em contato. */
  email: string | null
  telefone: string | null
  /** Se o Pro está valendo AGORA, decidido pela RPC `pro_vigente`. */
  /**
   * `pro_vigente()` no banco: a empresa PODE usar o Pro.
   *
   * Não confundir com "paga". A função é `assinatura viva OU trial válido`, e
   * usá-la como receita foi o defeito corrigido em 30/08 — ver
   * `lib/dono/receita.ts`. O estado de dinheiro é `estadoDoAcesso`, abaixo.
   */
  pagando: boolean
  /** `trial_ate` no futuro. Acesso grátis, receita zero. */
  emTrial: boolean
  /** `ehContaDeTeste` do e-mail de quem criou. Nunca conta como cliente. */
  interna: boolean
  /** O que `subscriptions.status` diz, quando existe linha. */
  statusAssinatura: 'trialing' | 'active' | 'past_due' | 'canceled' | null
  /** Quando o Pro vence. Nulo significa vencido, não "sem prazo" (migration 0044). */
  proVenceEm: string | null
  criadoEm: string
  /** Último login do dono. Nulo se nunca entrou depois de criar. */
  ultimoAcesso: string | null
  quantidadeDeMembros: number
  quantidadeDeContatos: number
  quantidadeDeNegocios: number
  /**
   * A campanha de anúncio que trouxe esta empresa, quando ela veio de uma.
   *
   * Gravado por `components/landing/utm-capture.tsx` a partir da URL. É o que
   * permite dizer quanto custou cada cliente pagante — ver `atribuicao.ts`.
   */
  utmCampaign: string | null
  /**
   * A PEÇA (criativo) que trouxe, dentro da campanha.
   *
   * Coluna criada pela migration 0069 e gravada desde então, mas lida pela
   * primeira vez em 04/09: os seis criativos apontam para o mesmo `/cadastro` e
   * só se distinguem por aqui, então sem este campo o relatório junta os seis
   * num número só e o teste de argumento não conclui nada.
   */
  utmContent: string | null
  /** Se chegou por um clique de anúncio do Meta (o `fbclid` da URL). */
  veioDeCliqueDeAnuncio: boolean
}

/** As famílias de problema que a Central sabe reconhecer. */
export type TipoDePendencia =
  | 'assinatura-orfa'
  | 'assinatura-nao-entrega'
  | 'assinatura-de-teste'
  | 'pro-vencendo'
  | 'email-nao-chegou'
  | 'email-com-erro-de-digitacao'
  | 'cliente-sumido'
  | 'erros-no-produto'

/** Um item da fila de "precisa da sua atenção". */
export type Pendencia = {
  /** Estável por item, para o React reconciliar a lista sem piscar. */
  id: string
  /**
   * Quão urgente. `dinheiro` é o topo porque é o único que custa caro por dia
   * parado; `atencao` é problema real sem sangramento imediato.
   */
  gravidade: 'dinheiro' | 'atencao'
  /** Usado para agrupar itens iguais e para silenciar uma família inteira. */
  tipo: TipoDePendencia
  titulo: string
  /** A frase que explica o que aconteceu, em português de dono de negócio. */
  detalhe: string
  /** Para quem quiser agir por fora (ligar, mandar e-mail). */
  empresa?: string
  email?: string
  /** Preenchido quando existe uma ação de um clique que resolve. */
  acao?: {
    tipo: 'consertar-assinatura'
    /** `asaas_subscription_id` ou id da empresa, conforme o tipo. */
    alvo: string
    rotulo: string
  }
}

/**
 * Os números do topo que vêm SÓ do banco.
 *
 * Receita saiu daqui em 30/08: ela depende do gateway, e calculá-la a partir
 * de `pro_vigente()` transformava trial gratuito em R$ 49/mês. Ver
 * `lib/dono/receita.ts`.
 */
export type NumerosDaCentral = {
  contasCriadas: number
  novasEm7Dias: number
}

/**
 * A empresa com o estado de DINHEIRO já decidido.
 *
 * Tipo separado de propósito, e a separação é a arquitetura: `queries.ts` só
 * conhece o banco e não tem como saber quem paga — `pro_vigente()` responde
 * "pode usar?", não "pagou?". Só `central.ts`, que também fala com o Asaas,
 * consegue produzir este tipo.
 *
 * Fazer os dois serem o mesmo tipo permitiria a uma função que só leu o banco
 * afirmar quem é cliente, que é exatamente o defeito corrigido em 30/08.
 */
export type EmpresaComEstado = EmpresaNaCentral & {
  /**
   * `null` quando o Asaas não respondeu: "não sei quem paga" é diferente de
   * "ninguém paga", e a segunda é afirmação falsa com cara de dado.
   */
  estadoDoAcesso: EstadoDoAcesso | null
}

/** Uma assinatura como o Asaas a devolve, para cruzar contra o banco. */
export type AssinaturaNoAsaas = { id: string; status: string; deleted: boolean }

/** O que o Asaas diz sobre o dinheiro, independente do nosso banco. */
export type DinheiroNoAsaas = {
  saldo: number
  aReceber: { quantidade: number; total: number }
  vencido: { quantidade: number; total: number }
  recebido: { quantidade: number; total: number }
  assinaturasAtivas: number
  /**
   * A lista crua, para o cruzamento das pendências.
   *
   * Vem daqui e não de uma chamada própria: `/subscriptions` era buscada
   * DUAS vezes por abertura da Central, e as 8 chamadas por F5 estouraram o
   * limite do Asaas em 30/08 (`429`, com a tela inteira sem dinheiro).
   */
  assinaturas: AssinaturaNoAsaas[]
  /**
   * Ids das assinaturas que de fato RECEBERAM dinheiro (RECEIVED ou
   * CONFIRMED). É o que separa receita de intenção — assinatura ACTIVE sem
   * pagamento é venda travada, não MRR.
   */
  comPagamento: Set<string>
}

/** Um e-mail transacional e se ele chegou. */
export type EmailEnviado = {
  id: string
  para: string
  assunto: string
  enviadoEm: string
  /** `delivered`, `bounced`, `complained`, `sent`... vem cru do Resend. */
  ultimoEvento: string
  /** Verdadeiro só em `delivered`. O resto merece olhar. */
  chegou: boolean
}

/**
 * Toda fonte externa pode estar fora do ar sem que isso derrube a tela.
 *
 * O Asaas cair não pode apagar a lista de clientes, que vem de outro lugar e
 * está perfeitamente disponível. Cada bloco carrega o próprio resultado, e a
 * tela mostra o erro daquele bloco só — em vez de uma página de erro inteira
 * que esconde os 90% que funcionam.
 */
export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string }

/** Tudo que a página precisa, numa carga só. */
export type DadosDaCentral = {
  numeros: NumerosDaCentral
  /**
   * O dinheiro de verdade, cruzado com o Asaas.
   *
   * `null` quando o gateway não respondeu — e a tela precisa dizer isso, em
   * vez de mostrar R$ 0,00, que afirmaria algo falso.
   */
  receita: QuadroDeReceita | null
  empresas: EmpresaComEstado[]
  /**
   * Verdadeiro quando alguma busca bateu no teto de linhas e os números podem
   * estar cortados. O PostgREST corta em 1.000 sem avisar — armadilha já paga
   * três vezes neste projeto. Melhor dizer que o número é suspeito do que
   * mostrar um número errado com cara de certo.
   */
  podeEstarCortado: boolean
  dinheiro: Resultado<DinheiroNoAsaas>
  emails: Resultado<EmailEnviado[]>
  /** O anúncio vive em `/dono/anuncio`, com leitura própria — ver `central.ts`. */
  pendencias: Pendencia[]
  /**
   * O que o dono mandou parar de mostrar.
   *
   * Vem junto, e não descartado, porque silenciar sem poder desfazer é o mesmo
   * que perder: sem esta lista não haveria como oferecer "mostrar de novo".
   */
  silenciadas: Pendencia[]
  errosRecentes: number
  /** Quando esta leitura foi feita, para a tela poder dizer "há 2 minutos". */
  lidoEm: string
}

// Os tipos do anúncio moram em `meta-ads.ts` e `atribuicao.ts`, junto de quem
// os produz: eles só interessam à página `/dono/anuncio`, e trazê-los para o
// vocabulário comum faria parecer que a Visão geral depende deles.
