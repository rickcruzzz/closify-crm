import { mensagemPara, type Prospect } from './prateleira'

/**
 * O que vai ser mandado, agrupado pelo que REPETE.
 *
 * ## Por que esta tela existe
 *
 * O dono perguntou: *"a mensagem é a mesma para todas as empresas?"*. A
 * resposta honesta só aparece medindo — e ela é "quase". Sobre as 790 do
 * universo, em 08/09:
 *
 *     mensagens distintas      788 de 790
 *     1a linha (o nome)        786 variantes
 *     2a linha (o gancho)        5 variantes, uma por nicho
 *     o resto (preco/saida)      2 variantes, com e sem a linha de equipe
 *
 * Tecnicamente cada mensagem é única; na prática são **dez modelos**, cinco
 * ganchos vezes dois corpos, personalizados só pelo nome.
 *
 * ## E isso não é observação estética
 *
 * `docs/mercado/limites-e-bloqueios.md` lista, entre o que faz o WhatsApp
 * banir: *"texto idêntico — a mesma string para centenas de destinos é o padrão
 * mais fácil de detectar"*. Mandar trezentas mensagens que diferem em duas
 * palavras é exatamente esse padrão, e o número banido é o do dono.
 *
 * Por isso a tela agrupa por modelo em vez de listar 882 textos: uma lista
 * longa esconde a repetição, e a repetição é o achado.
 */

export type ModeloDeMensagem = {
  /** A chave do agrupamento: tudo menos a primeira linha, que carrega o nome. */
  chave: string
  /** O texto de exemplo, já montado para uma empresa real. */
  exemplo: string
  /** O nicho, quando todas as empresas do modelo compartilham um. */
  vertical: string
  /** Quantas empresas receberiam exatamente este modelo. */
  quantas: number
  /** Quantas dessas têm como receber pelo WhatsApp. */
  comWhatsapp: number
  /** As primeiras empresas do grupo, para conferir o nome na saudação. */
  amostra: { dominio: string; nome: string; abertura: string }[]
}

const SEPARADOR = '\n\n'

/**
 * Agrupa as mensagens pelo corpo, ignorando a linha do nome.
 *
 * A primeira linha é descartada da chave de propósito: ela muda em 786 de 790
 * casos, então agrupar por texto inteiro devolveria 788 grupos de um — que é
 * verdade e não informa nada.
 */
export function agruparPorModelo(prospects: Prospect[]): ModeloDeMensagem[] {
  const grupos = new Map<string, ModeloDeMensagem>()

  for (const p of prospects) {
    const { texto, link } = mensagemPara(p)
    const partes = texto.split(SEPARADOR)
    const abertura = partes[0] ?? texto
    const chave = partes.slice(1).join(SEPARADOR)

    const atual = grupos.get(chave)
    if (atual) {
      atual.quantas += 1
      if (link) atual.comWhatsapp += 1
      if (atual.amostra.length < 5)
        atual.amostra.push({ dominio: p.dominio, nome: p.nome ?? p.dominio, abertura })
      // Um modelo pode atravessar nichos quando o gancho é o padrão. Marcar
      // como "vários" é mais honesto que mostrar o do primeiro que chegou.
      if (atual.vertical !== p.vertical) atual.vertical = 'vários'
      continue
    }

    grupos.set(chave, {
      chave,
      exemplo: texto,
      vertical: p.vertical,
      quantas: 1,
      comWhatsapp: link ? 1 : 0,
      amostra: [{ dominio: p.dominio, nome: p.nome ?? p.dominio, abertura }],
    })
  }

  return Array.from(grupos.values()).sort((a, b) => b.quantas - a.quantas)
}

/**
 * O que a saudação vai dizer, e onde ela ainda soa mal.
 *
 * `nomeCurto` já corta cauda de SEO, trilha de navegação e desfaz CAIXA ALTA —
 * as três medidas em 08/09 sobre as 882. O que sobra é nome legítimo e longo
 * ("Impressos Grafica E Comunicacao Visual"), que não é defeito e mesmo assim
 * lê pesado numa saudação. A tela mostra, e quem decide é o dono.
 */
export function aberturasSuspeitas(
  prospects: Prospect[],
  limite = 32,
): { dominio: string; abertura: string }[] {
  const saida: { dominio: string; abertura: string }[] = []
  for (const p of prospects) {
    const abertura = mensagemPara(p).texto.split(SEPARADOR)[0] ?? ''
    // O nome vive entre "Achei a " e " procurando".
    const casou = abertura.match(/Achei a (.+?) procurando/)
    const nome = casou?.[1] ?? ''
    if (nome.length > limite || nome.includes('.com') || nome === nome.toUpperCase())
      saida.push({ dominio: p.dominio, abertura })
  }
  return saida
}
