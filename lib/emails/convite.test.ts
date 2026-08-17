import { describe, expect, it } from 'vitest'

import { renderConviteEmail } from '@/lib/emails/convite'

/**
 * O caso de injeção abaixo é a razão de existir deste arquivo.
 *
 * O nome do workspace é texto livre, escolhido pelo admin, e vai interpolado
 * no HTML de um e-mail entregue a quem ainda nem tem conta, num domínio com
 * SPF e DKIM válidos, que é exatamente o que dá credibilidade a um phishing.
 * O escape existia solto em `lib/workspace/actions.ts`; ao movê-lo para
 * `lib/emails/layout.ts`, este teste é o que garante que a proteção veio junto
 * e continua valendo depois de qualquer refatoração do layout.
 */
describe('renderConviteEmail', () => {
  const inviteUrl = 'https://www.velofunil.com.br/convite/abc-123'

  it('neutraliza markup no nome do workspace', () => {
    const { html } = renderConviteEmail({
      workspaceName: '<img src=x onerror=alert(1)>',
      inviteUrl,
    })

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('não deixa o nome escapar de dentro de um atributo', () => {
    const { html } = renderConviteEmail({
      workspaceName: '" onmouseover="alert(1)',
      inviteUrl,
    })

    expect(html).not.toContain('onmouseover="alert(1)"')
  })

  it('mantém o link do convite intacto', () => {
    const { html } = renderConviteEmail({ workspaceName: 'Agência Nova Era', inviteUrl })
    expect(html).toContain(`href="${inviteUrl}"`)
  })

  /**
   * Assunto é texto puro. Escapar aqui é um erro fácil de cometer junto com o
   * escape do corpo, e o resultado aparece na cara do usuário: "Silva &amp;
   * Cia" na lista da caixa de entrada.
   */
  it('não escapa o assunto', () => {
    const { subject } = renderConviteEmail({ workspaceName: 'Silva & Cia', inviteUrl })

    expect(subject).toBe('Você foi convidado para o workspace Silva & Cia')
    expect(subject).not.toContain('&amp;')
  })

  it('exibe o nome do workspace para quem recebe', () => {
    const { html } = renderConviteEmail({ workspaceName: 'Agência Nova Era', inviteUrl })
    expect(html).toContain('Agência Nova Era')
  })
})
