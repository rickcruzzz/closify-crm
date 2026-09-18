/**
 * O título e a descrição de cada tela do produto, num lugar só.
 *
 * ## O defeito que isto fecha, e por que ele volta sozinho
 *
 * `loading.tsx` e `page.tsx` desenham o MESMO cabeçalho, e cada um tinha a sua
 * cópia da string. Na tela de Resultados isso já custou dez dias: a renomeação
 * de 19/08 tirou "Dashboard" do produto e a de 22/08 trocou a descrição, mas
 * só na página. O esqueleto de carregamento ficou para trás e seguiu
 * escrevendo `Dashboard / Métricas do seu funil de vendas` — ou seja, **toda
 * visita à tela mostrava o jargão banido primeiro**, e num aparelho lento por
 * mais tempo.
 *
 * Aquele caso ganhou uma constante (`lib/dashboard/cabecalho.ts`, agora
 * absorvida aqui). **As outras sete telas continuaram expostas**, medido em
 * 01/09: Funil, Contatos, Hoje, Conversas, Calendário, Perfil e Configurações
 * repetiam o texto à mão nos dois arquivos.
 *
 * Nenhum `tsc`, `lint` ou `test` compara um `loading.tsx` com o `page.tsx`
 * irmão: para as três ferramentas, duas strings diferentes em dois arquivos
 * diferentes são apenas duas strings. Corrigir o texto de cada uma deixaria a
 * causa de pé, e a próxima renomeação recriaria a divergência do mesmo jeito.
 *
 * ## A regra de escrita: dizer o que a tela RESPONDE
 *
 * Uma descrição que define a tela ("Busque, filtre e acompanhe seus contatos")
 * é uma legenda de funcionalidade: correta, e não diz a ninguém por que abrir
 * aquilo importa. A auditoria de 01/09 (`docs/auditoria-usabilidade.md`)
 * mediu a consequência disso — a landing inteira é construída sobre *"O
 * WhatsApp guarda a conversa. Não guarda o cliente"*, e nenhuma tela do
 * produto retomava a ideia. A pessoa reconhece a dor no anúncio, entra, e
 * encontra um sistema de cadastro.
 *
 * Então cada descrição aqui responde uma pergunta que alguém faria em voz
 * alta, e três delas reancoram a dor que trouxe a pessoa até aqui. O teste
 * irmão trava a regra para todas, não só para a que já tinha caído.
 */

/**
 * As chaves são `title`/`description`, em inglês, e isso é deliberado num
 * projeto cujo domínio é escrito em português: este objeto existe para
 * alimentar o `PageHeader`, e casar com a interface dele permite
 * `<PageHeader {...CABECALHOS.kanban} />`.
 *
 * A alternativa era `titulo`/`descricao` com uma tradução em cada uso — uma
 * camada que não carrega significado nenhum e cujo único efeito possível é
 * alguém esquecer metade dela. O nome do módulo e as decisões seguem em
 * português, que é onde elas importam.
 */
export type CabecalhoDeTela = {
  title: string
  description: string
}

/**
 * As chaves são o nome da rota, sem barra: é o que torna óbvio, ao ler um
 * `loading.tsx`, qual entrada ele deve usar.
 */
export const CABECALHOS = {
  /**
   * "Resultados", nunca "Dashboard": anglicismo que o PRD de copy bane
   * (`docs/prd-copy-sem-jargao.md`) e que a renomeação de 19/08 removeu do
   * produto inteiro.
   *
   * A descrição já seguia a regra desde 22/08 e por isso não mudou — quem
   * abre o sistema pergunta por dinheiro, não por métrica.
   */
  dashboard: {
    title: 'Resultados',
    description: 'Quanto entrou, quanto está em jogo e o que virou venda.',
  },

  /**
   * Era *"Cada negócio, do primeiro contato ao fechamento. Arraste o card
   * conforme a conversa avança."* — definia a tela e ainda ensinava a
   * arrastar, instrução que o próprio card já dá ao ser pego.
   *
   * A pergunta que alguém faz ao abrir o funil não é "o que é isto", é **"o
   * que está travado"**. Negócio parado é o que morre calado, e o filtro
   * "Parados" existe nesta tela justamente por isso.
   */
  kanban: {
    title: 'Funil',
    description: 'Em que pé está cada negócio, e qual deles parou de andar.',
  },

  /**
   * Era *"Busque, filtre e acompanhe seus contatos."* — três verbos de
   * interface, nenhum motivo.
   *
   * Esta é a tela que responde à dor mais forte do produto, registrada desde
   * a pesquisa de 21/08 e nunca dita dentro do sistema: **o vendedor sai e
   * leva a carteira junto**, porque o histórico mora no celular dele.
   * Esquecer uma venda dói uma vez; perder o histórico não tem conserto.
   */
  leads: {
    title: 'Contatos',
    description: 'Todo mundo com quem a empresa já falou, fora do celular de quem atendeu.',
  },

  /**
   * Era *"O que precisa da sua atenção, por prazo."* — perto do certo, e
   * ainda descrevia o critério de ordenação em vez da consequência.
   */
  hoje: {
    title: 'Hoje',
    description: 'Com quem falar hoje, para nenhuma venda morrer esperando.',
  },

  /**
   * A frase descrevia a ORDEM, e a ordem mudou em 18/09: a lista passou a pôr
   * a mensagem mais recente no topo, como todo aplicativo de mensagem.
   *
   * Deixar o texto antigo faria o cabeçalho prometer um critério que a lista
   * não usa mais, e é a classe de defeito que este projeto mais paga: número
   * certo com palavra contando outra coisa.
   *
   * A frase nova descreve o que a tela AINDA faz e que nenhum chat faz: quem
   * espera fica acima de quem já foi respondido, e o relógio conta o tempo.
   */
  // Era "Conversas". Passou a ser "WhatsApp" em 17/09, quando os dois itens de
  // menu viraram um: o titulo da tela precisa dizer o mesmo que o item
  // clicado, senao a pessoa clica em WhatsApp e chega numa tela chamada outra
  // coisa, que e o sinal classico de ter ido parar no lugar errado.
  conversas: {
    title: 'WhatsApp',
    description: 'Quem está esperando resposta, com o relógio de quanto tempo faz.',
  },

  /**
   * Já respondia. Mantida como estava.
   */
  calendario: {
    title: 'Calendário',
    description: 'O que aconteceu e o que vem por aí, tudo num lugar.',
  },

  /**
   * Tela administrativa: ninguém abre o perfil esperando vender mais, abre
   * para trocar o próprio nome. Forçar uma promessa aqui soaria falso, e a
   * regra existe para orientar, não para virar fórmula.
   */
  perfil: {
    title: 'Meu perfil',
    description: 'Seus dados de acesso e exibição.',
  },
} as const satisfies Record<string, CabecalhoDeTela>

export type NomeDeTela = keyof typeof CABECALHOS
