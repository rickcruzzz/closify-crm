import { describe, expect, it } from 'vitest'

import { validarCnpj } from './documento-br'
import {
  assinaturaPublica,
  CONTROLADOR,
  enderecoEmLinha,
  identificacaoDoControlador,
} from './legal'

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

  /**
   * ## O endereço virou objeto em 12/09, e a linha passou a ser derivada
   *
   * Os quatro consumidores anteriores — rodapé, Privacidade, Termos e o
   * prompt do SDR — continuam precisando de uma frase corrida. Se
   * `enderecoEmLinha` perder uma parte, nada quebra: a página renderiza, o
   * documento legal continua válido em aparência, e a sede passa a ser
   * identificada de forma incompleta num texto que existe justamente para
   * identificá-la.
   *
   * Por isso o caso confere que TODA parte preenchida aparece, em vez de
   * comparar com uma string escrita à mão — que seria a mesma frase digitada
   * duas vezes, e provaria apenas que eu sei copiar.
   */
  it('a linha derivada não perde nenhuma parte do endereço', () => {
    const endereco = CONTROLADOR.endereco
    expect(endereco).not.toBeNull()
    if (!endereco) return

    const linha = enderecoEmLinha(endereco)
    for (const parte of [
      endereco.logradouro,
      endereco.numero,
      endereco.complemento,
      endereco.bairro,
      endereco.cidade,
      endereco.uf,
      endereco.cep,
    ]) {
      if (parte) expect(linha).toContain(parte)
    }
  })

  /**
   * O nome do edifício é o único campo que NÃO entra na linha.
   *
   * Ele não vem da Receita: é como o lugar se identifica na fachada. Numa
   * cláusula de Termos ou num prompt, "CEO Salvador Shopping · Torre Londres"
   * é ruído entre o número e o bairro. Ele existe para a seção que mostra a
   * foto, onde é o que liga a imagem ao texto.
   *
   * Este caso existe porque a tentação de "completar" a linha é óbvia para
   * quem ler `enderecoEmLinha` sem o contexto.
   */
  it('o nome do edifício fica FORA da linha corrida', () => {
    const endereco = CONTROLADOR.endereco
    if (!endereco?.edificio) return
    expect(enderecoEmLinha(endereco)).not.toContain(endereco.edificio)
  })

  it('a UF é sigla de duas letras maiúsculas', () => {
    // `addressRegion` do schema.org espera a sigla. "Bahia" por extenso
    // passaria no TypeScript e o Google não casaria com o estado.
    const uf = CONTROLADOR.endereco?.uf
    if (uf) expect(uf).toMatch(/^[A-Z]{2}$/)
  })

  /**
   * O CNPJ publicado precisa ao menos ser um CNPJ.
   *
   * Reusa `validarCnpj`, a mesma função que valida o campo no cadastro de
   * empresa do produto — o cliente não consegue salvar um número inválido, e a
   * vitrine não deveria poder exibir um.
   *
   * Isto não prova que a inscrição está ATIVA; dígito verificador é aritmética,
   * não consulta. Situação cadastral só a Receita responde, e é o que a skill
   * `fatos-publicados` faz em duas fontes independentes.
   */
  it('o CNPJ publicado tem dígito verificador válido', () => {
    if (!CONTROLADOR.cnpj) return
    expect(validarCnpj(CONTROLADOR.cnpj)).toBe(true)
  })

  /**
   * A razão social do MEI era o CNPJ seguido do nome civil —
   * `64.543.748 ORLANDO HENRIQUE BASTOS DA CRUZ`. A LTDA tem razão social de
   * verdade.
   *
   * Voltar ao formato antigo significaria cópia de commit velho, e o teste
   * trava a FORMA (começar com dígito) em vez do valor: qualquer razão social
   * de pessoa jurídica passa, e só o padrão de MEI reprova.
   */
  it('a razão social não usa mais o formato de MEI', () => {
    expect(CONTROLADOR.razaoSocial).not.toMatch(/^\d/)
  })

  /**
   * Dois telefones, dois papéis, e trocá-los tem custo dos dois lados: quem
   * procura suporte cairia na contabilidade, e a verificação da Meta — que
   * compara o cadastral com o do CNPJ — deixaria de bater.
   */
  it('telefone cadastral e de suporte são campos distintos', () => {
    if (!CONTROLADOR.telefoneCadastral) return
    expect(CONTROLADOR.telefoneCadastral).not.toBe(CONTROLADOR.whatsapp.exibicao)
  })
})
