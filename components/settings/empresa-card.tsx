'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { CircleAlert, Loader2, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
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
import { LogoUpload } from '@/components/settings/logo-upload'
import {
  UNIDADES_FEDERATIVAS,
  empresaSchema,
  type EmpresaFormInput,
  type EmpresaFormValues,
} from '@/lib/validations/empresa'
import {
  cursorDepoisDaMascara,
  formatarCEP,
  formatarCNPJ,
  formatarTelefone,
  type Mascara,
} from '@/lib/validations/mascaras'
import { SEGMENTOS } from '@/lib/validations/onboarding'
import { buscarEnderecoPorCep } from '@/lib/enderecos/cep'
import { salvarEmpresa } from '@/lib/workspace/empresa'

/** Limite real da coluna `descricao` no banco. */
const MAX_DESCRICAO = 500

export type DadosIniciaisDaEmpresa = EmpresaFormInput & { logoUrl: string | null }

export function EmpresaCard({
  inicial,
  isAdmin,
}: {
  inicial: DadosIniciaisDaEmpresa
  isAdmin: boolean
}) {
  const [salvando, setSalvando] = React.useState(false)
  const [buscandoCep, setBuscandoCep] = React.useState(false)
  const { logoUrl, ...campos } = inicial

  // Já formatado na abertura: o banco guarda dígito puro, e mostrar
  // `12345678000190` num campo de CNPJ obrigaria a pessoa a contar casas.
  const iniciaisFormatados = React.useMemo<EmpresaFormInput>(
    () => ({
      ...campos,
      cnpj: campos.cnpj ? formatarCNPJ(String(campos.cnpj)) : '',
      cep: campos.cep ? formatarCEP(String(campos.cep)) : '',
      whatsapp: campos.whatsapp ? formatarTelefone(String(campos.whatsapp)) : '',
      telefone: campos.telefone ? formatarTelefone(String(campos.telefone)) : '',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm<EmpresaFormInput, unknown, EmpresaFormValues>({
    resolver: zodResolver(empresaSchema),
    defaultValues: iniciaisFormatados,
    // No blur, não só no envio: descobrir seis erros de uma vez ao apertar
    // salvar é pior do que corrigir um de cada vez, na hora.
    mode: 'onBlur',
  })

  const descricao = useWatch({ control, name: 'descricao' }) ?? ''

  /**
   * Aplica a máscara e devolve o cursor ao lugar.
   *
   * Sem `setSelectionRange`, o navegador joga o cursor para o fim a cada tecla
   * e corrigir o meio de um CNPJ fica impossível.
   */
  function comMascara(campo: 'cnpj' | 'cep' | 'whatsapp' | 'telefone', mascara: Mascara) {
    return (evento: React.ChangeEvent<HTMLInputElement>) => {
      const alvo = evento.target
      const digitado = alvo.value
      const posicao = alvo.selectionStart ?? digitado.length
      const formatado = mascara(digitado)

      setValue(campo, formatado, { shouldDirty: true, shouldValidate: false })

      const novaPosicao = cursorDepoisDaMascara(digitado, posicao, formatado)
      // Depois do próximo quadro: antes disso o React ainda não escreveu o
      // valor novo no DOM e o `setSelectionRange` seria descartado.
      requestAnimationFrame(() => alvo.setSelectionRange(novaPosicao, novaPosicao))
    }
  }

  // Cancela a busca anterior quando a pessoa continua digitando: sem isso uma
  // resposta atrasada de um CEP incompleto sobrescreveria o endereço certo.
  const buscaEmCurso = React.useRef<AbortController | null>(null)

  async function talvezBuscarCep(valor: string) {
    const digitos = valor.replace(/\D/g, '')
    if (digitos.length !== 8) return

    buscaEmCurso.current?.abort()
    const controlador = new AbortController()
    buscaEmCurso.current = controlador

    setBuscandoCep(true)
    const encontrado = await buscarEnderecoPorCep(digitos, controlador.signal)
    setBuscandoCep(false)

    if (!encontrado) return

    // Só campo VAZIO. Sobrescrever o que a pessoa digitou — um complemento, um
    // nome de rua corrigido à mão — é pior do que não preencher.
    const preencherSeVazio = (campo: 'endereco' | 'bairro' | 'cidade' | 'estado', v: string) => {
      if (!v) return
      const atual = getValues(campo)
      if (atual && String(atual).trim() !== '') return
      setValue(campo, v, { shouldDirty: true })
    }

    preencherSeVazio('endereco', encontrado.endereco)
    preencherSeVazio('bairro', encontrado.bairro)
    preencherSeVazio('cidade', encontrado.cidade)
    preencherSeVazio('estado', encontrado.estado)
  }

  async function onSubmit(values: EmpresaFormValues) {
    setSalvando(true)
    try {
      const resultado = await salvarEmpresa(values)

      if ('error' in resultado) {
        toast.error(resultado.error)
        return
      }

      toast.success('Alterações salvas.')
      // Reancora no que foi salvo, senão `isDirty` continua verdadeiro e a
      // barra insiste que há alteração pendente.
      reset(getValues())
    } finally {
      setSalvando(false)
    }
  }

  // Fechar a aba com alteração pendente. Navegação interna do Next NÃO dispara
  // este evento — é limitação conhecida, não descuido.
  React.useEffect(() => {
    if (!isDirty) return

    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [isDirty])

  const bloqueado = !isAdmin || salvando

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade</CardTitle>
        </CardHeader>
        <CardContent>
          <LogoUpload urlInicial={logoUrl} isAdmin={isAdmin} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações básicas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo id="name" rotulo="Nome da empresa" erro={errors.name?.message} obrigatorio>
            <Input id="name" disabled={bloqueado} {...register('name')} />
          </Campo>

          <Campo id="nome_fantasia" rotulo="Nome fantasia" ajuda="Opcional">
            <Input id="nome_fantasia" disabled={bloqueado} {...register('nome_fantasia')} />
          </Campo>

          <Campo id="cnpj" rotulo="CNPJ" ajuda="Opcional" erro={errors.cnpj?.message}>
            <Input
              id="cnpj"
              inputMode="numeric"
              placeholder="00.000.000/0001-00"
              disabled={bloqueado}
              {...register('cnpj')}
              onChange={comMascara('cnpj', formatarCNPJ)}
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
                  disabled={bloqueado}
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
            ajuda={`${String(descricao ?? '').length}/${MAX_DESCRICAO}`}
          >
            <Textarea
              id="descricao"
              rows={3}
              maxLength={MAX_DESCRICAO}
              placeholder="O que sua empresa faz, em uma frase."
              disabled={bloqueado}
              {...register('descricao')}
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contato comercial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo id="email_comercial" rotulo="E-mail" erro={errors.email_comercial?.message}>
            <Input
              id="email_comercial"
              type="email"
              inputMode="email"
              placeholder="contato@suaempresa.com.br"
              disabled={bloqueado}
              {...register('email_comercial')}
            />
          </Campo>

          <Campo id="whatsapp" rotulo="WhatsApp" erro={errors.whatsapp?.message}>
            <Input
              id="whatsapp"
              inputMode="tel"
              placeholder="(11) 98888-7777"
              disabled={bloqueado}
              {...register('whatsapp')}
              onChange={comMascara('whatsapp', formatarTelefone)}
            />
          </Campo>

          <Campo id="telefone" rotulo="Telefone" erro={errors.telefone?.message}>
            <Input
              id="telefone"
              inputMode="tel"
              placeholder="(11) 3333-4444"
              disabled={bloqueado}
              {...register('telefone')}
              onChange={comMascara('telefone', formatarTelefone)}
            />
          </Campo>

          <Campo id="site" rotulo="Site" erro={errors.site?.message}>
            <Input
              id="site"
              inputMode="url"
              placeholder="suaempresa.com.br"
              disabled={bloqueado}
              {...register('site')}
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="cep"
            rotulo="CEP"
            erro={errors.cep?.message}
            ajuda={buscandoCep ? 'Buscando endereço…' : undefined}
          >
            <div className="relative">
              <Input
                id="cep"
                inputMode="numeric"
                placeholder="00000-000"
                disabled={bloqueado}
                {...register('cep')}
                onChange={(e) => {
                  comMascara('cep', formatarCEP)(e)
                  void talvezBuscarCep(e.target.value)
                }}
              />
              {buscandoCep && (
                <Search
                  aria-hidden
                  className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-pulse"
                />
              )}
            </div>
          </Campo>

          <Campo id="endereco" rotulo="Endereço">
            <Input id="endereco" disabled={bloqueado} {...register('endereco')} />
          </Campo>

          <Campo id="numero" rotulo="Número">
            <Input id="numero" disabled={bloqueado} {...register('numero')} />
          </Campo>

          <Campo id="complemento" rotulo="Complemento">
            <Input id="complemento" disabled={bloqueado} {...register('complemento')} />
          </Campo>

          <Campo id="bairro" rotulo="Bairro">
            <Input id="bairro" disabled={bloqueado} {...register('bairro')} />
          </Campo>

          <Campo id="cidade" rotulo="Cidade">
            <Input id="cidade" disabled={bloqueado} {...register('cidade')} />
          </Campo>

          {/* Select e não texto: o campo aceitava duas letras quaisquer, e
              digitar "XX" só falhava na validação. O select impede o erro em
              vez de avisá-lo. Mostra o nome, guarda a sigla. */}
          <Campo id="estado" rotulo="Estado" erro={errors.estado?.message}>
            <Controller
              name="estado"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  disabled={bloqueado}
                >
                  <SelectTrigger id="estado" className="w-full">
                    <SelectValue placeholder="Selecione">
                      {(v) =>
                        UNIDADES_FEDERATIVAS.find((u) => u.sigla === v)?.nome ?? 'Selecione'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_FEDERATIVAS.map((u) => (
                      <SelectItem key={u.sigla} value={u.sigla}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>
        </CardContent>
      </Card>

      {/* Barra colada no rodapé: num formulário de 18 campos, o botão no fim
          do rolo obriga a descer até o fim para salvar uma correção feita no
          começo. */}
      {isAdmin ? (
        <div className="bg-background/95 border-border/60 sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6">
          <span
            // `aria-live` porque o aviso aparece sem a pessoa ter navegado até
            // ele — quem usa leitor de tela precisa ser informado.
            aria-live="polite"
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            {isDirty && (
              <>
                <CircleAlert aria-hidden className="size-3.5" />
                Alterações não salvas
              </>
            )}
          </span>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={salvando || !isDirty}
              onClick={() => reset(iniciaisFormatados)}
            >
              Descartar
            </Button>
            <Button type="submit" disabled={salvando || !isDirty}>
              {salvando && <Loader2 className="size-4 animate-spin" />}
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Só o administrador da empresa pode alterar estes dados.
        </p>
      )}
    </form>
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
  /** Texto curto ao lado do rótulo — "Opcional", contador, "Buscando…". */
  ajuda?: string
  obrigatorio?: boolean
  largura?: 'meia' | 'cheia'
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', largura === 'cheia' && 'sm:col-span-2')}>
      {/* Rótulo e auxiliar na MESMA linha, encostados: o "Opcional" jogado na
          outra ponta do campo perde a associação com o rótulo — a pessoa lê
          duas informações soltas em vez de uma. */}
      <div className="flex items-baseline gap-2">
        <Label htmlFor={id}>
          {rotulo}
          {obrigatorio && (
            <span aria-hidden className="text-muted-foreground ml-0.5">
              *
            </span>
          )}
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
