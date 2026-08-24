'use client'

import * as React from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { REPORT_AREA_ID } from '@/components/dashboard/report-area'

/**
 * Baixa o Dashboard (métricas, funil, próximos prazos) em PDF.
 *
 * Pensado para quem presta contas com o número: dono de agência mostrando
 * pro sócio, consultoria mandando resumo pro cliente que contratou. O
 * conteúdo é exatamente o que já está na tela, no período já selecionado —
 * o relatório não reabre a pergunta "qual período", só tira da tela o que a
 * pessoa já está olhando.
 *
 * Gerado no CLIENTE, sem rota de servidor nova: o navegador já tem os dados
 * carregados e o gráfico renderizado, `html2canvas` fotografa o DOM como
 * está. Evita Puppeteer/Chromium (runtime Node dedicado, pesado para um PDF
 * de uma tela só) e evita duplicar as consultas do Dashboard num endpoint
 * de servidor separado.
 */
export function ExportReportButton({
  nomeDoWorkspace,
  rotuloDoPeriodo,
}: {
  nomeDoWorkspace: string
  /** Ex: "Últimos 30 dias", já formatado — mesmo texto que `PeriodFilter` mostra. */
  rotuloDoPeriodo: string
}) {
  const [gerando, setGerando] = React.useState(false)

  async function exportar() {
    const area = document.getElementById(REPORT_AREA_ID)
    if (!area) {
      toast.error('Não foi possível gerar o relatório. Recarregue a página e tente de novo.')
      return
    }

    setGerando(true)
    try {
      // `html2canvas-pro`, não `html2canvas`: o original não sabe interpretar
      // `oklch()` — a notação de cor que o tema inteiro usa (`app/globals.css`,
      // Tailwind v4) — e falha com "unsupported color function". Medido no
      // navegador: captura quebrava em toda tentativa. O fork é mantido
      // exatamente para suportar `oklch`/`lab`/`lch`, mesma API.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ])

      // `backgroundColor` explícito: o tema escuro do produto não tem fundo
      // opaco no elemento capturado (o `<body>` que pinta), sem isto o PDF
      // sairia com o gráfico e os cards sobre fundo transparente/branco
      // aleatório dependendo do visualizador de PDF.
      const corDeFundo = getComputedStyle(document.body).backgroundColor
      const canvas = await html2canvas(area, {
        backgroundColor: corDeFundo || '#0a0a0a',
        scale: 2, // nitidez para impressão/zoom, sem pesar demais o arquivo
        useCORS: true,
      })

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const larguraPagina = pdf.internal.pageSize.getWidth()
      const alturaPagina = pdf.internal.pageSize.getHeight()
      const margem = 10
      const larguraUtil = larguraPagina - margem * 2

      const razaoAltura = canvas.height / canvas.width
      const alturaTotal = larguraUtil * razaoAltura

      // JPEG com qualidade alta, não PNG: medido, o PNG em `scale: 2` de uma
      // tela inteira dava um PDF de quase 12MB, pesado demais para um
      // relatório que a pessoa vai anexar num e-mail. O conteúdo é
      // texto/cards/gráfico sobre fundo sólido, não tem transparência a
      // perder, então JPEG 0.92 corta o tamanho sem serrilhado visível.
      const imgData = canvas.toDataURL('image/jpeg', 0.92)

      // Cabeçalho com contexto: workspace e período, para o PDF fazer
      // sentido fora do produto, sem precisar de legenda por fora.
      pdf.setFontSize(14)
      pdf.text(`Velo Funil · ${nomeDoWorkspace}`, margem, margem + 4)
      pdf.setFontSize(10)
      pdf.setTextColor(120)
      pdf.text(
        `${rotuloDoPeriodo} · Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
        margem,
        margem + 10,
      )

      const inicioConteudo = margem + 16
      const alturaUtilPrimeiraPagina = alturaPagina - inicioConteudo - margem
      const alturaUtilDemaisPaginas = alturaPagina - margem * 2

      // O conteúdo do Dashboard costuma ser mais alto que uma página A4: a
      // MESMA imagem é desenhada em cada página, deslocada para cima pelo
      // tanto já mostrado — como rolar uma janela sobre uma folha única —
      // em vez de recortar o canvas em pedaços, que deixaria artefato de
      // borda entre um pedaço e outro.
      let alturaJaDesenhada = 0
      let pagina = 0

      while (alturaJaDesenhada < alturaTotal) {
        const primeira = pagina === 0
        if (!primeira) pdf.addPage()

        const topoDestaPagina = primeira ? inicioConteudo : margem
        pdf.addImage(
          imgData,
          'JPEG',
          margem,
          topoDestaPagina - alturaJaDesenhada,
          larguraUtil,
          alturaTotal,
        )

        alturaJaDesenhada += primeira ? alturaUtilPrimeiraPagina : alturaUtilDemaisPaginas
        pagina += 1
      }

      const hoje = new Date().toISOString().slice(0, 10)
      const nomeArquivo = `velofunil-relatorio-${slugify(nomeDoWorkspace)}-${hoje}.pdf`
      pdf.save(nomeArquivo)
    } catch (err) {
      console.error('exportar relatório falhou', err)
      toast.error('Não foi possível gerar o relatório. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <Button variant="outline" onClick={exportar} disabled={gerando}>
      {gerando ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        <Download aria-hidden className="size-4" />
      )}
      Exportar relatório
    </Button>
  )
}

function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
