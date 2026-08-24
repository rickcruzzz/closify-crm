import { describe, expect, it } from 'vitest'

import { renderWhatsappDesconectadoEmail } from './whatsapp-desconectado'
import { CONTROLADOR } from '@/lib/legal'

const base = {
  workspaceName: 'Acme Serviços',
  appUrl: 'https://www.velofunil.com.br',
}

describe('renderWhatsappDesconectadoEmail', () => {
  // Mesmo motivo dos outros e-mails: o nome do workspace é digitado pela
  // própria pessoa e entra no corpo. Sem escape vira marcação no cliente de
  // e-mail de quem recebe.
  it('escapa o nome do workspace', () => {
    const { html } = renderWhatsappDesconectadoEmail({
      ...base,
      workspaceName: '<img src=x onerror=alert(1)>',
    })
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img src=x')
  })

  it('não escapa o assunto', () => {
    const { subject } = renderWhatsappDesconectadoEmail({ ...base, workspaceName: 'Silva & Cia' })
    expect(subject).not.toContain('&amp;')
  })

  it('leva para a aba de integrações, não para a raiz de configurações', () => {
    const { html } = renderWhatsappDesconectadoEmail(base)
    expect(html).toContain('/settings?aba=integracoes')
  })

  // Este e-mail só dispara depois que a tentativa automática de reconectar
  // já falhou (ver o webhook do Evolution) — o texto precisa dizer isso, ou
  // quem recebe vai achar que basta esperar, quando na verdade o produto já
  // tentou e não conseguiu sozinho.
  it('deixa claro que já tentamos reconectar sozinhos antes de avisar', () => {
    const { html } = renderWhatsappDesconectadoEmail(base)
    expect(html).toContain('tentativa automática de reconectar não funcionou')
  })

  // Sem isso a mensagem lê como "nosso produto quebrou", quando na verdade é
  // limitação conhecida de usar WhatsApp Web em vez da API oficial — dizer a
  // causa evita ligação de suporte perguntando "o CRM caiu?".
  it('nomeia a causa (WhatsApp Web, não API oficial) em vez de deixar vago', () => {
    const { html } = renderWhatsappDesconectadoEmail(base)
    expect(html).toContain('WhatsApp Web')
    expect(html).toContain('não a API oficial da Meta')
  })

  it('traz os dados do controlador no rodapé', () => {
    const { html } = renderWhatsappDesconectadoEmail(base)
    expect(html).toContain(CONTROLADOR.nomeFantasia)
  })
})
