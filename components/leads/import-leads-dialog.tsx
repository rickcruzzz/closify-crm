'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CSV_MAX_BYTES, CSV_MAX_LINHAS, decodificarPlanilha, lerCsv } from '@/lib/leads/csv'
import {
  CAMPOS,
  interpretarPlanilha,
  sugerirMapeamento,
  type CampoDestino,
  type Mapeamento,
} from '@/lib/leads/planilha'
import { importarPlanilha, type ResultadoImportacao } from '@/lib/leads/actions'

// Valor entre aspas de propósito: o separador do modelo é vírgula e o decimal
// brasileiro também — sem aspas, "2500,00" viraria duas colunas.
const MODELO =
  'Nome,Telefone,E-mail,Empresa,Valor,Etapa\n' +
  'Maria Silva,(11) 90000-0000,maria@empresa.com.br,Acme Serviços,"2500,00",Proposta enviada\n' +
  'João Souza,(21) 98888-7777,,Souza Consultoria,"800,00",Novo\n'

const NAO_IMPORTAR = '__nenhuma__'

type Passo = 'arquivo' | 'colunas' | 'resultado'

export function ImportLeadsDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}) {
  const [passo, setPasso] = React.useState<Passo>('arquivo')
  const [nomeDoArquivo, setNomeDoArquivo] = React.useState('')
  const [matriz, setMatriz] = React.useState<string[][]>([])
  const [mapeamento, setMapeamento] = React.useState<Mapeamento>({})
  const [lendo, setLendo] = React.useState(false)
  const [enviando, setEnviando] = React.useState(false)
  const [resultado, setResultado] = React.useState<ResultadoImportacao | null>(null)

  React.useEffect(() => {
    if (open) {
      setPasso('arquivo')
      setNomeDoArquivo('')
      setMatriz([])
      setMapeamento({})
      setResultado(null)
    }
  }, [open])

  function baixarModelo() {
    // BOM na frente para o Excel abrir o arquivo já em UTF-8; sem ele, o
    // próprio modelo que entregamos apareceria com acento quebrado.
    const url = URL.createObjectURL(
      new Blob(['﻿' + MODELO], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo-velo-funil.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function escolherArquivo(arquivo: File) {
    if (arquivo.size > CSV_MAX_BYTES) {
      toast.error('Arquivo grande demais. O limite é 512 KB por importação.')
      return
    }

    setLendo(true)
    try {
      const bytes = await arquivo.arrayBuffer()
      const ehExcel = /\.xlsx$/i.test(arquivo.name)

      let lida: string[][]
      if (ehExcel) {
        // Carregado sob demanda: `.xlsx` é um ZIP com XML dentro e a biblioteca
        // que lê isso pesa ~1 MB. Quem importa CSV — ou nem importa — não paga
        // por ela no bundle.
        //
        // `/browser` e não a raiz: o pacote não expõe export raiz, e a versão
        // de Node puxaria dependência de sistema de arquivos para dentro do
        // bundle do cliente.
        //
        // Escolhido em vez de `xlsx` (SheetJS) e `exceljs`: o primeiro está
        // parado em 0.18.5 no npm com duas falhas de segurança altas cuja
        // correção nunca foi publicada lá; o segundo está sem release há anos.
        const { readSheet } = await import('read-excel-file/browser')
        // `readSheet` e não o export padrão: na versão 9 o padrão devolve
        // TODAS as abas da pasta de trabalho. Importar sempre a primeira é
        // previsível — a pessoa sabe qual aba deixou na frente.
        const linhas = await readSheet(new Blob([bytes]), 1)
        lida = linhas.map((linha) =>
          linha.map((celula) => (celula === null || celula === undefined ? '' : String(celula))),
        )
      } else {
        lida = lerCsv(decodificarPlanilha(bytes))
      }

      if (lida.length < 2) {
        toast.error('A planilha não tem nenhuma linha além do cabeçalho.')
        return
      }

      setNomeDoArquivo(arquivo.name)
      setMatriz(lida)
      setMapeamento(sugerirMapeamento(lida[0] ?? []))
      setPasso('colunas')
    } catch (err) {
      console.error('falha ao ler a planilha', err)
      toast.error('Não foi possível ler o arquivo. Confira se é um .xlsx ou .csv válido.')
    } finally {
      setLendo(false)
    }
  }

  function trocarColuna(campo: CampoDestino, valor: string) {
    setMapeamento((atual) => {
      const proximo = { ...atual }
      if (valor === NAO_IMPORTAR) {
        delete proximo[campo]
        return proximo
      }
      const indice = Number(valor)
      // Uma coluna da planilha só pode alimentar um campo: sem isso, escolher
      // "Empresa" numa coluna já usada como "Nome" gravaria o mesmo texto nos
      // dois lugares, e a pessoa só descobriria depois de importar.
      for (const chave of Object.keys(proximo) as CampoDestino[]) {
        if (proximo[chave] === indice) delete proximo[chave]
      }
      proximo[campo] = indice
      return proximo
    })
  }

  const cabecalho = matriz[0] ?? []
  // A mesma função que o servidor roda, só que aqui para mostrar a prévia. O
  // servidor NÃO confia nisto — ele reinterpreta a matriz do zero.
  const previa = React.useMemo(
    () => interpretarPlanilha(matriz, mapeamento, CSV_MAX_LINHAS),
    [matriz, mapeamento],
  )

  async function enviar() {
    setEnviando(true)
    try {
      const retorno = await importarPlanilha({ matriz, mapeamento })
      if ('error' in retorno) {
        toast.error(retorno.error)
        return
      }
      setResultado(retorno)
      setPasso('resultado')
      onImported()
    } catch {
      toast.error('Não foi possível importar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {passo === 'arquivo' && 'Importar de planilha'}
            {passo === 'colunas' && 'Conferir as colunas'}
            {passo === 'resultado' && 'Importação concluída'}
          </DialogTitle>
          <DialogDescription>
            {passo === 'arquivo' &&
              'Arquivo do Excel (.xlsx) ou .csv. Cada contato vira um lead e um negócio no Kanban.'}
            {passo === 'colunas' &&
              `${nomeDoArquivo} · ${matriz.length - 1} linha(s). Confira se cada coluna foi para o lugar certo.`}
            {passo === 'resultado' && 'O que entrou e o que precisa da sua atenção.'}
          </DialogDescription>
        </DialogHeader>

        {passo === 'arquivo' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="arquivo-planilha">Arquivo</Label>
              <Input
                id="arquivo-planilha"
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={lendo}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0]
                  if (arquivo) void escolherArquivo(arquivo)
                }}
              />
              <p className="text-muted-foreground text-xs">
                Até {CSV_MAX_LINHAS.toLocaleString('pt-BR')} linhas e 512 KB. Contatos repetidos ou
                já cadastrados são ignorados.
              </p>
            </div>

            {lendo && (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Lendo a planilha…
              </p>
            )}

            <DialogFooter className="sm:justify-start">
              <Button type="button" variant="ghost" onClick={baixarModelo}>
                <FileSpreadsheet className="size-4" />
                Baixar modelo
              </Button>
            </DialogFooter>
          </div>
        )}

        {passo === 'colunas' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {CAMPOS.map(({ campo, rotulo }) => (
                <div key={campo} className="grid grid-cols-[7rem_1fr] items-center gap-3">
                  <Label htmlFor={`col-${campo}`} className="text-sm">
                    {rotulo}
                  </Label>
                  <Select
                    value={String(mapeamento[campo] ?? NAO_IMPORTAR)}
                    onValueChange={(valor) => trocarColuna(campo, String(valor))}
                  >
                    <SelectTrigger id={`col-${campo}`} className="w-full">
                      <SelectValue>
                        {(valor) =>
                          valor === NAO_IMPORTAR
                            ? 'Não importar'
                            : (cabecalho[Number(valor)] || `Coluna ${Number(valor) + 1}`)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NAO_IMPORTAR}>Não importar</SelectItem>
                      {cabecalho.map((titulo, indice) => (
                        <SelectItem key={indice} value={String(indice)}>
                          {titulo || `Coluna ${indice + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {previa.linhas.length > 0 && (
              <div className="border-border rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium">
                  Prévia — {previa.linhas.length} linha(s) prontas
                </p>
                <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                  {previa.linhas.slice(0, 3).map((linha) => (
                    <li key={linha.linha} className="truncate">
                      {[linha.name, linha.phone, linha.email, linha.company]
                        .filter(Boolean)
                        .join(' · ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previa.erros.length > 0 && (
              <div className="border-border max-h-40 overflow-y-auto rounded-lg border p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                  <AlertTriangle
                    aria-hidden
                    className="size-3.5 text-amber-500 dark:text-amber-400"
                  />
                  {previa.erros.length} aviso(s)
                </p>
                <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                  {previa.erros.slice(0, 20).map((erro) => (
                    <li key={erro}>{erro}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setPasso('arquivo')}>
                <ArrowLeft className="size-4" />
                Trocar arquivo
              </Button>
              <Button
                type="button"
                onClick={() => void enviar()}
                disabled={enviando || previa.linhas.length === 0}
              >
                {enviando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Importar {previa.linhas.length || ''}
              </Button>
            </DialogFooter>
          </div>
        )}

        {passo === 'resultado' && resultado && (
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 aria-hidden className="size-4 text-emerald-500 dark:text-emerald-400" />
              {resultado.importados === 1
                ? '1 lead importado, com o negócio criado no Kanban.'
                : `${resultado.importados} leads importados, com os negócios criados no Kanban.`}
            </p>

            {(resultado.duplicados > 0 ||
              resultado.ignorados > 0 ||
              resultado.foraDoLimite > 0) && (
              <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
                {resultado.duplicados > 0 && (
                  <li>{resultado.duplicados} já estavam cadastrados e foram ignorados.</li>
                )}
                {resultado.ignorados > 0 && (
                  <li>{resultado.ignorados} linha(s) com erro — veja a lista abaixo.</li>
                )}
                {resultado.foraDoLimite > 0 && (
                  <li className="text-foreground">
                    {resultado.foraDoLimite} não couberam no plano Free.
                  </li>
                )}
              </ul>
            )}

            {resultado.avisos.length > 0 && (
              <div className="border-border max-h-40 overflow-y-auto rounded-lg border p-3">
                <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                  {resultado.avisos.map((aviso) => (
                    <li key={aviso}>{aviso}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="sm:justify-between">
              {resultado.foraDoLimite > 0 ? (
                <Button type="button" variant="ghost" render={<a href="/settings/billing" />}>
                  Desbloquear no Pro
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
