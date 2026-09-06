/**
 * O que a prospecção devolve para o PROJETO, além da lista de prospects.
 *
 * Cada rodada lê dezenas de sites do ICP e joga o texto fora depois de pontuar.
 * Esse texto é a coisa mais escassa que este projeto tem: **as palavras que o
 * cliente usa para descrever o próprio negócio**, escritas por ele, sem
 * intermediário e sem eu ter adivinhado nada.
 *
 * Duas saídas, e a segunda é a que corrige um erro que está custando dinheiro:
 *
 *     VOCABULARIO  o termo que aparece em N sites DISTINTOS. Vira COPY
 *     PROMESSA     o que o site promete em primeira pessoa. E a objecao que a
 *                  nossa pagina precisa responder ANTES de ser perguntada
 *
 * É de graça: o texto já foi baixado e pago na mesma chamada que gerou o
 * prospect, e hoje era descartado depois de pontuar.
 *
 * ## O que ele NÃO é, e a distinção custa dinheiro
 *
 * **Isto não é pesquisa de palavra-chave.** Quem busca `clareamento dental` é o
 * PACIENTE da clínica, não a dona dela procurando um CRM — comprar esse clique
 * paga por um público que nunca assinaria. O site institucional mostra como a
 * empresa fala com o CLIENTE dela, não como ela descreveria o próprio problema
 * de gestão, que é o que a campanha precisa.
 *
 * A distinção fica escrita aqui porque a primeira versão deste comentário
 * afirmava o contrário — que o termo colhido corrigiria a cauda longa inventada
 * da `g_preco`. Número plausível com conclusão errada é a classe de erro mais
 * cara deste repositório, e ela reapareceu dentro do arquivo escrito para
 * evitá-la.
 *
 * ## As três regras, e todas nasceram de defeito já pago aqui
 *
 * **Conta DOMÍNIO, nunca ocorrência.** Um site que repete "agendamento online"
 * quarenta vezes é UM site, não uma tendência. Contar ocorrência deixaria o
 * termo mais repetido de um site só liderar a lista inteira — número plausível
 * com origem de uma amostra, que é a classe de erro mais cara deste projeto.
 *
 * **A palavra da consulta é desqualificada.** Eu busquei "clínica odontológica
 * em São Paulo": encontrar "clínica odontológica" em 100% dos resultados não
 * ensina nada, é o eco da minha própria pergunta. Mesma regra de
 * `classificarSinal`, e lá ela nasceu de 5 falsos positivos medidos.
 *
 * **Nada de parafrasear.** A promessa é recortada com as palavras do site. O
 * valor do documento é ser voz do cliente; reescrita, vira minha suposição com
 * fonte falsa em cima.
 */

/**
 * Palavras que carregam gramática e não significado. Sem cortá-las, o topo da
 * lista seria "para o", "de nossa", "e a" — verdadeiro e inútil.
 */
const VAZIAS = new Set(
  ('a as o os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre ' +
    'e ou mas que se ao aos à às pelo pela pelos pelas entre até desde apos ante ' +
    'seu sua seus suas nosso nossa nossos nossas meu minha dele dela deles delas ' +
    'este esta estes estas esse essa esses essas aquele aquela isso isto aquilo ' +
    'ser sao é eh sou somos foi era esta estao tem tem ha havia ter tera ' +
    'mais menos muito muita muitos muitas todo toda todos todas cada qualquer ' +
    'voce voces nos eu ele ela eles elas lhe lhes me te se ' +
    'aqui ali la onde quando como porque pois entao tambem ja nao sim ' +
    'mesmo mesma outro outra outros outras qual quais quem cujo ' +
    'saiba leia veja clique acesse conheca confira aqui').split(' '),
)

/**
 * Palavras funcionais em INGLÊS. O site é de PME brasileira: frase em inglês no
 * meio dele é boilerplate de widget, não a voz do cliente.
 *
 * Não é hipótese — foi medido. A primeira rodada trouxe `don t have`,
 * `have the app` e `download it now` em 6 sites, todos do mesmo banner de
 * "baixe nosso aplicativo" instalado por uma ferramenta. Seis domínios
 * distintos passavam no piso e o termo não dizia nada sobre o nicho.
 *
 * Corta pela função gramatical, não por vocabulário: `app` e `download` são
 * usados em português e ficam de fora da lista de propósito.
 *
 * **`do`, `no`, `so` e `da` ficam FORA por colisão**, e isso não é descuido: as
 * quatro são palavras portuguesas comuns no meio de um termo legítimo (`plano
 * do paciente`, `só para`), e cortá-las mataria vocabulário real do ICP para
 * pegar boilerplate. Falso positivo aqui apaga um dado; falso negativo deixa
 * uma linha de ruído visível na tabela, que qualquer leitor descarta sozinho.
 */
const FUNCIONAIS_EM_INGLES = new Set(
  ('the you your don have has are was were this that these those with and for from will would ' +
    'can could our their there here what when who how about not but its it is to of in on at by be we us an if or').split(
    ' ',
  ),
)

/**
 * O cromo do site: rodapé, navegação e aviso legal. É igual em todo site do
 * mundo e não distingue nicho nenhum.
 *
 * `agende sua consulta` NÃO entra aqui, e a distinção é o ponto: ela é o CTA do
 * nicho, escrito pelo próprio nicho — exatamente o que este documento existe
 * para colher.
 */
const RUIDO_DE_SITE = new Set([
  'fale conosco',
  'saiba mais',
  'leia mais',
  'clique aqui',
  'politica de privacidade',
  'termos de uso',
  'direitos reservados',
  'todos os direitos',
  'mapa do site',
  'redes sociais',
  'app download',
  'download app',
])

/** Tira acento e pontuação. `Clínica` e `clinica` são a mesma palavra. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** As palavras da consulta, para desqualificar o eco da própria pergunta. */
function palavrasDaConsulta(consultas: string[]): Set<string> {
  const fora = new Set<string>()
  for (const c of consultas) for (const p of normalizar(c).split(' ')) if (p.length > 2) fora.add(p)
  return fora
}

export type TermoDoIcp = {
  termo: string
  /** Em quantos DOMÍNIOS distintos ele apareceu. Nunca ocorrências. */
  sites: number
  /** Até três domínios, para conferir na fonte em um clique. */
  exemplos: string[]
}

export type PaginaLida = { dominio: string; texto: string }

/**
 * As expressões de 2 e 3 palavras que aparecem em pelo menos `minimoDeSites`
 * domínios distintos, ordenadas por quantos sites as usam.
 *
 * Expressão e não palavra solta: "agendamento" sozinho é ambíguo, "agendamento
 * online" é uma palavra-chave que alguém digita no Google.
 */
export function extrairVocabulario(
  paginas: PaginaLida[],
  { consultas = [], minimoDeSites = 3, maximo = 25 }: { consultas?: string[]; minimoDeSites?: number; maximo?: number } = {},
): TermoDoIcp[] {
  const fora = palavrasDaConsulta(consultas)
  const porTermo = new Map<string, Set<string>>()

  for (const pagina of paginas) {
    const palavras = normalizar(pagina.texto).split(' ')
    // Set por página: o mesmo termo repetido na mesma página conta UMA vez.
    const naPagina = new Set<string>()

    for (let i = 0; i < palavras.length; i++) {
      for (const tamanho of [2, 3]) {
        const janela = palavras.slice(i, i + tamanho)
        if (janela.length < tamanho) continue
        // Uma expressão que começa ou termina em palavra vazia é um fragmento
        // ("de agendamento", "online e"), não um termo.
        const primeira = janela[0]
        const ultima = janela[janela.length - 1]
        if (VAZIAS.has(primeira) || VAZIAS.has(ultima)) continue
        // O corte de tamanho vale só nas PONTAS. Aplicá-lo no meio matava
        // "plano de tratamento" e "clínica de estética", que são a forma
        // natural em português — a preposição interna é o que liga o termo.
        if ([primeira, ultima].some((p) => p.length < 3)) continue
        if (janela.some((p) => /^\d+$/.test(p))) continue
        if (janela.some((p) => FUNCIONAIS_EM_INGLES.has(p))) continue
        // O eco da consulta: desqualificado se QUALQUER palavra veio da pergunta.
        if (janela.some((p) => fora.has(p))) continue
        const termo = janela.join(' ')
        if (RUIDO_DE_SITE.has(termo)) continue
        naPagina.add(termo)
      }
    }

    for (const termo of Array.from(naPagina)) {
      if (!porTermo.has(termo)) porTermo.set(termo, new Set())
      porTermo.get(termo)!.add(pagina.dominio)
    }
  }

  return Array.from(porTermo.entries())
    .map(([termo, dominios]) => ({ termo, sites: dominios.size, exemplos: Array.from(dominios).slice(0, 3) }))
    .filter((t) => t.sites >= minimoDeSites)
    .sort((a, b) => b.sites - a.sites || a.termo.localeCompare(b.termo))
    .slice(0, maximo)
}

export type PromessaDoIcp = { frase: string; dominio: string }

/**
 * As frases em que o site promete alguma coisa em primeira pessoa.
 *
 * Cada uma é uma objeção que a nossa landing enfrenta sem saber: se trinta
 * sites do nicho prometem "atendimento humanizado", quem chega na nossa página
 * já ouviu isso trinta vezes e o termo não diferencia nada.
 *
 * **Recorte, nunca paráfrase** — a frase sai inteira, do jeito que foi escrita.
 */
export function extrairPromessas(
  paginas: PaginaLida[],
  { maximoPorSite = 2, maximo = 30 }: { maximoPorSite?: number; maximo?: number } = {},
): PromessaDoIcp[] {
  const gatilho =
    /\b(oferecemos|garantimos|entregamos|proporcionamos|nossa miss[ãa]o|nosso compromisso|somos (a|o|uma|um) (maior|melhor|primeira|primeiro|refer[êe]ncia)|mais de \d+ (anos|clientes|pacientes|im[óo]veis)|atendimento (humanizado|personalizado|24h))\b/i
  const promessas: PromessaDoIcp[] = []

  // A MESMA frase, do mesmo site, vinda do cabeçalho e repetida no corpo, é uma
  // promessa só. Sem isto a lista mostra o slogan duas vezes e parece dois dados.
  const jaVistas = new Set<string>()

  for (const pagina of paginas) {
    let doSite = 0
    for (const bruta of pagina.texto.split(/(?<=[.!?])\s+|\n+/)) {
      // O `contents` do Exa devolve markdown: `## Nosso compromisso` levaria a
      // marcação para dentro do recorte, e recorte com lixo parece descuido —
      // que é o oposto do que uma citação literal precisa transmitir.
      const frase = bruta
        .replace(/^[\s>#*-]+/, '')
        .replace(/[\s*]+$/, '')
        .replace(/\s+/g, ' ')
        .trim()
      const chave = frase.toLowerCase()
      if (jaVistas.has(chave)) continue
      if (frase.length < 25 || frase.length > 220) continue
      if (!gatilho.test(frase)) continue
      jaVistas.add(chave)
      promessas.push({ frase, dominio: pagina.dominio })
      if (++doSite >= maximoPorSite) break
    }
    if (promessas.length >= maximo) break
  }

  return promessas.slice(0, maximo)
}
