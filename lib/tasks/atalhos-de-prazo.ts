/**
 * Os atalhos de prazo do formulário de tarefa, e a conversão para o campo.
 *
 * ## Por que atalho, e não só o campo de data
 *
 * `<input type="datetime-local">` é o controle mais difícil da tela: é um
 * campo **segmentado**, e preencher exige navegar dia, mês, ano, hora e minuto
 * um a um. Com teclado dá trabalho; com leitor de tela, mais ainda; no
 * telefone abre um seletor nativo que varia de aparelho para aparelho.
 *
 * E o caso comum de um CRM de venda é sempre o mesmo: "amanhã de manhã".
 * Botão resolve isso num toque, é alcançável por `Tab` e anuncia o que faz.
 * O campo continua ali, intacto, para data qualquer — o atalho não substitui
 * nada, tira a obrigação de usar o difícil para o fácil.
 *
 * ## O rótulo sai do valor, nunca ao lado dele
 *
 * `rotulo` é montado a partir do próprio instante que o botão aplica. Escrever
 * "Hoje 9h" à mão num botão que grava outra coisa é o tipo de divergência que
 * ninguém percebe até um cliente marcar reunião na hora errada.
 */

/**
 * O valor que o `<input type="datetime-local">` espera: `YYYY-MM-DDTHH:mm` no
 * fuso de quem está olhando.
 *
 * `toISOString()` aqui daria o horário em UTC e o campo abriria três horas
 * adiantado. A conta com `getTimezoneOffset` desloca o instante para que o
 * corte da string caia no horário local.
 */
export function paraCampoLocal(data: Date): string {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** A hora que quase todo follow-up de venda quer. */
const HORA_PADRAO = 9

/**
 * Depois disto, "Hoje" não cabe mais no dia: a próxima hora cheia cairia na
 * madrugada seguinte, e um atalho chamado "Hoje" que marca amanhã mente.
 */
const ULTIMA_HORA_UTIL = 22

export type AtalhoDePrazo = {
  id: 'hoje' | 'amanha' | 'segunda'
  /** O que o botão mostra, derivado do valor. */
  rotulo: string
  /** Pronto para o `<input type="datetime-local">`. */
  valor: string
}

function em(base: Date, dias: number, hora: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  d.setHours(hora, 0, 0, 0)
  return d
}

function horaLegivel(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Quantos dias até a próxima segunda-feira, **nunca zero**.
 *
 * Numa segunda, "Segunda" tem que significar a da semana que vem: um atalho
 * que aponta para o dia em que a pessoa está não é atalho, é engano.
 */
function diasAteSegunda(agora: Date): number {
  return (8 - agora.getDay()) % 7 || 7
}

/**
 * Os atalhos que fazem sentido AGORA.
 *
 * Recebe o instante em vez de ler o relógio para poder ser testado: o servidor
 * da Vercel roda em UTC e "hoje" do usuário não é o dele, armadilha que este
 * projeto já pagou em `lib/tasks/buckets.ts`. Quem chama passa o relógio do
 * cliente.
 */
export function atalhosDePrazo(agora: Date): AtalhoDePrazo[] {
  const atalhos: AtalhoDePrazo[] = []

  // "Hoje" às 9h só enquanto 9h ainda não passou. Depois disso vira a próxima
  // hora cheia, que é o único "hoje" que ainda dá para cumprir — oferecer 9h
  // às três da tarde marcaria a tarefa como atrasada no instante em que ela
  // nasce, e o schema aceita (o piso é um ano atrás), então nada reclamaria.
  const hoje =
    agora.getHours() < HORA_PADRAO
      ? em(agora, 0, HORA_PADRAO)
      : em(agora, 0, agora.getHours() + 1)

  if (agora.getHours() < ULTIMA_HORA_UTIL) {
    atalhos.push({ id: 'hoje', rotulo: `Hoje, ${horaLegivel(hoje)}`, valor: paraCampoLocal(hoje) })
  }

  const amanha = em(agora, 1, HORA_PADRAO)
  atalhos.push({
    id: 'amanha',
    rotulo: `Amanhã, ${horaLegivel(amanha)}`,
    valor: paraCampoLocal(amanha),
  })

  const segunda = em(agora, diasAteSegunda(agora), HORA_PADRAO)
  const valorDaSegunda = paraCampoLocal(segunda)

  // No domingo, "Segunda" e "Amanhã" são o mesmo instante. Dois botões que
  // fazem a mesma coisa com nomes diferentes obrigam a pessoa a comparar as
  // datas para descobrir que não precisava escolher.
  if (!atalhos.some((a) => a.valor === valorDaSegunda)) {
    atalhos.push({
      id: 'segunda',
      rotulo: `Segunda, ${horaLegivel(segunda)}`,
      valor: valorDaSegunda,
    })
  }

  return atalhos
}

/** O prazo com que o formulário nasce quando a tarefa é nova. */
export function sugestaoDePrazo(agora: Date): string {
  return paraCampoLocal(em(agora, 1, HORA_PADRAO))
}
