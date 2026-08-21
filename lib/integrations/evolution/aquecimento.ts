/**
 * Quanto um número pode enviar, conforme a idade da conexão.
 *
 * ## Por que isto existe
 *
 * Número novo que começa disparando é o padrão que mais derruba conta. As
 * fontes convergem: aquecer o número — poucos envios nos primeiros dias,
 * subindo devagar — reduz o risco de banimento em 70-80%. É a proteção mais
 * eficaz depois do proxy residencial.
 *
 * Os tetos abaixo seguem a referência de mercado: **abaixo de 30 mensagens por
 * hora é considerado seguro; acima de 60 o risco cresce muito.** Por dia,
 * 30-100 para conta nova e 200-500 para conta madura.
 *
 * ## Por que os números são conservadores
 *
 * Porque o custo de errar é assimétrico. Enviar devagar demais atrasa um
 * follow-up; enviar rápido demais custa o telefone comercial de um cliente,
 * sem recurso. Entre os dois erros, o primeiro é reparável.
 *
 * Sem `server-only`: função pura, sem I/O, testável.
 */

export type Tier = {
  /** Nome que aparece na tela, em português de dono de negócio. */
  rotulo: string
  porHora: number
  porDia: number
  /** O que explicar para quem está esperando poder mandar mais. */
  explicacao: string
}

const TIERS: { ateDias: number; tier: Tier }[] = [
  {
    ateDias: 7,
    tier: {
      rotulo: 'Aquecendo',
      porHora: 10,
      porDia: 30,
      explicacao:
        'Número recém-conectado. Nos primeiros dias o WhatsApp observa se o uso parece humano — enviar pouco agora é o que protege a conta depois.',
    },
  },
  {
    ateDias: 21,
    tier: {
      rotulo: 'Ganhando confiança',
      porHora: 20,
      porDia: 100,
      explicacao:
        'Duas semanas de uso sem incidente. O limite sobe, ainda abaixo da faixa em que o risco cresce.',
    },
  },
  {
    ateDias: Infinity,
    tier: {
      rotulo: 'Maduro',
      porHora: 30,
      porDia: 300,
      explicacao:
        'Conexão estabelecida. O teto para aqui de propósito: acima de 60 mensagens por hora o risco de restrição cresce muito, e nenhum follow-up justifica isso.',
    },
  },
]

/**
 * O tier de uma conexão, pela idade dela.
 *
 * @param conectadoEm quando o número foi conectado
 * @param agora injetável para o teste não depender do relógio
 */
export function tierDaConexao(conectadoEm: Date, agora: Date = new Date()): Tier {
  const dias = Math.floor((agora.getTime() - conectadoEm.getTime()) / (24 * 60 * 60 * 1000))

  // Data no futuro (relógio torto, dado corrompido) cai no tier mais restrito:
  // na dúvida, protege.
  if (dias < 0) return TIERS[0].tier

  return (TIERS.find((t) => dias <= t.ateDias) ?? TIERS[TIERS.length - 1]).tier
}

/** Quantos dias faltam para o próximo degrau. `null` quando já está no topo. */
export function diasParaProximoTier(conectadoEm: Date, agora: Date = new Date()): number | null {
  const dias = Math.max(0, Math.floor((agora.getTime() - conectadoEm.getTime()) / (24 * 60 * 60 * 1000)))
  const proximo = TIERS.find((t) => t.ateDias !== Infinity && dias <= t.ateDias)

  if (!proximo) return null
  return proximo.ateDias - dias + 1
}
