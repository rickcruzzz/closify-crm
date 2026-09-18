import { redirect } from 'next/navigation'

/**
 * A conexao do WhatsApp mudou de endereco em 17/09, e esta rota fica como
 * ponte.
 *
 * A tela virou uma so: `/conversas` mostra o painel de conexao enquanto o
 * numero nao esta de pe e a caixa de entrada depois disso. Manter duas telas
 * que fazem a mesma coisa era o defeito, entao o conteudo nao foi copiado
 * para ca, ele saiu.
 *
 * ## Por que a rota nao foi simplesmente apagada
 *
 * Ela esta escrita em quatro lugares que ja sairam daqui e nao voltam:
 *
 *     lib/emails/pedido-de-conexao.ts        o botao do e-mail que avisa o dono
 *     app/api/webhooks/zapi/disconnected/    o `href` do aviso de queda no sino
 *     components/settings/max-card.tsx       o atalho de quem acabou de assinar
 *     lib/integrations/whatsapp-estado.ts    o destino declarado da integracao
 *
 * E-mail enviado e notificacao ja gravada no banco nao se reescrevem. Link
 * publicado que passa a dar 404 e pior do que rota duplicada, ainda mais
 * quando ele e o unico caminho de quem pagou R$ 250 ate o proprio numero.
 *
 * `redirect` e nao `permanentRedirect`: a area logada ja e `noindex`, e um 308
 * ficaria no cache do navegador da pessoa muito depois de esta ponte deixar de
 * ser necessaria.
 */
export default function WhatsappPage() {
  redirect('/conversas')
}
