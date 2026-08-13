import { describe, expect, it } from 'vitest'

import { renderPagamentoAtrasadoEmail } from './pagamento-atrasado'
import { CONTROLADOR } from '@/lib/legal'

const base = {
  workspaceName: 'Acme Serviços',
  valor: 49,
  appUrl: 'https://www.velofunil.com.br',
}

describe('renderPagamentoAtrasadoEmail', () => {
  // O nome do workspace é digitado pela própria pessoa e entra no corpo do
  // e-mail. Sem escape, um nome com marcação viraria HTML no cliente de e-mail
  // de quem recebe.
  it('escapa o nome do workspace', () => {
    const { html } = renderPagamentoAtrasadoEmail({
      ...base,
      workspaceName: '<img src=x onerror=alert(1)>',
    })
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img src=x')
  })

  it('mostra o valor em reais', () => {
    const { html } = renderPagamentoAtrasadoEmail(base)
    expect(html).toContain('49,00')
  })

  // O botão é renderizado duas vezes de propósito: uma em HTML e outra em VML,
  // que é o único jeito de o Outlook desenhar botão com cantos arredondados.
  it('aponta para a tela de cobrança nas duas versões do botão', () => {
    const { html } = renderPagamentoAtrasadoEmail(base)
    const ocorrencias = html.split('https://www.velofunil.com.br/settings/billing').length - 1
    expect(ocorrencias).toBe(2)
  })

  // Mesma decisão do convite/pagamento-confirmado: assunto é texto puro.
  it('não escapa o assunto', () => {
    const { subject } = renderPagamentoAtrasadoEmail({
      ...base,
      workspaceName: 'Silva & Cia',
    })
    expect(subject).toBe('Seu pagamento não foi confirmado — Velo Funil')
    expect(subject).not.toContain('&amp;')
  })

  it('traz os dados do controlador no rodapé', () => {
    const { html } = renderPagamentoAtrasadoEmail(base)
    expect(html).toContain(CONTROLADOR.nomeFantasia)
  })

  // A pessoa precisa saber que o acesso Pro não caiu na hora — sem isso, quem
  // recebe o aviso à noite acha que já perdeu o produto e desiste de resolver.
  it('avisa que o acesso continua até vencer de vez', () => {
    const { html } = renderPagamentoAtrasadoEmail(base)
    expect(html).toContain('continua ativo')
  })
})
