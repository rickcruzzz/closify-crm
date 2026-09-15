import { describe, expect, it } from 'vitest'

import {
  contarPorEstado,
  lerCsvDoUniverso,
  mensagemPara,
  mesclar,
  motivosQueExplicam,
  ordenar,
  type EstadoNaPrateleira,
  type LeadJaGravado,
  type Prospect,
} from './prateleira'

const CABECALHO = 'dominio;titulo;vertical;pontos;whatsapp;telefone;email;motivos'

function csv(...linhas: string[]): string {
  return '﻿' + [CABECALHO, ...linhas].join('\n') + '\n'
}

function lead(over: Partial<LeadJaGravado> = {}): LeadJaGravado {
  return {
    id: 'l1',
    dominio: 'orkinsp.com.br',
    nome: 'Orkin São Paulo',
    telefone: '11 99435-1036',
    email: 'contato@orkinsp.com.br',
    ...over,
  }
}

describe('lerCsvDoUniverso', () => {
  it('le a linha inteira, com o separador `;` do Excel brasileiro', () => {
    const [p] = lerCsvDoUniverso(
      csv('orkinsp.com.br;Orkin São Paulo;dedetizacao;20;5511994351036;11 99435-1036;a@b.com;WhatsApp direto | tem equipe'),
    )
    expect(p.dominio).toBe('orkinsp.com.br')
    expect(p.nome).toBe('Orkin São Paulo')
    expect(p.vertical).toBe('dedetizacao')
    expect(p.pontos).toBe(20)
    expect(p.whatsapp).toBe('5511994351036')
    expect(p.motivos).toEqual(['WhatsApp direto', 'tem equipe'])
  })

  it('come o BOM, senao o PRIMEIRO dominio do arquivo fica invisivel', () => {
    // O script escreve `﻿` na primeira gravação (mesma decisão de
    // `exportar-csv.ts`: sem ele "José" vira "JosÃ©" no Excel). Se o BOM
    // sobrevivesse à leitura ele grudaria no cabeçalho, não no primeiro dado —
    // mas o teste trava o caso em que o arquivo tenha sido cortado à mão.
    const semCabecalho = '﻿a.com.br;A;dedetizacao;5;;;;\nb.com.br;B;dedetizacao;4;;;;'
    const [p] = lerCsvDoUniverso(semCabecalho)
    expect(p.dominio).toBe('b.com.br')
  })

  it('ignora linha truncada em vez de derrubar a pagina', () => {
    // O arquivo é acrescentado a cada rodada e pode ter sido editado à mão.
    // Perder uma linha é recuperável; uma tela que não abre esconde as outras.
    const lista = lerCsvDoUniverso(csv('quebrada;sem;as;outras', 'ok.com.br;OK;dedetizacao;7;;;;'))
    expect(lista).toHaveLength(1)
    expect(lista[0].dominio).toBe('ok.com.br')
  })

  it('pontos ilegiveis viram 0, e nao NaN', () => {
    // `Number('')` é 0 e `Number('abc')` é NaN. NaN em `sort` produz ordem
    // indefinida — a empresa não some, ela aparece em lugar aleatório, que é
    // pior porque não parece defeito.
    const [p] = lerCsvDoUniverso(csv('x.com.br;X;dedetizacao;abc;;;;'))
    expect(p.pontos).toBe(0)
    expect(Number.isNaN(p.pontos)).toBe(false)
  })

  it('normaliza o dominio para minusculo: a dedupe casa por igualdade', () => {
    const lista = lerCsvDoUniverso(csv('SITE.COM.BR;S;marcenaria;3;;;;'))
    expect(lista[0].dominio).toBe('site.com.br')
  })
})

describe('mesclar', () => {
  it('dedupe por dominio mantendo o MAIOR pontos, nunca a soma', () => {
    // Medido em 07/09: o CSV tem 959 linhas para 790 domínios. `--universo`
    // grava por praça e por variante de consulta sem deduplicar, então a mesma
    // empresa aparece até quatro vezes. Somar transformaria repetição em
    // evidência — o erro que o corpus de vocabulário já pagou.
    const lista = mesclar(
      lerCsvDoUniverso(
        csv('a.com.br;A;dedetizacao;7;;;;', 'a.com.br;A;dedetizacao;13;;;;', 'a.com.br;A;dedetizacao;9;;;;'),
      ),
      [],
      {},
    )
    expect(lista).toHaveLength(1)
    expect(lista[0].pontos).toBe(13)
  })

  it('lead que NAO esta em CSV nenhum entra assim mesmo', () => {
    // São os 92 das rodadas de 06/09, antes de `--universo` existir. Ler só o
    // CSV os perderia, apesar de já terem sido pagos.
    const lista = mesclar([], [lead({ dominio: 'tecprag.com.br', id: 'l9' })], {})
    expect(lista).toHaveLength(1)
    expect(lista[0].dominio).toBe('tecprag.com.br')
    expect(lista[0].leadId).toBe('l9')
  })

  it('marca leadId quando o dominio ja virou contato no CRM', () => {
    const lista = mesclar(
      lerCsvDoUniverso(csv('orkinsp.com.br;Orkin;dedetizacao;20;5511994351036;;;')),
      [lead()],
      {},
    )
    expect(lista[0].leadId).toBe('l1')
    // O WhatsApp do CSV vence: ele já veio normalizado pelo script.
    expect(lista[0].whatsapp).toBe('5511994351036')
  })

  it('completa o contato que faltava no CSV a partir do lead', () => {
    const lista = mesclar(
      lerCsvDoUniverso(csv('orkinsp.com.br;Orkin;dedetizacao;20;;;;')),
      [lead()],
      {},
    )
    expect(lista[0].telefone).toBe('11 99435-1036')
    expect(lista[0].email).toBe('contato@orkinsp.com.br')
  })

  it('casa o lead mesmo com company em caixa alta ou com espaco', () => {
    // `company` é escrito pelo script, mas também pode vir de importação de
    // planilha, onde ninguém garante o formato.
    const lista = mesclar(
      lerCsvDoUniverso(csv('orkinsp.com.br;Orkin;dedetizacao;20;;;;')),
      [lead({ dominio: '  ORKINSP.COM.BR ' })],
      {},
    )
    expect(lista).toHaveLength(1)
    expect(lista[0].leadId).toBe('l1')
  })

  it('aplica o estado guardado, e o padrao e `novo`', () => {
    const estados: Record<string, EstadoNaPrateleira> = { 'a.com.br': 'enviado' }
    const lista = mesclar(lerCsvDoUniverso(csv('a.com.br;A;x;5;;;;', 'b.com.br;B;x;4;;;;')), [], estados)
    expect(lista.find((p) => p.dominio === 'a.com.br')?.estado).toBe('enviado')
    expect(lista.find((p) => p.dominio === 'b.com.br')?.estado).toBe('novo')
  })
})

describe('ordenar', () => {
  it('pontos primeiro, e quem tem como ser alcancado desempata', () => {
    const base: Prospect = {
      dominio: 'x',
      nome: null,
      vertical: 'x',
      pontos: 5,
      motivos: [],
      whatsapp: null,
      telefone: null,
      email: null,
      leadId: null,
      estado: 'novo',
    }
    const lista = ordenar([
      { ...base, dominio: 'sem-contato.com.br', pontos: 5 },
      { ...base, dominio: 'com-zap.com.br', pontos: 5, whatsapp: '5511999999999' },
      { ...base, dominio: 'melhor.com.br', pontos: 9 },
    ])
    expect(lista.map((p) => p.dominio)).toEqual([
      'melhor.com.br',
      'com-zap.com.br',
      'sem-contato.com.br',
    ])
  })
})

describe('contarPorEstado', () => {
  it('conta as quatro prateleiras, inclusive as vazias', () => {
    // Aba sem número é aba que parece quebrada; zero explícito é informação.
    const lista = mesclar(
      lerCsvDoUniverso(csv('a.com.br;A;x;5;;;;', 'b.com.br;B;x;4;;;;')),
      [],
      { 'a.com.br': 'enviado' },
    )
    expect(contarPorEstado(lista)).toEqual({ novo: 1, enviado: 1, confirmado: 0, descartado: 0 })
  })
})

describe('mensagemPara', () => {
  function prospect(over: Partial<Prospect> = {}): Prospect {
    return {
      dominio: 'orkinsp.com.br',
      nome: 'Orkin São Paulo',
      vertical: 'dedetizacao',
      pontos: 20,
      motivos: ['tem equipe de vendas'],
      whatsapp: '5511994351036',
      telefone: null,
      email: null,
      leadId: null,
      estado: 'novo',
      ...over,
    }
  }

  it('o texto do link e IDENTICO ao da tela, sem truncar', () => {
    // A nota gravada pelo script mostra o texto e o link lado a lado. Se os
    // dois divergissem, a pessoa leria uma coisa e o WhatsApp mandaria outra —
    // a classe de defeito mais difícil de perceber, porque a tela fica certa.
    const { texto, link } = mensagemPara(prospect())
    const enviado = decodeURIComponent(new URL(link!).searchParams.get('text') ?? '')
    expect(enviado).toBe(texto)
  })

  it('a linha de descarte e a ULTIMA, e ela nunca some', () => {
    // Ela transforma "não tenho interesse" em resposta em vez de denúncia, e
    // denúncia é o que derruba o número do dono. Um defeito real já a comeu
    // por truncamento, e o teste de tamanho não pegava.
    const { texto } = mensagemPara(prospect())
    expect(texto.trim().endsWith('por aqui.')).toBe(true)
  })

  it('sem numero devolve link nulo, e nao um wa.me quebrado', () => {
    // `wa.me` com número inválido abre tela de erro do WhatsApp, e quem clicou
    // conclui que o defeito é nosso. Melhor não oferecer o botão.
    expect(mensagemPara(prospect({ whatsapp: null, telefone: null })).link).toBeNull()
  })

  it('cai para o telefone da pagina quando nao ha WhatsApp direto', () => {
    const { link } = mensagemPara(prospect({ whatsapp: null, telefone: '(11) 99435-1036' }))
    expect(link).toContain('wa.me/5511994351036')
  })

  it('RECUSA numero estrangeiro de 11 digitos em vez de prefixar 55', () => {
    // `+1 415 555 2671` tem o mesmo tamanho de um celular com DDD. O que separa
    // os dois é o dígito depois do DDD: celular brasileiro é sempre 9.
    expect(mensagemPara(prospect({ whatsapp: null, telefone: '14155552671' })).link).toBeNull()
  })
})

describe('motivosQueExplicam', () => {
  it('poe o que diz que ela PAGA antes do que diz que da para falar com ela', () => {
    // `pontuar` empilha contato primeiro, entao mostrando os 3 primeiros a linha
    // exibia sempre "WhatsApp direto · telefone · e-mail" — verdadeiro, e a
    // informacao menos util, porque quase toda empresa qualificada tem contato.
    // Achado quando o dono perguntou o que o numero verde significava.
    expect(
      motivosQueExplicam([
        'WhatsApp direto',
        'telefone na página',
        'e-mail na página',
        'domínio .com.br',
        'tem equipe de vendas',
        'pede orçamento no site',
      ]).slice(0, 2),
    ).toEqual(['tem equipe de vendas', 'pede orçamento no site'])
  })

  it('nao perde nenhum motivo, so troca a ordem', () => {
    const entrada = ['Instagram', 'já paga por software', 'domínio .com.br']
    const saida = motivosQueExplicam(entrada)
    expect(saida).toHaveLength(entrada.length)
    expect([...saida].sort()).toEqual([...entrada].sort())
  })

  it('lista vazia continua vazia: lead sem CSV nao tem motivo nenhum', () => {
    expect(motivosQueExplicam([])).toEqual([])
  })
})
