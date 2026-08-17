'use client'

import { Analytics as VercelAnalytics } from '@vercel/analytics/next'

/**
 * Vercel Analytics com as URLs sensíveis higienizadas antes do envio.
 *
 * O pacote manda dois campos por pageview: `route`, que é o padrão da rota
 * (`/convite/[token]`), e `path`, que é o caminho REAL, com o valor do
 * parâmetro dentro. O segundo é o problema:
 *
 * - `/convite/<token>`, o token de convite é credencial: quem o tem entra no
 *   workspace. Mandar isso para um terceiro é vazar acesso, não telemetria.
 * - `/leads/<uuid>`, identificador de lead de cliente. Não abre porta, mas é
 *   dado de negócio de quem assina, e não há motivo para sair daqui.
 *
 * `beforeSend` roda no browser antes do envio: o que for devolvido é o que
 * viaja, e `null` descarta o evento. Aqui o segmento sensível é substituído
 * pelo nome do parâmetro, então a métrica de "quantas visitas a tela de
 * convite teve" continua funcionando sem carregar o segredo junto.
 */
const ROTAS_SENSIVEIS: { prefixo: string; substituto: string }[] = [
  { prefixo: '/convite/', substituto: '/convite/[token]' },
  { prefixo: '/leads/', substituto: '/leads/[id]' },
]

export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(evento) => {
        try {
          const url = new URL(evento.url)

          // A query inteira vai fora, em toda rota. `/leads?search=` carrega o
          // que a pessoa digitou, nome ou e-mail de cliente, e nenhum outro
          // parâmetro daqui (cursor, status) vale telemetria. Limpar sempre é
          // mais seguro que manter uma lista do que limpar: primeiro eu tratei
          // só as rotas com segmento dinâmico, e a busca escapava.
          url.search = ''

          for (const { prefixo, substituto } of ROTAS_SENSIVEIS) {
            if (
              url.pathname.startsWith(prefixo) &&
              url.pathname.length > prefixo.length
            ) {
              url.pathname = substituto
              break
            }
          }

          return { ...evento, url: url.toString() }
        } catch {
          // URL impossível de parsear é caso que não deveria acontecer; na
          // dúvida, descarta o evento em vez de mandar algo não inspecionado.
          return null
        }
      }}
    />
  )
}
