import 'server-only'

import { registrarNotificacao } from '@/lib/notificacoes/registrar'

import type { AvisoDeSinal, PortaDeNotificacoes } from '../ports/notificacoes'

/**
 * A ponte com o sino que já existe.
 *
 * Chama `registrarNotificacao` e nada mais. A regra de "um único ponto de
 * escrita de notificação" (0066) continua valendo: se este adapter montasse o
 * próprio `insert`, o texto do sino e o do e-mail passariam a divergir sem nada
 * falhar — que é exatamente o que aquele arquivo existe para impedir.
 *
 * O tipo `sinal_de_mercado` precisa entrar no `check` da 0066 antes disto
 * funcionar. É de propósito: naquela migration está escrito que "acrescentar um
 * tipo passa a exigir uma migration, e exigir migration é o que transforma
 * 'entrou na lista' em decisão".
 */
export function criarPortaDeNotificacoes(): PortaDeNotificacoes {
  return {
    async avisar(aviso: AvisoDeSinal): Promise<void> {
      await registrarNotificacao({
        workspaceId: aviso.workspaceId,
        // @ts-expect-error — `sinal_de_mercado` entra no `check` da 0066 numa
        // migration própria, junto com a tela que o mostra. Até lá o tipo não
        // existe no banco e esta chamada seria recusada com 23514. O
        // `ts-expect-error` é a trava: quando o tipo entrar, ele passa a
        // acusar erro e obriga a remover esta linha.
        tipo: 'sinal_de_mercado',
        titulo: aviso.titulo,
        corpo: aviso.corpo,
        href: aviso.href,
      })
    },
  }
}
