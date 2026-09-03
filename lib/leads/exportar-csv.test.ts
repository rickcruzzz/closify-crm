import { describe, expect, it } from 'vitest'

import { detectarSeparador, lerCsv } from '@/lib/leads/csv'
import { BOM_UTF8, montarCsvDeContatos, nomeDoArquivo } from './exportar-csv'
import type { Lead } from '@/lib/leads/types'

const base: Lead = {
  id: '1',
  name: 'Juliana Prado',
  email: 'juliana@vidaplena.com.br',
  phone: '71 98812-4400',
  company: 'Clínica Vida Plena',
  status: 'negociacao',
  owner: 'Rick Cruz',
  value: 4500,
  createdAt: '2026-09-03T12:00:00.000Z',
}

describe('exportação de contatos', () => {
  it('usa ponto e vírgula, que é o que o Excel em português espera', () => {
    const csv = montarCsvDeContatos([base])
    expect(csv.split('\r\n')[0]).toBe(
      'Nome;E-mail;Telefone;Empresa;Etapa;Valor;Responsável;Criado em',
    )
  })

  /**
   * O teste que fecha o ciclo: o que sai daqui tem de voltar por
   * `lib/leads/csv.ts`, que é o mesmo caminho da importação. Sem isto,
   * "exporte e reimporte" seria promessa não verificada.
   */
  it('gera arquivo que a PRÓPRIA importação lê de volta', () => {
    const csv = montarCsvDeContatos([base])

    expect(detectarSeparador(csv.split('\r\n')[0])).toBe(';')

    const matriz = lerCsv(csv)
    expect(matriz[0]).toContain('Nome')
    expect(matriz[1][0]).toBe('Juliana Prado')
    expect(matriz[1][3]).toBe('Clínica Vida Plena')
  })

  it('traduz a etapa em vez de despejar o enum do banco', () => {
    const csv = montarCsvDeContatos([base])
    expect(csv).toContain('Negociação')
    expect(csv).not.toContain('negociacao')
  })

  it('escreve valor com vírgula decimal, senão o Excel lê como texto', () => {
    expect(montarCsvDeContatos([{ ...base, value: 1234.5 }])).toContain('1234,50')
  })

  /** Vazio, e não `0,00`: negócio sem valor não vale zero, vale desconhecido. */
  it('deixa o valor em branco quando não existe', () => {
    const linha = montarCsvDeContatos([
      { ...base, value: null as unknown as number },
    ]).split('\r\n')[1]
    expect(linha.split(';')[5]).toBe('')
  })

  it('escapa aspas e separador dentro da célula', () => {
    const csv = montarCsvDeContatos([
      { ...base, company: 'Alfa; Beta', name: 'Ana "Aninha" Souza' },
    ])
    expect(csv).toContain('"Alfa; Beta"')
    expect(csv).toContain('"Ana ""Aninha"" Souza"')

    // e continua legível pela leitura do projeto
    const matriz = lerCsv(csv)
    expect(matriz[1][0]).toBe('Ana "Aninha" Souza')
    expect(matriz[1][3]).toBe('Alfa; Beta')
  })

  /**
   * ## Injeção de fórmula, e por que ela é o teste mais importante daqui
   *
   * Célula começando com `=`, `+`, `-` ou `@` é executada como FÓRMULA pelo
   * Excel e pelo Sheets. Um contato chamado `=cmd|'/c calc'!A1` — que qualquer
   * pessoa consegue cadastrar no produto — viraria execução de comando na
   * máquina de quem abre o arquivo.
   *
   * O alvo não é o servidor: é o CLIENTE que exportou. Um CRM que entrega uma
   * planilha capaz disso é pior que um CRM sem exportação.
   */
  it('neutraliza fórmula, que executaria na máquina de quem abre', () => {
    for (const perigoso of ['=1+1', '+1', '-1', '@SUM(A1)', "=cmd|'/c calc'!A1"]) {
      const linha = montarCsvDeContatos([{ ...base, name: perigoso }]).split('\r\n')[1]
      expect(linha.startsWith(`'`) || linha.startsWith(`"'`)).toBe(true)
    }
  })

  it('formata a data no fuso de São Paulo, não em UTC', () => {
    // 03/09 às 21h em São Paulo já é 04/09 em UTC. Sem o fuso, todo contato
    // criado à noite apareceria com a data do dia seguinte.
    const csv = montarCsvDeContatos([
      { ...base, createdAt: '2026-09-04T02:00:00.000Z' },
    ])
    expect(csv).toContain('03/09/2026')
  })

  it('o BOM existe, e é ele que faz o Excel não quebrar o acento', () => {
    expect(BOM_UTF8).toBe('﻿')
    expect(BOM_UTF8.length).toBe(1)
  })

  it('nomeia o arquivo com a data do dia', () => {
    expect(nomeDoArquivo(new Date('2026-09-03T12:00:00Z'))).toBe(
      'contatos-velo-funil-2026-09-03.csv',
    )
  })

  it('devolve só o cabeçalho quando não há contatos', () => {
    expect(montarCsvDeContatos([])).toBe(
      'Nome;E-mail;Telefone;Empresa;Etapa;Valor;Responsável;Criado em\r\n',
    )
  })
})
