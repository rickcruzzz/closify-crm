import { jsPDF } from 'jspdf'

/**
 * O PDF do orçamento, montado no SERVIDOR.
 *
 * ## Por que no servidor, e não como o relatório do Dashboard
 *
 * O "Exportar relatório" do Dashboard usa `html2canvas-pro` + `jspdf` no
 * navegador: ele fotografa a tela. Aqui isso seria errado por duas razões
 * independentes.
 *
 * A primeira é o produto: este documento vai para o CLIENTE DO CLIENTE. Uma
 * captura de tela vira imagem — não dá para selecionar o texto, pesa mais, e
 * fica borrada ao imprimir. Texto vetorial é o que um orçamento precisa ser.
 *
 * A segunda é comercial, e é a que decide: **o PDF é a linha do Pro.** Uma
 * geração que acontece no navegador, a partir de dados que já estão na tela,
 * não é um portão — é uma sugestão. Gerando aqui, quem chama passa por
 * `pro_vigente()` no servidor antes de qualquer byte sair, que é a regra que
 * este projeto aprendeu em 0019→0022: regra que só vive no cliente não é
 * regra.
 *
 * ## Puro de propósito
 *
 * Recebe dados e devolve bytes. Não lê banco, não lê sessão — quem faz isso é
 * a rota. Assim o layout tem teste sem precisar de sessão nem de Supabase.
 */

export type DadosDoOrcamento = {
  /** A empresa que EMITE. Sai de `workspaces`, preenchida no onboarding. */
  emissor: {
    nome: string
    cnpj: string | null
    telefone: string | null
    email: string | null
    site: string | null
    cidade: string | null
    estado: string | null
  }
  /** Para quem vai. */
  cliente: {
    nome: string
    empresa: string | null
    telefone: string | null
    email: string | null
  }
  titulo: string
  valor: number
  /** `YYYY-MM-DD`. */
  validade: string
  descricao: string | null
  /** Quando o documento foi emitido, para o rodapé. */
  emitidoEm: Date
}

const MARGEM = 20
const LARGURA_UTIL = 210 - MARGEM * 2

const dinheiro = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * `YYYY-MM-DD` para `DD/MM/AAAA`, por corte de string.
 *
 * `new Date('2026-09-20')` é interpretado como MEIA-NOITE UTC, que em São
 * Paulo é 21h do dia 19 — o orçamento sairia impresso vencendo um dia antes do
 * que o banco guarda. A data aqui não tem hora nenhuma, então não há o que
 * converter: só reordenar.
 */
export function dataBR(dia: string): string {
  const [ano, mes, d] = dia.split('-')
  return `${d}/${mes}/${ano}`
}

/** Junta os pedaços que existem, sem deixar separador solto quando faltam. */
function linhaDeContato(partes: (string | null | undefined)[]): string {
  return partes.filter((p) => p && p.trim()).join('  ·  ')
}

export function montarPdfDoOrcamento(dados: DadosDoOrcamento): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGEM

  // Cabeçalho: quem emite.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(dados.emissor.nome, MARGEM, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110)

  const contatoEmissor = linhaDeContato([
    dados.emissor.cnpj ? `CNPJ ${dados.emissor.cnpj}` : null,
    dados.emissor.telefone,
    dados.emissor.email,
  ])
  if (contatoEmissor) {
    doc.text(contatoEmissor, MARGEM, y)
    y += 4
  }

  const localEmissor = linhaDeContato([
    dados.emissor.site,
    [dados.emissor.cidade, dados.emissor.estado].filter(Boolean).join('/') || null,
  ])
  if (localEmissor) {
    doc.text(localEmissor, MARGEM, y)
    y += 4
  }

  y += 3
  doc.setDrawColor(200)
  doc.line(MARGEM, y, MARGEM + LARGURA_UTIL, y)
  y += 10

  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Orçamento', MARGEM, y)
  y += 10

  // Para quem.
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.setFont('helvetica', 'normal')
  doc.text('PARA', MARGEM, y)
  y += 5

  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(dados.cliente.nome, MARGEM, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110)
  const contatoCliente = linhaDeContato([
    dados.cliente.empresa,
    dados.cliente.telefone,
    dados.cliente.email,
  ])
  if (contatoCliente) {
    doc.text(contatoCliente, MARGEM, y)
    y += 5
  }

  y += 5

  // O que foi proposto.
  doc.setTextColor(110)
  doc.setFontSize(9)
  doc.text('SERVIÇO', MARGEM, y)
  y += 5

  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  // `splitTextToSize` quebra por LARGURA REAL da fonte, não por contagem de
  // caracteres. Sem ele, um título longo sairia para fora da página — e como o
  // jsPDF não reclama, o texto simplesmente some na borda.
  for (const linha of doc.splitTextToSize(dados.titulo, LARGURA_UTIL)) {
    doc.text(linha, MARGEM, y)
    y += 6
  }

  if (dados.descricao) {
    y += 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60)
    for (const linha of doc.splitTextToSize(dados.descricao, LARGURA_UTIL)) {
      doc.text(linha, MARGEM, y)
      y += 5
    }
  }

  y += 8
  doc.setDrawColor(200)
  doc.line(MARGEM, y, MARGEM + LARGURA_UTIL, y)
  y += 10

  // O valor, à direita, que é onde o olho procura num orçamento.
  doc.setTextColor(110)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('VALOR TOTAL', MARGEM, y)

  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(dinheiro(dados.valor), MARGEM + LARGURA_UTIL, y + 1, { align: 'right' })
  y += 12

  // A validade é o argumento comercial do documento, então é frase e não
  // campo: "válido até 20/09/2026" cobra decisão; um rótulo "Validade" com uma
  // data ao lado é só cadastro.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(0)
  doc.text(`Este orçamento é válido até ${dataBR(dados.validade)}.`, MARGEM, y)

  // Rodapé, ancorado no PÉ da página e não no fluxo: com descrição longa o `y`
  // já desceu, e um rodapé que segue o texto apareceria no meio da folha.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text(
    `Emitido em ${dados.emitidoEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    MARGEM,
    297 - 12,
  )

  return new Uint8Array(doc.output('arraybuffer'))
}
