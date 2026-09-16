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
import { PagarConteudo } from '@/components/settings/pagar-dialog'
import {
  checkoutSchema,
  type CheckoutInput,
  type CheckoutValues,
} from '@/lib/validations/billing'
import {
  CICLOS,
  PRO_ANUAL_ECONOMIA,
  PRO_ANUAL_MESES_GRATIS,
  PRO_PLAN_PRICE,
} from '@/lib/plans'
import { formatarCpfCnpj } from '@/lib/documento-br'
import { identificacaoComercial } from '@/lib/legal'
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

  /**
   * ## O passo, e por que UM diálogo em vez de dois
   *
   * Até 16/09 eram dois `Dialog` irmãos: o do CPF fechava e o do pagamento
   * abria, com `setDialogOpen(false)` e `setPagamentoAberto(true)` no mesmo
   * lote do React. Um desmontava enquanto o outro montava, e a limpeza do
   * primeiro (restaurar foco, soltar a trava de rolagem) rodava DEPOIS,
   * desfazendo o que o segundo tinha instalado.
   *
   * Na tela: o diálogo sumia e era preciso clicar de novo. **E a assinatura já
   * tinha sido criada no Asaas nesse instante** — a pessoa concluía que falhou
   * no exato ponto em que a venda acontece.
   *
   * Agora o diálogo nunca desmonta; só o conteúdo troca.
   */
  const [passo, setPasso] = React.useState<'dados' | 'pagamento'>('dados')

  /**
   * `useState(abrirDeInicio)` sozinho não bastava: inicializador só roda na
   * MONTAGEM. O CTA da barra lateral navega com `router.push()`, então quem já
   * estava em `/settings/billing` ganhava o parâmetro na URL com o componente
   * montado, e nada abria. `avisarLimite` escapava por acidente, porque usa
   * `window.location.href` e recarrega a página.
   */
  React.useEffect(() => {
    if (abrirDeInicio) setDialogOpen(true)
  }, [abrirDeInicio])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  /**
   * ## Por que o padrão é MENSAL, e não o plano que rende mais
   *
   * Este é o caminho de quem chega sozinho pelo site, sem ninguém ao lado. Uma
   * cobrança de R$ 49 indevida se resolve com um estorno; uma de R$ 490 vira
   * caso de suporte e pedido de reembolso. O lado seguro de errar é o barato.
   *
   * O anual existe para a venda presencial, onde há alguém explicando — e ali
   * a escolha é deliberada, feita na frente do cliente.
   */
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutInput, unknown, CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { cpfCnpj: '', ciclo: 'MONTHLY' },
  })

  const ciclo = watch('ciclo')

  /**
   * Cria a assinatura e abre o pagamento AQUI DENTRO.
   *
   * ## O que mudou, e por que
   *
   * Antes esta função abria a fatura do Asaas em outra aba — e precisava abrir
   * a aba ANTES do `await`, porque depois dele o navegador deixa de tratar
   * `window.open` como resposta a um clique e o bloqueador de pop-up mata a
   * janela. Aquilo era contorno para um problema que agora não existe: Pix e
   * boleto acontecem no mesmo diálogo, sem sair do produto.
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

    // Server Action que REJEITA não passa por nenhum `if` abaixo, e aqui isso
    // custa a venda: o botão de assinar gira para sempre, sem mensagem e sem
    // caminho. Mesma classe do `onSubmit` do cadastro, fechada em 02/09.
    let result: Awaited<ReturnType<typeof createCheckout>>
    try {
      result = await createCheckout(values)
    } catch (err) {
      console.error('createCheckout rejeitou', err)
      setIsSubmitting(false)
      toast.error(
        'Não foi possível abrir o pagamento. Confira sua conexão e tente de novo.',
      )
      return
    }

    if (result?.error) {
      toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    // A assinatura existe no Asaas a partir daqui. O diálogo de pagamento
    // busca as três formas da MESMA cobrança e deixa a pessoa escolher.
    setIsSubmitting(false)
    // O diálogo CONTINUA aberto: só o conteúdo troca. Ver o comentário de
    // `passo` para o defeito que isto fecha.
    setPasso('pagamento')
  }

  return (
    <>
      <Button onClick={() => setDialogOpen(true)} className={cn('w-fit', className)}>
        <Zap className="size-4" />
        Assinar Pro por R$ {PRO_PLAN_PRICE}/mês
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(aberto) => {
          setDialogOpen(aberto)
          // Fechou: o próximo clique começa do início. Sem isto, reabrir caía
          // direto no pagamento de uma cobrança que pode já ter sido paga.
          if (!aberto) setPasso('dados')
        }}
      >
        <DialogContent className="sm:max-w-md">
          {passo === 'dados' ? (
            <>
              <DialogHeader>
                <DialogTitle>Assinar plano Pro</DialogTitle>
                <DialogDescription>
                  Escolha como quer pagar e informe o CPF ou CNPJ. Na próxima tela você
                  escolhe entre Pix, boleto e cartão.
                </DialogDescription>
              </DialogHeader>

              {/* ## A escolha do ciclo vem ANTES do documento
              É a decisão que muda o valor da cobrança; pedi-la depois do CPF
              faria a pessoa preencher um formulário para só então descobrir
              que existia outra opção. */}
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Período da assinatura</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['MONTHLY', 'YEARLY'] as const).map((opcao) => {
                    const escolhido = ciclo === opcao
                    const dados = CICLOS[opcao]
                    return (
                      <button
                        key={opcao}
                        type="button"
                        aria-pressed={escolhido}
                        onClick={() => setValue('ciclo', opcao, { shouldDirty: true })}
                        disabled={isSubmitting}
                        className={cn(
                          // `min-h-11` pelo mesmo motivo do resto do produto: é
                          // alvo de toque, e esta tela é usada no telefone.
                          'flex min-h-11 flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors',
                          escolhido
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-foreground/20',
                        )}
                      >
                        <span className="text-sm font-medium capitalize">
                          {dados.periodo}
                        </span>
                        <span className="text-lg font-semibold tabular-nums">
                          R$ {dados.valor}
                          <span className="text-muted-foreground text-xs font-normal">
                            {dados.sufixo}
                          </span>
                        </span>
                        {opcao === 'YEARLY' && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            {PRO_ANUAL_MESES_GRATIS} meses grátis · economize R${' '}
                            {PRO_ANUAL_ECONOMIA}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

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

                {/* ## Esta linha mostrava o NOME CIVIL do sócio, até 12/09

                `identificacaoDoControlador()` devolve razão social + CNPJ, e a
                razão social aqui é o nome completo de uma pessoa física — o
                padrão da Receita para empresa aberta a partir de firma
                individual. Ela é obrigatória nos Termos e na Privacidade, onde
                o Art. 9º, I pede identificação do controlador.

                Aqui era o oposto do que a tela precisa: relato do dono, o
                cliente lia um nome de pessoa logo acima do botão de continuar,
                e num B2B isso levanta "em quem eu estou pagando?" no pior
                segundo possível.

                O comentário antigo justificava com a regra do MEI — verdadeira
                até 28/08, quando a LTDA entrou.

                O CNPJ fica, e é ele que torna a frase conferível. */}
                <p className="text-muted-foreground text-xs">
                  A cobrança é emitida por {identificacaoComercial()}.
                </p>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Continuar para pagamento
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            // O MESMO diálogo, conteúdo trocado. `open` fica preso em `true`:
            // ele só monta quando o passo virou pagamento, e é o que dispara a
            // busca da cobrança e a vigilância até ela ser paga.
            <PagarConteudo open onOpenChange={setDialogOpen} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
