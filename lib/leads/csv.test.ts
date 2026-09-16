import { describe, expect, it } from 'vitest'
import { sugerirMapeamento } from '@/lib/leads/planilha'

import {
  decodificarPlanilha,
  detectarSeparador,
  escolherSeparador,
  formaDoArquivo,
  lerCsv,
  detectarLinhaDoCabecalho,
  parseValorBRL,
} from './csv'

/** Windows-1252 e Unicode coincidem byte a byte para o texto destes testes. */
function bytesWindows1252(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.codePointAt(i)!
  return bytes
}

describe('decodificarPlanilha', () => {
  // Defeito confirmado em 11/08/2026: o diálogo usava `File.text()`, que
  // decodifica SEMPRE em UTF-8, e o Excel em português salva CSV em
  // Windows-1252. "José Antônio" chegava ao banco como "Jos<?> Ant<?>nio".
  it('lê arquivo do Excel pt-BR sem quebrar o acento', () => {
    const texto = decodificarPlanilha(bytesWindows1252('Nome;Cidade\nJosé Antônio;Salvador\n'))
    expect(texto).toContain('José Antônio')
    expect(texto).not.toContain('�')
  })

  it('não estraga arquivo que já é UTF-8', () => {
    const bytes = new TextEncoder().encode('Nome,Cidade\nJosé Antônio,Salvador\n')
    expect(decodificarPlanilha(bytes)).toContain('José Antônio')
  })

  // O BOM do Excel ("CSV UTF-8") vira caractere invisível grudado no primeiro
  // cabeçalho e faz "Nome" deixar de casar com "nome".
  it('remove o BOM do Excel', () => {
    const corpo = new TextEncoder().encode('Nome,Cidade\nAna,Salvador\n')
    const comBom = new Uint8Array(corpo.length + 3)
    comBom.set([0xef, 0xbb, 0xbf], 0)
    comBom.set(corpo, 3)
    expect(decodificarPlanilha(comBom).startsWith('Nome')).toBe(true)
  })
})

describe('detectarSeparador', () => {
  it('reconhece o ponto e vírgula do Excel pt-BR', () => {
    expect(detectarSeparador('Nome;Telefone;E-mail;Valor')).toBe(';')
  })

  it('reconhece a vírgula do Google Sheets', () => {
    expect(detectarSeparador('Nome,Telefone,E-mail,Valor')).toBe(',')
  })

  // Sem ignorar o conteúdo entre aspas, "2.500,00" faria a vírgula ganhar de
  // um arquivo que na verdade é separado por ponto e vírgula.
  it('ignora separador que está dentro de aspas', () => {
    expect(detectarSeparador('Nome;Valor;"a,b,c,d,e"')).toBe(';')
  })
})

describe('lerCsv', () => {
  it('devolve cabeçalho e linhas como matriz', () => {
    const matriz = lerCsv('Nome;E-mail\nAna;ana@x.com\nBruno;bruno@x.com\n')
    expect(matriz).toEqual([
      ['Nome', 'E-mail'],
      ['Ana', 'ana@x.com'],
      ['Bruno', 'bruno@x.com'],
    ])
  })

  // `split('\n')` quebraria aqui: endereço colado da planilha traz quebra de
  // linha dentro de campo entre aspas.
  it('mantém quebra de linha dentro de campo entre aspas', () => {
    const matriz = lerCsv('Nome,Obs\nAna,"linha 1\nlinha 2"\n')
    expect(matriz).toHaveLength(2)
    expect(matriz[1]?.[1]).toBe('linha 1\nlinha 2')
  })

  it('trata aspas duplicadas como aspa literal', () => {
    expect(lerCsv('A\n"diz ""oi"""\n')[1]?.[0]).toBe('diz "oi"')
  })

  it('descarta linha totalmente vazia', () => {
    expect(lerCsv('Nome\nAna\n\n\nBruno\n')).toHaveLength(3)
  })

  it('devolve matriz vazia para arquivo em branco', () => {
    expect(lerCsv('   \n  ')).toEqual([])
  })
})

describe('parseValorBRL', () => {
  it('lê o formato brasileiro com milhar e centavos', () => {
    expect(parseValorBRL('R$ 1.234,56')).toBe(1234.56)
    expect(parseValorBRL('1.200,00')).toBe(1200)
  })

  it('lê o formato em inglês', () => {
    expect(parseValorBRL('1234.56')).toBe(1234.56)
  })

  // "1.200" numa planilha brasileira é mil e duzentos; o tamanho do último
  // grupo desempata contra "1234.56", que é decimal exportado em inglês.
  it('desempata ponto de milhar e ponto decimal pelo tamanho do grupo', () => {
    expect(parseValorBRL('1.200')).toBe(1200)
    expect(parseValorBRL('1.20')).toBe(1.2)
  })

  it('célula em branco é zero, porque lead sem valor estimado é normal', () => {
    expect(parseValorBRL('')).toBe(0)
    expect(parseValorBRL('   ')).toBe(0)
  })

  // Defeito corrigido: "abc" virava R$ 0,00 em silêncio, o que é pior do que
  // recusar a linha, num CRM de vendas o valor errado contamina o dashboard.
  it('recusa texto sem dígito em vez de virar zero', () => {
    expect(parseValorBRL('abc')).toBeNull()
    expect(parseValorBRL('a combinar')).toBeNull()
  })
})

describe('escolherSeparador, planilha com titulo acima do cabecalho', () => {
  // ## O defeito de 08/09, e ele so aparece com o arquivo INTEIRO
  //
  // `lerCsv` decidia o separador pela PRIMEIRA linha do arquivo. Relatorio
  // exportado quase sempre traz titulo antes do cabecalho, e essa linha nao tem
  // separador nenhum — entao caia no padrao `,` e o arquivo virava uma coluna
  // so, sem erro nenhum na tela.
  const COM_TITULO =
    'RELATORIO DE CLIENTES\n' +
    'Gerado em 08/09/2026\n' +
    'Nome;Telefone;Empresa\n' +
    'Joao;11988887777;Joao ME\n' +
    'Maria;11977776666;Maria Ltda\n'

  it('acha o `;` mesmo com duas linhas de titulo em cima', () => {
    expect(escolherSeparador(COM_TITULO)).toBe(';')
  })

  it('e a matriz sai com TRES colunas, nao uma', () => {
    const matriz = lerCsv(COM_TITULO)
    expect(matriz[2]).toEqual(['Nome', 'Telefone', 'Empresa'])
    expect(matriz[3]).toEqual(['Joao', '11988887777', 'Joao ME'])
  })

  it('a versao antiga falharia: a 1a linha sozinha devolve virgula', () => {
    // O controle que prova que o defeito era este, e nao outro.
    expect(detectarSeparador('RELATORIO DE CLIENTES')).toBe(',')
  })

  it('um ponto-e-virgula solto no meio NAO rouba um arquivo de virgula', () => {
    // Contar ocorrencias numa linha so erraria aqui: a linha do endereco tem
    // dois `;` e venceria o `,` que reparte todas as outras.
    const texto =
      'Nome,Telefone,Endereco\n' +
      'Ana,11999990000,Rua A 10\n' +
      'Bruno,11988880000,Rua B; sala 2; fundos\n' +
      'Carla,11977770000,Rua C 30\n'
    expect(escolherSeparador(texto)).toBe(',')
  })

  it('tabulacao continua sendo reconhecida', () => {
    expect(escolherSeparador('Nome\tTelefone\nAna\t11999990000\n')).toBe('\t')
  })

  it('arquivo de uma coluna nao inventa separador', () => {
    expect(escolherSeparador('Nome\nAna\nBruno\n')).toBe(',')
  })

  it('campo com quebra de linha entre aspas nao conta como registro', () => {
    // As aspas saem antes de contar, sobre o conteudo INTEIRO: dentro delas a
    // quebra de linha nao e fim de registro.
    const texto = 'Nome;Obs\nAna;"linha 1\nlinha 2"\nBruno;ok\n'
    expect(escolherSeparador(texto)).toBe(';')
    expect(lerCsv(texto)[1]).toEqual(['Ana', 'linha 1\nlinha 2'])
  })
})

describe('detectarLinhaDoCabecalho', () => {
  /**
   * O caso que motivou a função, reproduzido pela TELA em 11/09: o botão de
   * confirmar nascia desabilitado e a pessoa concluía que a importação não
   * funciona. Era o único dos cinco formatos testados que falhava.
   */
  it('pula título e data antes do cabeçalho', () => {
    const matriz = [
      ['RELATORIO DE CLIENTES'],
      ['Gerado em 10/09/2026'],
      [],
      ['Nome', 'Telefone', 'Empresa'],
      ['Carlos Lima', '11955554444', 'Lima Vidros'],
    ]
    expect(detectarLinhaDoCabecalho(matriz, sugerirMapeamento)).toBe(3)
  })

  it('fica em 0 quando o cabeçalho já é a primeira linha', () => {
    const matriz = [
      ['Nome', 'E-mail', 'Telefone'],
      ['João', 'joao@teste.com', '11999998888'],
    ]
    expect(detectarLinhaDoCabecalho(matriz, sugerirMapeamento)).toBe(0)
  })

  /**
   * O controle que importa mais que os outros: sem cabeçalho reconhecível,
   * NÃO inventa um desvio. Errar para baixo apagaria o primeiro contato da
   * importação, e ninguém notaria — a planilha entraria com uma pessoa a menos.
   */
  it('não pula nada quando não há cabeçalho reconhecível', () => {
    const matriz = [
      ['Pedro Alves', '11944443333'],
      ['Lucia Ramos', '11933332222'],
    ]
    expect(detectarLinhaDoCabecalho(matriz, sugerirMapeamento)).toBe(0)
  })

  it('ignora linha de uma célula só, que é título e não cabeçalho', () => {
    const matriz = [
      ['Contatos'],
      ['Nome', 'Telefone'],
      ['Ana', '11922221111'],
    ]
    expect(detectarLinhaDoCabecalho(matriz, sugerirMapeamento)).toBe(1)
  })

  it('aceita matriz vazia sem estourar', () => {
    expect(detectarLinhaDoCabecalho([], sugerirMapeamento)).toBe(0)
  })
})

describe('formaDoArquivo', () => {
  /**
   * O arquivo que o dono mandou em 11/09. A tela lia tudo como uma coluna só e
   * dizia que não achou e-mail nem telefone — com os dois ali, visíveis.
   */
  it('separa o título do dado no arquivo do relato', () => {
    const bruto = [
      'EMPRESA',
      'Alfa Soluções Empresariais LTDA',
      '',
      'CONTATOS:',
      'Mariana Oliveira | mariana@alfasolucoes.com.br | (71) 99111-1001',
      'Rafael Santos | rafael@alfasolucoes.com.br | (71) 99222-1002',
    ].join('\n')

    expect(escolherSeparador(bruto)).toBe('|')

    const m = lerCsv(bruto)
    const forma = formaDoArquivo(m)
    expect(forma.colunas).toBe(3)
    expect(forma.primeiraLinhaDeDados).toBe(3)
    expect(forma.descartadas).toEqual([
      'EMPRESA',
      'Alfa Soluções Empresariais LTDA',
      'CONTATOS:',
    ])
  })

  it('não descarta nada quando o arquivo já começa nos dados', () => {
    const m = lerCsv('Nome;Email\nAna;ana@x.com.br\nBia;bia@x.com.br')
    const forma = formaDoArquivo(m)
    expect(forma.primeiraLinhaDeDados).toBe(0)
    expect(forma.descartadas).toEqual([])
  })

  /**
   * Linha curta NO MEIO pode ser dado sujo — alguém apagou um campo — e jogá-la
   * fora perderia um contato. O corte para na primeira linha na forma certa.
   */
  it('só corta ruído do começo, nunca do meio', () => {
    const m = lerCsv('RELATORIO\nNome;Email\nAna;ana@x.com.br\nSemEmail\nBia;bia@x.com.br')
    const forma = formaDoArquivo(m)
    expect(forma.primeiraLinhaDeDados).toBe(1)
    expect(forma.descartadas).toEqual(['RELATORIO'])
  })

  /** Arquivo legítimo de coluna única não vira ruído inteiro. */
  it('deixa em paz um arquivo de uma coluna só', () => {
    const m = lerCsv('Nome\nAna\nBia\nCarla')
    const forma = formaDoArquivo(m)
    expect(forma.colunas).toBe(1)
    expect(forma.primeiraLinhaDeDados).toBe(0)
    expect(forma.descartadas).toEqual([])
  })

  it('aceita matriz vazia', () => {
    expect(formaDoArquivo([])).toEqual({ colunas: 0, primeiraLinhaDeDados: 0, descartadas: [] })
  })
})

describe('o pipe como separador', () => {
  it('reconhece uma lista escrita à mão', () => {
    expect(escolherSeparador('Ana | ana@x.com.br | 11999998888\nBia | bia@x.com.br | 11988887777')).toBe('|')
  })

  /**
   * O CONTROLE que impede o pipe de estragar arquivo bom: um endereço com `|`
   * no meio de um CSV de vírgula não pode roubar a escolha. O piso de apoio é
   * quem resolve — uma linha só com pipe é coincidência, não padrão.
   */
  it('não rouba a escolha de um CSV de vírgula', () => {
    const bruto = [
      'Nome,Email,Endereco',
      'Ana,ana@x.com.br,Rua A 100',
      'Bia,bia@x.com.br,Av B | fundos',
      'Caio,caio@x.com.br,Rua C 300',
    ].join('\n')
    expect(escolherSeparador(bruto)).toBe(',')
  })

  /** Sem duas linhas concordando, não há padrão — e o padrão antigo vale. */
  it('uma vírgula solta em texto livre não decide o arquivo', () => {
    expect(escolherSeparador('titulo do documento\numa frase, com virgula\noutra frase sem nada')).toBe(',')
  })
})
