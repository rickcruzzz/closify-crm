import { describe, expect, it } from 'vitest'
import { FREE_LEAD_LIMIT, FREE_ORCAMENTO_LIMIT } from '@/lib/plans'

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
  // expira" é sobre o nosso processo; "o orçamento com lembrete trava em 3" é
  // sobre o dia da pessoa.
  //
  // Citava WhatsApp até 11/09, e a perda tinha que mudar junto com a verdade:
  // ele não funciona para ninguém desde 28/08.
  it('do penúltimo dia em diante diz o que para de funcionar', () => {
    for (const dias of [2, 1]) {
      const { bodyHtml } = corpoDoTrial({ ...args, diasRestantes: dias })
      expect(bodyHtml, `dia ${dias}`).toContain(String(FREE_ORCAMENTO_LIMIT))
      expect(bodyHtml, `dia ${dias}`).toContain(String(FREE_LEAD_LIMIT))
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
  /**
   * Relógio FIXO, e o `agora` passado por parâmetro.
   *
   * A primeira versão deste bloco usava `new Date()` com `setHours(12)`, e
   * passou aqui às 23h de São Paulo enquanto reprovava no CI, que roda em UTC:
   * meio-dia local vira 15h UTC, a diferença dá 1,5 dia e `Math.ceil` devolve
   * 2 — caindo no texto plural em vez do texto de véspera.
   *
   * Teste que depende da hora em que roda não é teste, é sorteio.
   */
  const AGORA = new Date('2026-08-25T15:00:00Z')
  const VESPERA = new Date(AGORA.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const doEmail = corpoDoTrial({
    nomeEscapado: 'Acme',
    valorFormatado: 'R$ 49,00',
    diasRestantes: 1,
  }).bodyHtml

  /**
   * O caso mudou de conteúdo em 11/09, e o motivo vale mais que a asserção.
   *
   * Ele travava a presença de "WhatsApp" nos dois textos. E o WhatsApp **não
   * funciona para ninguém** desde 28/08: `FASE_DO_WHATSAPP` é 'migrando', e
   * `escolherRemetente` devolve sempre `emMigracao`, com teto de 0 mensagens
   * por hora. Os dois textos anunciavam como perda do fim do trial uma coisa
   * que já não existia — a tarja em toda tela logada, com botão de assinar ao
   * lado, e o e-mail junto de um pedido de pagamento.
   *
   * O teste continua fazendo o mesmo trabalho: garante que tarja e e-mail
   * contam a MESMA história. Só mudou qual história é verdadeira.
   *
   * Os números saem das constantes de propósito: escritos à mão, o teste
   * passaria a exigir um teto que o produto não aplica mais.
   */
  it('os dois citam o teto de orçamento e o de contatos', () => {
    const daTela = textoDoAviso(estadoDoTrial(VESPERA, false, AGORA))
    expect(daTela).not.toBeNull()

    for (const fato of [String(FREE_ORCAMENTO_LIMIT), String(FREE_LEAD_LIMIT)]) {
      expect(daTela!.detalhe, `tarja, ${fato}`).toContain(fato)
      expect(doEmail, `e-mail, ${fato}`).toContain(fato)
    }
  })

  /** E o que saiu não pode voltar: WhatsApp fora dos dois, enquanto migra. */
  it('nenhum dos dois promete WhatsApp', () => {
    const daTela = textoDoAviso(estadoDoTrial(VESPERA, false, AGORA))
    expect(daTela!.detalhe.toLowerCase()).not.toContain('whatsapp')
    expect(doEmail.toLowerCase()).not.toContain('whatsapp')
  })

  /**
   * Os dois prometem que o dado fica, e é isso que precisa bater — não a
   * redação. A tarja diz "Nada é apagado" na véspera e "O que você já
   * cadastrou continua aqui" nos outros dias; as duas cumprem a garantia de
   * porta de saída que a landing publica, e travar a frase exata quebraria o
   * teste em toda melhoria de texto.
   */
  it('os dois prometem que o dado continua com o cliente', () => {
    const daTela = textoDoAviso(estadoDoTrial(VESPERA, false, AGORA))
    expect(daTela!.detalhe.toLowerCase()).toMatch(/nada é apagado|continua aqui/)
    expect(doEmail.toLowerCase()).toMatch(/nada é apagado|continua aqui/)
  })

  it('a véspera da tarja tem texto próprio, no singular', () => {
    const daTela = textoDoAviso(estadoDoTrial(VESPERA, false, AGORA))
    expect(daTela!.titulo).toBe('Último dia do seu teste')
    expect(daTela!.detalhe).toContain('Nada é apagado')
  })
})
