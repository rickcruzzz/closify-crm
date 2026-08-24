'use client'

import * as React from 'react'

/**
 * Cerca em volta do que é rastreamento, para ele nunca derrubar o produto.
 *
 * ## Por que existe
 *
 * Em 24/08/2026 o site inteiro virou tela preta para quem aceitava os
 * cookies. A causa foi um `\n` no valor de `NEXT_PUBLIC_META_PIXEL_ID`, que
 * transformava o script inline do pixel em JavaScript inválido; `next/script`
 * injeta com `appendChild` durante o commit do React, e a exceção subiu até
 * `app/global-error.tsx`, que pinta fundo `#0a0a0a`.
 *
 * `lib/analytics/pixel-id.ts` corrige a CAUSA daquele incidente. Este arquivo
 * fecha a CLASSE dele, que é maior:
 *
 * > **Uma falha em medição nunca pode impedir alguém de usar o sistema.**
 *
 * Pixel, Analytics e captura de UTM não entregam nada ao cliente — servem
 * para o dono entender o tráfego. Quando um deles quebra, a resposta certa é
 * perder o dado, não a visita. Sem esta cerca, qualquer erro futuro em
 * qualquer um dos três (script de terceiro mudando, variável mal colada de
 * novo, bloqueador criando um estado inesperado) volta a derrubar a página
 * inteira, porque os três vivem no LAYOUT RAIZ.
 *
 * ## Por que classe e não hook
 *
 * `componentDidCatch` não tem equivalente em função — é a única API do React
 * que captura erro de render e de commit da subárvore. Não é escolha de
 * estilo.
 *
 * O erro não é engolido em silêncio: vai para o console e para `error_logs`
 * pelo mesmo caminho dos boundaries de página, para continuar aparecendo na
 * investigação sem aparecer para o visitante.
 */
export class IsolarAnalytics extends React.Component<
  { children: React.ReactNode; nome: string },
  { falhou: boolean }
> {
  state = { falhou: false }

  static getDerivedStateFromError() {
    return { falhou: true }
  }

  componentDidCatch(erro: Error) {
    console.error(`[analytics] ${this.props.nome} falhou e foi desligado`, erro)

    // Import dinâmico: `reportarErro` puxa o caminho de rede, e carregá-lo no
    // bundle do layout raiz custaria peso em toda página para um caminho que
    // quase nunca roda.
    void import('@/lib/erros/reportar')
      .then(({ reportarErro }) => reportarErro(erro, 'publico'))
      .catch(() => {
        // Se nem o relato funcionar, não há mais nada a fazer aqui — e
        // insistir seria o próprio erro de analytics derrubando a página, que
        // é exatamente o que este componente existe para impedir.
      })
  }

  render() {
    // Sem fallback visual, de propósito: rastreamento não desenha nada. O
    // visitante não deve perceber diferença nenhuma.
    return this.state.falhou ? null : this.props.children
  }
}
