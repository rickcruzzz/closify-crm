'use client'

import * as React from 'react'

import { reportarErro } from '@/lib/erros/reportar'

/**
 * Captura o NOME do componente que quebrou, e devolve o erro para o Next.
 *
 * ## O defeito que isto fecha
 *
 * Em 20/08, 22/08, 02/09 e 05/09 o `/kanban` registrou "React #185" — o código
 * de *Maximum update depth exceeded*, um loop de `setState`. O que foi gravado
 * em `error_logs` é isto:
 *
 *     at ik (.../chunks/fd9d1056-b58fad7d2523e3e9.js:1:110229)
 *     at nf (.../chunks/fd9d1056-b58fad7d2523e3e9.js:1:26357)
 *
 * Nada ali nomeia um arquivo do projeto. Sabe-se que houve loop e não se sabe
 * em qual componente — então corrigir seria adivinhar.
 *
 * ## Por que não bastou usar o `error.tsx`
 *
 * Porque ele não recebe essa informação. O boundary do App Router entrega
 * apenas `{ error, reset }` — confirmado na documentação do Next, que lista
 * exatamente `error`, `error.digest` e `reset`. `errorInfo` não está lá, e
 * nenhuma prop do arquivo de erro carrega a árvore de componentes.
 *
 * Quem tem acesso a ela é `componentDidCatch(error, errorInfo)`, que só existe
 * em componente de CLASSE. Daí este arquivo ser a única classe do projeto: é
 * onde o React entrega `errorInfo.componentStack`, e ele traz a árvore **por
 * nome**, legível mesmo em produção minificada.
 *
 * ## Por que ele passou de 20/08 a 05/09 sem reportar UMA vez
 *
 * A primeira versão relançava direto no `render`:
 *
 *     render() { if (this.state.erro) throw this.state.erro; ... }
 *
 * `componentDidCatch` **não roda no render, roda no commit** — o React o agenda
 * como callback da própria update de erro, e callback de update é chamado
 * quando o fiber commita. Relançar no render impede o commit: a fila de update
 * é descartada junto com a subárvore, e o callback nunca acontece. O erro subia
 * para o `error.tsx` do segmento, que reporta sem `componentStack` — que é
 * exatamente a única linha que aparecia no banco, sempre vazia.
 *
 * A prova está na CONTAGEM: se os dois caminhos reportassem, cada incidente
 * gravaria duas linhas, uma com árvore e uma sem. Havia uma, sem. Inclusive
 * depois de 02/09, quando este boundary foi movido para dentro da página —
 * mudar de lugar não podia resolver, porque o defeito era o relance.
 *
 * ## Duas fases: commitar primeiro, relançar depois
 *
 * Na primeira, o render devolve `null`. Isso COMMITA, o React chama
 * `componentDidCatch`, e a árvore é capturada. Só então `reportado` libera o
 * relance, e o erro sobe para o `error.tsx` do segmento — que continua sendo a
 * tela que a pessoa vê, escrita para responder "perdi o que era meu?".
 *
 * O frame `null` dura um commit. Não é tela em branco: o layout do dashboard
 * está acima deste boundary e não é afetado.
 */
export class CapturaDeComponente extends React.Component<
  { children: React.ReactNode; origem: 'dashboard' | 'publico' },
  { erro: Error | null; reportado: boolean }
> {
  state: { erro: Error | null; reportado: boolean } = { erro: null, reportado: false }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  componentDidCatch(erro: Error & { digest?: string }, info: React.ErrorInfo) {
    // O único lugar do projeto onde `componentStack` existe.
    reportarErro(erro, this.props.origem, info.componentStack ?? undefined)
    // Libera a segunda fase. Sem este `setState` o erro ficaria preso aqui e a
    // tela do Next nunca apareceria — o oposto do que este boundary promete.
    this.setState({ reportado: true })
  }

  render() {
    if (this.state.erro && this.state.reportado) throw this.state.erro
    // Primeira fase: commita para que `componentDidCatch` possa rodar.
    if (this.state.erro) return null
    return this.props.children
  }
}
