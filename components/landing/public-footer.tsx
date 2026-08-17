import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

import { Logo } from '@/components/branding/logo'
import { CONTROLADOR } from '@/lib/legal'

// O rodapé repetia os links do menu do topo (Funcionalidades, Planos, Entrar,
// Começar grátis), que já estão visíveis na navbar fixa. Espaço de rodapé
// rende mais com o que não cabe em outro lugar: os documentos legais, que a
// LGPD exige serem de acesso fácil e permanente (Art. 9º), e o canal de
// suporte.
const legalLinks = [
  { label: 'Privacidade', href: '/privacidade' },
  { label: 'Termos de uso', href: '/termos' },
]

export function PublicFooter() {
  return (
    <footer className="border-border/50 border-t px-4 py-10 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
        <div className="flex w-full flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo />
          {/* `min-h-11` em vez de só texto: um link de 20px de altura é um alvo
              de toque ruim no polegar, e abaixo do mínimo de 24px da WCAG 2.2.
              O `-my-2` mantém o espaçamento visual original. */}
          <nav
            aria-label="Links legais"
            className="-my-2 flex flex-wrap items-center justify-center gap-x-6"
          >
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground flex min-h-11 items-center text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {/* `wa.me` abre a conversa direto, no app instalado ou no web,
                melhor do que exibir o número solto, que obrigaria a pessoa a
                copiar e colar. `rel=noopener` porque abre em outra aba. */}
            <a
              href={`https://wa.me/${CONTROLADOR.whatsapp.numero}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-1.5 text-sm transition-colors"
            >
              <MessageCircle aria-hidden className="size-4" />
              Suporte
            </a>
          </nav>
          <span className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Velo Funil. Todos os direitos reservados.
          </span>
        </div>

        {/* O número aparece por extenso, além do link: quem prefere ligar ou
            salvar o contato não deveria precisar abrir o WhatsApp para
            descobri-lo. */}
        {/* `-my-3 inline-block py-3` nos dois: são links de contato em texto
            de 12px e mediam 14px de altura, contra os 44 mínimos de alvo de
            toque. Quem está no celular tentando falar com o suporte é
            justamente quem não pode errar o clique. O padding cresce a área
            tocável e a margem negativa cancela o efeito no layout, então a
            linha continua com a mesma aparência. Mesmo padrão já usado no
            link da FAQ. */}
        <p className="text-muted-foreground text-center text-xs">
          Central de suporte:{' '}
          <a
            href={`https://wa.me/${CONTROLADOR.whatsapp.numero}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground -my-3.5 inline-block py-3.5 underline underline-offset-4 transition-colors"
          >
            {CONTROLADOR.whatsapp.exibicao}
          </a>{' '}
          ·{' '}
          <a
            href={`mailto:${CONTROLADOR.email}`}
            className="hover:text-foreground -my-3.5 inline-block py-3.5 underline underline-offset-4 transition-colors"
          >
            {CONTROLADOR.email}
          </a>
        </p>
      </div>
    </footer>
  )
}
