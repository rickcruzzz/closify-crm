'use client'

import * as React from 'react'

import { reportarErro } from '@/lib/erros/reportar'

/**
 * Captura o NOME do componente que quebrou, e devolve o erro para o Next.
 *
 * ## O defeito que isto fecha
 *
 * Em 20/08 e 22/08 o `/kanban` registrou dois "React #185" — o código de
 * *Maximum update depth exceeded*, um loop de `setState`. O que foi gravado
 * em `error_logs` é isto:
 *
 *     at ik (.../chunks/fd9d1056-b58fad7d2523e3e9.js:1:110229)
 *     at nf (.../chunks/fd9d1056-b58fad7d2523e3e9.js:1:26357)
 *
 * Nada ali nomeia um arquivo do projeto. Sabe-se que houve loop e não se sabe
 * em qual componente — então corrigir seria adivinhar, e por isso os dois
 * seguem sem diagnóstico.
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
 * ## Ele reporta e sai da frente
 *
 * O boundary mais interno é quem captura, então segurar o erro aqui tiraria a
 * tela de erro do Next — e ela é boa, foi escrita para responder "perdi o que
 * era meu?". A solução é a que a própria documentação indica: **relançar no
 * render**, para o erro subir ao `error.tsx` do segmento.
 *
 * O efeito é que este componente é invisível: reporta com o nome do
 * componente, e a experiência do usuário segue idêntica.
 */
export class CapturaDeComponente extends React.Component<
  { children: React.ReactNode; origem: 'dashboard' | 'publico' },
  { erro: Error | null }
> {
  state: { erro: Error | null } = { erro: null }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  componentDidCatch(erro: Error & { digest?: string }, info: React.ErrorInfo) {
    // O único lugar do projeto onde `componentStack` existe.
    reportarErro(erro, this.props.origem, info.componentStack ?? undefined)
  }

  render() {
    // Relança para o `error.tsx` do Next assumir a tela. Sem isto, a página
    // ficaria em branco: este boundary capturou e não desenha nada.
    if (this.state.erro) throw this.state.erro
    return this.props.children
  }
}
