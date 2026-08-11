import { describe, expect, it } from 'vitest'

import { renderPagamentoConfirmadoEmail } from './pagamento-confirmado'
import { CONTROLADOR } from '@/lib/legal'

const base = {
  workspaceName: 'Acme Serviços',
  valor: 49,
  appUrl: 'https://www.velofunil.com.br',
}

describe('renderPagamentoConfirmadoEmail', () => {
  // O nome do workspace é digitado pela própria pessoa e entra no corpo do
  // e-mail. Sem escape, um nome com marcação viraria HTML no cliente de e-mail
  // de quem recebe.
  it('escapa o nome do workspace', () => {
    const { html } = renderPagamentoConfirmadoEmail({
      ...base,
      workspaceName: '<img src=x onerror=alert(1)>',
    })
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img src=x')
  })

  it('mostra o valor em reais', () => {
    const { html } = renderPagamentoConfirmadoEmail(base)
    expect(html).toContain('49,00')
  })

  // O botão é renderizado duas vezes de propósito: uma em HTML e outra em VML,
  // que é o único jeito de o Outlook desenhar botão com cantos arredondados.
  // Se cair para uma só, o Outlook perde o botão ou o resto perde o link.
  it('aponta para o dashboard nas duas versões do botão', () => {
    const { html } = renderPagamentoConfirmadoEmail(base)
    const ocorrencias = html.split('https://www.velofunil.com.br/dashboard').length - 1
    expect(ocorrencias).toBe(2)
  })

  // Mesma decisão do convite: assunto é texto puro, não HTML. Escapar faria
  // "Silva & Cia" aparecer como "Silva &amp; Cia" na lista da caixa de entrada.
  it('não escapa o assunto', () => {
    const { subject } = renderPagamentoConfirmadoEmail({
      ...base,
      workspaceName: 'Silva & Cia',
    })
    expect(subject).toBe('Seu plano Pro está ativo — Velo Funil')
    expect(subject).not.toContain('&amp;')
  })

  it('traz os dados do controlador no rodapé', () => {
    const { html } = renderPagamentoConfirmadoEmail(base)
    expect(html).toContain(CONTROLADOR.nomeFantasia)
  })

  // Quem recebe precisa saber que vai ser cobrado de novo e como sair. Sem
  // isso, a renovação do mês seguinte vira contestação.
  it('avisa que a renovação é automática e como cancelar', () => {
    const { html } = renderPagamentoConfirmadoEmail(base)
    expect(html).toContain('mensal e automática')
    expect(html).toContain('Cobrança')
  })
})
