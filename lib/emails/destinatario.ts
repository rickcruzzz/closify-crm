/**
 * Para onde o sistema avisa o DONO. Um endereço, um lugar.
 *
 * ## Por que isto existe
 *
 * Estava escrito dentro de `app/api/cron/vigia/route.ts`, e só o vigia o
 * conhecia. O relato de suporte, que é aviso operacional do mesmo tipo, ia
 * para `CONTROLADOR.email` (`suporte@velofunil.com.br`) — outro endereço,
 * outra caixa.
 *
 * Duas caixas para avisos do mesmo sistema significa que uma vai ser esquecida,
 * e foi o que aconteceu: medido em 02/09, o Resend mostrava o vigia chegando em
 * `notificacaosistemavelofunil@gmail.com` e **zero** e-mails de suporte, com
 * dez relatos guardados no banco.
 *
 * ## Por que não é `CONTROLADOR.email`
 *
 * `suporte@velofunil.com.br` é o endereço PÚBLICO: ele aparece no rodapé, nas
 * páginas legais e é para onde o cliente escreve. Ele continua sendo o
 * remetente de tudo — é o domínio verificado no Resend, e mandar de um Gmail
 * derrubaria a entregabilidade que o domínio próprio garante.
 *
 * O que muda é o DESTINO de aviso interno: quem lê é o dono, não o público.
 */
export const EMAIL_DE_AVISO_DO_DONO = 'notificacaosistemavelofunil@gmail.com'
