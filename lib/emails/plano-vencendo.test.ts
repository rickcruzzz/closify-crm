import { describe, expect, it } from 'vitest'

import { corpoDoAviso, renderPlanoVencendoEmail } from './plano-vencendo'
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
  //
  // `?pagar=1` e não `/settings/billing` seco: o parâmetro abre o diálogo de
  // pagamento já com o Pix na tela. Sem ele, a pessoa cai numa tela e ainda
  // precisa achar o botão, justamente quando já decidiu pagar.
  it('leva direto ao pagamento, nas duas versões do botão', () => {
    const { html } = renderPlanoVencendoEmail(base)
    const comParametro =
      html.split('https://www.velofunil.com.br/settings/billing?pagar=1').length - 1
    expect(comParametro).toBe(2)
  })

  it('não escapa o assunto', () => {
    const { subject } = renderPlanoVencendoEmail({ ...base, workspaceName: 'Silva & Cia' })
    expect(subject).not.toContain('&amp;')
  })

  it('traz os dados do controlador no rodapé', () => {
    const { html } = renderPlanoVencendoEmail(base)
    expect(html).toContain(CONTROLADOR.nomeFantasia)
  })
})

/**
 * O aviso passou a sair todo dia na reta final (D-4 a D-1). Quatro e-mails
 * idênticos em quatro dias lêem como robô de cobrança, e quem marca como spam
 * perde junto o e-mail de pagamento confirmado, que sai do mesmo remetente.
 */
describe('corpoDoAviso, a escada de quatro dias', () => {
  const args = { nomeEscapado: 'Acme', valorFormatado: 'R$ 49,00', quando: 'em 3 dias' }

  it('os quatro dias dizem coisas diferentes', () => {
    const corpos = [4, 3, 2, 1].map(
      (d) => corpoDoAviso({ ...args, diasRestantes: d }).bodyHtml,
    )
    expect(new Set(corpos).size).toBe(4)
  })

  // No caminho feliz o Asaas cobra sozinho. Se o aviso soar como "pague agora
  // ou perde o acesso", quem tem cartão salvo entra no produto achando que algo
  // quebrou, e o e-mail vira suporte em vez de evitar churn.
  it('o primeiro aviso diz que não há nada a fazer no cartão', () => {
    const { bodyHtml } = corpoDoAviso({ ...args, diasRestantes: 4 })
    expect(bodyHtml).toContain('automática')
    expect(bodyHtml).toContain('não precisa fazer nada')
  })

  it('todos os dias deixam claro que a cobrança é automática no cartão', () => {
    for (const dias of [4, 3, 2, 1]) {
      const { bodyHtml } = corpoDoAviso({ ...args, diasRestantes: dias })
      expect(bodyHtml.toLowerCase(), `dia ${dias}`).toMatch(/autom[áa]tic|entra sozinha/)
    }
  })

  // A véspera é o único momento em que a pessoa ainda pode agir e precisa saber
  // o que está em jogo. Esconder a consequência para pressionar seria o oposto
  // da garantia de porta de saída que a landing publica.
  it('a véspera promete por escrito que nada é apagado', () => {
    const { bodyHtml } = corpoDoAviso({ ...args, diasRestantes: 1 })
    expect(bodyHtml).toContain('plano gratuito')
    expect(bodyHtml).toContain('nada é apagado')
  })

  it('só a véspera e o penúltimo falam da consequência', () => {
    // Falar em "volta para o gratuito" no primeiro aviso transformaria um
    // lembrete tranquilo em ameaça, e é o que faz a pessoa marcar como spam.
    expect(corpoDoAviso({ ...args, diasRestantes: 4 }).bodyHtml).not.toContain('gratuito')
    expect(corpoDoAviso({ ...args, diasRestantes: 3 }).bodyHtml).not.toContain('gratuito')
    expect(corpoDoAviso({ ...args, diasRestantes: 2 }).bodyHtml).toContain('gratuito')
    expect(corpoDoAviso({ ...args, diasRestantes: 1 }).bodyHtml).toContain('gratuito')
  })

  // Trava contra escassez inventada. Nenhum destes termos descreve algo
  // verdadeiro sobre uma renovação mensal automática.
  it('nenhum dia inventa urgência', () => {
    const proibidos = [
      'última chance',
      'ultima chance',
      'não perca',
      'nao perca',
      'agora ou nunca',
      'urgente',
      'atenção imediata',
      'imperdível',
      'expira já',
    ]
    for (const dias of [4, 3, 2, 1]) {
      const texto = corpoDoAviso({ ...args, diasRestantes: dias }).bodyHtml.toLowerCase()
      for (const termo of proibidos) {
        expect(texto, `dia ${dias} usou "${termo}"`).not.toContain(termo)
      }
    }
  })

  it('nenhum dia sugere que o dado some', () => {
    for (const dias of [4, 3, 2, 1]) {
      const texto = corpoDoAviso({ ...args, diasRestantes: dias }).bodyHtml.toLowerCase()
      expect(texto, `dia ${dias}`).not.toMatch(/ser[ãa]o? apagad|perder[áa] seus dados|exclu[íi]d/)
    }
  })

  // Dia maior que o teto cai no primeiro aviso, não num corpo vazio. O cron
  // pode chamar com 5 se a janela mudar, e e-mail sem corpo é pior que e-mail
  // repetido.
  it('dia acima do teto usa o texto do primeiro aviso', () => {
    const alto = corpoDoAviso({ ...args, diasRestantes: 9 })
    const quatro = corpoDoAviso({ ...args, diasRestantes: 4 })
    expect(alto.bodyHtml).toBe(quatro.bodyHtml)
  })

  it('dia zero ou negativo cai na véspera, nunca em corpo vazio', () => {
    for (const dias of [0, -3]) {
      const { bodyHtml } = corpoDoAviso({ ...args, diasRestantes: dias })
      expect(bodyHtml.length, `dia ${dias}`).toBeGreaterThan(100)
      expect(bodyHtml).toContain('nada é apagado')
    }
  })
})
