'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, Zap } from 'lucide-react'

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
import { createCheckout } from '@/lib/asaas/actions'
import { PagarDialog } from '@/components/settings/pagar-dialog'
import { checkoutSchema, type CheckoutValues } from '@/lib/validations/billing'
import { PRO_PLAN_PRICE } from '@/lib/plans'
import { formatarCpfCnpj } from '@/lib/documento-br'
import { CONTROLADOR, identificacaoDoControlador } from '@/lib/legal'
import { cn } from '@/lib/utils'

/**
 * Botão que abre o checkout do Asaas.
 *
 * `className` existe para o mesmo componente servir na tela de Cobrança (onde
 * o botão é `w-fit`) e no card de Plano em Configurações (onde ocupa a
 * largura toda no celular). Duplicar o componente para mudar uma classe
 * significaria manter duas cópias da validação de CPF e do fluxo de checkout.
 */
export function SubscribeButton({
  className,
  abrirDeInicio = false,
}: {
  className?: string
  /**
   * Já abre o formulário de CPF ao montar.
   *
   * Serve a quem clicou em "Assinar Pro" na landing: essa pessoa atravessa
   * cadastro, e-mail de confirmação e criação de empresa antes de chegar
   * aqui. Fazer ela procurar e clicar de novo, depois de tudo isso, é onde a
   * compra se perde.
   */
  abrirDeInicio?: boolean
}) {
  const [dialogOpen, setDialogOpen] = React.useState(abrirDeInicio)
  const [pagamentoAberto, setPagamentoAberto] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { cpfCnpj: '' },
  })

  /**
   * Cria a assinatura e abre o pagamento AQUI DENTRO.
   *
   * ## O que mudou, e por que
   *
   * Antes esta função abria a fatura do Asaas em outra aba — e precisava abrir
   * a aba ANTES do `await`, porque depois dele o navegador deixa de tratar
   * `window.open` como resposta a um clique e o bloqueador de pop-up mata a
   * janela. Aquilo era contorno para um problema que agora não existe: Pix e
   * boleto acontecem no `PagarDialog`, sem sair do produto.
   *
   * O ganho não é só de fluxo. A página do Asaas exibe o **nome civil do
   * titular** em destaque (para MEI não há nome fantasia na base do CNPJ desde
   * 15/11/2023), e quem clicou em "Assinar o Velo Funil" caía numa tela com o
   * nome de um desconhecido no topo.
   *
   * Cartão continua indo para o Asaas, a partir do próprio diálogo: processar
   * cartão por API colocaria o número no nosso servidor e nos jogaria no
   * escopo do PCI-DSS.
   */
  async function onSubmit(values: CheckoutValues) {
    setIsSubmitting(true)

    const result = await createCheckout(values)

    if (result?.error) {
      toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    // A assinatura existe no Asaas a partir daqui. O diálogo de pagamento
    // busca as três formas da MESMA cobrança e deixa a pessoa escolher.
    setIsSubmitting(false)
    setDialogOpen(false)
    setPagamentoAberto(true)
  }

  return (
    <>
      <PagarDialog open={pagamentoAberto} onOpenChange={setPagamentoAberto} />

      <Button onClick={() => setDialogOpen(true)} className={cn('w-fit', className)}>
        <Zap className="size-4" />
        Assinar Pro por R$ {PRO_PLAN_PRICE}/mês
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assinar plano Pro</DialogTitle>
            <DialogDescription>
              Precisamos do CPF ou CNPJ para emitir a cobrança. Na próxima tela você escolhe
              entre Pix, boleto e cartão.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
              {/* Formata durante a digitação e alterna sozinho para CNPJ ao
                  passar de 11 dígitos. O dígito verificador é conferido no
                  schema, antes de chamar o Asaas: sem isso um número errado só
                  falhava lá, com mensagem genérica que não dizia o que
                  corrigir. */}
              <Controller
                name="cpfCnpj"
                control={control}
                render={({ field }) => (
                  <Input
                    id="cpfCnpj"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    aria-invalid={!!errors.cpfCnpj}
                    disabled={isSubmitting}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(formatarCpfCnpj(e.target.value))}
                  />
                )}
              />
              {errors.cpfCnpj && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.cpfCnpj.message}
                </p>
              )}
            </div>

            {/* Diz de antemão o que aparece na fatura. Em MEI o recebedor é a
                razão social da Receita, não o nome fantasia, quem não sabe
                disso estranha ver um nome de pessoa física na cobrança e
                desiste de pagar, achando que errou de site. */}
            <p className="text-muted-foreground text-xs">
              A cobrança é emitida por {identificacaoDoControlador()}, razão social do{' '}
              {CONTROLADOR.nomeFantasia}.
            </p>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Continuar para pagamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
