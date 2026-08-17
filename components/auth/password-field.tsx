'use client'

import * as React from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { avaliarSenha, type NivelSenha } from '@/lib/password-strength'

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

        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
          {valor && visivel && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={copiada ? 'Senha copiada' : 'Copiar senha'}
              onClick={copiar}
              disabled={desabilitado}
            >
              {copiada ? (
                <Check aria-hidden className="size-4 text-emerald-500" />
              ) : (
                <Copy aria-hidden className="size-4" />
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
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
        // `aria-live` para leitor de tela anunciar a mudança de nível: sem
        // isso a informação existe só como cor, e cor sozinha não comunica.
        <div id={`${id}-forca`} aria-live="polite" className="flex flex-col gap-1">
          <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                CORES[forca.nivel].barra,
              )}
              style={{ width: `${forca.percentual}%` }}
            />
          </div>
          <p className="text-xs">
            <span className={cn('font-medium', CORES[forca.nivel].texto)}>
              {forca.rotulo}
            </span>
            {forca.sugestao && (
              <span className="text-muted-foreground"> {forca.sugestao}</span>
            )}
          </p>
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
