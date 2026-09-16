'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Crown, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DESTINO_DO_UPGRADE } from '@/lib/plans'
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
import { Textarea } from '@/components/ui/textarea'
import {
  emailMessageSchema,
  type EmailMessageFormInput,
  type EmailMessageFormValues,
} from '@/lib/validations/email'

/**
 * Os tres e-mails que este ICP de fato manda.
 *
 * ## Por que modelo, e nao folha em branco
 *
 * O dialogo abria com dois campos vazios, sem placeholder e sem pista. Quem
 * abre para cobrar um orcamento comeca do zero toda vez — e escrever do zero e
 * exatamente o atrito que faz a pessoa voltar para o WhatsApp.
 *
 * Os tres saem do que o produto existe para resolver, medido em 08/09 sobre 25
 * geradores de orcamento: 88% geram o PDF, 48% guardam a validade e **nenhum
 * avisa antes de vencer**. Cobrar retorno de orcamento e o e-mail mais mandado
 * aqui, e e o unico que a concorrencia nao ajuda a escrever.
 *
 * ## O que eles NAO fazem
 *
 * Nao mandam sozinhos e nao travam nada: preenchem os dois campos e continuam
 * editaveis. Modelo que nao da para editar vira mensagem de robo, e o remetente
 * e a conta pessoal de Gmail de quem clicou — o nome dele e que assina.
 */
const MODELOS: {
  rotulo: string
  assunto: (nome: string) => string
  corpo: (nome: string) => string
}[] = [
  {
    rotulo: 'Enviar o orçamento',
    assunto: () => 'Seu orçamento',
    corpo: (nome) =>
      `Oi, ${nome}!

Segue o orçamento que combinamos. Qualquer dúvida sobre valores ou prazo, é só responder este e-mail.

Fico no aguardo.`,
  },
  {
    rotulo: 'Saber se recebeu',
    assunto: () => 'Você chegou a ver o orçamento?',
    corpo: (nome) =>
      `Oi, ${nome}!

Só passando para saber se o orçamento chegou certinho e se ficou alguma dúvida.

Se precisar ajustar alguma coisa, me fala que eu refaço.`,
  },
  {
    rotulo: 'O prazo está acabando',
    assunto: () => 'O prazo do seu orçamento está acabando',
    corpo: (nome) =>
      `Oi, ${nome}!

O orçamento que te mandei vence em breve, e depois disso os valores podem mudar.

Se ainda fizer sentido para você, me avisa que eu garanto as condições.`,
  },
]

/**
 * O primeiro nome, para a saudação.
 *
 * "Oi, Carlos Eduardo Lima da Silva!" denuncia máquina — e o corpo de
 * prospecção deste projeto já pagou isso em 08/09, quando 44 de 790 mensagens
 * saudavam em CAIXA ALTA. Sem nome, cai em "tudo bem?", que funciona sozinho.
 */
function primeiroNome(nome: string | null | undefined): string {
  const limpo = (nome ?? '').trim().split(/\s+/)[0] ?? ''
  return limpo || 'tudo bem?'
}

export function SendEmailDialog({
  open,
  onOpenChange,
  remetente,
  temPro,
  destinatario,
  nomeDoContato,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** E-mail da conta Gmail conectada. `null` quando ninguém conectou ainda. */
  remetente: string | null
  /**
   * Pro vigente. Decide QUAL beco a mensagem evita.
   *
   * Sem isto o dialogo dizia sempre "Conecte o Gmail em Configuracoes" — e no
   * Free nao ha o que conectar: Gmail e recurso Pro, e a tela de Integracoes
   * recusa a conexao. A instrucao mandava a pessoa a uma porta trancada e a
   * deixava la, sem dizer que a chave e o plano.
   */
  temPro: boolean
  /** Só para mostrar pra quem vai, o e-mail de verdade sai do lead no servidor. */
  destinatario: string
  /**
   * Nome do contato, para os modelos e para a linha "Para".
   *
   * O diálogo mostrava só o endereço, e endereço não é como se pensa em
   * alguém: "fulano@corp.com.nr" exige traduzir de volta para a pessoa que se
   * tem em mente. O nome vem primeiro e o endereço fica ao lado, que é a ordem
   * que toda caixa de e-mail usa.
   */
  nomeDoContato?: string | null
  onSend: (values: EmailMessageFormValues) => void | Promise<void>
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EmailMessageFormInput, unknown, EmailMessageFormValues>({
    resolver: zodResolver(emailMessageSchema),
    defaultValues: { assunto: '', corpo: '' },
  })

  React.useEffect(() => {
    if (open) reset({ assunto: '', corpo: '' })
  }, [open, reset])

  async function onSubmit(values: EmailMessageFormValues) {
    setIsSubmitting(true)
    try {
      await onSend(values)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar e-mail</DialogTitle>
          <DialogDescription>
            {remetente
              ? 'Este e-mail sai da sua conta do Gmail conectada.'
              : temPro
                ? 'Conecte o Gmail em Configurações para enviar.'
                : 'Enviar e-mail pelo Gmail é um recurso do plano Pro.'}
          </DialogDescription>
        </DialogHeader>

        {/* "De → Para" visível antes de escrever, não só depois de enviar:
            quem manda vê exatamente qual conta vai aparecer como remetente
            para o cliente, sem precisar adivinhar ou abrir Configurações. */}
        <div className="bg-muted/50 flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground w-10 shrink-0 text-xs font-medium">
              De
            </span>
            <span className="truncate font-medium">
              {remetente ?? (temPro ? 'Gmail não conectado' : 'Disponível no plano Pro')}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground w-10 shrink-0 text-xs font-medium">
              Para
            </span>
            {/* Nome antes do endereço: o diálogo mostrava só
                `fulano@corp.com.br`, e endereço obriga a traduzir de volta para
                a pessoa que se tem em mente. É a ordem que toda caixa de
                e-mail usa. */}
            <span className="min-w-0 truncate">
              {nomeDoContato && <span className="font-medium">{nomeDoContato} </span>}
              <span
                className={
                  nomeDoContato ? 'text-muted-foreground text-xs' : 'font-medium'
                }
              >
                {nomeDoContato ? `<${destinatario}>` : destinatario}
              </span>
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Começar de um modelo</span>
            <div className="flex flex-wrap gap-2">
              {MODELOS.map((modelo) => (
                <Button
                  key={modelo.rotulo}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => {
                    const nome = primeiroNome(nomeDoContato)
                    // `shouldDirty` para a validação do zod rodar: sem isso o
                    // formulário continuaria achando que os campos estão vazios.
                    setValue('assunto', modelo.assunto(nome), { shouldDirty: true })
                    setValue('corpo', modelo.corpo(nome), { shouldDirty: true })
                  }}
                >
                  {modelo.rotulo}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assunto">Assunto</Label>
            <Input
              id="assunto"
              placeholder="Seu orçamento"
              aria-invalid={!!errors.assunto}
              disabled={isSubmitting}
              {...register('assunto')}
            />
            {errors.assunto && (
              <p role="alert" className="text-destructive text-xs">
                {errors.assunto.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="corpo">Mensagem</Label>
            <Textarea
              id="corpo"
              rows={8}
              placeholder={`Oi, ${primeiroNome(nomeDoContato)}!`}
              aria-invalid={!!errors.corpo}
              disabled={isSubmitting}
              {...register('corpo')}
            />
            {errors.corpo && (
              <p role="alert" className="text-destructive text-xs">
                {errors.corpo.message}
              </p>
            )}
          </div>

          <DialogFooter>
            {/* O botão diz PARA QUEM: "Enviar" sozinho num diálogo que pode
                ter sido aberto de outra tela não confirma o destinatário no
                momento em que a ação acontece. */}
            {/* ## O botao muda de TRABALHO quando falta o plano
                
                Desabilitado, ele dizia "Enviar para Fulano" e nao fazia nada:
                a pessoa lia que o Gmail nao esta conectado, via um botao
                apagado, e nao tinha para onde ir. `workspace-switcher.tsx` ja
                registra a licao em comentario — "dizer 'faca upgrade' sem
                mostrar onde deixa a pessoa num beco".
                
                Com o Pro vigente e sem Gmail conectado o botao continua
                desabilitado, e ai esta certo: o caminho e Configuracoes, que a
                propria descricao acima ja nomeia. */}
            {!remetente && !temPro ? (
              <Button
                type="button"
                onClick={() => (window.location.href = DESTINO_DO_UPGRADE)}
              >
                <Crown aria-hidden className="size-4" />
                Conhecer o plano Pro
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting || !remetente}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {nomeDoContato ? `Enviar para ${primeiroNome(nomeDoContato)}` : 'Enviar'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
