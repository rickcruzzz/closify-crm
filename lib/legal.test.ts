import { describe, expect, it } from 'vitest'

import { assinaturaPublica, CONTROLADOR, identificacaoDoControlador } from './legal'

/**
 * O defeito que motivou estes testes, achado em 25/08.
 *
 * O CNPJ `64.543.748/0001-13` estava cravado em `lib/legal.ts` e aparecia em
 * seis lugares, incluindo a seção "O que a gente garante por escrito" da
 * landing. Consultado na Receita naquele dia, ele estava **BAIXADO** desde
 * 08/08 — extinção por encerramento a pedido do titular.
 *
 * Ou seja: a página convidava a conferir e a consulta desmentia a página. Foi
 * também o motivo de a verificação de negócio da Meta reprovar, porque ela
 * bate o número contra a Receita.
 *
 * Baixa de MEI é irreversível, então o número novo será outro. Estes testes
 * travam os DOIS estados: sem inscrição, nada de `CNPJ null` nem de número
 * morto na tela; com inscrição, ela volta a aparecer sem ninguém precisar
 * lembrar de reeditar cada componente.
 */

const COM_CNPJ = {
  nomeFantasia: 'Velo Funil',
  razaoSocial: '11.222.333 FULANO DE TAL',
  cnpj: '11.222.333/0001-81',
}

const SEM_CNPJ = { ...COM_CNPJ, cnpj: null }

describe('identificacaoDoControlador', () => {
  it('cita a inscrição quando ela existe', () => {
    expect(identificacaoDoControlador(COM_CNPJ)).toBe(
      '11.222.333 FULANO DE TAL, CNPJ 11.222.333/0001-81',
    )
  })

  it('sem inscrição, o responsável continua identificado', () => {
    // O art. 9º, I da LGPD pede identificação clara de quem responde pelo
    // dado. Some a inscrição, não o responsável — devolver string vazia aqui
    // deixaria a Política de Privacidade sem controlador nomeado, que é pior
    // do que a ausência do número.
    expect(identificacaoDoControlador(SEM_CNPJ)).toBe('11.222.333 FULANO DE TAL')
  })

  it('nunca escreve a palavra CNPJ sem um número ao lado', () => {
    // O defeito literal que isto impede: `CNPJ {CONTROLADOR.cnpj}` com o campo
    // nulo renderiza "CNPJ" seguido de nada — ou "CNPJ null", dependendo de
    // como o React trata o valor.
    expect(identificacaoDoControlador(SEM_CNPJ)).not.toContain('CNPJ')
  })
})

describe('assinaturaPublica', () => {
  it('usa o nome fantasia, não o nome civil do titular', () => {
    // Decisão de 24/08: nome civil sai de tudo que é reforço de marca. Ele
    // continua nas páginas legais e nos avisos de fatura, por necessidade.
    const texto = assinaturaPublica(COM_CNPJ)
    expect(texto).toContain('Velo Funil')
    expect(texto).not.toContain('FULANO')
  })

  it('sem inscrição, sobra só o nome', () => {
    expect(assinaturaPublica(SEM_CNPJ)).toBe('Velo Funil')
    expect(assinaturaPublica(SEM_CNPJ)).not.toContain('CNPJ')
  })

  it('o separador acompanha o lugar onde a assinatura é lida', () => {
    // Rodapé usa `·`; a seção de confiança lê como frase e precisa de vírgula.
    expect(assinaturaPublica(COM_CNPJ)).toBe('Velo Funil · CNPJ 11.222.333/0001-81')
    expect(assinaturaPublica(COM_CNPJ, ', ')).toBe(
      'Velo Funil, CNPJ 11.222.333/0001-81',
    )
  })

  it('sem inscrição o separador não vaza para a tela', () => {
    // Sem esta trava, o rodapé sairia como "© 2026 Velo Funil ·" com um ponto
    // solto no fim.
    expect(assinaturaPublica(SEM_CNPJ)).not.toContain('·')
    expect(assinaturaPublica(SEM_CNPJ, ', ')).not.toContain(',')
  })
})

describe('CONTROLADOR', () => {
  it('não guarda o CNPJ baixado', () => {
    // Trava específica contra o número morto voltar por cópia de commit velho
    // ou por alguém "restaurando" o que parecia ter sumido sem querer.
    expect(CONTROLADOR.cnpj).not.toBe('64.543.748/0001-13')
  })

  it('endereço e CNPJ andam juntos', () => {
    // Endereço sem inscrição não identifica ninguém, e a verificação da Meta
    // compara os dois. Publicar endereço sozinho exporia a casa do titular sem
    // entregar nada em troca.
    expect(Boolean(CONTROLADOR.endereco)).toBe(Boolean(CONTROLADOR.cnpj))
  })
})
