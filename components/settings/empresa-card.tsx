'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Building2, Loader2, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { empresaSchema, type EmpresaFormInput, type EmpresaFormValues } from '@/lib/validations/empresa'
import { SEGMENTOS } from '@/lib/validations/onboarding'
import { enviarLogo, removerLogo, salvarEmpresa } from '@/lib/workspace/empresa'
import { LOGO_TAMANHO_MAXIMO } from '@/lib/storage/logo'

export type DadosIniciaisDaEmpresa = EmpresaFormInput & { logoUrl: string | null }

export function EmpresaCard({
  inicial,
  isAdmin,
}: {
  inicial: DadosIniciaisDaEmpresa
  isAdmin: boolean
}) {
  const [salvando, setSalvando] = React.useState(false)
  const { logoUrl, ...campos } = inicial

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm<EmpresaFormInput, unknown, EmpresaFormValues>({
    resolver: zodResolver(empresaSchema),
    defaultValues: campos,
  })

  async function onSubmit(values: EmpresaFormValues) {
    setSalvando(true)
    try {
      const resultado = await salvarEmpresa(values)

      if ('error' in resultado) {
        toast.error(resultado.error)
        return
      }

      toast.success('Empresa configurada com sucesso.')
      // Reancora o formulário no que foi salvo: sem isto o botão continuaria
      // habilitado, sugerindo que há mudança pendente.
      reset(values as unknown as EmpresaFormInput)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresa</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <CampoDeLogo urlInicial={logoUrl} isAdmin={isAdmin} />

        <Separator />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          <Secao titulo="Identificação">
            <Campo id="name" rotulo="Nome da empresa" erro={errors.name?.message} obrigatorio>
              <Input id="name" disabled={!isAdmin || salvando} {...register('name')} />
            </Campo>

            <Campo id="nome_fantasia" rotulo="Nome fantasia">
              <Input id="nome_fantasia" disabled={!isAdmin || salvando} {...register('nome_fantasia')} />
            </Campo>

            <Campo id="cnpj" rotulo="CNPJ" erro={errors.cnpj?.message} ajuda="Opcional">
              <Input
                id="cnpj"
                inputMode="numeric"
                placeholder="00.000.000/0001-00"
                disabled={!isAdmin || salvando}
                {...register('cnpj')}
              />
            </Campo>

            <Campo id="segmento" rotulo="Segmento">
              <Controller
                name="segmento"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    disabled={!isAdmin || salvando}
                  >
                    <SelectTrigger id="segmento" className="w-full">
                      <SelectValue placeholder="Selecione">
                        {(v) => SEGMENTOS.find((s) => s.valor === v)?.rotulo ?? 'Selecione'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SEGMENTOS.map((s) => (
                        <SelectItem key={s.valor} value={s.valor}>
                          {s.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo
              id="descricao"
              rotulo="Descrição"
              erro={errors.descricao?.message}
              largura="cheia"
            >
              <Textarea
                id="descricao"
                rows={3}
                placeholder="O que sua empresa faz, em uma frase."
                disabled={!isAdmin || salvando}
                {...register('descricao')}
              />
            </Campo>
          </Secao>

          <Secao titulo="Contato comercial">
            <Campo id="email_comercial" rotulo="E-mail" erro={errors.email_comercial?.message}>
              <Input
                id="email_comercial"
                type="email"
                inputMode="email"
                disabled={!isAdmin || salvando}
                {...register('email_comercial')}
              />
            </Campo>

            <Campo id="whatsapp" rotulo="WhatsApp" erro={errors.whatsapp?.message}>
              <Input
                id="whatsapp"
                inputMode="tel"
                placeholder="(11) 98888-7777"
                disabled={!isAdmin || salvando}
                {...register('whatsapp')}
              />
            </Campo>

            <Campo id="telefone" rotulo="Telefone" erro={errors.telefone?.message}>
              <Input
                id="telefone"
                inputMode="tel"
                disabled={!isAdmin || salvando}
                {...register('telefone')}
              />
            </Campo>

            <Campo id="site" rotulo="Site" erro={errors.site?.message}>
              <Input
                id="site"
                inputMode="url"
                placeholder="velofunil.com.br"
                disabled={!isAdmin || salvando}
                {...register('site')}
              />
            </Campo>
          </Secao>

          <Secao titulo="Endereço">
            <Campo id="cep" rotulo="CEP" erro={errors.cep?.message}>
              <Input
                id="cep"
                inputMode="numeric"
                placeholder="00000-000"
                disabled={!isAdmin || salvando}
                {...register('cep')}
              />
            </Campo>

            <Campo id="endereco" rotulo="Endereço">
              <Input id="endereco" disabled={!isAdmin || salvando} {...register('endereco')} />
            </Campo>

            <Campo id="numero" rotulo="Número">
              <Input id="numero" disabled={!isAdmin || salvando} {...register('numero')} />
            </Campo>

            <Campo id="complemento" rotulo="Complemento">
              <Input id="complemento" disabled={!isAdmin || salvando} {...register('complemento')} />
            </Campo>

            <Campo id="bairro" rotulo="Bairro">
              <Input id="bairro" disabled={!isAdmin || salvando} {...register('bairro')} />
            </Campo>

            <Campo id="cidade" rotulo="Cidade">
              <Input id="cidade" disabled={!isAdmin || salvando} {...register('cidade')} />
            </Campo>

            <Campo id="estado" rotulo="Estado" erro={errors.estado?.message}>
              <Input
                id="estado"
                maxLength={2}
                placeholder="SP"
                className="uppercase"
                disabled={!isAdmin || salvando}
                {...register('estado')}
              />
            </Campo>
          </Secao>

          {isAdmin ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={salvando || !isDirty}>
                {salvando && <Loader2 className="size-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Só o administrador da empresa pode alterar estes dados.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        {titulo}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Campo({
  id,
  rotulo,
  erro,
  ajuda,
  obrigatorio,
  largura = 'meia',
  children,
}: {
  id: string
  rotulo: string
  erro?: string
  ajuda?: string
  obrigatorio?: boolean
  largura?: 'meia' | 'cheia'
  children: React.ReactNode
}) {
  return (
    <div className={largura === 'cheia' ? 'flex flex-col gap-1.5 sm:col-span-2' : 'flex flex-col gap-1.5'}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          {rotulo}
          {obrigatorio && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {ajuda && <span className="text-muted-foreground text-xs">{ajuda}</span>}
      </div>
      {children}
      {erro && (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      )}
    </div>
  )
}

function CampoDeLogo({ urlInicial, isAdmin }: { urlInicial: string | null; isAdmin: boolean }) {
  const entrada = React.useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = React.useState<string | null>(urlInicial)
  const [ocupado, setOcupado] = React.useState(false)

  // A prévia local é criada com `createObjectURL` e precisa ser revogada, senão
  // cada troca de arquivo deixa um blob preso na memória da aba.
  const blobLocal = React.useRef<string | null>(null)

  React.useEffect(() => {
    return () => {
      if (blobLocal.current) URL.revokeObjectURL(blobLocal.current)
    }
  }, [])

  async function escolher(arquivo: File) {
    // Barra o tamanho antes de subir: mandar 8 MB pela rede para receber um
    // "não" do servidor gasta o dado móvel de quem está no celular.
    if (arquivo.size > LOGO_TAMANHO_MAXIMO) {
      toast.error(`A imagem tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. O limite é 2 MB.`)
      return
    }

    if (blobLocal.current) URL.revokeObjectURL(blobLocal.current)
    blobLocal.current = URL.createObjectURL(arquivo)
    setPrevia(blobLocal.current)

    setOcupado(true)
    try {
      const dados = new FormData()
      dados.append('logo', arquivo)

      const resultado = await enviarLogo(dados)

      if ('error' in resultado) {
        toast.error(resultado.error)
        setPrevia(urlInicial)
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
      toast.success('Logo removida.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
        {previa ? (
          // `img` e não `next/image`: a URL é assinada e expira, então o
          // otimizador da Vercel guardaria em cache uma URL que morre em uma
          // hora e a imagem quebraria depois.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previa} alt="Logo da empresa" className="size-full object-contain" />
        ) : (
          <Building2 aria-hidden className="text-muted-foreground size-6" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={entrada}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="logo-arquivo"
            disabled={!isAdmin || ocupado}
            onChange={(e) => {
              const arquivo = e.target.files?.[0]
              if (arquivo) void escolher(arquivo)
            }}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isAdmin || ocupado}
            onClick={() => entrada.current?.click()}
          >
            {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {previa ? 'Trocar logo' : 'Enviar logo'}
          </Button>

          {previa && isAdmin && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={ocupado}
              onClick={remover}
            >
              <Trash2 className="size-4" />
              Remover
            </Button>
          )}
        </div>

        <span className="text-muted-foreground text-xs">PNG, JPG ou WEBP, até 2 MB.</span>
      </div>
    </div>
  )
}
