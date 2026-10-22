import { normalizarTelefoneBrasileiro } from '@/lib/leads/whatsapp'

export function contatoDoEventoCompleto(evento: {
  contato_email?: string | null
  contato_telefone?: string | null
}): boolean {
  const email = evento.contato_email?.trim() ?? ''
  return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(email) &&
    !/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(email) &&
    normalizarTelefoneBrasileiro(evento.contato_telefone) !== null
}

/** Nunca troca o destino do evento pelo telefone de outro contato com o mesmo e-mail. */
export function conferirDestinatarioDoEvento(
  telefoneDoEvento: string | null | undefined,
  telefoneDoContato: string | null | undefined,
): { ok: true; telefone: string } | { ok: false; erro: string } {
  const esperado = normalizarTelefoneBrasileiro(telefoneDoEvento)
  const cadastrado = normalizarTelefoneBrasileiro(telefoneDoContato)
  if (!esperado || !cadastrado) {
    return { ok: false, erro: 'Confirme um telefone válido no evento e no contato do CRM antes de abrir a conversa.' }
  }
  if (esperado !== cadastrado) {
    return { ok: false, erro: 'O telefone do evento é diferente do contato vinculado. Confira os dois cadastros antes de enviar.' }
  }
  return { ok: true, telefone: cadastrado }
}
