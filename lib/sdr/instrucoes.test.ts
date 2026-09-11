import { describe, expect, it } from 'vitest'

import { CONTROLADOR } from '@/lib/legal'
import {
  MARCA_DE_PASSAGEM,
  NOME_DO_AGENTE,
  assuntosProibidos,
  fatosDaEmpresa,
  fatosDoProduto,
  instrucoesDoAgente,
  limparResposta,
  pediuPassagem,
} from '@/lib/sdr/instrucoes'
import {
  FREE_LEAD_LIMIT,
  FREE_ORCAMENTO_LIMIT,
  PRO_ANUAL_PRICE,
  PRO_PLAN_PRICE,
  PRO_WORKSPACE_LIMIT,
} from '@/lib/plans'

describe('os fatos do produto vêm do código', () => {
  /**
   * A regra mais importante deste módulo. Um modelo que "lembra" o preço diria
   * R$ 49 para sempre — e ele mudou em 10/09. Interpolar na hora faz a troca da
   * constante atualizar o agente sem ninguém reescrever prompt.
   */
  it('o preço no prompt é o preço vigente', () => {
    const f = fatosDoProduto()
    expect(f).toContain(`R$ ${PRO_PLAN_PRICE} por mês`)
    expect(f).toContain(`R$ ${PRO_ANUAL_PRICE}`)
  })

  it('os limites do Free vêm das constantes', () => {
    const f = fatosDoProduto()
    expect(f).toContain(`${FREE_LEAD_LIMIT} contatos`)
    expect(f).toContain(`${FREE_ORCAMENTO_LIMIT} orçamentos`)
    expect(f).toContain(`${PRO_WORKSPACE_LIMIT} empresas`)
  })

  /**
   * O preço antigo não pode aparecer em lugar nenhum do prompt. Se aparecesse,
   * o modelo teria duas âncoras e escolheria uma — provavelmente a errada,
   * porque a antiga é a mais comum no texto do mundo.
   */
  it('o preço antigo não sobrou em canto nenhum', () => {
    expect(instrucoesDoAgente()).not.toMatch(/R\$ ?49\b/)
  })
})

describe('o que o produto NÃO faz está escrito', () => {
  /**
   * A pergunta mais provável de quem vende por WhatsApp é "integra com
   * WhatsApp?", e a resposta é não. Modelo preenche lacuna com o que é
   * plausível, e "CRM integra com WhatsApp" é plausível demais.
   *
   * Este projeto já pagou três vezes pela promessa que o produto não cumpre: a
   * landing com WhatsApp depois de a ponte sair, a arte com trial aposentado, a
   * bio com limite antigo.
   */
  it('nega WhatsApp integrado explicitamente', () => {
    const f = fatosDoProduto()
    expect(f).toMatch(/NÃO tem WhatsApp integrado/)
  })

  it('nega IA, nota fiscal, app e proposta 3D', () => {
    const f = fatosDoProduto()
    for (const ausente of ['inteligência artificial', 'nota fiscal', 'aplicativo de celular', 'proposta 3D']) {
      expect(f).toContain(ausente)
    }
  })

  /** A lista do que não faz é maior que a do que faz, e isso é o desenho. */
  it('a lista de ausências é a mais longa', () => {
    const f = fatosDoProduto()
    const naoFaz = (f.match(/^- NÃO /gm) ?? []).length
    expect(naoFaz).toBeGreaterThanOrEqual(6)
  })
})

describe('comportamento', () => {
  /**
   * A identificação continua obrigatória — o que mudou em 11/09 foi a FORMA:
   * "Aqui é o Gabriel, assistente do Velo Funil" no lugar do carimbo "Sou o
   * assistente do Velo Funil". O cargo não some, ele passa a vir junto de um
   * nome, que é como gente se apresenta no WhatsApp.
   */
  it('manda se identificar como assistente, com nome, na primeira resposta', () => {
    const i = instrucoesDoAgente()
    expect(i).toMatch(/assistente do Velo Funil/)
    expect(i).toContain(NOME_DO_AGENTE)
    expect(i).toMatch(/PRIMEIRA mensagem da conversa/)
  })

  /**
   * O pedido do dono, depois de ouvir os próprios áudios: a apresentação
   * entrava por cima de um "olá, tudo bem?" em toda mensagem.
   */
  it('manda responder o cumprimento ANTES de se apresentar', () => {
    const i = instrucoesDoAgente()
    expect(i).toMatch(/RESPONDA o cumprimento primeiro/)
    expect(i).toMatch(/Vale igual para áudio/)
  })

  it('proíbe fechar venda e negociar preço', () => {
    const i = instrucoesDoAgente()
    expect(i).toMatch(/Nunca prometa preço, desconto/)
    // Em 11/09 virou `PEDIDO de desconto` em caixa alta, para separar o pedido da PERGUNTA
    // sobre o desconto do anual — que é fato público e estava virando passagem em 6 de 6.
    expect(i).toMatch(/PEDIDO de desconto/i)
  })

  /**
   * Honestidade que fecha mais que insistência: para uma pessoa só, cobrar por
   * usuário é mais barato, e o agente deve dizer. É a mesma posição que a
   * página de comparação já assume por escrito.
   */
  it('manda admitir quando o concorrente é mais barato', () => {
    expect(fatosDoProduto()).toMatch(/Com uma pessoa só, cobrar por usuário costuma sair mais barato/)
  })

  it('leva a empresa e o setor quando existem', () => {
    const i = instrucoesDoAgente({ empresa: 'SolarOn', vertical: 'energia-solar' })
    expect(i).toContain('SolarOn')
    expect(i).toContain('energia-solar')
  })

  it('funciona sem contexto nenhum', () => {
    expect(() => instrucoesDoAgente()).not.toThrow()
    expect(instrucoesDoAgente().length).toBeGreaterThan(500)
  })
})

describe('a marca de passagem', () => {
  it('reconhece o pedido de passagem', () => {
    expect(pediuPassagem(`Vou chamar um atendente. ${MARCA_DE_PASSAGEM}`)).toBe(true)
    expect(pediuPassagem('Claro, o plano Pro custa isso.')).toBe(false)
  })

  /**
   * Sem esta limpeza, `[[PASSAR]]` chega no WhatsApp do cliente e ele lê o
   * mecanismo interno da conversa. É o tipo de vazamento que nenhum teste de
   * integração pega, porque a resposta continua "certa".
   */
  it('a marca nunca chega ao cliente', () => {
    const limpo = limparResposta(`Um atendente te responde já.\n${MARCA_DE_PASSAGEM}`)
    expect(limpo).not.toContain(MARCA_DE_PASSAGEM)
    expect(limpo).toBe('Um atendente te responde já.')
  })

  it('limpa a marca no meio do texto também', () => {
    expect(limparResposta(`antes ${MARCA_DE_PASSAGEM} depois`)).toBe('antes  depois')
  })

  it('texto sem marca passa intacto', () => {
    expect(limparResposta('  resposta normal  ')).toBe('resposta normal')
  })
})

describe('a pesquisa entra no prompt', () => {
  const bloco = 'O QUE ENCONTREI SOBRE A EMPRESA (use para responder com especificidade):\n- X: faz solar'

  it('aparece quando existe', () => {
    expect(instrucoesDoAgente({ pesquisa: bloco })).toContain('faz solar')
  })

  /**
   * Sem pesquisa o prompt não ganha nenhum buraco: o agente simplesmente não
   * cita o negócio da pessoa. Um bloco vazio dizendo "não encontrei" convidaria
   * o modelo a comentar a ausência, que é pior que o silêncio.
   */
  it('não deixa rastro quando não existe', () => {
    for (const vazio of [undefined, null, '', '   ']) {
      expect(instrucoesDoAgente({ pesquisa: vazio })).not.toContain('ENCONTREI SOBRE A EMPRESA')
    }
  })

  /**
   * A ordem é decisão: o que vem por último pesa mais na atenção do modelo, e
   * o que ele não pode errar é o PRODUTO — não a empresa do outro lado. Se a
   * pesquisa viesse antes dos fatos, um site que menciona "CRM com WhatsApp"
   * competiria com a linha que diz que o nosso não tem.
   */
  it('vem depois dos fatos do produto', () => {
    const i = instrucoesDoAgente({ pesquisa: bloco })
    expect(i.indexOf('NÃO tem WhatsApp integrado')).toBeLessThan(i.indexOf('faz solar'))
  })
})

describe('o agente nunca cita o nome do dono', () => {
  /**
   * Ele fala pela EMPRESA, não por uma pessoa. Citar o nome cria duas
   * expectativas erradas: que existe um time com aquela pessoa esperando, e
   * que quem responder depois é obrigatoriamente ela.
   *
   * E dá ao interlocutor um nome para cobrar — num produto de uma pessoa só,
   * "cadê o Fulano?" na terceira mensagem é pergunta sem boa resposta.
   */
  it('nenhum nome próprio nas instruções', () => {
    const i = instrucoesDoAgente({ empresa: 'SolarOn' })
    for (const nome of ['Orlando', 'Henrique', 'Bastos', 'Cruz']) {
      expect(i).not.toContain(nome)
    }
  })

  it('diz "um atendente" nos três lugares que pedem', () => {
    const i = instrucoesDoAgente()
    expect(i).toContain('um atendente entra quando precisar')
    expect(i).toContain('confirmar com um atendente')
    expect(i).toContain('um atendente responde em seguida')
  })
})

describe('o agente sabe quem é a empresa', () => {
  /**
   * Toda pergunta aqui é de quem está decidindo se confia. Antes destas
   * linhas o agente respondia "vou confirmar com um atendente" para coisas
   * que estão no rodapé do site — e transferir uma pergunta de confiança é o
   * pior momento para transferir.
   */
  it.each([
    ['onde ficam', /Salvador/i],
    ['CNPJ', /68\.877\.105/],
    ['é brasileira', /brasileiro|Brasil/i],
    ['dados seguros', /LGPD/i],
    ['onde ficam os dados', /São Paulo/i],
    ['suporte', /suporte@/i],
    ['cancelamento', /cancelar/i],
  ])('responde: %s', (_, re) => {
    expect(fatosDaEmpresa()).toMatch(re)
  })

  /**
   * Vem de `lib/legal.ts`, que é a fonte do rodapé e das páginas legais.
   * Escrever à mão criaria a quarta cópia do CNPJ — e este projeto já exibiu
   * um CNPJ BAIXADO por 17 dias porque a cópia não acompanhou a mudança.
   */
  it('deriva do controlador, não escreve à mão', () => {
    expect(fatosDaEmpresa()).toContain(CONTROLADOR.cnpj)
    expect(fatosDaEmpresa()).toContain(CONTROLADOR.razaoSocial)
  })
})

describe('o que ele nunca comenta', () => {
  /**
   * Um LLM é honesto demais. Perguntado "quantos clientes vocês têm?", ele
   * responde com o que sabe — e a resposta verdadeira hoje é zero cliente
   * externo pagante. Dita numa conversa de venda, encerra a conversa.
   *
   * A saída não é mentir: é o número não estar no contexto.
   */
  /**
   * A primeira versão deste caso proibia a PALAVRA "faturamento" — e reprovou,
   * porque ela aparece na linha que manda não falar de faturamento. Proibir o
   * vocabulário proíbe a própria instrução.
   *
   * O que não pode vazar é o NÚMERO. A asserção passou a procurar afirmações
   * de tamanho, não termos.
   */
  it('nenhum número de clientes ou receita vaza para o prompt', () => {
    const i = instrucoesDoAgente()
    for (const afirmacao of [
      /zero clientes?/i,
      /nenhum cliente/i,
      /ainda n[ãa]o (temos|tivemos)/i,
      /primeiro cliente/i,
      /R\$ ?0[,.]00/,
      /\d+ (clientes|empresas) (usam|pagam|ativos)/i,
    ]) {
      expect(i).not.toMatch(afirmacao)
    }
  })

  it('manda calar sobre tamanho, equipe e prospecção', () => {
    const p = assuntosProibidos()
    expect(p).toMatch(/Quantos clientes temos/i)
    expect(p).toMatch(/Quantas pessoas trabalham/i)
    expect(p).toMatch(/como encontramos o contato/i)
    expect(p).toMatch(/ferramenta usamos para prospectar/i)
  })

  /** Recusar é passar, nunca desconversar. */
  it('a saída do proibido é o handoff', () => {
    expect(assuntosProibidos()).toContain(MARCA_DE_PASSAGEM)
    expect(assuntosProibidos()).toMatch(/Não invente/i)
  })

  /**
   * A ordem é decisão: o que vem por último pesa mais, e a instrução que não
   * pode falhar é a de não falar.
   */
  it('os proibidos vêm depois dos fatos', () => {
    const i = instrucoesDoAgente()
    expect(i.indexOf('SOBRE A EMPRESA')).toBeLessThan(i.indexOf('NUNCA COMENTE'))
  })
})

describe('quem se apresenta, e quando', () => {
  /**
   * Medido em 11/09: sem esta informação o agente se apresentava em apenas
   * 1 de 4 primeiras mensagens quando a pessoa ia direto ao ponto. Ele não
   * tinha como saber — histórico vazio é ambíguo entre "primeira mensagem" e
   * "não temos o histórico", e os dois casos pedem o oposto.
   */
  it('manda se apresentar sem falta quando é a primeira', () => {
    expect(instrucoesDoAgente({ primeiraMensagem: true })).toMatch(/PRIMEIRA MENSAGEM desta conversa/)
  })

  it('manda NÃO se apresentar quando já conversaram', () => {
    const i = instrucoesDoAgente({ primeiraMensagem: false })
    expect(i).toMatch(/JÁ CONVERSARAM antes/)
    expect(i).not.toMatch(/PRIMEIRA MENSAGEM desta conversa/)
  })

  /** Sem a informação, o comportamento antigo: ele decide sozinho. */
  it('não afirma nem uma coisa nem outra quando não se sabe', () => {
    const i = instrucoesDoAgente()
    expect(i).not.toMatch(/PRIMEIRA MENSAGEM desta conversa/)
    expect(i).not.toMatch(/JÁ CONVERSARAM antes/)
  })
})
