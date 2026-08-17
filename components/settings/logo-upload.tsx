'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Building2, Loader2, Trash2, Upload } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LOGO_TAMANHO_MAXIMO } from '@/lib/storage/logo'
import { enviarLogo, removerLogo } from '@/lib/workspace/empresa'

const FORMATOS = 'image/png,image/jpeg,image/webp'

/**
 * Upload da logo da empresa.
 *
 * Arrastar-e-soltar existe, mas o botão NUNCA sai: quem usa teclado, leitor de
 * tela ou celular não arrasta arquivo. Arrastar é atalho, não caminho único.
 *
 * O que chega aqui já passou pela validação de bytes no servidor
 * (`lib/storage/logo.ts`), extensão e `Content-Type` são escolhidos por quem
 * envia. A checagem de tamanho daqui é só para não gastar a internet de quem
 * está no celular mandando 8 MB para receber um "não".
 */
export function LogoUpload({
  urlInicial,
  isAdmin,
}: {
  urlInicial: string | null
  isAdmin: boolean
}) {
  const entrada = React.useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = React.useState<string | null>(urlInicial)
  const [nomeDoArquivo, setNomeDoArquivo] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const [arrastando, setArrastando] = React.useState(false)
  const [confirmandoRemocao, setConfirmandoRemocao] = React.useState(false)

  // `createObjectURL` precisa ser revogado, senão cada troca deixa um blob
  // preso na memória da aba.
  const blobLocal = React.useRef<string | null>(null)

  React.useEffect(() => {
    return () => {
      if (blobLocal.current) URL.revokeObjectURL(blobLocal.current)
    }
  }, [])

  async function enviar(arquivo: File) {
    if (arquivo.size > LOGO_TAMANHO_MAXIMO) {
      toast.error(
        `A imagem tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. O limite é 2 MB.`,
      )
      return
    }

    if (blobLocal.current) URL.revokeObjectURL(blobLocal.current)
    blobLocal.current = URL.createObjectURL(arquivo)
    setPrevia(blobLocal.current)
    setNomeDoArquivo(arquivo.name)
    setOcupado(true)

    try {
      const dados = new FormData()
      dados.append('logo', arquivo)

      const resultado = await enviarLogo(dados)

      if ('error' in resultado) {
        toast.error(resultado.error)
        setPrevia(urlInicial)
        setNomeDoArquivo(null)
        return
      }

      toast.success('Logo atualizada.')
    } finally {
      setOcupado(false)
      // Zera o input: sem isso, escolher o MESMO arquivo de novo não dispara
      // `onChange` e a tela parece travada.
      if (entrada.current) entrada.current.value = ''
    }
  }

  async function remover() {
    setOcupado(true)
    try {
      const resultado = await removerLogo()

      if ('error' in resultado) {
        toast.error(resultado.error)
        return
      }

      if (blobLocal.current) {
        URL.revokeObjectURL(blobLocal.current)
        blobLocal.current = null
      }
      setPrevia(null)
      setNomeDoArquivo(null)
      setConfirmandoRemocao(false)
      toast.success('Logo removida.')
    } finally {
      setOcupado(false)
    }
  }

  const podeMexer = isAdmin && !ocupado

  return (
    <>
      <div
        // A área inteira aceita o arquivo solto, e o `onDragOver` precisa do
        // `preventDefault`, sem ele o navegador abre a imagem numa aba nova e
        // a pessoa perde o formulário preenchido.
        onDragOver={(e) => {
          if (!podeMexer) return
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          if (!podeMexer) return
          e.preventDefault()
          setArrastando(false)
          const arquivo = e.dataTransfer.files?.[0]
          if (arquivo) void enviar(arquivo)
        }}
        className={cn(
          'flex flex-wrap items-center gap-4 rounded-xl border border-dashed p-4 transition-colors',
          arrastando ? 'border-primary bg-primary/5' : 'border-border/60',
        )}
      >
        <div className="bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
          {previa ? (
            // `img` e não `next/image`: a URL é assinada e expira em uma hora.
            // O otimizador da Vercel guardaria em cache uma URL morta, e a
            // imagem quebraria depois.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previa} alt="Logo da empresa" className="size-full object-contain" />
          ) : (
            <Building2 aria-hidden className="text-muted-foreground size-7" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              {previa ? 'Logo da empresa' : 'Nenhuma logo enviada'}
            </span>
            <span className="text-muted-foreground text-xs">
              {nomeDoArquivo ?? 'Arraste um arquivo aqui ou escolha abaixo.'}
            </span>
            <span className="text-muted-foreground text-xs">PNG, JPG ou WEBP, até 2 MB.</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={entrada}
              type="file"
              accept={FORMATOS}
              className="sr-only"
              id="logo-arquivo"
              disabled={!podeMexer}
              onChange={(e) => {
                const arquivo = e.target.files?.[0]
                if (arquivo) void enviar(arquivo)
              }}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!podeMexer}
              onClick={() => entrada.current?.click()}
            >
              {ocupado ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {ocupado ? 'Enviando…' : previa ? 'Alterar logo' : 'Escolher arquivo'}
            </Button>

            {previa && isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={ocupado}
                onClick={() => setConfirmandoRemocao(true)}
              >
                <Trash2 className="size-4" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal só aqui: remover a logo é a única ação destrutiva desta tela.
          Salvar campo não pede confirmação. */}
      <Dialog open={confirmandoRemocao} onOpenChange={setConfirmandoRemocao}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover a logo?</DialogTitle>
            <DialogDescription>
              A empresa volta a aparecer sem imagem. Você pode enviar outra depois.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmandoRemocao(false)}
            >
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={ocupado} onClick={remover}>
              {ocupado && <Loader2 className="size-4 animate-spin" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
