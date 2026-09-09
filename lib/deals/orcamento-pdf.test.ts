import { describe, expect, it } from 'vitest'

import { dataBR, montarPdfDoOrcamento, type DadosDoOrcamento } from './orcamento-pdf'

const base: DadosDoOrcamento = {
  emissor: {
    nome: 'Dedetizadora Silva',
    cnpj: '68.877.105/0001-67',
    telefone: '(71) 99999-0000',
    email: 'contato@silva.com.br',
    site: 'silva.com.br',
    cidade: 'Salvador',
    estado: 'BA',
  },
  cliente: {
    nome: 'Restaurante Sabor',
    empresa: 'Sabor Ltda',
    telefone: '(71) 98888-0000',
    email: 'sabor@exemplo.com.br',
  },
  titulo: 'Dedetização de 3 dormitórios e garagem',
  valor: 1200,
  validade: '2026-09-20',
  descricao: '2 aplicações com 30 dias de intervalo. Garantia de 6 meses.',
  emitidoEm: new Date('2026-09-08T15:00:00Z'),
}

describe('dataBR', () => {
  it('reordena sem passar por Date, que trocaria o dia', () => {
    // `new Date('2026-09-20')` e MEIA-NOITE UTC, que em Sao Paulo e 21h do dia
    // 19 — o orcamento sairia impresso vencendo um dia antes do que o banco
    // guarda, e quem recebesse o PDF teria menos prazo do que foi dado.
    expect(dataBR('2026-09-20')).toBe('20/09/2026')
    expect(dataBR('2026-01-01')).toBe('01/01/2026')
  })
})

describe('montarPdfDoOrcamento', () => {
  it('devolve um PDF de verdade, e nao uma string vazia', () => {
    const bytes = montarPdfDoOrcamento(base)
    // `%PDF` e o numero magico. Sem esta checagem, um jsPDF que falhasse em
    // silencio devolveria bytes que o navegador baixaria como arquivo corrompido
    // — e o defeito so apareceria na mao do cliente do cliente.
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF')
    expect(bytes.length).toBeGreaterThan(1000)
  })

  it('roda em NODE: o gate do Pro depende disso', () => {
    // Se o jsPDF exigisse `window` ou `canvas`, a rota quebraria em producao e
    // o PDF teria que voltar para o navegador — onde o portao do Pro deixa de
    // ser portao. Este teste roda no ambiente `node` do vitest.
    expect(typeof globalThis.window).toBe('undefined')
    expect(montarPdfDoOrcamento(base).length).toBeGreaterThan(0)
  })

  it('aguenta descricao longa sem estourar', () => {
    // 2.000 caracteres e o teto do banco. `splitTextToSize` quebra por largura
    // real da fonte; sem ele o texto sairia pela borda e o jsPDF NAO reclama.
    const bytes = montarPdfDoOrcamento({ ...base, descricao: 'palavra '.repeat(250) })
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF')
  })

  it('aguenta emissor e cliente sem nenhum contato preenchido', () => {
    // O onboarding tem 18 campos e quase todos sao opcionais. Uma empresa que
    // pulou tudo precisa conseguir emitir orcamento — senao o recurso pago
    // falha justamente para quem acabou de assinar.
    const bytes = montarPdfDoOrcamento({
      ...base,
      emissor: { nome: 'Empresa', cnpj: null, telefone: null, email: null, site: null, cidade: null, estado: null },
      cliente: { nome: 'Cliente', empresa: null, telefone: null, email: null },
      descricao: null,
    })
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF')
  })
})
