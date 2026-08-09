import { cn } from '@/lib/utils'

// Três camadas que convergem para um ponto: lidas juntas formam a silhueta de
// um funil e a letra V de Velo; lidas separadas são as etapas do pipeline
// afunilando até o fechamento. Camadas soltas em vez de um funil sólido de
// peça única porque o sólido lê como o ícone genérico de filtro — testado lado
// a lado antes de escolher.
//
// As larguras caem 18.8 → 10.2 → 2.2 e cada camada tem a base chanfrada no
// mesmo ângulo, o que mantém o V visível mesmo a 16px, onde o vão entre as
// camadas quase some.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <g fill="currentColor">
        <path d="M2.6 4.4h18.8a.9.9 0 0 1 .72 1.44l-2.1 2.8a1.4 1.4 0 0 1-1.12.56H5.1a1.4 1.4 0 0 1-1.12-.56l-2.1-2.8A.9.9 0 0 1 2.6 4.4Z" />
        <path d="M6.9 10.6h10.2a.9.9 0 0 1 .72 1.44l-1.72 2.3a1.4 1.4 0 0 1-1.12.56H9.02a1.4 1.4 0 0 1-1.12-.56l-1.72-2.3a.9.9 0 0 1 .72-1.44Z" />
        <path d="M10.9 16.6h2.2a.9.9 0 0 1 .72 1.44l-1.1 1.47a.9.9 0 0 1-1.44 0l-1.1-1.47a.9.9 0 0 1 .72-1.44Z" />
      </g>
    </svg>
  )
}

const sizeClasses = {
  default: 'size-8',
  sm: 'size-7',
} as const

export function Logo({
  size = 'default',
  showWordmark = true,
  className,
}: {
  size?: keyof typeof sizeClasses
  showWordmark?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'bg-primary text-primary-foreground flex shrink-0 items-center justify-center rounded-lg',
          sizeClasses[size],
        )}
      >
        <LogoMark className={size === 'sm' ? 'size-4' : 'size-4.5'} />
      </div>
      {/* Nome composto ganha hierarquia em vez de dois pesos iguais: "Velo" é
          a marca, "Funil" é a categoria. Sem o contraste de peso, o lockup lê
          como duas palavras soltas. */}
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight">
          Velo <span className="text-muted-foreground font-normal">Funil</span>
        </span>
      )}
    </div>
  )
}
