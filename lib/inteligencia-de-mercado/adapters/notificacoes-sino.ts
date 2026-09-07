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
 * O tipo `sinal_de_mercado` entrou no `check` pela **0073**, numa migration
 * própria e não de carona na 0072 — porque naquele arquivo está escrito que
 * "acrescentar um tipo passa a exigir uma migration, e exigir migration é o que
 * transforma 'entrou na lista' em decisão".
 *
 * Até a 0073 existia aqui um `@ts-expect-error` dizendo que o tipo ainda não
 * existia no banco. **Ele fez o trabalho dele:** no instante em que o valor
 * entrou na lista, o próprio `tsc` acusou a diretiva como inútil e obrigou a
 * removê-la. Comentário de pendência que envelhece em silêncio é o que este
 * padrão evita.
 */
export function criarPortaDeNotificacoes(): PortaDeNotificacoes {
  return {
    async avisar(aviso: AvisoDeSinal): Promise<void> {
      await registrarNotificacao({
        workspaceId: aviso.workspaceId,
        tipo: 'sinal_de_mercado',
        titulo: aviso.titulo,
        corpo: aviso.corpo,
        href: aviso.href,
      })
    },
  }
}
