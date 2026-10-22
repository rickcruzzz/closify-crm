import { CONTROLADOR } from '@/lib/legal'

/**
 * O caminho comercial da landing, num lugar só.
 *
 * Desde o reposicionamento de 22/10 (CRM B2B + Radar de Prospecção) a página
 * inicial não leva mais ao cadastro: todo CTA abre uma conversa com a equipe.
 * Cada botão manda uma mensagem própria para quem atende saber de onde a
 * pessoa veio sem precisar perguntar.
 *
 * O número vem de `CONTROLADOR`, o mesmo das páginas legais e do rodapé —
 * escrito à mão aqui, divergiria na primeira troca de número.
 */
export const MENSAGENS_COMERCIAIS = {
  demonstracao:
    'Olá! Quero ver uma demonstração do Velo Funil, o CRM com Radar de Prospecção. Podemos agendar?',
  equipe:
    'Olá! Conheci o Velo Funil e quero conversar com a equipe sobre o CRM e o Radar de Prospecção para a minha empresa.',
  crm: 'Olá! Quero entender como o CRM do Velo Funil funcionaria na minha operação comercial.',
  radar:
    'Olá! Tenho interesse no Radar de Prospecção. Posso contar o segmento, a região e o perfil de cliente que quero alcançar?',
} as const

export type MotivoDoContato = keyof typeof MENSAGENS_COMERCIAIS

export function linkDoContatoComercial(motivo: MotivoDoContato): string {
  return `https://wa.me/${CONTROLADOR.whatsapp.numero}?text=${encodeURIComponent(MENSAGENS_COMERCIAIS[motivo])}`
}
