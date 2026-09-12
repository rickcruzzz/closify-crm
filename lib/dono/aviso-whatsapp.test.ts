import { describe, expect, it } from 'vitest'

import { textoDoAviso } from './aviso-whatsapp'
import type { Alerta } from './vigia'

/**
 * O texto do aviso é testado sozinho porque ele é a parte que decide se o dono
 * larga o que está fazendo — e é a única parte que não depende de rede.
 *
 * O envio em si não tem teste: ele é um `fetch` para a Evolution, e um teste
 * que o mocasse provaria apenas que eu sei escrever um mock. O que vale é
 * exercitar contra a Evolution real, que é como o resto deste projeto prova
 * integração.
 */

const alerta = (titulo: string): Alerta =>
  ({ titulo, detalhe: '', href: null, gravidade: 'alta' }) as unknown as Alerta

describe('textoDoAviso', () => {
  it('o primeiro alerta aparece na PRIMEIRA linha de conteúdo', () => {
    // `montarAlertas` já ordena por gravidade, e dinheiro vem primeiro. O que
    // a pessoa lê antes de desbloquear a tela é a linha de cima — se ela
    // trouxer o alerta menos grave, o aviso perde o trabalho que a ordenação
    // fez.
    const t = textoDoAviso([alerta('Webhook do Asaas parado'), alerta('3 erros novos')], [], '12/09 05:00')
    const linhas = t.split('\n').filter(Boolean)
    expect(linhas[1]).toContain('Webhook do Asaas parado')
  })

  it('corta em CINCO e diz quantos ficaram de fora', () => {
    // Acima de ~5 itens o WhatsApp mostra "Ler mais", e o que fica escondido é
    // o fim da lista. Cortar em silêncio seria pior que cortar: a pessoa
    // leria 5 de 9 achando que viu tudo.
    const t = textoDoAviso(Array.from({ length: 9 }, (_, i) => alerta(`alerta ${i}`)), [], '12/09')
    expect(t).toContain('e mais 4')
    expect(t).not.toContain('alerta 5')
  })

  it('"não consegui conferir" NUNCA vira "está tudo certo"', () => {
    // A distinção que fez a Central declarar R$ 490 de receita com R$ 0 real
    // em 30/08: `null` significa NÃO SEI, e um vigia que não conseguiu ler o
    // Asaas e cala passa a mensagem de que conferiu e estava tudo bem.
    const t = textoDoAviso([], ['Asaas'], '12/09')
    expect(t).toContain('Não consegui conferir')
    expect(t).toContain('Asaas')
  })

  it('sem alerta e sem falha, o texto não afirma que está tudo bem', () => {
    // O vigia não chama isto quando não há nada — `deveEnviar` barra antes.
    // Mas se alguém mudar essa regra, o texto não pode inventar um "tudo
    // certo" que ninguém apurou.
    const t = textoDoAviso([], [], '12/09')
    expect(t.toLowerCase()).not.toMatch(/tudo (certo|ok|bem)|nenhum problema/)
  })
})
