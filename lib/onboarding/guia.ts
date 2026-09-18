import type { SinaisDeAtivacao } from '@/lib/onboarding/checklist'

/**
 * O guia interativo: o produto pegando na mao de quem acabou de entrar.
 *
 * ## O que ele substitui, e por que o formato antigo nao servia
 *
 * Ate 17/09 o primeiro contato com o produto era `TourDeBoasVindas`, cinco
 * `Dialog` centrais em sequencia. Ele descrevia telas em vez de abri-las: a
 * pessoa lia "o funil mostra cada negocio na etapa em que esta", clicava
 * "Proximo" quatro vezes, e terminava diante do mesmo CRM vazio de antes, sem
 * ter tocado em nada.
 *
 * O numero que condena o formato ja estava medido em 01/09: **25 das 42
 * empresas nunca criaram um contato**, contra 88% que concluem o assistente de
 * perguntas. O gargalo nunca foi explicar o produto. Era dar o primeiro passo
 * dentro dele.
 *
 * ## A conclusao e DERIVADA, nunca marcada
 *
 * Mesma doutrina de `montarChecklist`, e pelo mesmo motivo: um `boolean`
 * gravado quando a pessoa cria o primeiro contato continuaria dizendo "feito"
 * depois que ela apagasse esse contato. Aqui o custo do erro e maior, porque o
 * guia nao so informa, ele MANDA fazer: um passo marcado a mao daria
 * "Concluido" para quem nao fez, e pediria de novo para quem fez.
 *
 * Isso tambem entrega a idempotencia de graca. Quem importou uma planilha
 * antes de o guia comecar ja tem contato, e o passo 1 nasce concluido, sem
 * nenhum caso especial escrito para isso.
 *
 * A unica excecao sao os passos de VISITA, que nao tem sinal no banco: "ver a
 * tela Hoje" nao deixa registro. Esses ficam na lista de visitadas, gravada em
 * `onboarding_state.respostas`, e e por isso que os dois tipos existem.
 */

export type ChaveDoPasso =
  | 'contato'
  | 'negocio'
  | 'orcamento'
  | 'hoje'
  | 'conversas'
  | 'resultados'

/**
 * Como o passo sabe que terminou.
 *
 * `dado` le o banco: a acao criou uma linha, e a linha e a prova. `visita` le
 * a rota: nao ha o que criar, a acao e conhecer a tela.
 *
 * Nao existe um terceiro tipo por tempo, e essa ausencia e a regra: passo que
 * avanca sozinho depois de alguns segundos volta a ser o slideshow que este
 * arquivo substituiu.
 */
export type GatilhoDeConclusao =
  | { tipo: 'dado'; sinal: 'leads' | 'negocios' | 'orcamentos' }
  | { tipo: 'visita' }

export type PassoDoGuia = {
  chave: ChaveDoPasso
  /** Onde o passo acontece. O guia leva a pessoa ate aqui antes de apontar. */
  rota: string
  /**
   * O valor de `data-tour` do elemento destacado.
   *
   * Atributo dedicado, e nao seletor de classe ou texto: classe do Tailwind
   * muda com o desenho, e texto muda com a copy. Os dois quebrariam em
   * silencio, que e o pior jeito de um guia quebrar, ele continua rodando e
   * aponta para lugar nenhum.
   */
  alvo: string
  titulo: string
  /** Uma frase. O que fazer, na ordem em que se faz. */
  texto: string
  conclusao: GatilhoDeConclusao
  /**
   * Passo que so existe para quem pode faze-lo.
   *
   * Conversas sem o plano Max e uma caixa de entrada que nunca vai receber
   * mensagem. Mandar alguem conhece-la seria vender no meio do onboarding, e o
   * pedido era ensinar o sistema real.
   */
  exigeMax?: true
}

/**
 * Os passos, na ordem em que o produto entrega valor.
 *
 * ## Por que estes seis, e nao os doze possiveis
 *
 * Cada passo custa uma decisao de quem acabou de chegar, entao a lista foi
 * cortada pelo que o produto de fato resolve. O ICP foi medido em 07/09 e a
 * dor tem nome: **o orcamento que o cliente nao responde**. Os tres primeiros
 * passos constroem exatamente esse caminho, contato, negocio, validade, e o
 * quarto mostra a tarefa que nasceu sozinha dele.
 *
 * Ficaram de fora, de proposito: calendario (e outra vista das mesmas tarefas
 * do passo 4), importar planilha (caminho alternativo do passo 1, e quem tem
 * planilha acha o botao ao lado), convidar equipe (o cliente tipico e PME de
 * uma ou duas pessoas, ja aprendido em `getting-started-card`) e configurar a
 * empresa (trabalho administrativo que nao devolve nada, ja rebaixado para o
 * fim do checklist em 01/09 pelo mesmo motivo).
 *
 * ## O passo 3 e o unico que ensina o produto, e nao a categoria
 *
 * Contato e negocio qualquer CRM tem. Guardar a validade e ver a cobranca
 * nascer sozinha e o que 0 de 25 geradores de orcamento fazem, medido em
 * 09/09. Se a pessoa sair do guia antes dele, ela conheceu um CRM generico.
 */
export const PASSOS_DO_GUIA: PassoDoGuia[] = [
  {
    chave: 'contato',
    rota: '/leads',
    alvo: 'novo-contato',
    titulo: 'Comece pelo primeiro contato',
    texto: 'Clique em Novo contato e salve alguem com quem voce ja conversa.',
    conclusao: { tipo: 'dado', sinal: 'leads' },
  },
  {
    chave: 'negocio',
    rota: '/kanban',
    alvo: 'novo-negocio',
    titulo: 'Transforme o contato em negocio',
    texto: 'Clique em Novo negocio, escolha o contato e de um valor a oportunidade.',
    conclusao: { tipo: 'dado', sinal: 'negocios' },
  },
  {
    chave: 'orcamento',
    rota: '/kanban',
    alvo: 'card-de-negocio',
    titulo: 'Agora a parte que so o Velo Funil faz',
    texto:
      'Abra o negocio e preencha a validade do orcamento. A cobranca do retorno nasce sozinha, dois dias antes de vencer.',
    conclusao: { tipo: 'dado', sinal: 'orcamentos' },
  },
  {
    chave: 'hoje',
    rota: '/hoje',
    alvo: 'nav:/hoje',
    titulo: 'Aqui esta a cobranca que nasceu',
    texto: 'Hoje e a tela de abrir de manha: ela reune tudo que vence, sem voce procurar.',
    conclusao: { tipo: 'visita' },
  },
  {
    chave: 'conversas',
    rota: '/conversas',
    alvo: 'nav:/conversas',
    titulo: 'As conversas ficam com a empresa',
    texto: 'Cada mensagem cai na conversa do contato, com o negocio dele do lado.',
    conclusao: { tipo: 'visita' },
    exigeMax: true,
  },
  {
    chave: 'resultados',
    rota: '/dashboard',
    alvo: 'nav:/dashboard',
    titulo: 'E o placar do mes fica aqui',
    texto: 'Resultados soma o que esta em negociacao e o que ja virou venda.',
    conclusao: { tipo: 'visita' },
  },
]

/** O que o guia precisa saber para decidir sozinho o que ja esta feito. */
export type EstadoDoGuia = {
  sinais: Pick<SinaisDeAtivacao, 'leads' | 'negocios'> & { orcamentos: number }
  /** Passos de visita ja cumpridos, vindos de `onboarding_state.respostas`. */
  visitadas: ChaveDoPasso[]
  temMax: boolean
}

export type PassoResolvido = PassoDoGuia & { concluido: boolean; indice: number }

/**
 * Deriva a lista de passos que ESTA pessoa deve ver, com o que ja fez marcado.
 *
 * O indice e calculado depois do filtro, nao antes: sem o Max a lista tem
 * cinco passos, e "3 de 6" com um numero que nunca chega seria o contador
 * mentindo sobre o proprio fim.
 */
export function montarGuia(estado: EstadoDoGuia): PassoResolvido[] {
  return PASSOS_DO_GUIA.filter((p) => !p.exigeMax || estado.temMax).map((passo, indice) => ({
    ...passo,
    indice,
    concluido:
      passo.conclusao.tipo === 'dado'
        ? estado.sinais[passo.conclusao.sinal] > 0
        : estado.visitadas.includes(passo.chave),
  }))
}

/**
 * O passo que a pessoa esta vivendo agora: o primeiro em aberto.
 *
 * Primeiro em aberto e nao "o proximo depois do ultimo concluido": quem chega
 * com contatos importados e sem negocio nenhum tem o passo 1 feito e o 2 nao,
 * e e no 2 que ela precisa de ajuda. Contar a partir do fim a mandaria para o
 * passo 3.
 */
export function passoAtivo(passos: PassoResolvido[]): PassoResolvido | null {
  return passos.find((p) => !p.concluido) ?? null
}

export function guiaCumprido(passos: PassoResolvido[]): boolean {
  return passos.length > 0 && passos.every((p) => p.concluido)
}

/** Quantos dos passos ja sairam do caminho, para a barra de progresso. */
export function concluidosNoGuia(passos: PassoResolvido[]): number {
  return passos.filter((p) => p.concluido).length
}

/**
 * A rota atual serve para o passo?
 *
 * Prefixo e nao igualdade: `/leads/<id>` continua sendo a tela de contatos, e
 * quem abriu o contato que acabou de criar nao deve ver o guia decretar que
 * ela se perdeu.
 */
export function naRotaDoPasso(passo: PassoDoGuia, rotaAtual: string): boolean {
  return rotaAtual === passo.rota || rotaAtual.startsWith(`${passo.rota}/`)
}

/**
 * O passo de visita da rota atual, se houver.
 *
 * Existe para o cliente marcar a visita SEM precisar saber qual passo esta
 * ativo: chegar em `/hoje` cumpre o passo de Hoje mesmo que a pessoa tenha ido
 * la por conta propria, fora da ordem do guia. Guia que ignora o que a pessoa
 * ja fez sozinha e guia que a manda repetir.
 */
export function visitaCumpridaEm(rotaAtual: string): ChaveDoPasso | null {
  const passo = PASSOS_DO_GUIA.find(
    (p) => p.conclusao.tipo === 'visita' && naRotaDoPasso(p, rotaAtual),
  )
  return passo?.chave ?? null
}

/**
 * Le a lista de visitas gravada em `onboarding_state.respostas`.
 *
 * O `jsonb` e livre, entao o que volta de la pode ser qualquer coisa: chave
 * ausente, `null`, um numero, ou uma lista com strings que nao sao passo
 * nenhum (um passo renomeado numa versao anterior). Nada disso pode derrubar o
 * layout do produto inteiro, que e onde o guia e montado.
 *
 * Por isso a leitura filtra contra `PASSOS_DO_GUIA` em vez de confiar num
 * `as ChaveDoPasso[]`: o `tsc` nao le o banco, e um `as` aqui seria a
 * afirmacao que ninguem conferiu.
 */
export function lerVisitadas(respostas: unknown): ChaveDoPasso[] {
  const guia = (respostas as { guia?: { visitadas?: unknown } } | null)?.guia
  if (!Array.isArray(guia?.visitadas)) return []

  const validas = new Set<string>(PASSOS_DO_GUIA.map((p) => p.chave))
  return guia.visitadas.filter(
    (v): v is ChaveDoPasso => typeof v === 'string' && validas.has(v),
  )
}

/* ------------------------------------------------------------------------- *
 * A geometria do cartao do guia.
 *
 * Mora aqui, e nao no componente, por um motivo pratico: a suite de testes
 * cobre `lib/**` e nao tem transformacao de JSX, entao nada dentro de um
 * `.tsx` pode ser exercitado. E esta e justamente a parte que quebra em
 * silencio, um alvo na quina da janela empurra o cartao para fora da tela sem
 * erro nenhum no console.
 * ------------------------------------------------------------------------- */

/** Folga entre o recorte e a borda do elemento destacado. */
export const FOLGA_DO_RECORTE = 8
/** Distancia do cartao ate o recorte. */
export const RESPIRO_DO_CARTAO = 14
/** Margem minima ate a borda da janela. */
export const MARGEM_DA_JANELA = 16
export const LARGURA_DO_CARTAO = 328

export type Retangulo = { top: number; left: number; width: number; height: number }

/**
 * Onde o cartao cabe, nesta ordem: abaixo do alvo, acima, e por fim preso ao
 * rodape da janela.
 *
 * O terceiro caso nao e desistencia, e o caminho normal em tela estreita: com
 * 390px de largura nao ha "ao lado", e o cartao no rodape e o formato que todo
 * aplicativo de celular usa para instrucao passo a passo.
 *
 * Os dois `clamp` sao o que cumpre "nunca deixar o tooltip fora da tela": alvo
 * na quina da janela empurraria o cartao para fora sem eles.
 */
export function posicionarCartao({
  recorte,
  alturaDoCartao,
  largura,
  janela,
}: {
  recorte: Retangulo | null
  alturaDoCartao: number
  largura: number
  janela: { largura: number; altura: number }
}): { top: number; left: number } {
  if (janela.largura === 0) return { top: MARGEM_DA_JANELA, left: MARGEM_DA_JANELA }

  const rodape = {
    top: janela.altura - alturaDoCartao - MARGEM_DA_JANELA,
    left: Math.max(MARGEM_DA_JANELA, (janela.largura - largura) / 2),
  }

  if (!recorte) return rodape

  const abaixo = recorte.top + recorte.height + RESPIRO_DO_CARTAO
  const acima = recorte.top - alturaDoCartao - RESPIRO_DO_CARTAO

  const top =
    abaixo + alturaDoCartao + MARGEM_DA_JANELA <= janela.altura
      ? abaixo
      : acima >= MARGEM_DA_JANELA
        ? acima
        : rodape.top

  const centralizado = recorte.left + recorte.width / 2 - largura / 2
  const left = Math.min(
    Math.max(MARGEM_DA_JANELA, centralizado),
    Math.max(MARGEM_DA_JANELA, janela.largura - largura - MARGEM_DA_JANELA),
  )

  return { top, left }
}
