/**
 * Prospecção do Velo Funil — encontrar quem PAGA por este produto.
 *
 * Uso INTERNO. Não é recurso do CRM: não roda em conta de cliente, não tem RLS,
 * não tem tela. É o dono usando o Exa para achar prospect, e o resultado entra
 * como lead no workspace dele — vender o produto usando o produto.
 *
 * ## A regra que inverte o módulo vizinho, e foi medida
 *
 * No enriquecimento (`consulta.ts`), o site institucional é a fonte INÚTIL:
 * ninguém publica a própria dor. Aqui é o contrário — **o site institucional é
 * exatamente o alvo**, porque ele é a empresa existindo, com telefone e página
 * de contato.
 *
 * Medido em 06/09/2026, quatro ângulos contra a API real:
 *
 *     "vaga de vendedor"          -> betavagas, vagas.sc, remotar, solides
 *                                    devolve o SITE DE VAGAS, nao a empresa
 *     "reclama de planilha"       -> agendor, deepcrm, nexarhub
 *                                    devolve o BLOG DO CONCORRENTE sobre a dor
 *     "site de agencia PME"       -> hostconect, marketingpme, aprimoraweb
 *                                    PROSPECTS DE VERDADE
 *     "site de clinica pequena"   -> vanzelaclinic, clinicalys, biotikclinic
 *                                    PROSPECTS, com pagina de contato
 *
 * Buscar "quem reclama de planilha" parece esperto e entrega blog de
 * concorrente. Buscar "site de clínica de estética pequena" parece burro e
 * entrega cliente.
 */

/**
 * Os verticais do ICP, do `CLAUDE.md`: PMEs de serviço no Brasil.
 *
 * A consulta é a descrição do SITE da empresa, não da dor dela. Ver acima.
 */
/**
 * Os nichos onde a prospecção caça, **escolhidos por medição e não por palpite**.
 *
 * Em 06/09 os dez candidatos foram medidos pelo mesmo método — semente de 10
 * sites e um lote de `contents`, duas chamadas cada — comparando quantos
 * carregam sinal FORTE de propensão:
 *
 *     comunicacao-visual  5 FORTE  4 equipe  2 orcamento   <- entra
 *     marcenaria          4        2         3             <- entra
 *     climatizacao        4        4         1             <- entra
 *     agencia             3        2         0
 *     imobiliaria         2        2         0
 *     clinica             2        2         0   agendamento: 5   <- SAI
 *
 * **A linha da clínica é a lição.** Ela liderava a régua antiga, e liderava
 * pelo motivo errado: todo site de clínica diz "agende sua avaliação", e a
 * régua lia isso como "sente a dor de perder lead". Agendamento é a dor de uma
 * AGENDA — que este produto não tem e que Simples Dental e Dental Office já
 * resolvem por R$ 100–200/mês. Zero pedidos de orçamento em dez sites.
 *
 * O eixo que a medição NÃO enxerga, e que decidiu junto: se o nicho já tem
 * software vertical barato, o CRM genérico perde antes de começar. Os três que
 * entraram não têm — o CRM deles hoje é a conversa fixada no topo do WhatsApp,
 * que é o inimigo que a landing já nomeia.
 *
 * **Isto não é o ICP do PRD.** Lá continuam agências, consultorias, clínicas,
 * imobiliárias e software houses: quem chegar sozinho é bem-vindo. Esta lista
 * é onde eu vou CAÇAR, e caçar é caro — por isso segue o número.
 */
export const VERTICAIS = [
  {
    nome: 'comunicacao-visual',
    consulta: 'site de gráfica ou empresa de comunicação visual no Brasil que atende empresas',
  },
  {
    nome: 'marcenaria',
    consulta: 'site de marcenaria ou móveis planejados sob medida no Brasil',
  },
  {
    nome: 'climatizacao',
    consulta:
      'site de empresa de ar condicionado, elétrica ou CFTV no Brasil que faz orçamento para empresas',
  },
  {
    nome: 'agencia',
    consulta: 'site de agência de marketing digital pequena no Brasil que atende PMEs',
  },
  {
    nome: 'imobiliaria',
    consulta: 'site de imobiliária pequena ou corretor de imóveis no Brasil',
  },
] as const

export type Vertical = (typeof VERTICAIS)[number]['nome']

/**
 * Domínios que nunca são prospect, e o porquê de cada família.
 *
 * Sem esta lista, metade do resultado é agregador — medido: o ângulo de vaga
 * devolveu quatro sites de emprego em quatro posições. Prospectar um site de
 * vagas é gastar a busca para achar quem já é intermediário.
 */
export const DOMINIOS_EXCLUIDOS = [
  // Agregadores de vaga: aparecem em qualquer busca com sinal de contratação.
  'vagas.com.br', 'vagas.sc', 'betavagas.com', 'remotar.com.br', 'solides.com.br',
  'catho.com.br', 'indeed.com', 'infojobs.com.br', 'trabalhabrasil.com.br',
  // Redes e diretórios: não é o site da empresa, é o perfil dela.
  'linkedin.com', 'facebook.com', 'instagram.com', 'youtube.com', 'x.com',
  'google.com', 'reclameaqui.com.br', 'econodata.com.br', 'cnpj.biz',
  // CONCORRENTES. O blog deles domina toda busca sobre a dor — é conteúdo de
  // marketing feito para ranquear exatamente nesses termos.
  'agendor.com.br', 'rdstation.com', 'pipedrive.com', 'hubspot.com',
  'deepcrm.app', 'nexarhub.com.br', 'moskitcrm.com', 'ploomes.com',
  'salesforce.com', 'zoho.com', 'bitrix24.com.br', 'kommo.com',
  // Marketplace e conteúdo genérico.
  'wikipedia.org', 'medium.com', 'blogspot.com', 'wordpress.com',
  'mercadolivre.com.br', 'elo7.com.br', 'sebrae.com.br', 'gov.br',
  // DIRETÓRIOS DE EMPRESA. Achados medindo, e são o efeito colateral do
  // `findSimilar`: dado o site de uma clínica, ele devolve páginas SOBRE
  // aquela clínica — CNPJ, horário de funcionamento, avaliação — em vez de
  // outras clínicas. Medido em 06/09: seis das dez expansões de
  // `clinicakondo.com.br` eram diretórios falando da própria Kondo.
  'aboutcompany.info', 'dentmap.com.br', 'efirma.com.br', 'idoutor.com',
  'todos-os-horarios.com.br', 'website.informer.com', 'imigra.net',
  'cnpj.info', 'casadosdados.com.br', 'empresascnpj.com', 'consultasocio.com',
  'apontador.com.br', 'telelistas.net', 'guiamais.com.br', 'solutudo.com.br',
  // O proprio buscador. Apareceu na rodada de 06/09 como "prospect" de
  // agencia, porque o Exa indexa as proprias paginas de resultado.
  'exa.ai',
] as const

/**
 * Nota mínima para virar lead no CRM.
 *
 * A lista de exclusão é jogo de gato e rato — sempre haverá um diretório novo.
 * Este piso é a defesa estrutural: um diretório não tem WhatsApp próprio, não
 * fala "nossa equipe" e raramente tem e-mail da empresa, então não chega perto
 * de 4 pontos. Medido: os diretórios da rodada de 06/09 pontuaram de 0 a 2, e
 * as clínicas de verdade, de 9 a 11.
 *
 * O ensaio continua MOSTRANDO tudo, com nota. Só a gravação exige o piso —
 * separar "vi" de "trabalhei" é o que impede o funil de encher de lixo, a mesma
 * lição dos 8 de 11 alertas falsos da Central.
 */
export const MINIMO_PARA_LEAD = 4

export function ehDominioExcluido(url: string): boolean {
  const host = hostDe(url)
  if (!host) return true
  return DOMINIOS_EXCLUIDOS.some((d) => host === d || host.endsWith(`.${d}`))
}

export type Contato = {
  whatsapp: string | null
  telefone: string | null
  email: string | null
  instagram: string | null
}

/**
 * Contato a partir do texto E dos links da página.
 *
 * As duas fontes, porque nenhuma sozinha basta — medido em três sites:
 *
 *     so o texto   1 de 3 deu telefone, ZERO e-mail
 *     so os links  1 de 3 deu WhatsApp (wa.me/5511941289701)
 *
 * O texto extraído do Exa remove `href`, então `wa.me` e `mailto:` só existem
 * em `extras.links`. E o telefone escrito no rodapé só existe no texto. São
 * fontes complementares, não redundantes.
 *
 * **A taxa não é 100% e isso fica dito:** PME brasileira põe contato em botão
 * flutuante de WhatsApp renderizado por JavaScript, em formulário sem e-mail
 * visível, e em imagem. O que este extrator não achar, a pessoa acha abrindo o
 * site — o valor já está em ter o site certo na frente.
 */
export function extrairContato(entrada: { texto?: string; links?: string[] }): Contato {
  const texto = entrada.texto ?? ''
  const links = entrada.links ?? []

  return {
    whatsapp: primeiroWhatsapp(links) ?? null,
    telefone: primeiroTelefone(texto, links),
    email: primeiroEmail(texto, links),
    instagram: links.find((l) => /instagram\.com\/[\w.]+/i.test(l))?.split('?')[0] ?? null,
  }
}

function primeiroWhatsapp(links: string[]): string | null {
  for (const l of links) {
    const m = l.match(/wa\.me\/(\d{10,15})/i) ?? l.match(/phone=(\d{10,15})/i)
    if (m) return m[1]
  }
  return null
}

function primeiroTelefone(texto: string, links: string[]): string | null {
  const doLink = links.map((l) => l.match(/^tel:\+?(\d{10,15})/i)?.[1]).find(Boolean)
  if (doLink) return doLink

  // `(11) 94068-4935` e variações. Exige DDD entre parênteses ou o par de
  // blocos separado: sem isso, CNPJ e CEP entram como telefone.
  const m = texto.match(/\(?\b\d{2}\)?\s?9?\d{4}[-.\s]\d{4}\b/)
  return m ? m[0].trim() : null
}

function primeiroEmail(texto: string, links: string[]): string | null {
  const doLink = links
    .map((l) => l.match(/^mailto:([\w.+-]+@[\w.-]+\.\w{2,})/i)?.[1])
    .find(Boolean)
  if (doLink) return doLink.toLowerCase()

  const achados = texto.match(/[\w.+-]+@[\w.-]+\.\w{2,}/gi) ?? []
  // Fora os e-mails que são do fornecedor do site, não da empresa: eles
  // aparecem em rodapé de tema e em política de cookies, e mandar proposta
  // para o desenvolvedor do site do prospect é queimar o contato.
  const limpo = achados
    .map((e) => e.toLowerCase())
    .find((e) => !/(wixpress|sentry|example|@2x|\.png|\.jpg|godaddy|hostgator)/i.test(e))
  return limpo ?? null
}

export type ProspectBruto = {
  url: string
  titulo: string | null
  vertical: Vertical
  contato: Contato
  /** Texto da página, para as checagens de qualificação. */
  texto: string
}

/**
 * Os sinais de PROPENSÃO A PAGAR, separados dos de alcance.
 *
 * A régua nasceu medindo só alcançabilidade — tem WhatsApp? tem e-mail? — e as
 * duas coisas não são a mesma. Um consultório com WhatsApp na página é fácil de
 * contatar e pode não ter nenhuma razão para pagar R$ 49 por mês; uma
 * imobiliária com oito corretores tem a razão inteira, mesmo com contato
 * escondido.
 *
 * A ordem abaixo é de força, e cada linha responde "por que ESTA empresa pagaria
 * um CRM":
 *
 *     EQUIPE       CRM sem time e planilha com outro nome. Quem vende sozinho
 *                  anota no papel e nao sente a dor. E o sinal mais forte
 *     CAPTURA      quem ja captura lead no site JA perde lead, e sabe disso.
 *                  E o momento exato da dor que este produto resolve
 *     JA PAGA SaaS quem assina alguma ferramenta ja atravessou a barreira de
 *                  "pagar mensalidade por software", que e metade da venda.
 *                  **Medido: disparou 1 vez em 94 sites.** Fica porque quando
 *                  dispara vale muito, mas nao espere que ele ordene nada —
 *                  site institucional nao lista a ferramenta interna. A fonte
 *                  certa e vaga de emprego e pagina de integracoes
 *     UNIDADES     duas ou mais unidades e coordenacao, que e onde a planilha
 *                  quebra primeiro
 *
 * **O que NÃO entra:** faturamento estimado e número de funcionários vindos de
 * diretório. São chute vendido como dado, e este projeto já pagou caro por
 * número plausível de origem fraca — "6 de 9 clientes abandonaram" nasceu
 * assim e foi repetido em quatro documentos.
 */
const SINAIS_DE_PROPENSAO: { nome: string; pontos: number; regex: RegExp }[] = [
  {
    nome: 'tem equipe de vendas',
    pontos: 4,
    regex: /nossa equipe|nosso time|equipe comercial|equipe de vendas|nossos consultores|nossos corretores|nossos especialistas|fale com um (consultor|corretor|especialista)/i,
  },
  {
    // Pedir ORÇAMENTO cria um negócio com valor, prazo e uma decisão pendente —
    // que é literalmente uma linha do Kanban. É o sinal mais próximo do que
    // este produto faz.
    nome: 'pede orçamento no site',
    pontos: 3,
    regex: /solicite (um|uma|seu|sua) (or[çc]amento|proposta|cota[çc][ãa]o)|fa[çc]a (seu|sua) (or[çc]amento|cota[çc][ãa]o)|pe[çc]a (um|uma|seu) (or[çc]amento|proposta)|receba (um|uma) proposta|or[çc]amento (gratuito|sem compromisso)/i,
  },
  {
    // **Agendar NÃO é o mesmo que orçar, e confundir os dois foi defeito meu.**
    //
    // Medido em 10 nichos: `clinica` liderou o sinal de captura porque todo
    // site de clínica diz "agende sua avaliação". Só que agendamento é a dor
    // de uma AGENDA — que este produto não tem e que o software vertical do
    // setor já resolve. A régua estava lendo "precisa de um concorrente meu"
    // como "precisa de mim".
    //
    // Continua valendo pouco em vez de zero: o site que agenda online tem
    // alguém cuidando de entrada de cliente, o que é sinal de atividade.
    nome: 'agendamento no site',
    pontos: 1,
    regex: /agende (sua|seu|uma|um) (avalia|consulta|visita|hor[áa]rio)|agendar (hor[áa]rio|consulta|avalia)|marque (sua|seu) (consulta|hor[áa]rio)/i,
  },
  {
    nome: 'já paga por software',
    pontos: 3,
    regex: /conta azul|contaazul|omie|bling|tiny erp|nibo|granatum|trello|asana|monday\.com|slack|hubspot|mailchimp|activecampaign/i,
  },
  {
    nome: 'mais de uma unidade',
    pontos: 2,
    regex: /nossas (duas|tr[êe]s|quatro|\d+) unidades|nossas filiais|nossas lojas|unidade [ivx]+/i,
  },
  {
    nome: 'contrata vendedor no próprio site',
    pontos: 2,
    regex: /trabalhe conosco|vagas? (aberta|dispon[íi]ve)|faça parte do (nosso )?time/i,
  },
]

export type ProspectPontuado = {
  url: string
  dominio: string
  titulo: string | null
  vertical: Vertical
  contato: Contato
  pontos: number
  motivos: string[]
  /** `false` quando algo o desqualifica de vez. */
  qualificado: boolean
}

/**
 * Pontua o prospect, e diz por quê em texto.
 *
 * O `motivos` não é enfeite: uma nota sem justificativa é número plausível sem
 * como conferir — a classe de erro mais cara deste projeto. Com os motivos, o
 * dono discorda da régua olhando a linha.
 */
export function pontuarProspect(p: ProspectBruto): ProspectPontuado {
  const dominio = hostDe(p.url) ?? p.url
  const motivos: string[] = []
  let pontos = 0

  if (ehDominioExcluido(p.url)) {
    return {
      url: p.url, dominio, titulo: p.titulo, vertical: p.vertical, contato: p.contato,
      pontos: 0, motivos: ['domínio na lista de exclusão'], qualificado: false,
    }
  }

  // Já usa concorrente: não é prospect frio, é troca — argumento diferente e
  // conversão menor. Não some da lista, mas perde a prioridade.
  const jaTemCrm = /rd station|pipedrive|hubspot|agendor|ploomes|moskit|salesforce|bitrix/i.test(p.texto)
  if (jaTemCrm) {
    pontos -= 3
    motivos.push('já menciona um CRM concorrente')
  }

  if (p.contato.whatsapp) { pontos += 3; motivos.push('WhatsApp direto') }
  if (p.contato.telefone) { pontos += 2; motivos.push('telefone na página') }
  if (p.contato.email) { pontos += 2; motivos.push('e-mail na página') }
  if (p.contato.instagram) { pontos += 1; motivos.push('Instagram') }

  // Título que anuncia dado cadastral é diretório, não empresa: "CNPJ
  // 12342019000103", "Informações Societárias", "Horário de abertura". O
  // `findSimilar` produz esses em quantidade, e eles têm telefone — ou seja,
  // pontuariam bem sem esta trava.
  if (/\bcnpj\b|informa[çc][õo]es societ|hor[áa]rio de abertura|at WI\b|avalia[çc][õo]es/i.test(
    `${p.titulo ?? ''} ${p.texto.slice(0, 400)}`,
  )) {
    pontos -= 5
    motivos.push('parece diretório de empresa, não a empresa')
  }

  // `.com.br` é sinal de empresa brasileira formalizada, que é quem paga
  // mensalidade. `.com` genérico pode ser de qualquer lugar.
  if (dominio.endsWith('.com.br')) { pontos += 2; motivos.push('domínio .com.br') }

  // Os sinais de PROPENSÃO, que são o que separa "dá para falar com" de "tem
  // razão para comprar". Ver a nota em `SINAIS_DE_PROPENSAO`.
  for (const sinal of SINAIS_DE_PROPENSAO) {
    if (sinal.regex.test(p.texto)) {
      pontos += sinal.pontos
      motivos.push(sinal.nome)
    }
  }

  // Sem NENHUM contato, o prospect exige trabalho manual para virar lead.
  // Continua qualificado — o site está lá — mas com nota baixa.
  const temContato = Boolean(p.contato.whatsapp || p.contato.telefone || p.contato.email)
  if (!temContato) motivos.push('sem contato extraído (abrir o site à mão)')

  return {
    url: p.url, dominio, titulo: p.titulo, vertical: p.vertical, contato: p.contato,
    pontos, motivos, qualificado: true,
  }
}

/** Melhores primeiro. Empate: quem tem WhatsApp ganha, porque é o canal que responde. */
export function ordenarProspects(lista: ProspectPontuado[]): ProspectPontuado[] {
  return [...lista].sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos
    return Number(Boolean(b.contato.whatsapp)) - Number(Boolean(a.contato.whatsapp))
  })
}

/** Um domínio, um prospect. `findSimilar` devolve o mesmo site em ângulos diferentes. */
export function deduplicarPorDominio(lista: ProspectPontuado[]): ProspectPontuado[] {
  const vistos = new Set<string>()
  const out: ProspectPontuado[] = []
  for (const p of lista) {
    if (vistos.has(p.dominio)) continue
    vistos.add(p.dominio)
    out.push(p)
  }
  return out
}

function hostDe(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}
