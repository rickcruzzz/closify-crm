import { describe, expect, it } from 'vitest'

import { corpoDoTrial, renderTrialTerminandoEmail } from './trial-terminando'
import { CONTROLADOR } from '@/lib/legal'
import { textoDoAviso, estadoDoTrial } from '@/lib/plans/trial'

const base = {
  workspaceName: 'Acme Serviços',
  valor: 49,
  diasRestantes: 3,
  appUrl: 'https://www.velofunil.com.br',
}

describe('renderTrialTerminandoEmail', () => {
  it('escapa o nome do workspace', () => {
    const { html } = renderTrialTerminandoEmail({
      ...base,
      workspaceName: '<img src=x onerror=alert(1)>',
    })
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img src=x')
  })

  it('não escapa o assunto', () => {
    const { subject } = renderTrialTerminandoEmail({ ...base, workspaceName: 'Silva & Cia' })
    expect(subject).not.toContain('&amp;')
  })

  it('mostra o valor em reais', () => {
    expect(renderTrialTerminandoEmail(base).html).toContain('49,00')
  })

  it('diz "último dia" na véspera, não "em 1 dia"', () => {
    const { subject, html } = renderTrialTerminandoEmail({ ...base, diasRestantes: 1 })
    expect(subject).toBe('Último dia do seu teste, Velo Funil')
    expect(html).not.toContain('em 1 dias')
  })

  // `?assinar=1` e NÃO `?pagar=1`: quem está em trial ainda não tem assinatura,
  // então o caminho é o SubscribeButton (que pede CPF/CNPJ e cria a cobrança),
  // não o PagarDialog de quem já tem uma. Mandar para `pagar=1` abriria um
  // diálogo sem nada para pagar.
  it('leva ao fluxo de assinar, não ao de pagar fatura', () => {
    const { html } = renderTrialTerminandoEmail(base)
    const assinar = html.split('/settings/billing?assinar=1').length - 1
    expect(assinar).toBe(2)
    expect(html).not.toContain('?pagar=1')
  })

  it('traz os dados do controlador no rodapé', () => {
    expect(renderTrialTerminandoEmail(base).html).toContain(CONTROLADOR.nomeFantasia)
  })
})

describe('corpoDoTrial, a escada de quatro dias', () => {
  const args = { nomeEscapado: 'Acme', valorFormatado: 'R$ 49,00' }

  it('os quatro dias dizem coisas diferentes', () => {
    const corpos = [4, 3, 2, 1].map((d) => corpoDoTrial({ ...args, diasRestantes: d }).bodyHtml)
    expect(new Set(corpos).size).toBe(4)
  })

  // A régua de `textoDoAviso`: é a PERDA que decide, não a data. "Seu teste
  // expira" é sobre o nosso processo; "o WhatsApp para de trazer as mensagens"
  // é sobre o dia da pessoa.
  it('do penúltimo dia em diante diz o que para de funcionar', () => {
    for (const dias of [2, 1]) {
      const { bodyHtml } = corpoDoTrial({ ...args, diasRestantes: dias })
      expect(bodyHtml, `dia ${dias}`).toContain('WhatsApp')
      expect(bodyHtml, `dia ${dias}`).toContain('50')
    }
  })

  it('a véspera promete por escrito que nada é apagado', () => {
    const { bodyHtml } = corpoDoTrial({ ...args, diasRestantes: 1 })
    expect(bodyHtml).toContain('plano gratuito')
    expect(bodyHtml).toContain('nada é apagado')
  })

  // O preço por EMPRESA é a única vantagem estrutural contra Kommo, Agendor,
  // RD Station e todo o resto, que cobram por pessoa. Some dele e o e-mail
  // vira mais um lembrete de cobrança.
  it('todo dia repete que o preço é pela empresa, não por pessoa', () => {
    for (const dias of [4, 3, 2, 1]) {
      const { bodyHtml } = corpoDoTrial({ ...args, diasRestantes: dias })
      expect(bodyHtml.toLowerCase(), `dia ${dias}`).toContain('empresa')
    }
  })

  it('nenhum dia inventa urgência', () => {
    const proibidos = ['última chance', 'ultima chance', 'não perca', 'agora ou nunca', 'urgente']
    for (const dias of [4, 3, 2, 1]) {
      const texto = corpoDoTrial({ ...args, diasRestantes: dias }).bodyHtml.toLowerCase()
      for (const termo of proibidos) {
        expect(texto, `dia ${dias} usou "${termo}"`).not.toContain(termo)
      }
    }
  })

  it('nenhum dia promete desconto que não existe', () => {
    for (const dias of [4, 3, 2, 1]) {
      const texto = corpoDoTrial({ ...args, diasRestantes: dias }).bodyHtml.toLowerCase()
      expect(texto, `dia ${dias}`).not.toMatch(/desconto|cupom|oferta especial|só hoje/)
    }
  })

  it('dia acima do teto e dia zero não geram corpo vazio', () => {
    for (const dias of [9, 0, -2]) {
      const { bodyHtml } = corpoDoTrial({ ...args, diasRestantes: dias })
      expect(bodyHtml.length, `dia ${dias}`).toBeGreaterThan(100)
    }
  })
})

/**
 * O e-mail e a tarja dentro do produto falam da MESMA coisa para a MESMA
 * pessoa, e podem chegar no mesmo dia. Se disserem coisas diferentes sobre o
 * que para de funcionar, quem está decidindo pagar perde a confiança nos dois.
 *
 * É a classe 7 do diagnóstico de 25/08: mesma regra escrita em dois lugares.
 * Aqui não dá para unificar o texto (um é HTML de e-mail, outro é React), então
 * o teste trava que os fatos batem.
 */
describe('e-mail e tarja do produto contam a mesma história', () => {
  it('os dois citam WhatsApp e o teto de 50 contatos', () => {
    const daTela = textoDoAviso(estadoDoTrial(daquiADias(1), false))
    expect(daTela).not.toBeNull()

    const doEmail = corpoDoTrial({
      nomeEscapado: 'Acme',
      valorFormatado: 'R$ 49,00',
      diasRestantes: 1,
    }).bodyHtml

    for (const fato of ['WhatsApp', '50']) {
      expect(daTela!.detalhe, `tarja, ${fato}`).toContain(fato)
      expect(doEmail, `e-mail, ${fato}`).toContain(fato)
    }
  })

  it('os dois prometem que nada é apagado', () => {
    const daTela = textoDoAviso(estadoDoTrial(daquiADias(1), false))
    expect(daTela!.detalhe).toContain('Nada é apagado')

    const doEmail = corpoDoTrial({
      nomeEscapado: 'Acme',
      valorFormatado: 'R$ 49,00',
      diasRestantes: 1,
    }).bodyHtml
    expect(doEmail).toContain('nada é apagado')
  })
})

function daquiADias(dias: number): string {
  // Meio-dia para a fração de hora não empurrar `Math.ceil` para o dia seguinte.
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return new Date(d.getTime() + dias * 24 * 60 * 60 * 1000).toISOString()
}
