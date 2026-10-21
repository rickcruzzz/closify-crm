import { buttonVariants } from '@/components/ui/button'
import { CONTROLADOR } from '@/lib/legal'
import { cn } from '@/lib/utils'

/** Abre o WhatsApp com o plano escolhido na mensagem, com ou sem sessão. */
export function CtaDoPlano({
  plano,
  variant = 'default',
  className,
}: {
  plano: string
  variant?: 'default' | 'outline'
  className?: string
}) {
  const mensagem = `Olá! Tenho interesse no plano ${plano} do Velo Funil. Gostaria de falar com um especialista para saber mais.`
  const href = `https://wa.me/${CONTROLADOR.whatsapp.numero}?text=${encodeURIComponent(mensagem)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Falar com especialista sobre o plano ${plano}`}
      className={cn(buttonVariants({ variant, size: 'lg' }), className)}
    >
      Falar com especialista
    </a>
  )
}
