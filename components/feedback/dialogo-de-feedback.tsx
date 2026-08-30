'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Bug, FileText, ImageIcon, Lightbulb, Loader2, MessageSquarePlus, Paperclip, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { enviarFeedback } from '@/lib/feedback/actions'
import { feedbackSchema, type FeedbackValues, type TipoDeFeedback } from '@/lib/validations/feedback'
import { cn } from '@/lib/utils'
import {
  ANEXO_QUANTIDADE_MAXIMA,
  ANEXO_TAMANHO_MAXIMO,
  formatarTamanho,
} from '@/lib/storage/anexo-de-feedback'

/**
 * O canal do cliente para falar com o suporte, de dentro do produto.
 *
 * ## Por que ele existe
 *
 * Até 30/08 o único canal permanente vivia no rodapé da LANDING: quem já era
 * cliente, logado, precisava SAIR do produto para achar o e-mail. A única
 * menção interna estava em `pagar-dialog.tsx`, visível só para quem tentou
 * pagar e viu dar errado.
 *
 * ## As três decisões de tela, e o que cada uma evita
 *
 * **O texto explica ANTES do campo.** Um `textarea` em branco sem contexto faz
 * a pessoa não saber o que escrever nem o que esperar depois — e o pior
 * desfecho aqui não é o relato ruim, é o silêncio.
 *
 * **A escolha do tipo são dois botões, não um `select`.** São duas opções, e
 * `select` esconderia metade atrás de um clique. Além disso os dois têm
 * consequências diferentes (só "problema" avisa por e-mail), então precisam
 * ser lidos lado a lado para a escolha ser informada.
 *
 * **A confirmação diz o que acontece a seguir**, não "enviado". "Enviado" é o
 * que o sistema fez; a pessoa quer saber se alguém vai ver. E as duas
 * mensagens são diferentes de propósito: prometer resposta para sugestão seria
 * promessa que não se cumpre.
 */
const TIPOS = [
  {
    valor: 'problema' as const,
    rotulo: 'Tive um problema',
    descricao: 'Algo não funcionou',
    icone: Bug,
  },
  {
    valor: 'sugestao' as const,
    rotulo: 'Tenho uma sugestão',
    descricao: 'Uma ideia para o produto',
    icone: Lightbulb,
  },
]

export function DialogoDeFeedback() {
  const [aberto, setAberto] = React.useState(false)
  const [tipo, setTipo] = React.useState<TipoDeFeedback>('problema')
  const [enviando, setEnviando] = React.useState(false)
  const [anexos, setAnexos] = React.useState<File[]>([])
  const [erroDeAnexo, setErroDeAnexo] = React.useState<string | null>(null)
  const campoDeArquivo = React.useRef<HTMLInputElement>(null)
  const pathname = usePathname()

  /**
   * Recusa no NAVEGADOR o que dá para recusar sem subir nada.
   *
   * Um arquivo de 40 MB rejeitado aqui custa um segundo; rejeitado no servidor
   * custa a subida inteira antes de dizer não. Mas isto é conveniência, não
   * segurança — o servidor revalida pelos BYTES, porque medição do cliente é
   * informação e não permissão (lição de 20/08, quando um 720×720 declarado
   * como 1080×1080 passou e entrou na biblioteca).
   */
  function acrescentarArquivos(escolhidos: FileList | null) {
    if (!escolhidos || escolhidos.length === 0) return
    setErroDeAnexo(null)

    const novos: File[] = []
    for (const arquivo of Array.from(escolhidos)) {
      if (anexos.length + novos.length >= ANEXO_QUANTIDADE_MAXIMA) {
        setErroDeAnexo(`Máximo de ${ANEXO_QUANTIDADE_MAXIMA} arquivos.`)
        break
      }
      if (arquivo.size > ANEXO_TAMANHO_MAXIMO) {
        setErroDeAnexo(`${arquivo.name} tem mais de 10 MB.`)
        continue
      }
      novos.push(arquivo)
    }

    if (novos.length > 0) setAnexos((atual) => [...atual, ...novos])
    // Zera o input: sem isto, escolher o MESMO arquivo de novo depois de
    // removê-lo não dispara `change`, e a pessoa clica achando que travou.
    if (campoDeArquivo.current) campoDeArquivo.current.value = ''
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { tipo: 'problema', mensagem: '' },
  })

  async function onSubmit(values: FeedbackValues) {
    setEnviando(true)

    // `FormData` é o único jeito de um arquivo atravessar uma Server Action.
    // `tipo` vive em `useState` e não no formulário porque a escolha é por
    // botão — mas o schema exige os dois juntos, e é ele que o servidor
    // revalida do outro lado.
    const formulario = new FormData()
    formulario.set('tipo', tipo)
    formulario.set('mensagem', values.mensagem)
    formulario.set('rota', pathname)
    for (const arquivo of anexos) formulario.append('anexos', arquivo)

    const resultado = await enviarFeedback(formulario)
    setEnviando(false)

    if (resultado?.error) {
      toast.error(resultado.error)
      return
    }

    toast.success(
      tipo === 'problema'
        ? 'Recebemos. Já fomos avisados e respondemos no seu e-mail.'
        : 'Sugestão registrada. Toda ideia é lida antes de decidirmos o que construir.',
    )
    setAberto(false)
    reset()
    setTipo('problema')
    setAnexos([])
    setErroDeAnexo(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        // `min-h-11` (44px) em telefone: a regra de alvo de toque já aplicada
        // em `select.tsx`, `combobox.tsx` e `month-grid.tsx` depois da
        // auditoria de 18/08. `md:` volta ao compacto, onde o alvo é o mouse.
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors md:min-h-9"
      >
        <MessageSquarePlus aria-hidden className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Ajuda e sugestões</span>
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fale com a gente</DialogTitle>
            {/* Diz para onde vai e quem lê, ANTES de pedir o texto. Sem isso a
                pessoa escreve sem saber se alguém do outro lado existe — e a
                dúvida é o que faz desistir de escrever. */}
            <DialogDescription>
              Sua mensagem vai direto para quem cuida do Velo Funil. Não é robô.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">O que você quer contar?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TIPOS.map((opcao) => {
                  const Icone = opcao.icone
                  const escolhido = tipo === opcao.valor
                  return (
                    <button
                      key={opcao.valor}
                      type="button"
                      // `aria-pressed` e não `role="radio"`: são botões de
                      // alternância de verdade, e um `radiogroup` incompleto
                      // (sem navegação por seta) confunde leitor de tela mais
                      // do que ajuda.
                      aria-pressed={escolhido}
                      onClick={() => setTipo(opcao.valor)}
                      disabled={enviando}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                        escolhido
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-input text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icone
                        aria-hidden
                        className={cn('size-4 shrink-0', escolhido && 'text-primary')}
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{opcao.rotulo}</span>
                        <span className="text-muted-foreground text-xs">{opcao.descricao}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mensagem">
                {tipo === 'problema' ? 'O que aconteceu?' : 'Qual é a sua ideia?'}
              </Label>
              <Textarea
                id="mensagem"
                rows={5}
                // O placeholder muda com o tipo porque a pergunta é outra. No
                // problema ele pede o que mais falta em relato real: o que a
                // pessoa esperava que acontecesse.
                placeholder={
                  tipo === 'problema'
                    ? 'Conte o que você tentou fazer e o que aconteceu no lugar.'
                    : 'O que facilitaria o seu dia aqui dentro?'
                }
                aria-invalid={!!errors.mensagem}
                disabled={enviando}
                {...register('mensagem')}
              />
              {errors.mensagem && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.mensagem.message}
                </p>
              )}
              {/* Dito na cara, e é o que evita a pergunta "como vocês sabem
                  qual tela?" — além de ser transparência sobre o que é
                  coletado, que a LGPD pede. Nenhum dado do conteúdo do CRM
                  (nome de cliente, valor de negócio) vai junto. */}
              <p className="text-muted-foreground text-xs">
                Enviamos junto a tela em que você está e seu plano, para não
                precisar perguntar depois.
              </p>
            </div>

            {/* ## Anexos
                Botão de escolher, NÃO área de arrastar. O diálogo é estreito
                (`sm:max-w-lg`) e metade do público está no celular, onde
                arrastar não existe — uma zona grande de soltar tomaria espaço
                do campo de texto, que é o que importa, para servir um gesto
                que só metade consegue fazer. */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="anexos">Anexos (opcional)</Label>
                <span className="text-muted-foreground text-xs">
                  PNG, JPG, WEBP ou PDF até 10 MB
                </span>
              </div>

              {/* `sr-only` e não `hidden`: campo escondido com `display:none`
                  some da árvore de acessibilidade e deixa de ser alcançável
                  por teclado e leitor de tela. */}
              <input
                ref={campoDeArquivo}
                id="anexos"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="sr-only"
                disabled={enviando || anexos.length >= ANEXO_QUANTIDADE_MAXIMA}
                onChange={(e) => acrescentarArquivos(e.target.files)}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={enviando || anexos.length >= ANEXO_QUANTIDADE_MAXIMA}
                onClick={() => campoDeArquivo.current?.click()}
              >
                <Paperclip className="size-4" />
                {anexos.length === 0 ? 'Anexar print ou PDF' : 'Anexar mais'}
              </Button>

              {erroDeAnexo && (
                // `role="alert"` porque erro só visual não é anunciado por
                // leitor de tela, e a mensagem nomeia o ARQUIVO: "um arquivo
                // falhou" não diz qual dos três.
                <p role="alert" className="text-destructive text-xs">
                  {erroDeAnexo}
                </p>
              )}

              {anexos.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {anexos.map((arquivo, indice) => {
                    const ehImagem = arquivo.type.startsWith('image/')
                    const Icone = ehImagem ? ImageIcon : FileText
                    return (
                      <li
                        key={`${arquivo.name}-${indice}`}
                        className="border-border flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
                      >
                        <Icone aria-hidden className="text-muted-foreground size-4 shrink-0" />
                        <span className="flex-1 truncate text-sm">{arquivo.name}</span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {formatarTamanho(arquivo.size)}
                        </span>
                        <button
                          type="button"
                          // 44px de alvo: a regra de toque do projeto. O ícone
                          // é pequeno, a área de clique não.
                          className="text-muted-foreground hover:text-foreground -m-2 shrink-0 p-2 transition-colors"
                          aria-label={`Remover ${arquivo.name}`}
                          disabled={enviando}
                          onClick={() => {
                            setAnexos((atual) => atual.filter((_, i) => i !== indice))
                            setErroDeAnexo(null)
                          }}
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={enviando}>
                {enviando && <Loader2 className="size-4 animate-spin" />}
                Enviar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
