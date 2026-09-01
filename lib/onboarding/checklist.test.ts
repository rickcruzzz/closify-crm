import { describe, expect, it } from 'vitest'

import {
  checklistCumprido,
  contarConcluidos,
  montarChecklist,
  proximoPasso,
  type SinaisDeAtivacao,
} from './checklist'

const zerado: SinaisDeAtivacao = {
  leads: 0,
  negocios: 0,
  tarefas: 0,
  empresa: { name: 'Studio Vega', segmento: null },
}

describe('montarChecklist', () => {
  it('empresa recém-criada tem só o pipeline feito', () => {
    const itens = montarChecklist(zerado)

    expect(contarConcluidos(itens)).toBe(1)
    expect(itens.find((i) => i.chave === 'pipeline')?.concluido).toBe(true)

    // ## O próximo passo é o CONTATO, não a configuração da empresa
    //
    // Este caso esperava `'empresa'` até 01/09, e a inversão é deliberada.
    // O rodapé do card anuncia o próximo passo, e é a primeira coisa que
    // alguém lê ao entrar: apontar para "nome, segmento e dados de contato"
    // manda a pessoa preencher formulário para continuar com um CRM vazio.
    //
    // A auditoria daquele dia mediu onde essa fila termina: 25 das 42
    // empresas nunca criaram um contato, e 88% concluem o assistente. O
    // primeiro contato é o único passo depois do qual o produto tem o que
    // mostrar.
    expect(proximoPasso(itens)?.chave).toBe('lead')
  })

  it('empresa só conta como configurada com nome E segmento', () => {
    const soNome = montarChecklist(zerado)
    expect(soNome.find((i) => i.chave === 'empresa')?.concluido).toBe(false)

    const completa = montarChecklist({
      ...zerado,
      empresa: { name: 'Studio Vega', segmento: 'agencia' },
    })
    expect(completa.find((i) => i.chave === 'empresa')?.concluido).toBe(true)
  })

  // O motivo de o checklist ser derivado e não gravado: um boolean salvo
  // quando o primeiro lead nasceu continuaria dizendo "feito" depois que a
  // pessoa apagasse esse lead, e o checklist mentiria sobre o próprio produto.
  it('apagar o único lead reabre o item', () => {
    const com = montarChecklist({ ...zerado, leads: 1 })
    expect(com.find((i) => i.chave === 'lead')?.concluido).toBe(true)

    const sem = montarChecklist({ ...zerado, leads: 0 })
    expect(sem.find((i) => i.chave === 'lead')?.concluido).toBe(false)
  })

  it('cumprido só quando os cinco estão feitos', () => {
    const quase = montarChecklist({
      leads: 3,
      negocios: 2,
      tarefas: 0,
      empresa: { name: 'Studio Vega', segmento: 'agencia' },
    })
    expect(checklistCumprido(quase)).toBe(false)
    expect(proximoPasso(quase)?.chave).toBe('tarefa')

    const tudo = montarChecklist({
      leads: 3,
      negocios: 2,
      tarefas: 1,
      empresa: { name: 'Studio Vega', segmento: 'agencia' },
    })
    expect(checklistCumprido(tudo)).toBe(true)
    expect(contarConcluidos(tudo)).toBe(5)
    expect(proximoPasso(tudo)).toBeNull()
  })

  it('cada item aponta para a tela onde a ação acontece', () => {
    const destinos = Object.fromEntries(
      montarChecklist(zerado).map((i) => [i.chave, i.href]),
    )

    expect(destinos).toEqual({
      empresa: '/settings',
      pipeline: '/kanban',
      lead: '/leads',
      negocio: '/kanban',
      tarefa: '/hoje',
    })
  })
})
