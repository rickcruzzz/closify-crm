'use client'

import * as React from 'react'
import { Check, Circle, Copy, Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  avaliarSenha,
  requisitosDaSenha,
  type NivelSenha,
} from '@/lib/password-strength'

const CORES: Record<NivelSenha, { barra: string; texto: string }> = {
  fraca: { barra: 'bg-red-500', texto: 'text-red-500 dark:text-red-400' },
  media: { barra: 'bg-amber-500', texto: 'text-amber-500 dark:text-amber-400' },
  forte: { barra: 'bg-emerald-500', texto: 'text-emerald-500 dark:text-emerald-400' },
}

/**
 * Campo de senha com medidor de força.
 *
 * Não gera senha. O botão "Sugerir senha forte" existiu e foi retirado: senha
 * que a pessoa não escolheu é senha que ela não decora, e o que acontece
 * depois é ela anotar num papel, guardar num bloco de notas sem proteção, ou
 * pedir recuperação toda vez que entra. Nenhum desses desfechos é mais seguro
 * do que uma senha escolhida por ela e medida aqui na tela.
 *
 * O que sobra é o que importa: mostrar a força enquanto digita, e recusar
 * senha derivada do e-mail, regra que vive nos schemas de validação, não
 * aqui, porque precisa valer também para quem chama a Server Action direto.
 */
export function PasswordField({
  id,
  label,
  valor,
  onChange,
  erro,
  desabilitado,
  autoComplete = 'new-password',
  mostrarForca = false,
}: {
  id: string
  label: string
  valor: string
  onChange: (valor: string) => void
  erro?: string
  desabilitado?: boolean
  autoComplete?: string
  mostrarForca?: boolean
}) {
  const [visivel, setVisivel] = React.useState(false)
  const [copiada, setCopiada] = React.useState(false)
  const forca = avaliarSenha(valor)
  const requisitos = requisitosDaSenha(valor)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiada(true)
      setTimeout(() => setCopiada(false), 2000)
    } catch {
      // Sem permissão de clipboard: a senha está visível na tela de qualquer
      // forma, então não vale interromper o fluxo com um erro.
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>

      <div className="relative">
        <Input
          id={id}
          type={visivel ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="pr-20"
          aria-invalid={!!erro}
          aria-describedby={
            [erro ? `${id}-erro` : null, mostrarForca && valor ? `${id}-forca` : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          disabled={desabilitado}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />

        {/* ## Alvo de 44px sem crescer um pixel na tela
            `size="icon-sm"` desenha 36px no celular. O mínimo de toque é 44, e
            estes dois botões vivem dentro dos DOIS campos de senha do
            cadastro — o passo de maior atrito de todo o funil pago, e o último
            lugar onde vale economizar precisão de dedo.
            Aumentar o botão não serve: o campo tem `h-11` (44px) e dois
            controles de 44px lado a lado dentro dele comeriam a área onde a
            senha é digitada. `after:-inset-1` estende só a REGIÃO CLICÁVEL em
            4px por lado (36 + 8 = 44) sem mexer no desenho.
            Some em `md:`, onde o apontador é mouse e a regra não se aplica —
            mesma divisão da correção de alvo de toque de 18/08. */}
        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
          {valor && visivel && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="relative after:absolute after:-inset-1 after:content-[''] md:after:hidden"
              aria-label={copiada ? 'Senha copiada' : 'Copiar senha'}
              onClick={copiar}
              disabled={desabilitado}
            >
              {copiada ? (
                <Check aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy aria-hidden className="size-4" />
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="relative after:absolute after:-inset-1 after:content-[''] md:after:hidden"
            aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setVisivel((v) => !v)}
            disabled={desabilitado}
          >
            {visivel ? (
              <EyeOff aria-hidden className="size-4" />
            ) : (
              <Eye aria-hidden className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {mostrarForca && valor && (
        // `aria-live` para leitor de tela anunciar a mudança: sem isso a
        // informação existe só como cor, e cor sozinha não comunica.
        <div id={`${id}-forca`} aria-live="polite" className="flex flex-col gap-2">
          <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                CORES[forca.nivel].barra,
              )}
              style={{ width: `${forca.percentual}%` }}
            />
          </div>

          {/* ## Checklist item a item, não uma frase de sugestão

              Antes havia só "Senha fraca. Adicione mais caracteres e uma
              maiúscula." — o veredito e, no máximo, duas faltas de cada vez. A
              pessoa corrigia uma, a frase trocava, e ela não tinha como saber
              quantas ainda faltavam nem quando ia acabar.

              A lista resolve isso mostrando tudo de uma vez e marcando o item
              no caractere em que ele passa a valer. É o padrão que todo mundo
              já viu (gov.br, banco), e o reconhecimento vale mais aqui do que
              qualquer invenção.

              O que este NÃO copia daquele padrão é a obrigatoriedade: só o
              tamanho trava o cadastro. Ver `requisitosDaSenha` para o porquê —
              regra que bloqueia produz senha anotada em papel e abandono no
              único funil que este produto tem. */}
          <ul className="flex flex-col gap-1">
            {requisitos.map((r) => (
              <li
                key={r.id}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  r.atendido
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground',
                )}
              >
                {/* Ícone E cor, nunca só cor: 8% dos homens têm alguma forma de
                    daltonismo, e verde/cinza é justamente o par que mais some.
                    A marca desenha a diferença; a cor reforça. */}
                {r.atendido ? (
                  <Check aria-hidden className="size-3.5 shrink-0" />
                ) : (
                  <Circle aria-hidden className="size-3.5 shrink-0 opacity-40" />
                )}
                <span>{r.rotulo}</span>
                {!r.obrigatorio && (
                  <span className="text-muted-foreground">(opcional)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {erro && (
        <p id={`${id}-erro`} role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      )}
    </div>
  )
}
