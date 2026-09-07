import { describe, expect, it } from 'vitest'

import { montarAbordagem, nomeCurto, TETO } from './abordagem'

const base = {
  dominio: 'quatrocor.com.br',
  nome: 'Gráfica Quatrocor',
  vertical: 'comunicacao-visual',
  motivos: ['WhatsApp direto', 'pede orçamento no site'],
  precoMensal: 49,
  limiteGratis: 50,
}

describe('montarAbordagem', () => {
  it('a linha de DESCARTE nunca e cortada, em nenhum nicho', () => {
    // O defeito que este teste tranca: a primeira versao cortava a mensagem
    // inteira no fim, e contra 90 prospects reais a saida terminava em
    // "Se nao fizer sentido, me avisa que…" — comendo exatamente a linha que
    // transforma "nao tenho interesse" em resposta em vez de denuncia de spam.
    // O teste antigo passava porque conferia TAMANHO, nao o que sobrou.
    for (const vertical of ['dedetizacao', 'comunicacao-visual', 'marcenaria', 'nicho-novo']) {
      for (const motivos of [['tem equipe de vendas'], ['WhatsApp direto']]) {
        const m = montarAbordagem({ ...base, vertical, motivos })
        expect(m.endsWith('me avisa que não te procuro de novo.')).toBe(true)
        expect(m).not.toContain('…')
      }
    }
  })

  it('quando nao cabe, sai o OPCIONAL e nao o fim', () => {
    const comEquipe = montarAbordagem({
      ...base, vertical: 'marcenaria', motivos: ['tem equipe de vendas'],
    })
    // O gancho de marcenaria e o mais longo: a linha da equipe e sacrificada.
    expect(comEquipe).toMatch(/n[ãa]o te procuro de novo\.$/)
    expect(comEquipe.length).toBeLessThanOrEqual(TETO)
  })

  it('cabe na tela do WhatsApp', () => {
    // Acima de ~520 caracteres o WhatsApp mostra "Ler mais" e a mensagem morre
    // ali, sem leitura.
    for (const vertical of ['dedetizacao', 'marcenaria', 'locacao-equipamentos', 'nicho-novo']) {
      const m = montarAbordagem({ ...base, vertical, motivos: ['tem equipe de vendas'] })
      expect(m.length).toBeLessThanOrEqual(TETO)
    }
  })

  it('diz de ONDE veio o contato', () => {
    // Exigencia pratica da LGPD para interesse legitimo, e antes disso o que
    // separa abordagem de spam.
    expect(montarAbordagem(base)).toMatch(/Achei a .+ procurando/)
  })

  it('oferece a saida na PRIMEIRA mensagem', () => {
    // Uma linha de descarte custa nada e e a diferenca entre "nao tenho
    // interesse" e uma denuncia de spam — que no WhatsApp derruba o numero.
    expect(montarAbordagem(base)).toMatch(/n[ãa]o te procuro de novo/)
  })

  it('NUNCA afirma dor que ninguem mediu', () => {
    // Nos lemos o site, nao a carteira. "Vi que voce esta perdendo vendas" e
    // invencao — vira pergunta, que e honesta e obriga resposta.
    const m = montarAbordagem(base)
    expect(m).not.toMatch(/vi que (voc[êe]|a empresa)|percebi que|notei que|voc[êe] est[áa] perdendo/i)
    expect(m).toMatch(/\?/)
  })

  it('so cita equipe quando o SITE disse que ela existe', () => {
    const com = montarAbordagem({ ...base, motivos: ['tem equipe de vendas'] })
    const sem = montarAbordagem({ ...base, motivos: ['WhatsApp direto'] })
    expect(com).toMatch(/mais de um no atendimento/)
    expect(sem).not.toMatch(/mais de um no atendimento/)
  })

  it('preco e limite vem de fora, nunca escritos a mao', () => {
    // Se `lib/plans.ts` mudar e a mensagem nao, a abordagem passa a prometer um
    // preco que o checkout nao cobra.
    const m = montarAbordagem({ ...base, precoMensal: 59, limiteGratis: 30 })
    expect(m).toContain('R$ 59')
    expect(m).toContain('30 contatos')
    expect(m).not.toContain('R$ 49')
  })

  it('leva o argumento que a dor publica revelou: contrato, nao preco', () => {
    // Medido em 06/09 no Reclame Aqui: a objecao numero um contra RD Station e
    // Agendor e "nao consigo cancelar", nao "e caro".
    const m = montarAbordagem(base)
    expect(m).toMatch(/sem fidelidade/i)
    expect(m).toMatch(/CSV/)
  })

  it('NAO inventa prova social', () => {
    // Decisao travada do projeto: este produto nao tem cliente externo.
    const m = montarAbordagem(base)
    expect(m).not.toMatch(/\+?\d+ (empresas|clientes) (j[áa] )?us|mais de \d+ (empresas|clientes)|l[íi]der/i)
  })

  it('o gancho muda por nicho, e cai num padrao seguro no nicho desconhecido', () => {
    expect(montarAbordagem({ ...base, vertical: 'marcenaria' })).toMatch(/planejados/)
    expect(montarAbordagem({ ...base, vertical: 'inexistente' })).toMatch(/or[çc]amento/)
  })
})

describe('nomeCurto', () => {
  it('corta a cauda de SEO do titulo', () => {
    // Chamar a empresa pelo titulo inteiro denuncia que a mensagem foi montada
    // por maquina.
    expect(nomeCurto('Gráfica Quatrocor | Impressão em São Paulo', 'x.com.br')).toBe('Gráfica Quatrocor')
    expect(nomeCurto('Marcenaria Alfa - Móveis sob medida', 'x.com.br')).toBe('Marcenaria Alfa')
  })

  it('cai no dominio quando o titulo nao serve', () => {
    expect(nomeCurto(null, 'quatrocor.com.br')).toBe('quatrocor.com.br')
    expect(nomeCurto('', 'quatrocor.com.br')).toBe('quatrocor.com.br')
    expect(nomeCurto('A', 'quatrocor.com.br')).toBe('quatrocor.com.br')
    expect(nomeCurto('Um título longo demais para ser o nome de uma empresa de verdade', 'q.com.br')).toBe(
      'q.com.br',
    )
  })
})
