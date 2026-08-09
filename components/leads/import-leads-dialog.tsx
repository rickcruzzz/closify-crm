'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CSV_MAX_BYTES } from '@/lib/leads/csv'
import { importLeadsFromCsv } from '@/lib/leads/actions'

// Valor entre aspas de propósito: o separador do modelo é vírgula e o decimal
// brasileiro também — sem aspas, "2500,00" viraria duas colunas.
const MODELO =
  'Nome,Telefone,E-mail,Valor\n' +
  'Maria Silva,(11) 90000-0000,maria@empresa.com.br,"2500,00"\n'

export function ImportLeadsDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}) {
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [avisos, setAvisos] = React.useState<string[]>([])

  React.useEffect(() => {
    if (open) {
      setArquivo(null)
      setAvisos([])
    }
  }, [open])

  function baixarModelo() {
    // Blob local em vez de arquivo servido: é uma linha de exemplo, não vale
    // uma rota nem um asset no bundle.
    const url = URL.createObjectURL(new Blob([MODELO], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo-leads.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!arquivo) return

    if (arquivo.size > CSV_MAX_BYTES) {
      toast.error('Arquivo grande demais. O limite é 512 KB por importação.')
      return
    }

    setEnviando(true)
    setAvisos([])
    try {
      const texto = await arquivo.text()
      const resultado = await importLeadsFromCsv(texto)

      if ('error' in resultado) {
        toast.error(resultado.error)
        return
      }

      toast.success(
        resultado.importados === 1
          ? '1 lead importado.'
          : `${resultado.importados} leads importados.`,
      )
      onImported()

      // Com aviso, o diálogo fica aberto: fechar esconderia exatamente a
      // lista de linhas que a pessoa precisa corrigir na planilha.
      if (resultado.avisos.length > 0) {
        setAvisos(resultado.avisos)
        setArquivo(null)
      } else {
        onOpenChange(false)
      }
    } catch {
      toast.error('Não foi possível ler o arquivo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar leads de planilha</DialogTitle>
          <DialogDescription>
            Arquivo .csv com as colunas Nome, Telefone, E-mail e Valor na primeira
            linha. Os leads entram na etapa &ldquo;Novo Lead&rdquo; com você como
            responsável.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="arquivo-csv">Arquivo CSV</Label>
            <Input
              id="arquivo-csv"
              type="file"
              accept=".csv,text/csv"
              disabled={enviando}
              onChange={(e) => {
                setArquivo(e.target.files?.[0] ?? null)
                setAvisos([])
              }}
            />
            <p className="text-muted-foreground text-xs">
              Até 1.000 linhas e 512 KB. E-mails repetidos ou já cadastrados são
              ignorados.
            </p>
          </div>

          {avisos.length > 0 && (
            <div className="border-border max-h-48 overflow-y-auto rounded-lg border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <AlertTriangle
                  aria-hidden
                  className="size-3.5 text-amber-500 dark:text-amber-400"
                />
                Linhas não importadas
              </p>
              <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                {avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" onClick={baixarModelo}>
              <FileSpreadsheet className="size-4" />
              Baixar modelo
            </Button>
            <Button type="submit" disabled={!arquivo || enviando}>
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Importar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
