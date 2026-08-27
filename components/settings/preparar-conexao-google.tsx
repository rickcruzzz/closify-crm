'use client'

import * as React from 'react'
import { ArrowRight, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * O que vai acontecer na tela do Google, explicado ANTES de sair daqui.
 *
 * ## Por que aqui, e não depois
 *
 * A tela de consentimento do Google mostra **uma caixa por permissão**, e ela
 * não vem marcada. Quem clica em "Continuar" sem marcar recebe um token válido
 * sem a permissão — e antes da guarda no callback, o produto gravava isso como
 * "conectado com sucesso".
 *
 * O erro acontece **na tela do Google**, e de lá o produto não alcança
 * ninguém: não dá para pôr um aviso, destacar a caixa nem detectar o clique.
 * Este diálogo é o último instante em que ainda estamos na frente da pessoa.
 *
 * ## Sem print da tela do Google, por decisão
 *
 * Print seria mais claro para quem não é técnico, e é justamente por isso que
 * envelhece mal: o Google muda esse desenho sem avisar, e nenhum `tsc`, `lint`
 * ou `test` olha dentro de uma imagem. Este projeto já pagou duas vezes por
 * imagem velha — os prints do produto exibiram por meses o jargão que a
 * própria landing tinha banido, e só foram vistos quando alguém abriu o PNG.
 * Print de tela de TERCEIRO é a mesma armadilha, sem nem o commit para
 * comparar.
 *
 * O passo 2 é desenhado com os componentes daqui e não afirma o texto exato
 * que o Google escreve na caixa — afirmar isso seria inventar um detalhe que
 * muda sozinho.
 *
 * ## "Agora não", e não "Pular"
 *
 * O rascunho previa "Pular" ao lado de "Ir para o Google". Os dois levariam ao
 * mesmo lugar: dois controles para um resultado só, que obriga a pessoa a
 * procurar a diferença que não existe. A saída secundária fecha sem conectar,
 * que é a única outra coisa que ela pode querer aqui — e nenhum diálogo
 * committal deste produto fica sem saída visível.
 */
const PASSOS = [
  {
    titulo: 'Escolher sua conta do Google',
    detalhe: 'A mesma que você usa para a agenda ou o e-mail da empresa.',
  },
  {
    titulo: 'Marcar a caixa de permissão',
    // O passo que carrega o peso: é o único ponto do fluxo em que a pessoa
    // pode errar sem receber nenhum aviso do Google.
    detalhe: 'Ela aparece desmarcada. Sem marcar, a conexão não funciona.',
    destacar: true,
  },
  {
    titulo: 'Clicar em Continuar',
    detalhe: 'Você volta para cá sozinho, e a tela avisa que deu certo.',
  },
] as const

export function PrepararConexaoGoogle({
  open,
  onOpenChange,
  titulo,
  href,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Google Calendar" ou "Gmail", para o título dizer o que está conectando. */
  titulo: string
  /** A rota de conexão, que redireciona para o consentimento do Google. */
  href: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar {titulo}</DialogTitle>
          <DialogDescription>
            O Google vai pedir sua permissão em três telas. Leva menos de um minuto.
          </DialogDescription>
        </DialogHeader>

        {/* Lista ordenada de verdade: aqui os números carregam informação, é
            uma sequência real. O marcador nativo é substituído por um círculo
            para caber o alinhamento, e a semântica de `<ol>` fica. */}
        <ol className="flex list-none flex-col gap-4">
          {PASSOS.map((passo, indice) => (
            <li key={passo.titulo} className="flex gap-3">
              <span
                aria-hidden
                className="bg-muted text-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums"
              >
                {indice + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium">{passo.titulo}</span>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {passo.detalhe}
                </p>

                {/* A ilustração da caixa marcada. Deliberadamente NÃO escreve o
                    texto que o Google põe ao lado dela: esse texto muda sem
                    aviso, e afirmá-lo aqui seria inventar um detalhe que
                    envelhece sozinho. O que a pessoa precisa reconhecer é a
                    forma — uma caixinha para marcar. */}
                {'destacar' in passo && passo.destacar && (
                  <div className="border-border bg-muted/40 mt-1 flex items-center gap-2 rounded-md border p-2.5">
                    <span
                      aria-hidden
                      className="bg-primary text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded-[4px]"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className="text-muted-foreground text-xs">
                      a permissão que o Google mostrar, marcada
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 md:min-h-9"
            onClick={() => onOpenChange(false)}
          >
            Agora não
          </Button>
          {/* `<a>` de verdade, não `router.push`: a rota de conexão responde
              com um redirect para fora do domínio, e navegação do App Router
              não sai do site. É também o que faz "abrir em nova aba" e o
              teclado funcionarem. */}
          <Button className="min-h-11 md:min-h-9" render={<a href={href} />}>
            Ir para o Google
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
