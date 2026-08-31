/**
 * Contas que existem por razão operacional, não porque alguém comprou.
 *
 * ## Por que isto precisa existir
 *
 * A conta `google.review@velofunil.com.br` foi criada para a verificação OAuth
 * do Google, e recebeu Pro de cortesia porque as integrações são recurso pago —
 * sem Pro, o revisor não veria o botão "Conectar" e reprovaria de novo.
 *
 * O efeito colateral, medido em 20/08: a Central passou a dizer **R$ 98/mês**
 * quando a receita real é **R$ 49**. Um painel que existe para responder
 * "quanto entra por mês" não pode contar dinheiro que ninguém pagou — e o erro
 * é do tipo que passa despercebido justamente porque o número fica maior.
 *
 * ## Por que uma lista explícita, e não um padrão no e-mail
 *
 * Este projeto já quase apagou uma cliente real por causa de um regex de
 * "parece teste": `testei122@gmaa2il.com` casa com qualquer padrão de teste e é
 * pessoa de verdade, dona de uma empresa com contatos e negócios (ver
 * `lib/dono/dominios.ts`). Lista conferida uma a uma é chata de manter e nunca
 * apaga o cliente errado.
 */

/**
 * Tira o sub-endereçamento (`+algo`) antes de comparar com as listas.
 *
 * ## O buraco que isto fecha
 *
 * `pedroescobar90sb@gmail.com` está em `EMAILS_DO_DONO` desde sempre. Os
 * testes de ponta a ponta criam conta como
 * `pedroescobar90sb+velofunil-teste-1788129871354@gmail.com` — a MESMA caixa,
 * pela RFC 5233 —, e a comparação exata não casava. Medido em 31/08: **3
 * contas** passando como cliente externo, e os 4 relatos de suporte delas
 * aparecendo na fila como se fossem gente de fora.
 *
 * É a porta dos fundos da lista fechada: cada conta nova de teste nasce com
 * carimbo de tempo no sufixo, então nomear uma a uma nunca daria conta —
 * exatamente o argumento que já valeu para o domínio do produto em 30/08.
 *
 * ## Por que isto NÃO reabre o risco do regex
 *
 * O comentário no topo deste arquivo avisa contra detectar teste por padrão, e
 * a razão é `testei122@gmaa2il.com`: cliente real que casa com qualquer regex
 * de "parece teste". Esta função não decide nada sozinha — ela só normaliza o
 * endereço ANTES de consultar as listas conferidas à mão.
 *
 * Consequência: `joao+nota@empresa.com` só é classificado como teste se
 * `joao@empresa.com` já estiver explicitamente listado. Cliente de verdade que
 * use `+` continua sendo cliente.
 */
function semSubEnderecamento(email: string): string {
  const [local, dominio] = email.split('@')
  if (!dominio) return email
  return `${local.split('+')[0]}@${dominio}`
}

/** E-mails de contas internas. Comparado em minúsculas. */
const EMAILS_INTERNOS = new Set([
  'google.review@velofunil.com.br',
  // Conta de demonstração das Conversas. Faltava aqui, e por isso 4 dos
  // erros de produção de `error_logs` pareciam ser de cliente quando eram de
  // uma sessão de teste — achado em 30/08 ao ler a tabela pela primeira vez.
  'demo.conversas@velofunil.com.br',
  // As duas contas usadas para gravar o vídeo de verificação OAuth do Google
  // (20/08 e 24/08). Zero empresa, zero contato, um login cada — conferido no
  // banco, não deduzido do nome. Juntas geraram 11 dos 21 erros de produção.
  'oauthtestks@gmail.com',
  'oauthtestmsn@gmail.com',
])

/**
 * Verdadeiro quando a conta existe por razão operacional nossa.
 *
 * Contas internas continuam aparecendo na lista de empresas — esconder seria
 * pior, porque elas existem de verdade e ocupam espaço no banco. O que muda é
 * que não entram na contagem de dinheiro.
 */
export function ehContaInterna(email: string | null | undefined): boolean {
  if (!email) return false
  return EMAILS_INTERNOS.has(semSubEnderecamento(email.trim().toLowerCase()))
}

/**
 * Domínios de e-mail descartável usados nos testes deste projeto.
 *
 * ## A lição que esta lista carrega
 *
 * A tentação é detectar teste por padrão ("contém 'teste'", "domínio
 * esquisito"). Este projeto quase apagou uma cliente real assim:
 * `testei122@gmaa2il.com` casa com qualquer regex de teste e é pessoa de
 * verdade, com empresa, contatos e negócios — ela só digitou o próprio e-mail
 * errado (ver `lib/dono/dominios.ts`).
 *
 * Por isso: lista fechada, conferida uma a uma. Chata de manter e nunca
 * classifica cliente de verdade como lixo.
 */
const DOMINIOS_DESCARTAVEIS = new Set([
  // Geradores de e-mail temporário usados nos testes desta base, conferidos um
  // a um contra a lista real de contas que criaram empresa.
  'neplis.com',
  'beiwoh.com',
  'joystill.com',
  'mrworlds.com',
  'careney.com',
  'rpaintel.com',
  'hutdot.com',
  'ittiv.com',
  'archifun.com',
  'ehwit.com',
  'prodbits.com',
  // Domínios que só existem dentro dos scripts de teste deste repositório.
  'exemplo-teste.com.br',
  'acmecorp.com.br',
])

/**
 * Contas do próprio dono e de demonstração.
 *
 * O dono confirmou em 23/08 que **todos os cadastros até aqui foram teste
 * dele** — inclusive os de `gmail.com`, que nenhum filtro de domínio pegaria.
 * Por isso esta lista existe e por isso ela precisa ser mantida à mão: sem ela,
 * o painel misturaria teste antigo com o tráfego pago que está por vir, e a
 * primeira campanha seria avaliada contra uma linha de base falsa.
 *
 * Quando entrar cliente de verdade, NÃO adicione ninguém aqui — a lista só
 * cresce com conta que você mesmo criou.
 */
const EMAILS_DO_DONO = new Set([
  'j4693001@gmail.com',
  'henriquestn24@gmail.com',
  'henriqueprogramador590@gmail.com',
  'pedroescobar90sb@gmail.com',
  'jonatqpedro@gmail.com',
  'imperioimports70@gmail.com',
  'empresatower6@gmail.com',
  'mbarretodacruz@gmail.com',
  'lamopuniftc@gmail.com',
  'fanimayara67@gmail.com',
  'demo.pro@velofunil.com.br',
])

/**
 * Verdadeiro quando a conta é teste nosso, e não cliente externo.
 *
 * Vive aqui, e não dentro de uma das telas, porque **duas** telas dependem
 * dela e por motivos diferentes: Ativação, para não medir a taxa de conversão
 * contra as próprias contas de teste; e Decidindo agora, para não mandar o dono
 * abrir o WhatsApp de um e-mail descartável que ele mesmo gerou. Uma segunda
 * cópia divergiria da primeira no dia em que uma das duas fosse atualizada — e
 * o efeito seria invisível, porque as duas telas continuariam mostrando um
 * número plausível.
 */
export function ehContaDeTeste(email: string | null | undefined): boolean {
  if (!email) return true // sem e-mail não dá para afirmar que é cliente real
  const limpo = semSubEnderecamento(email.trim().toLowerCase())
  if (ehContaInterna(limpo)) return true
  if (EMAILS_DO_DONO.has(limpo)) return true

  const dominio = limpo.split('@')[1] ?? ''

  // **O domínio do próprio produto nunca é cliente.**
  //
  // Achado em 30/08 auditando a receita: `teste-pro-1787589892727@
  // velofunil.com.br` — uma conta criada por script de teste — aparecia como
  // cliente externo com Pro, e entrava na conta de "R$ 490,00/mês". Ninguém
  // compra o próprio produto pelo e-mail do produto.
  //
  // A lista `EMAILS_INTERNOS` cobria quatro endereços específicos e não
  // acompanhava conta nova de teste, que nasce com carimbo de tempo no nome —
  // então nomear uma a uma nunca daria conta. O domínio dá.
  if (dominio === 'velofunil.com.br') return true

  return DOMINIOS_DESCARTAVEIS.has(dominio)
}
