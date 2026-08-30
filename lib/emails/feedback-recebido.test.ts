import { describe, expect, it } from 'vitest'

import { renderFeedbackRecebidoEmail } from './feedback-recebido'

const base = {
  emailDoCliente: 'pessoa@empresa.com.br',
  empresa: 'Acme Serviços',
  plano: 'pro',
  rota: '/kanban',
  mensagem: 'O botão de salvar não responde quando arrasto um card.',
}

describe('renderFeedbackRecebidoEmail', () => {
  /**
   * A mensagem é escrita pelo cliente e entra no corpo do e-mail que o DONO
   * abre. Sem escape, um relato com marcação viraria HTML na caixa de quem
   * recebe — e este é o único e-mail do produto cujo corpo carrega texto livre
   * de terceiro, então é o único onde essa porta existe.
   */
  it('escapa a mensagem do cliente', () => {
    const { html } = renderFeedbackRecebidoEmail({
      ...base,
      mensagem: '<img src=x onerror=alert(1)>',
    })
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img src=x')
  })

  it('escapa o nome da empresa, que a própria pessoa digitou', () => {
    const { html } = renderFeedbackRecebidoEmail({ ...base, empresa: '<script>x</script>' })
    expect(html).toContain('&lt;script')
    expect(html).not.toContain('<script>x')
  })

  /**
   * O assunto é lido na notificação do celular, muitas vezes sem abrir nada.
   * Cliente pagante travado é outra urgência que cliente do plano gratuito, e
   * saber disso ANTES de abrir é o que permite decidir se responde agora.
   */
  it('diz o plano no assunto, porque é o que muda a urgência', () => {
    expect(renderFeedbackRecebidoEmail(base).subject).toContain('Pro')
    expect(renderFeedbackRecebidoEmail({ ...base, plano: 'free' }).subject).toContain('Grátis')
  })

  it('nomeia a empresa no assunto', () => {
    expect(renderFeedbackRecebidoEmail(base).subject).toContain('Acme Serviços')
  })

  /**
   * Responder ao cliente É a ação deste e-mail, e ele não tem botão para
   * lugar nenhum. Se o endereço sumisse do corpo, o aviso chegaria sem dizer
   * para quem responder — e a Central, que tem o dado, só abre em localhost.
   */
  it('carrega o e-mail do cliente no corpo, que é a única forma de responder', () => {
    expect(renderFeedbackRecebidoEmail(base).html).toContain('pessoa@empresa.com.br')
  })

  it('diz de qual tela o relato saiu', () => {
    expect(renderFeedbackRecebidoEmail(base).html).toContain('/kanban')
  })

  // A rota é opcional no schema: faltar contexto não pode impedir o relato de
  // chegar, e muito menos quebrar o e-mail que avisa sobre ele.
  it('funciona sem rota', () => {
    const { html } = renderFeedbackRecebidoEmail({ ...base, rota: null })
    expect(html).toContain('relatou um problema')
  })

  /**
   * Quebra de linha vira `<br />`: e-mail em HTML colapsa `\n`, e um relato de
   * três parágrafos chegaria como um bloco único e ilegível — exatamente o
   * texto que precisa ser lido com atenção.
   */
  it('preserva as quebras de linha do relato', () => {
    const { html } = renderFeedbackRecebidoEmail({ ...base, mensagem: 'linha um\nlinha dois' })
    expect(html).toContain('linha um<br />linha dois')
  })

  // Mesma decisão dos outros e-mails: assunto é texto puro, não HTML.
  it('não escapa o assunto', () => {
    const { subject } = renderFeedbackRecebidoEmail({ ...base, empresa: 'Silva & Cia' })
    expect(subject).toContain('Silva & Cia')
    expect(subject).not.toContain('&amp;')
  })
})
