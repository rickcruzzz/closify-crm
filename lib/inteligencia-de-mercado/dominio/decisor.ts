/**
 * O nome de quem decide, tirado do título de um perfil público do LinkedIn.
 *
 * Ligar para uma empresa e pedir "o responsável" cai na recepção. Pedir "o
 * Daniel" atravessa. É a diferença entre ligação fria e ligação com nome, e o
 * Exa devolve isso pelo índice dele — nós não raspamos nada, e automatizar
 * qualquer ação DENTRO do LinkedIn é o que derruba conta.
 *
 * ## A trava que vale mais que a extração
 *
 * O risco aqui não é falhar em achar o nome — é achar o nome ERRADO. Uma busca
 * por "Spark Comunicação Visual" devolve perfis parecidos, e atribuir o sócio
 * de outra empresa ao prospect é pior do que não ter nome nenhum: a ligação
 * começa com um erro de identidade e queima a abordagem inteira.
 *
 * Por isso `extrairDecisor` só devolve alguma coisa quando o nome da empresa
 * aparece no próprio título do perfil. Sem casamento, `null` — e `null` aqui é
 * a resposta certa, não uma falha.
 *
 * É a mesma disciplina de `chaveDeUtm`, que devolve `null` quando duas
 * campanhas casam: ambiguidade não vira palpite.
 *
 * ## Medido em 06/09: o rendimento é quase ZERO, e a trava não é a culpada
 *
 * Rodado contra prospects reais de comunicação visual, **0 de 6 casaram**.
 * Investigado um a um, e o problema não é rigor demais — é que o dado não
 * existe. Buscando pelo NOME DA EMPRESA, o Exa devolve:
 *
 *     Quatro Pontos Gráfica   "junior andrades", "marcio bertholetti"  <- só nomes,
 *                             sem empresa nenhuma no título
 *     Forthlux                "Kayke Altieri - Executivo Comercial | E-commerce",
 *                             "Gabriela Dini Castillo | Universidade Cidade de SP"
 *                             <- pessoas sem relação com a empresa
 *
 * A sonda inicial deu a impressão contrária porque a consulta era GENÉRICA
 * ("proprietário de empresa de comunicação visual no Brasil") e devolveu donos
 * do setor com a empresa no título — nomes reais, de empresas que não eram as
 * que eu procurava. Confirmar por caso é o que separou uma coisa da outra.
 *
 * **Consequência:** `--decisores` fica em 0 por padrão, e a busca é opcional.
 * Não vale um centavo por prospect para acertar quase nunca. Dono de PME
 * brasileira em geral não mantém LinkedIn com a empresa no título.
 *
 * O que NÃO fazer, e é a tentação óbvia: afrouxar o casamento para "algum
 * resultado aparecer". Isso trocaria zero nome por nomes ERRADOS — e a ligação
 * começaria com um erro de identidade, que é pior que ligar sem nome.
 */

/**
 * Os cargos que decidem compra num negócio pequeno. Gerente de marketing e
 * analista ficam fora de propósito: quem assina R$ 49/mês numa PME é dono.
 */
const CARGO =
  /(s[óo]cio[- ]?propriet[áa]ri[oa]|propriet[áa]ri[oa]|s[óo]ci[oa]|fundador[a]?|diretor[a]?(\s+comercial)?|ceo|gerente\s+comercial|gestor[a]?\s+comercial)/i

export type Decisor = {
  nome: string
  cargo: string
  perfilUrl: string
}

/** Tira acento e caixa, para comparar nome de empresa sem tropeçar em til. */
function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * As palavras do nome da empresa que servem para casar.
 *
 * Descarta o genérico do ramo: "Comunicação Visual", "Gráfica", "Odontologia"
 * aparecem em centenas de empresas, e casar por elas atribuiria qualquer sócio
 * do setor a qualquer prospect. Sobra o que é próprio do nome — "Spark",
 * "Quatrocor" —, que é o que identifica.
 */
const GENERICOS = new Set(
  ('comunicacao visual grafica graficas odontologia odontologica clinica clinicas marcenaria ' +
    'moveis planejados dedetizacao dedetizadora controle pragas imobiliaria imoveis agencia ' +
    'marketing digital consultoria eventos buffet locacao equipamentos ltda me epp eireli ' +
    'brasil brazil sa do da de e').split(' '),
)

export function tokensDaEmpresa(nome: string): string[] {
  return chave(nome)
    .split(' ')
    .filter((p) => p.length >= 4 && !GENERICOS.has(p))
}

/**
 * Lê um resultado de perfil do LinkedIn e devolve o decisor **só quando o
 * perfil é comprovadamente daquela empresa**.
 *
 * O título vem em formatos como:
 *
 *     "Daniel Pombo - Sócio Proprietário da Spark Comunicação Visual"
 *     "sandro schultz - Sócio-Proprietário na Imagem Visual - LinkedIn"
 */
export function extrairDecisor(
  resultado: { titulo?: string | null; url?: string | null },
  nomeDaEmpresa: string,
): Decisor | null {
  const titulo = (resultado.titulo ?? '').replace(/\s*[-|]\s*LinkedIn\s*$/i, '').trim()
  const url = resultado.url ?? ''
  if (!titulo || !url.includes('linkedin.com')) return null

  const tokens = tokensDaEmpresa(nomeDaEmpresa)
  // Empresa cujo nome é só genérico não tem como ser casada com segurança.
  // Devolver `null` é a resposta certa: sem isso, o primeiro perfil do setor
  // seria atribuído a ela.
  if (tokens.length === 0) return null

  const tituloChave = chave(titulo)
  if (!tokens.some((t) => tituloChave.includes(t))) return null

  const cargo = titulo.match(CARGO)
  if (!cargo) return null

  // O nome é o que vem ANTES do separador de cargo. Título sem separador não
  // permite dizer onde termina o nome — melhor devolver nada.
  const nome = titulo.split(/\s+[-–—|]\s+|\s+[-–—]\s*(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)[0].trim()
  if (!nome || nome.length < 3 || nome.length > 60) return null
  // Se o "nome" extraído for na verdade o cargo, o separador não estava onde se
  // supôs.
  if (CARGO.test(nome)) return null

  return {
    // "sandro schultz" vira "Sandro Schultz": o LinkedIn deixa a pessoa
    // escrever em minúscula, e chamar alguém pelo nome em caixa errada na
    // primeira frase denuncia que o texto foi montado por máquina.
    nome: nome
      .split(/\s+/)
      .map((p) => (p.length > 2 ? p[0].toUpperCase() + p.slice(1) : p))
      .join(' '),
    cargo: cargo[0],
    perfilUrl: url,
  }
}
