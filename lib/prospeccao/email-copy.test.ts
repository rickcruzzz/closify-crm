import { describe, expect, it } from 'vitest'

import {
  assuntoPara,
  conferirConformidade,
  corpoDoEmail,
} from '@/lib/prospeccao/email-copy'
import { CONTROLADOR } from '@/lib/legal'
import { PRO_PLAN_PRICE } from '@/lib/plans'

const base = {
  dominio: 'marcenariasilva.com.br',
  nomeDaEmpresa: 'Marcenaria Silva',
  tokenDeSaida: 'abc123',
  urlDoProduto: 'https://velofunil.com.br',
}

describe('assunto', () => {
  /**
   * As três regras que a medição de 10/09 combina num formato só:
   * personalizado (46% contra 35%), pergunta (46%, o melhor tipo) e 2-4
   * palavras (46%, o topo por tamanho).
   */
  it('tem no máximo 4 palavras', () => {
    for (const d of ['a.com.br', 'b.com.br', 'c.com.br', 'd.com.br', 'e.com.br']) {
      expect(assuntoPara(d, 'Silva').split(/\s+/).length).toBeLessThanOrEqual(4)
    }
  })

  it('nomeia a empresa', () => {
    expect(assuntoPara('x.com.br', 'Marcenaria Silva')).toContain('Marcenaria Silva')
  })

  /**
   * "numero no assunto: 27% contra 28%" — piora. E o preço já está no corpo,
   * onde ele qualifica em vez de espantar.
   */
  it('não leva número', () => {
    for (const d of ['a.com.br', 'b.com.br', 'c.com.br', 'd.com.br']) {
      expect(assuntoPara(d, 'Silva')).not.toMatch(/\d/)
    }
  })

  /** Mesma empresa, mesmo texto — reenvio acidental não muda a redação. */
  it('é estável para o mesmo domínio', () => {
    expect(assuntoPara('x.com.br', 'Silva')).toBe(assuntoPara('x.com.br', 'Silva'))
  })

  it('varia entre domínios diferentes', () => {
    const vistos = new Set(
      ['a.com.br', 'b.com.br', 'c.com.br', 'd.com.br', 'e.com.br', 'f.com.br'].map((d) =>
        assuntoPara(d, 'Silva'),
      ),
    )
    expect(vistos.size).toBeGreaterThan(1)
  })
})

describe('corpo', () => {
  it('deriva o preço, nunca escreve à mão', () => {
    expect(corpoDoEmail(base)).toContain(`R$ ${PRO_PLAN_PRICE}`)
  })

  it('leva o token de saída no link', () => {
    expect(corpoDoEmail({ ...base, tokenDeSaida: 'tok/+1' })).toContain(
      `t=${encodeURIComponent('tok/+1')}`,
    )
  })

  it('não duplica a barra da URL', () => {
    expect(corpoDoEmail({ ...base, urlDoProduto: 'https://velofunil.com.br/' })).not.toContain(
      '.com.br//',
    )
  })

  /**
   * Texto puro: nenhuma tag. Filtro de spam moderno avalia o perfil inteiro do
   * remetente, e HTML de marketing saindo de domínio novo é a combinação que
   * ele foi treinado para achar.
   */
  it('é texto puro, sem HTML', () => {
    expect(corpoDoEmail(base)).not.toMatch(/<[a-z/]/i)
  })

  it('cabe no mesmo fôlego da mensagem de WhatsApp', () => {
    expect(corpoDoEmail(base).length).toBeLessThan(750)
  })
})

describe('conformidade com a LGPD', () => {
  /**
   * As três exigências do interesse legítimo (Art. 7º, IX) numa mensagem não
   * solicitada: quem fala, de onde veio o contato, e como sair. Faltando
   * qualquer uma, o e-mail sai, chega, e só vira problema quando alguém
   * reclama — que é tarde.
   */
  it('o corpo real passa', () => {
    expect(() => conferirConformidade(corpoDoEmail(base))).not.toThrow()
  })

  it('identifica o controlador pelo CNPJ, sem repetir a palavra', () => {
    const corpo = corpoDoEmail(base)
    expect(corpo).toContain(CONTROLADOR.cnpj)
    // O caso que faltava. `assinaturaPublica` ja escreve "CNPJ", e o separador
    // ' — CNPJ ' produzia "Velo Funil — CNPJ CNPJ 68.877.105/0001-67". Conferir
    // so o numero aprovava a linha duplicada.
    expect(corpo).not.toMatch(/CNPJ\s+CNPJ/)
    expect(corpo).toContain(`Velo Funil, CNPJ ${CONTROLADOR.cnpj}`)
  })

  it('recusa corpo sem CNPJ', () => {
    expect(() => conferirConformidade('oi\nnao-quero\nAchei seu contato no site')).toThrow(/CNPJ/)
  })

  it('recusa corpo sem link de saída', () => {
    const semSaida = corpoDoEmail(base).replace(/nao-quero/g, 'x')
    expect(() => conferirConformidade(semSaida)).toThrow(/saída/)
  })

  it('recusa corpo que não diz de onde veio o contato', () => {
    const semOrigem = corpoDoEmail(base).replace('Achei seu contato no site da empresa.', '')
    expect(() => conferirConformidade(semOrigem)).toThrow(/de onde veio/)
  })
})
