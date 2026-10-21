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
  const mensagens: Record<string, string> = {
    Free: 'Olá! Conheci o Velo Funil e gostaria de entender como começar com o plano Free. Pode me orientar sobre a configuração inicial do funil e a importação dos meus contatos?',
    Pro: 'Olá! Quero conhecer o plano Pro do Velo Funil para minha empresa. Gostaria de conversar sobre a organização do time, os recursos de agenda e e-mail e a melhor forma de implantar o CRM.',
    Max: 'Olá! Tenho interesse no plano Max do Velo Funil. Gostaria de entender como conectar o WhatsApp da empresa ao funil, centralizar as conversas e organizar o atendimento da equipe.',
    Enterprise: 'Olá! Tenho interesse em um projeto Enterprise de prospecção de eventos para mídia outdoor. Quero conversar sobre as agendas públicas que devemos acompanhar, como identificar organizadores e contatos, explicar a prioridade de cada oportunidade e preparar mensagens comerciais com aprovação da minha equipe. Podemos agendar uma conversa para definir o escopo?',
  }
  const mensagem = mensagens[plano] ?? `Olá! Gostaria de conversar com um especialista sobre o plano ${plano} do Velo Funil.`
  const href = `https://wa.me/${CONTROLADOR.whatsapp.numero}?text=${encodeURIComponent(mensagem)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Falar com um especialista sobre o plano ${plano} pelo WhatsApp`}
      className={cn(buttonVariants({ variant, size: 'lg' }), className)}
    >
      Falar com um especialista
    </a>
  )
}
