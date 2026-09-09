/**
 * A primeira mensagem, montada a partir do que o site do prospect DIZ.
 *
 * Uma lista de mil contatos não vale nada sem a primeira frase, e a primeira
 * frase é onde a prospecção fria morre: mensagem genérica é ignorada, e
 * mensagem que finge conhecer a empresa é pior — ela mente na primeira linha e
 * a pessoa percebe.
 *
 * ## As quatro regras, e cada uma existe para não queimar o número
 *
 * **Nunca afirmar dor que não foi medida.** "Vi que você está perdendo vendas"
 * é invenção: nós lemos o site, não a carteira. Vira PERGUNTA, que é honesta e
 * converte melhor porque obriga resposta.
 *
 * **Sempre dizer de onde veio o contato.** Exigência prática da LGPD para
 * interesse legítimo (Art. 7º, IX) e, antes disso, o que separa abordagem de
 * spam: quem não diz de onde tirou o número está escondendo alguma coisa.
 *
 * **Sempre oferecer a saída, na primeira mensagem.** Uma linha de descarte
 * custa nada e é a diferença entre "não tenho interesse" e uma denúncia de
 * spam — que no WhatsApp é o que derruba o número.
 *
 * ## Em 09/09 ela ficou mais profissional, sem perder a promessa
 *
 * O dono leu a mensagem pronta e disse que *"não te procuro de novo"* soava
 * mal. Trocada por *"pode ignorar. Não volto a procurar."* — mesma promessa,
 * registro de quem escreve para uma empresa e não para um conhecido.
 *
 * O que NÃO podia mudar é o compromisso ser explícito e verificável: ele é o
 * que transforma "não tenho interesse" em resposta em vez de denúncia, e é
 * `nao-perturbe.txt` que o cumpre na rodada seguinte. Uma linha educada que
 * não promete nada seria pior que a anterior.
 *
 * Sem travessão, pela decisão de 07/09: no WhatsApp ele vira caractere
 * estranho em teclado antigo, e no `wa.me` custa três bytes como `%E2%80%94`.
 *
 * Em 08/09 ela mudou de *"me avisa que não te procuro de novo"* para *"é só
 * ignorar"*, e o motivo é operacional: o dono decidiu **enviar sem responder**.
 * A frase antiga era uma promessa que exigia ação dele — e promessa que o
 * remetente não cumpre é exatamente o que transforma desinteresse em denúncia.
 * "É só ignorar" tem a mesma função e se cumpre sozinha.
 *
 * **Nada de número inventado.** Preço e limite saem de `lib/plans.ts`. Prova
 * social não entra: este produto não tem cliente externo, e a decisão travada
 * do projeto é não inventar nenhum.
 *
 * ## Por que curta
 *
 * A mensagem é lida no WhatsApp, na tela do celular, por alguém no meio do
 * expediente. Acima de ~500 caracteres ela vira bloco de texto e é descartada
 * sem leitura. `TETO` trava isso, e tem teste.
 */

/** Acima disto o WhatsApp mostra "Ler mais" e a mensagem morre ali. */
export const TETO = 560

/**
 * Para onde a pessoa vai, e por que ele é marcado.
 *
 * ## A mensagem não dizia ONDE
 *
 * Até 08/09 ela dizia *"Montei um CRM pra isso"*, dava o preço, prometia teste
 * grátis — e nunca dizia onde ver. Quem se interessasse tinha que **perguntar**,
 * e cada resposta exigida derruba conversão.
 *
 * ## O `utm_source` é o ÚNICO retorno que existe
 *
 * A operação é de envio, não de conversa: o dono manda e não responde. Sem a
 * marca no link, seriam quinhentas mensagens sem saber se uma pessoa sequer
 * abriu o site. `utm-capture.tsx` já grava `utm_source` no workspace de quem se
 * cadastra, então quem vier daqui aparece marcado sem código novo.
 *
 * ## O domínio raiz, e não a página de preço
 *
 * A home tem a barra de números, a tabela de comparação e a FAQ; a página de
 * preço tem um argumento só. E a prévia do link que o WhatsApp monta a partir
 * dela diz, em letra grande, *"O WhatsApp guarda a conversa. Não guarda o
 * cliente."* — que é a frase certa para ser lida dentro do WhatsApp. Medido em
 * 08/09: 1200x630, 43 KB, muito abaixo do teto de ~600 KB que faz o WhatsApp
 * desistir de renderizar.
 *
 * ## O `https://` é obrigatório, e a falta dele apareceu numa conversa real
 *
 * Em 09/09 o dono mandou a primeira mensagem e o cartão de prévia **não
 * apareceu** — só o link sublinhado. Medido contra produção, o lado do site
 * está são: `og:image` responde 200, PNG de 44 KB em 1200x630, e o mesmo HTML
 * chega quando a requisição usa o User-Agent do WhatsApp.
 *
 * O que faltava era o esquema. Sem `https://`, o WhatsApp reconhece o texto
 * como link e o deixa clicável — foi o que a conversa mostrou —, mas o
 * caminho que dispara a busca da prévia é o do endereço COMPLETO. Oito
 * caracteres a mais, e a mensagem mais longa (eventos) vai a 554 dos 560.
 *
 * **E há uma parte que não é código:** a prévia é montada pelo aparelho de
 * QUEM ENVIA, no momento em que o texto entra no campo. Com o `wa.me?text=` o
 * texto chega inteiro de uma vez, e apertar enviar no mesmo instante manda a
 * mensagem antes de a busca terminar. Esperar o cartão aparecer é do dono.
 */
const LINK = 'https://velofunil.com.br/?utm_source=whatsapp'

export type DadosDaAbordagem = {
  /** O domínio, que é como a pessoa reconhece a própria empresa. */
  dominio: string
  /** O nome do negócio, quando o título da página o revela. */
  nome?: string | null
  /** O nicho, que decide o gancho. */
  vertical: string
  /** Os motivos que a pontuação encontrou — só os que a mensagem pode citar. */
  motivos: string[]
  /** Preço e limite vêm de `lib/plans.ts`, nunca escritos à mão aqui. */
  precoMensal: number
  limiteGratis: number
  /** Empresas que o Pro cobre. Sai de `PRO_WORKSPACE_LIMIT`, nunca à mão. */
  limiteDeEmpresas: number
  /**
   * O primeiro nome de quem decide, quando `dominio/decisor.ts` conseguiu casar
   * o perfil com ESTA empresa. `null` é o caso comum e é seguro.
   *
   * Chamar pelo nome atravessa a recepção. Chamar pelo nome ERRADO queima a
   * abordagem na primeira palavra — por isso o extrator devolve `null` em vez
   * de arriscar, e por isso aqui a saudação simplesmente volta a ser genérica.
   */
  decisor?: string | null
}

/**
 * O gancho por nicho, escrito na linguagem de quem vende ali.
 *
 * Cada um nomeia o momento em que o dinheiro escapa naquele negócio — e todos
 * são formulados como PERGUNTA, porque afirmar seria inventar.
 *
 * ## O verbo NÃO pode ser "cobrar", e isso foi medido (09/09)
 *
 * O gancho de dedetização e o padrão diziam "quem lembra de COBRAR de volta?".
 * Buscado no Exa o que responde para *"como cobrar retorno de orçamento"*, os
 * 8 primeiros resultados eram **inadimplência** — cobrar quem não pagou, com
 * modelo de mensagem e advogado. No português do cliente, cobrar é receber
 * dívida.
 *
 * Numa mensagem fria isso é pior do que numa página: ela chega de um número
 * desconhecido, sem contexto nenhum para desambiguar, e a primeira associação
 * de quem lê é cobrança ou golpe. Eram 101 dos 790 domínios do universo, mais
 * todo nicho novo, que herda o padrão.
 *
 * O verbo que o mercado usa é "follow-up" (10 de 10 títulos do tema), e é
 * jargão de vendedor. O que sobra é o mais simples da língua: **dar o
 * retorno**. Zero dos 25 geradores de orçamento lidos usa, então também não
 * compete com ninguém.
 */
/**
 * O sorteio que quebra o padrão de texto idêntico, sem virar loteria.
 *
 * ## Por que variar
 *
 * `docs/mercado/limites-e-bloqueios.md` lista "texto idêntico" como o terceiro
 * padrão que faz o WhatsApp banir um número — *"a mesma string para centenas
 * de destinos e o padrão mais fácil de detectar"*. Medido em 08/09 sobre as
 * 882 mensagens da prateleira: eram **10 modelos**, personalizados só pelo
 * nome da empresa. Tecnicamente 788 textos distintos; na prática, dez.
 *
 * Com quatro pontos de variação a conta muda de dez para **algumas centenas**
 * de formas por nicho, e duas empresas do mesmo setor deixam de receber a
 * mesma frase.
 *
 * ## Por que DETERMINÍSTICO, e não sorteio de verdade
 *
 * `Math.random` faria a mesma empresa receber um texto diferente a cada vez
 * que a tela é aberta. Isso quebra três coisas: a prévia que o dono lê antes
 * de enviar deixa de ser o que será enviado; a mensagem gravada na timeline do
 * lead deixa de bater com a que saiu; e reabrir a fila depois de um Ctrl+C
 * mudaria o texto de quem ainda não recebeu.
 *
 * O domínio é a semente. A mesma empresa recebe sempre a mesma mensagem, e
 * empresas diferentes recebem mensagens diferentes.
 *
 * ## Por que uma semente por FATIA
 *
 * Com uma semente só, o domínio que caísse no índice 0 pegaria a variante 0 de
 * todas as fatias — e o número de mensagens distintas voltaria a ser o número
 * de variantes, não o produto delas. Misturar o nome da fatia na semente faz
 * as escolhas serem independentes entre si.
 */
function escolher<T>(opcoes: readonly T[], semente: string, fatia: string): T {
  // FNV-1a de 32 bits: determinístico, sem dependência, e espalha o suficiente
  // para 3 ou 4 posições. Não é hash criptográfico e não precisa ser — o que
  // se protege aqui é de repetição, não de adivinhação.
  let h = 0x811c9dc5
  for (const ch of `${fatia}:${semente}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return opcoes[h % opcoes.length]
}

/**
 * As aberturas. Todas dizem a MESMA coisa: achei você procurando, não comprei
 * sua lista.
 *
 * A honestidade da origem não é enfeite — é o que separa esta mensagem de
 * spam, e é ela que sustenta a linha de descarte no fim.
 */
const SAUDACAO = [
  (nome: string) => `Achei a ${nome} procurando empresas do setor no Google.`,
  (nome: string) => `Cheguei na ${nome} pesquisando empresas do setor aqui no Google.`,
  (nome: string) => `Encontrei a ${nome} enquanto procurava empresas do setor no Google.`,
  (nome: string) => `Vi a ${nome} numa busca por empresas do setor no Google.`,
] as const

/**
 * A oferta, em três formulações.
 *
 * As três carregam as mesmas duas coisas obrigatórias: o mecanismo ("cada
 * orçamento vira um card, com a data do retorno") e o preço pela empresa. A
 * primeira é o eco literal do `og:description` da landing, e por isso continua
 * na lista.
 */
const OFERTA = [
  (preco: number) =>
    `Montei um sistema pra isso: cada orçamento vira um card, com a data do retorno. ` +
    `R$ ${preco} pela empresa toda, sem cobrar por usuário.`,
  (preco: number) =>
    `Fiz um sistema pra isso: você guarda a validade e o card avisa na data do retorno. ` +
    `R$ ${preco} pela empresa toda, não por pessoa.`,
  (preco: number) =>
    `Construí um sistema pra isso: o orçamento entra com a data do retorno e o lembrete ` +
    `nasce junto. R$ ${preco} pela empresa toda.`,
] as const

/**
 * A linha do multi-empresa, e por que ela é OPCIONAL na mensagem.
 *
 * ## O mal-entendido que ela evita
 *
 * "R$ 49 pela empresa toda" é ambíguo para quem tem dois negócios — e no
 * Brasil isso é comum: a marcenaria e a loja de material, a dedetizadora e a
 * de limpeza. A pessoa lê "pela empresa toda" e não sabe se precisa pagar
 * duas vezes.
 *
 * Dizer o número resolve, e o número agora existe: a migration 0078 fez o Pro
 * cobrir cinco empresas do mesmo dono, todas com os recursos Pro. Antes disso
 * a frase seria mentira — a segunda empresa nascia Free.
 *
 * ## Por que não entra em todas
 *
 * A mensagem tem teto de 560 caracteres e a linha de descarte é intocável.
 * Quem tem duas empresas é minoria (3 de 45 na base medida em 09/09), então
 * pagar ~55 caracteres em toda mensagem para falar com poucos sairia caro em
 * "Ler mais" — que mata a mensagem inteira.
 *
 * Entra quando cabe, pelo mesmo mecanismo da linha de equipe: o que sai
 * quando estoura é o opcional, nunca o fim.
 */
const LINHA_MULTI_EMPRESA = (limite: number) =>
  ` Se você tem mais de um negócio, o mesmo preço cobre até ${limite}.`

/**
 * O convite para testar. As três dizem sem cartão, sem prisão e com o número.
 *
 * ## O limite fica dito, e não anunciado (09/09)
 *
 * As versões anteriores abriam com ele — *"Grátis até 50 contatos"* — e o dono
 * apontou: a primeira coisa que a frase comunicava era o teto, não o convite.
 * Numa mensagem fria, liderar pela restrição é dar motivo para parar de ler.
 *
 * O número CONTINUA, e isso não é negociável: quem se cadastra esperando
 * ilimitado e bate em 50 vive a mesma promessa quebrada que a landing acabou
 * de consertar em "Empresas ilimitadas". A mudança é de ênfase, não de
 * conteúdo — o convite vem primeiro e o teto vem junto, sem holofote.
 */
const TESTE = [
  (limite: number) =>
    `Testa sem pagar e sem cartão, com até ${limite} contatos. Sem fidelidade, e seus dados saem em CSV.`,
  (limite: number) =>
    `Dá pra usar de graça, sem cartão, com até ${limite} contatos. Cancela quando quiser e leva tudo em CSV.`,
  (limite: number) =>
    `Pode testar à vontade: sem cartão, até ${limite} contatos, e seus dados saem em CSV quando quiser.`,
] as const

const GANCHO: Record<string, readonly string[]> = {
  dedetizacao: [
    'Quando você manda um orçamento e o cliente some, quem lembra de dar o retorno?',
    'Quantos orçamentos você mandou esse mês e nunca teve resposta?',
    'Depois que o orçamento sai, o retorno fica na sua cabeça ou anotado em algum lugar?',
  ],
  'comunicacao-visual': [
    'Quando você manda um orçamento e o cliente some, o retorno fica na memória de quem?',
    'Orçamento de fachada demora pra decidir. Como você acompanha quem ficou de ver?',
    'Quantos orçamentos você mandou essa semana e não sabe dizer em que pé estão?',
  ],
  marcenaria: [
    'Planejados demoram semanas pra fechar. Como você acompanha quem ainda decide?',
    'Depois que o projeto e o valor saem, quem lembra de voltar antes do cliente esfriar?',
    'Quantos projetos de planejados estão parados esperando um retorno seu?',
  ],
  'locacao-equipamentos': [
    'Quando uma locação está terminando, quem lembra de oferecer a renovação?',
    'Orçamento de locação tem prazo curto. Como você acompanha quem pediu e não fechou?',
    'Quantas locações venceram esse mês sem ninguém oferecer a renovação?',
  ],
  'eventos-corporativos': [
    'Depois que a proposta do evento sai, quem acompanha o cliente até a assinatura?',
    'Proposta de evento leva semanas. Como você sabe quem ainda está decidindo?',
    'Quantas propostas de evento estão paradas esperando um retorno seu?',
  ],
}

const GANCHO_PADRAO = [
  'Quando você manda um orçamento e o cliente some, quem lembra de dar o retorno?',
  'Depois que o orçamento sai, o retorno fica na sua cabeça ou anotado em algum lugar?',
  'Quantos orçamentos você mandou esse mês e não sabe dizer em que pé estão?',
] as const

/**
 * As duas linhas que NUNCA podem ser cortadas, e o defeito que provou isso.
 *
 * A primeira versão montava a mensagem inteira e cortava no fim. Rodando contra
 * 90 prospects reais, a saída terminava assim:
 *
 *     "Se não fizer sentido, me avisa que…"
 *
 * O corte comeu exatamente a linha de descarte — a que transforma "não tenho
 * interesse" em resposta em vez de denúncia de spam, e que no WhatsApp é o que
 * separa um número vivo de um número banido. O teste passava, porque ele
 * conferia o TAMANHO e não o que sobrou.
 *
 * Agora o excesso sai do que é opcional (a linha da equipe), nunca do fim.
 */

/**
 * O nome que a pessoa reconhece. Título de página vem com cauda de SEO
 * ("Gráfica Quatrocor | Impressão em São Paulo"), e chamar a empresa pelo
 * título inteiro denuncia que a mensagem foi montada por máquina.
 */
export function nomeCurto(nome: string | null | undefined, dominio: string): string {
  if (!nome) return dominio
  // `»` e `›` sao separadores de trilha ("i9 Acrilicos » Porta Folhetos"), que
  // o corte original nao previa — medido em 08/09 sobre as 882 mensagens.
  const limpo = nome.split(/[|—–\-:•»«›‹]/)[0].replace(/\s+/g, ' ').trim()
  if (limpo.length < 3 || limpo.length > 40) return dominio
  if (ehTituloDePagina(limpo)) return dominio
  return desgritar(limpo)
}

/**
 * Título de página não é nome de empresa.
 *
 * Medido em 08/09 sobre os 589 contatos da prospecção: oito abriam com
 * *"Oi! Achei a Sobre a Empresa procurando empresas do setor"* — `Home`,
 * `Sobre NÓS`, `Empresa`, `Produtos`. O site não pôs o nome no `<title>`, e o
 * extrator pegou o rótulo do menu.
 *
 * ## A regra é "TODAS as palavras são genéricas", não "começa com uma"
 *
 * A primeira versão recusava qualquer nome começando por palavra genérica, e
 * derrubava três nomes REAIS: `Empresa Comunicação Visual SP`,
 * `Empresa Brasileira De Eventos` e `Empresa de Eventos em Brasília`. Trocar
 * um nome legítimo pelo domínio é pior que o defeito original — o domínio
 * denuncia máquina, o nome não.
 *
 * Palavra de uma letra é ignorada: `Produtos s` é `Produtos` com sujeira de
 * corte, e não um nome que por acaso tem duas palavras.
 */
const PALAVRAS_DE_MENU = new Set([
  'sobre', 'nos', 'home', 'inicio', 'pagina', 'inicial', 'principal', 'contato',
  'quem', 'somos', 'empresa', 'produtos', 'servicos', 'blog', 'bem', 'vindo',
  'vinda', 'institucional', 'index',
])

function ehTituloDePagina(nome: string): boolean {
  const palavras = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 1 && !['a', 'o', 'as', 'os', 'de', 'da', 'do', 'e', 'em'].includes(p))

  if (palavras.length === 0) return true
  return palavras.every((p) => PALAVRAS_DE_MENU.has(p))
}

/**
 * Nome escrito em CAIXA ALTA vira Caixa de Título.
 *
 * Medido em 08/09 sobre as 882 mensagens da prateleira: **44 nomes vinham todos
 * em maiúscula**, porque é assim que muita PME escreve o `<title>` do site.
 * A saudação virava *"Oi! Achei a SERRALHERIA EM PORTO ALEGRE procurando
 * empresas do setor"* — que lê como grito e denuncia montagem por máquina, que
 * é exatamente o que `nomeCurto` existe para evitar.
 *
 * **Só age quando o nome INTEIRO está em maiúscula.** Nome já misto é escolha
 * de quem escreveu, e reescrevê-lo estragaria marcas como `iFood` ou `AGGIO`.
 *
 * Sigla curta continua gritando de propósito: `DGA SISTEMAS` vira
 * `DGA Sistemas`, não `Dga Sistemas`. Três letras ou menos quase sempre é
 * sigla, e sigla em caixa alta está certa.
 *
 * E as conjunções descem: `E`, `DE`, `DA` viram minúsculas, senão o resultado
 * é `Grafica E Comunicacao`, que continua parecendo máquina — só que outra.
 */
const LIGACOES = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'em', 'para', 'com', 'a', 'o'])

function desgritar(nome: string): string {
  // `toLowerCase` diferente do original prova que há letra maiúscula ali; a
  // igualdade com `toUpperCase` prova que NÃO há minúscula nenhuma.
  if (nome !== nome.toUpperCase() || nome === nome.toLowerCase()) return nome

  return nome
    .split(' ')
    .map((palavra, i) => {
      // Sem `\p{L}` e a flag `u`: o `target` deste tsconfig nao aceita
      // property escape, e o tsc reprova com TS1501.
      const minusculo = palavra.toLowerCase()
      // A conjuncao vem ANTES da regra de sigla, e a ordem importa: `E` e `EM`
      // tem 1 e 2 letras, entao a excecao de sigla os pegava primeiro e o nome
      // saia "Sistemas E Solucoes" — que continua parecendo maquina, so que
      // outra. Pego no teste.
      if (i > 0 && LIGACOES.has(minusculo)) return minusculo
      // Sem `\p{L}` e a flag `u`: o `target` deste tsconfig nao aceita
      // property escape, e o tsc reprova com TS1501.
      const so = palavra.replace(/[^A-Za-zÀ-ÿ0-9]/g, '')
      if (so.length <= 3 && so.length > 0) return palavra
      return minusculo.charAt(0).toUpperCase() + minusculo.slice(1)
    })
    .join(' ')
}

/**
 * A mensagem de primeiro contato, pronta para colar no WhatsApp.
 *
 * Devolve texto puro: **este módulo não envia nada**, e isso é decisão. Envio
 * automatizado em volume é exatamente o que faz o WhatsApp banir um número, e
 * o número aqui é o do dono. Quem aperta enviar é uma pessoa.
 */
export function montarAbordagem(d: DadosDaAbordagem): string {
  const nome = nomeCurto(d.nome, d.dominio)
  // A semente é o DOMÍNIO, não o nome: nome muda quando o título do site
  // muda, e aí a mesma empresa receberia outro texto na rodada seguinte.
  const semente = d.dominio
  const gancho = escolher(GANCHO[d.vertical] ?? GANCHO_PADRAO, semente, 'gancho')
  const saudacao = escolher(SAUDACAO, semente, 'saudacao')(nome)
  const oferta = escolher(OFERTA, semente, 'oferta')(d.precoMensal)
  const teste = escolher(TESTE, semente, 'teste')(d.limiteGratis)

  // Só cita equipe quando o próprio site disse que ela existe. Sem isso, a
  // frase vira suposição sobre o negócio de outra pessoa.
  const temEquipe = d.motivos.includes('tem equipe de vendas')
  const linhaEquipe = temEquipe
    ? ' Vocês sendo mais de um no atendimento, entra todo mundo pelo mesmo preço.'
    : ''
  const linhaEmpresas = LINHA_MULTI_EMPRESA(d.limiteDeEmpresas)

  const montar = (equipe: string, empresas: string) =>
    [
      d.decisor ? `Oi, ${d.decisor}! ${saudacao}` : `Oi! ${saudacao}`,
      gancho,
      // ## "Sistema" e não "CRM", e a razão é a mesma da landing de 09/09
      //
      // Medido com o Exa: quando os cinco nichos desta lista procuram
      // software, quem responde é orçamento (58%), ERP (44%) e só então CRM
      // (28%). Em locação é 0 de 10 e em dedetização 1 de 10 — e esses dois
      // nichos são 223 dos 790 domínios do universo.
      //
      // Anunciar a CATEGORIA antes do benefício obriga quem lê a reconhecer
      // uma palavra que ele não procura. "Sistema" é o que a PME brasileira
      // diz sozinha ("o sistema da loja"), não exige tradução e não compete
      // com nada.
      //
      // O "sem cobrar por usuário" FICA: ali cobrar significa dinheiro, que é
      // o sentido correto da palavra.
      `${oferta}${equipe}`,
      `${teste}${empresas}`,
      // ## O link em parágrafo PRÓPRIO, e não no meio da frase
      //
      // Visto numa conversa real em 09/09: com o endereço encaixado depois de
      // "sem cartão:" e seguido de mais texto, o WhatsApp desenha a prévia
      // COMPACTA — miniatura de ~70px à esquerda, com o título espremido em
      // duas linhas. Sozinho no parágrafo, o link é o assunto daquele bloco, e
      // é assim que o cartão grande aparece.
      //
      // Ele fica no PENÚLTIMO lugar, nunca no fim: a última linha continua
      // sendo a de descarte, que é o que transforma um "não" em resposta em
      // vez de denúncia de spam — e o corte, quando a mensagem estoura, já tem
      // teste provando que não a alcança.
      LINK,
      `Se não fizer sentido, pode ignorar. Não volto a procurar.`,
    ].join('\n\n')

  // Duas linhas opcionais agora, e a ordem de sacrifício é deliberada: a de
  // EMPRESAS sai primeiro porque fala com poucos (3 de 45 na base), e a de
  // EQUIPE sai depois porque só aparece quando o próprio site disse que existe
  // equipe — ou seja, ela já é dirigida a quem se encaixa.
  //
  // O fim continua intocável. Um defeito real já comeu a linha de descarte por
  // truncamento, e o teste de tamanho não pegava.
  for (const tentativa of [
    montar(linhaEquipe, linhaEmpresas),
    montar(linhaEquipe, ''),
    montar('', ''),
  ]) {
    if (tentativa.length <= TETO) return tentativa
  }
  return montar('', '')
}
