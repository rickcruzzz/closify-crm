'use client'

import * as React from 'react'
import { Check, Copy, Eye, EyeOff, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { avaliarSenha, gerarSenhaForte, type NivelSenha } from '@/lib/password-strength'

const CORES: Record<NivelSenha, { barra: string; texto: string }> = {
  fraca: { barra: 'bg-red-500', texto: 'text-red-500 dark:text-red-400' },
  media: { barra: 'bg-amber-500', texto: 'text-amber-500 dark:text-amber-400' },
  forte: { barra: 'bg-emerald-500', texto: 'text-emerald-500 dark:text-emerald-400' },
}

export function PasswordField({
  id,
  label,
  valor,
  onChange,
  onSugerir,
  erro,
  desabilitado,
  autoComplete = 'new-password',
  mostrarForca = false,
  permitirSugestao = false,
}: {
  id: string
  label: string
  valor: string
  onChange: (valor: string) => void
  /** Chamado junto com a senha gerada, para preencher também a confirmação. */
  onSugerir?: (senha: string) => void
  erro?: string
  desabilitado?: boolean
  autoComplete?: string
  mostrarForca?: boolean
  permitirSugestao?: boolean
}) {
  const [visivel, setVisivel] = React.useState(false)
  const [copiada, setCopiada] = React.useState(false)
  const forca = avaliarSenha(valor)

  function sugerir() {
    const senha = gerarSenhaForte()
    onChange(senha)
    onSugerir?.(senha)
    // Revela ao gerar: senha sugerida que a pessoa não consegue ver é senha
    // que ela não anota, e aí perde o acesso.
    setVisivel(true)
  }

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
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {permitirSugestao && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto gap-1.5 px-2 py-1 text-xs"
            onClick={sugerir}
            disabled={desabilitado}
          >
            <Sparkles aria-hidden className="size-3.5" />
            Sugerir senha forte
          </Button>
        )}
      </div>

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
