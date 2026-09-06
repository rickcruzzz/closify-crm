/**
 * `agora()` injetável.
 *
 * A janela de 30 dias e o corte de 12 meses dependem do relógio. Sem injeção, o
 * teste teria que esperar ou mexer no relógio do sistema — e o projeto já pagou
 * por confundir hora do servidor com hora do usuário: a Vercel roda em UTC, e
 * `toISOString().slice(0,10)` às 21h de São Paulo já é o dia seguinte.
 */
export type Relogio = { agora(): Date }

export const relogioDoSistema: Relogio = { agora: () => new Date() }
