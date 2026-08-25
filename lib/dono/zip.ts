import { crc32 } from 'node:zlib'

/**
 * Um `.zip` sem compressão, montado à mão.
 *
 * ## Por que existe: o WhatsApp estraga foto, e não tem como pedir para não
 *
 * Mandar as telas pelo WhatsApp como **foto** degrada duas vezes, e a segunda
 * é a que dói: além de recomprimir em JPEG, o aplicativo **reduz a resolução**
 * de imagens acima do teto dele. Um Story é 1080×1920 — o lado maior passa do
 * limite, então chega menor do lado de lá. O Instagram depois amplia de volta
 * para 1080×1920, e é aí que o texto fica borrado.
 *
 * Não existe ajuste que desligue isso. O modo "HD" reduz o estrago, não o
 * elimina, e ainda depende de a pessoa lembrar de ligá-lo em cada envio.
 *
 * **Arquivo enviado como documento não é tocado** — os bytes chegam iguais. E
 * um `.zip` não pode ser enviado como foto: o WhatsApp não sabe abri-lo, então
 * só oferece o caminho de documento. É essa a razão de esta função existir em
 * vez de um aviso na tela: instrução depende de alguém lembrar, formato de
 * arquivo não.
 *
 * ## Por que sem compressão (método `store`)
 *
 * PNG já é deflate por dentro. Comprimir de novo rende quase nada — medido nas
 * telas deste projeto, menos de 1% — e custaria manter o caminho de deflate,
 * com o cabeçalho de tamanho comprimido divergindo do real. `store` mantém o
 * escritor pequeno o bastante para ser lido inteiro e conferido.
 *
 * ## Por que não uma dependência
 *
 * Seria adicionar pacote ao `package.json` do produto por causa de uma tela que
 * só existe em localhost. O formato, na variante `store`, são três estruturas
 * de cabeçalho — e elas estão documentadas abaixo campo a campo.
 */

/** Assinaturas do formato, na ordem em que aparecem no arquivo. */
const CABECALHO_LOCAL = 0x04034b50
const CABECALHO_CENTRAL = 0x02014b50
const FIM_DO_DIRETORIO = 0x06054b50

/** `store`: os bytes vão como estão. */
const SEM_COMPRESSAO = 0

/**
 * Bit 11 do campo de flags: o nome do arquivo está em UTF-8.
 *
 * Sem ele, quem descompacta assume a página de código local (CP437 no Windows),
 * e um nome com acento chega corrompido. Nenhum arquivo deste projeto tem
 * acento hoje, mas o dia em que tiver não deve ser o dia de descobrir isto.
 */
const NOME_EM_UTF8 = 0x0800

export type ArquivoDoZip = {
  nome: string
  conteudo: Uint8Array
}

/**
 * Converte uma data para o par hora/data do MS-DOS, que é o que o ZIP guarda.
 *
 * O formato nasceu em 1980 e guarda os segundos em passos de 2, com o ano como
 * deslocamento a partir de 1980. Data fora dessa faixa não tem representação —
 * então a função prende nos extremos em vez de gravar lixo, que faria alguns
 * descompactadores recusarem o arquivo inteiro.
 */
function horaEDataDos(quando: Date): { hora: number; data: number } {
  const ano = Math.min(Math.max(quando.getFullYear(), 1980), 2107)

  return {
    hora:
      (quando.getHours() << 11) |
      (quando.getMinutes() << 5) |
      (Math.floor(quando.getSeconds() / 2) & 0x1f),
    data: ((ano - 1980) << 9) | ((quando.getMonth() + 1) << 5) | quando.getDate(),
  }
}

/**
 * Monta o `.zip` inteiro em memória.
 *
 * Em memória, e não em fluxo, porque o consumidor é uma tela local com dezenas
 * de arquivos de algumas centenas de KB. Fluxo pagaria complexidade por uma
 * escala que esta tela nunca vai ter — e o dia em que tiver, o gargalo seria
 * outro.
 */
export function montarZip(arquivos: ArquivoDoZip[], quando: Date = new Date()): Uint8Array {
  const { hora, data } = horaEDataDos(quando)

  const pedacos: Uint8Array[] = []
  const central: Uint8Array[] = []
  let deslocamento = 0

  for (const arquivo of arquivos) {
    const nome = new TextEncoder().encode(arquivo.nome)
    const soma = crc32(arquivo.conteudo)
    const tamanho = arquivo.conteudo.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, CABECALHO_LOCAL, true)
    local.setUint16(4, 20, true) // versão mínima para extrair: 2.0
    local.setUint16(6, NOME_EM_UTF8, true)
    local.setUint16(8, SEM_COMPRESSAO, true)
    local.setUint16(10, hora, true)
    local.setUint16(12, data, true)
    local.setUint32(14, soma, true)
    // Sem compressão os dois tamanhos são o mesmo número. Divergir aqui é o
    // erro clássico de quem escreve ZIP à mão, e o sintoma é um arquivo que
    // abre em uma ferramenta e é recusado por outra.
    local.setUint32(18, tamanho, true)
    local.setUint32(22, tamanho, true)
    local.setUint16(26, nome.length, true)
    local.setUint16(28, 0, true) // sem campo extra

    pedacos.push(new Uint8Array(local.buffer), nome, arquivo.conteudo)

    const entrada = new DataView(new ArrayBuffer(46))
    entrada.setUint32(0, CABECALHO_CENTRAL, true)
    entrada.setUint16(4, 20, true) // versão de quem escreveu
    entrada.setUint16(6, 20, true) // versão mínima para extrair
    entrada.setUint16(8, NOME_EM_UTF8, true)
    entrada.setUint16(10, SEM_COMPRESSAO, true)
    entrada.setUint16(12, hora, true)
    entrada.setUint16(14, data, true)
    entrada.setUint32(16, soma, true)
    entrada.setUint32(20, tamanho, true)
    entrada.setUint32(24, tamanho, true)
    entrada.setUint16(28, nome.length, true)
    entrada.setUint16(30, 0, true) // sem campo extra
    entrada.setUint16(32, 0, true) // sem comentário
    entrada.setUint16(34, 0, true) // disco onde começa
    entrada.setUint16(36, 0, true) // atributos internos
    entrada.setUint32(38, 0, true) // atributos externos
    entrada.setUint32(42, deslocamento, true)

    central.push(new Uint8Array(entrada.buffer), nome)
    deslocamento += 30 + nome.length + tamanho
  }

  const tamanhoDoCentral = central.reduce((soma, p) => soma + p.length, 0)

  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, FIM_DO_DIRETORIO, true)
  fim.setUint16(4, 0, true) // número deste disco
  fim.setUint16(6, 0, true) // disco onde o diretório começa
  fim.setUint16(8, arquivos.length, true)
  fim.setUint16(10, arquivos.length, true)
  fim.setUint32(12, tamanhoDoCentral, true)
  fim.setUint32(16, deslocamento, true)
  fim.setUint16(20, 0, true) // sem comentário

  const todos = [...pedacos, ...central, new Uint8Array(fim.buffer)]
  const total = todos.reduce((soma, p) => soma + p.length, 0)

  const saida = new Uint8Array(total)
  let posicao = 0
  for (const pedaco of todos) {
    saida.set(pedaco, posicao)
    posicao += pedaco.length
  }

  return saida
}
