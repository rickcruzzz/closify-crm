import { describe, expect, it } from 'vitest'

import { renderPedidoDeConexaoEmail } from './pedido-de-conexao'

const BASE = {
  nomeDaEmpresa: 'Marcenaria Silva',
  emailDeQuemPediu: 'jose@marcenaria.com.br',
  appUrl: 'https://www.velofunil.com.br',
}

describe('renderPedidoDeConexaoEmail', () => {
  it('o assunto NOMEIA a empresa, e é o que o distingue na caixa', () => {
    // Ele chega na mesma caixa do vigia, que manda alerta de hora em hora.
    // Assunto genérico viraria mais uma linha igual às outras.
    const { subject } = renderPedidoDeConexaoEmail(BASE)
    expect(subject).toContain('Marcenaria Silva')
  })

  it('o assunto NÃO escapa HTML, porque assunto não é HTML', () => {
    // "Silva & Cia" viraria "Silva &amp; Cia" na caixa de entrada.
    const { subject } = renderPedidoDeConexaoEmail({ ...BASE, nomeDaEmpresa: 'Silva & Cia' })
    expect(subject).toContain('Silva & Cia')
    expect(subject).not.toContain('&amp;')
  })

  it('o corpo diz QUAL empresa e QUEM clicou', () => {
    // Quem abre este e-mail abre para FAZER. A informação que falta é qual
    // empresa e onde colar, não o que aconteceu.
    const { html } = renderPedidoDeConexaoEmail(BASE)
    expect(html).toContain('Marcenaria Silva')
    expect(html).toContain('jose@marcenaria.com.br')
  })

  it('o negrito sai como NEGRITO, e não como texto', () => {
    // `paragraph()` escapa tudo, então `<strong>` sairia literal na tela. Este
    // caso trava o uso de `rawParagraph` nas duas linhas que precisam dele.
    const { html } = renderPedidoDeConexaoEmail(BASE)
    expect(html).toContain('<strong>Marcenaria Silva</strong>')
    expect(html).not.toContain('&lt;strong&gt;')
  })

  it('nome com HTML dentro é ESCAPADO no corpo', () => {
    // `rawParagraph` não escapa nada, e o nome da empresa é digitado por gente.
    // Sem o `escapeHtml` à mão, um nome com tag viraria HTML no e-mail — e o
    // `tsc` não pega, porque os dois helpers recebem `string`.
    const { html } = renderPedidoDeConexaoEmail({
      ...BASE,
      nomeDaEmpresa: '<script>alert(1)</script>',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('o botão leva à tela do PRODUTO, e não ao painel da Z-API', () => {
    // O passo que só o Velo Funil faz é colar as credenciais, e é o que se
    // esquece. O painel da Z-API quem abre este e-mail já tem aberto.
    const { html } = renderPedidoDeConexaoEmail(BASE)
    expect(html).toContain('https://www.velofunil.com.br/settings/whatsapp')
    expect(html).not.toContain('z-api.io')
  })

  it('os TRÊS passos estão no corpo, e o segundo é o que some sozinho', () => {
    // A instância nasce em trial de 2 dias e a Z-API a apaga se ninguém
    // assinar. Esquecer o passo 2 faz o cliente perder o número no domingo.
    const { html } = renderPedidoDeConexaoEmail(BASE)
    expect(html).toContain('48 horas')
    expect(html).toMatch(/Já tenho uma instância/)
  })
})
