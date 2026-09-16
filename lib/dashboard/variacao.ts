import type { PeriodoDoDashboard } from '@/lib/dashboard/queries'

/**
 * A comparação com o período anterior, e as três formas dela ser mentira.
 *
 * ## Por que ela pode existir agora, e não podia antes
 *
 * `metric-cards.tsx` afirmava desde agosto que "sem histórico de métricas por
 * período no schema ainda, não há como calcular variação real". A primeira
 * metade continua verdadeira: não existe tabela de snapshot. A segunda deixou
 * de ser, e o motivo é que as três RPCs do dashboard recortam por `created_at`
 * desde a 0036 — chamá-las com a janela anterior devolve o número de lá, sem
 * guardar nada.
 *
 * ## As três mentiras que este arquivo recusa
 *
 * **1. Comparar contra o nada.** Sem período escolhido ("Todo o período") não
 * existe janela anterior: o anterior a "tudo" é vazio, e toda métrica subiria
 * infinito por cima de zero. `janelaAnterior` devolve `null` e quem chama não
 * mostra comparação.
 *
 * **2. Dividir por zero e chamar de crescimento.** Sair de 0 para 5 não é
 * "+500%", é "não havia nada antes". Percentual exige base positiva.
 *
 * **3. Somar ponto percentual com por cento.** A conversão já É um percentual:
 * de 40% para 50% são DEZ PONTOS, e um crescimento de 25%. Os dois números são
 * certos e dizem coisas diferentes, e o errado aqui é o que engana — por isso
 * `unidade` não tem valor padrão: quem chama escolhe, sempre.
 */

/** Como a diferença deve ser lida. Sem padrão de propósito. */
export type UnidadeDaVariacao = 'percentual' | 'pontos'

export type Variacao = {
  /** O texto pronto, com sinal: `+7,4%`, `-4,2 p.p.`. */
  texto: string
  /** Para escolher cor e seta. `estavel` quando a diferença arredonda a zero. */
  direcao: 'subiu' | 'desceu' | 'estavel'
}

/**
 * A janela imediatamente anterior, do mesmo tamanho.
 *
 * "Últimos 7 dias" compara com os 7 dias antes deles, "Este mês" com o mesmo
 * número de dias antes do dia 1. Não é "mês anterior de calendário": no dia 3
 * do mês, comparar 3 dias contra 31 faria toda métrica despencar por
 * construção.
 */
export function janelaAnterior(
  periodo: PeriodoDoDashboard | null,
): PeriodoDoDashboard | null {
  if (!periodo) return null

  const inicio = Date.parse(periodo.desde)
  const fim = Date.parse(periodo.ate)
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim <= inicio) return null

  const duracao = fim - inicio

  return {
    // O fim recua 1ms; o INÍCIO não. Sem o 1ms as duas janelas se tocariam no
    // mesmo instante e um negócio criado exatamente na virada contaria dos dois
    // lados. Recuar o início junto (o defeito da primeira versão, pego pelo
    // teste) deslocaria a janela inteira um milissegundo para trás sem motivo,
    // e a comparação passaria a medir um intervalo que não é o espelho do
    // atual.
    ate: new Date(inicio - 1).toISOString(),
    desde: new Date(inicio - duracao).toISOString(),
  }
}

/**
 * Monta o texto da variação, ou devolve `null` quando não há o que afirmar.
 *
 * `null` é resposta, e é a mais importante: o card simplesmente não mostra a
 * linha de comparação. Um "0%" no lugar diria que ficou igual, quando a
 * verdade é que não havia base.
 */
export function compararComAnterior(
  atual: number,
  anterior: number,
  unidade: UnidadeDaVariacao,
): Variacao | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null

  if (unidade === 'pontos') {
    // Diferença absoluta entre dois percentuais. Base zero é legítima aqui:
    // ir de 0% para 30% são trinta pontos, e isso é verdade.
    const diferenca = Math.round((atual - anterior) * 10) / 10
    if (diferenca === 0) return { texto: '0 p.p.', direcao: 'estavel' }
    const sinal = diferenca > 0 ? '+' : '-'
    return {
      texto: `${sinal}${formatarNumero(Math.abs(diferenca))} p.p.`,
      direcao: diferenca > 0 ? 'subiu' : 'desceu',
    }
  }

  // Sem base anterior não existe percentual de crescimento. É a mentira nº 2.
  if (anterior <= 0) return null

  const razao = ((atual - anterior) / anterior) * 100
  const arredondado = Math.round(razao * 10) / 10
  if (arredondado === 0) return { texto: '0%', direcao: 'estavel' }

  const sinal = arredondado > 0 ? '+' : '-'
  return {
    texto: `${sinal}${formatarNumero(Math.abs(arredondado))}%`,
    direcao: arredondado > 0 ? 'subiu' : 'desceu',
  }
}

/** Vírgula decimal, e sem casa quando ela seria zero (`7,4%` mas `12%`). */
function formatarNumero(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}
