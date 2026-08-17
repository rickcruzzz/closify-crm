import { describe, expect, it } from 'vitest'

import { renderPlanoVencendoEmail } from './plano-vencendo'
import { CONTROLADOR } from '@/lib/legal'

const base = {
  workspaceName: 'Acme Serviços',
  valor: 49,
  diasRestantes: 2,
  appUrl: 'https://www.velofunil.com.br',
}

describe('renderPlanoVencendoEmail', () => {
  // Mesmo motivo dos outros e-mails: o nome do workspace é digitado pela
  // própria pessoa e entra no corpo. Sem escape vira marcação no cliente de
  // e-mail de quem recebe.
  it('escapa o nome do workspace', () => {
    const { html } = renderPlanoVencendoEmail({
      ...base,
      workspaceName: '<img src=x onerror=alert(1)>',
    })
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img src=x')
  })

  it('mostra o valor em reais', () => {
    const { html } = renderPlanoVencendoEmail(base)
    expect(html).toContain('49,00')
  })

  // "vence em 1 dia" lê como texto gerado por máquina. Quem recebe isso na
  // véspera precisa entender de primeira que é amanhã.
  it('diz "amanhã" em vez de "em 1 dia"', () => {
    const { subject, html } = renderPlanoVencendoEmail({ ...base, diasRestantes: 1 })
    expect(subject).toBe('Seu plano Pro vence amanhã, Velo Funil')
    expect(html).toContain('amanhã')
    expect(html).not.toContain('em 1 dias')
    expect(html).not.toContain('em 1 dia ')
  })

  it('usa a contagem em dias quando falta mais de um', () => {
    const { subject } = renderPlanoVencendoEmail({ ...base, diasRestantes: 2 })
    expect(subject).toBe('Seu plano Pro vence em 2 dias, Velo Funil')
  })

  // O botão sai duas vezes: HTML e VML, que é o único jeito de o Outlook
  // desenhar botão com canto arredondado.
  it('aponta para a tela de cobrança nas duas versões do botão', () => {
    const { html } = renderPlanoVencendoEmail(base)
    const ocorrencias = html.split('https://www.velofunil.com.br/settings/billing').length - 1
    expect(ocorrencias).toBe(2)
  })

  it('não escapa o assunto', () => {
    const { subject } = renderPlanoVencendoEmail({ ...base, workspaceName: 'Silva & Cia' })
    expect(subject).not.toContain('&amp;')
  })

  it('traz os dados do controlador no rodapé', () => {
    const { html } = renderPlanoVencendoEmail(base)
    expect(html).toContain(CONTROLADOR.nomeFantasia)
  })

  // No caminho feliz o Asaas cobra sozinho. Se este e-mail soar como "pague
  // agora ou perde o acesso", quem tem cartão salvo entra no produto achando
  // que algo quebrou, e o aviso vira suporte em vez de evitar churn.
  it('deixa claro que a cobrança é automática', () => {
    const { html } = renderPlanoVencendoEmail(base)
    expect(html).toContain('automática')
    expect(html).toContain('não precisa fazer nada')
  })
})
