import type { Alerta } from '@/lib/dono/vigia'

import { escapeHtml, paragraph, rawParagraph, renderEmail } from './layout'

/**
 * O e-mail do vigia: o que precisa de você hoje, e o que não deu para conferir.
 *
 * ## Este e-mail vai para UMA pessoa, e isso muda o texto
 *
 * Os outros e-mails deste projeto falam com o cliente e precisam explicar o
 * contexto inteiro. Este fala com quem construiu o sistema, então ele pode ser
 * telegráfico — e deve. Cada linha a mais é uma linha que atrasa a leitura de
 * quem abriu no celular entre uma coisa e outra.
 *
 * ## Por que não tem botão
 *
 * O layout deste projeto oferece `action`, e ele não é usado aqui de propósito:
 * a Central só existe em `localhost`, e um botão que leva a um endereço que só
 * abre numa máquina específica é um botão quebrado em todo lugar menos um. O
 * caminho vai como texto (`/dono/trial`), que é o que de fato ajuda quando a
 * máquina certa estiver na frente.
 */
export function renderVigiaEmail(params: {
  alertas: Alerta[]
  naoConferido: string[]
  dia: string
}): string {
  const { alertas, naoConferido, dia } = params

  const linhas = alertas
    .map((a) => {
      const onde = a.ondeOlhar
        ? ` <span style="color:#6b7280">${escapeHtml(a.ondeOlhar)}</span>`
        : ''
      return (
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.5">` +
        `<strong>${escapeHtml(a.titulo)}</strong><br>` +
        `<span style="color:#4b5563">${escapeHtml(a.detalhe)}</span>${onde}` +
        `</p>`
      )
    })
    .join('')

  const aviso =
    naoConferido.length > 0
      ? paragraph(
          `Não consegui conferir: ${naoConferido.join(', ')}. ` +
            'Isso não quer dizer que esteja tudo bem por lá, quer dizer que não sei.',
        )
      : ''

  const corpo =
    alertas.length > 0
      ? rawParagraph(linhas) + aviso
      : aviso

  return renderEmail({
    preheader:
      alertas.length > 0
        ? `${alertas.length} item(ns) precisam de você`
        : 'Algumas verificações falharam hoje',
    title: alertas.length > 0 ? 'O que precisa de você' : 'Não consegui conferir tudo',
    bodyHtml: corpo,
    footnote:
      // O fuso vai escrito: "01:11" sozinho e ambiguo para quem sabe que o
      // servidor roda em UTC, e a duvida derrota o proposito de mostrar a hora.
      `Varredura de ${escapeHtml(dia)} (horário de Brasília). ` +
      'Este e-mail só chega quando há algo, silêncio significa que está tudo em ordem.',
  })
}
