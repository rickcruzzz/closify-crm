'use client'

import * as React from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Logo } from '@/components/branding/logo'
import { ScrollLink } from '@/components/landing/scroll-link'
import { CONTROLADOR } from '@/lib/legal'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Planos', href: '#planos' },
  { label: 'Dúvidas', href: '#faq' },
] as const

export function PublicNavbar() {
  const rotuloDeEntrada = 'Entrar'
  // O login deixa o middleware validar a sessao: quem ainda estiver logado
  // vai ao painel; quem nao estiver ve os campos de e-mail e senha.
  const destinoDeEntrada = '/login'
  const contatoEspecialista = `https://wa.me/${CONTROLADOR.whatsapp.numero}?text=${encodeURIComponent('Olá! Conheci o Velo Funil e gostaria de conversar com um especialista sobre a melhor solução para minha empresa. Podemos agendar uma conversa?')}`

  const [menuAberto, setMenuAberto] = React.useState(false)

  return (
    // `backdrop-blur` em header sticky é o pior caso de scroll no mobile: o
    // navegador repinta o backdrop a cada frame e perde o caminho rápido de
    // scroll composto. Fundo sólido abaixo de `md`, blur só no desktop, onde
    // sobra GPU.
    <header className="border-border/60 bg-background md:bg-background/80 sticky top-0 z-50 border-b md:backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        {/* `flex min-h-11 items-center`: o lockup do logo tem 32px de altura e
            é um link (leva para a home), então no celular era um alvo de
            toque 12px menor que o mínimo. O cabeçalho tem `h-16`, sobra
            espaço, nada é empurrado. */}
        <Link href="/" className="flex min-h-11 items-center">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <ScrollLink
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center text-sm font-medium"
            >
              {link.label}
            </ScrollLink>
          ))}
        </nav>

        {/* O seletor de tema saiu daqui em 24/08, e a medição é o argumento:
            em 390px ele comia 48px — 13% da largura útil do cabeçalho — e em
            320px o resultado era pior, o "Começar grátis" DESAPARECIA e o
            botão de tema FICAVA. A landing estava priorizando escolha de
            aparência sobre o único clique que gera receita.

            Ninguém decide comprar um CRM pelo tema, e nenhuma landing de
            referência auditada (Linear, Vercel, Attio, Stripe) tem esse botão.

            RESSALVA, medida em 26/08, porque este comentário afirmava o
            contrário: o `prefers-color-scheme` do aparelho NÃO é seguido aqui.
            `app/layout.tsx` roda com `defaultTheme="dark"` e `enableSystem`, e
            no `next-themes` o `enableSystem` só torna `"system"` um valor
            possível — quem decide sem nada salvo é o `defaultTheme`. Navegador
            limpo em `prefers-color-scheme: light`, contra produção, renderiza
            escuro. Escuro é o padrão por decisão de identidade (CLAUDE.md), e
            fica; o que era falso era a justificativa de que o aparelho já
            resolvia.

            Ele CONTINUA no produto (`components/layout/topbar.tsx`), que é
            onde faz sentido: lá a pessoa passa horas, e a escolha é dela. */}
        <div className="flex items-center gap-2">
          <Link
            href={destinoDeEntrada}
            className={cn(buttonVariants({ variant: 'ghost' }), 'inline-flex')}
          >
            {rotuloDeEntrada}
          </Link>

          <a
            href={contatoEspecialista}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants(), 'hidden min-h-11 sm:inline-flex')}
          >
            Falar com especialista
          </a>

          {/* Abaixo de `md` os links da seção sumiam e o "Entrar" ficava oculto
             , quem já é cliente não tinha como acessar a conta pelo celular, e
              quem chegava não conseguia navegar até planos ou dúvidas. */}
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir menu"
                  className="size-12 md:hidden"
                >
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>

              {/* O padding horizontal vive AQUI, no container, e não em cada
                  filho.

                  O `SheetContent` não tem padding nenhum, conferido na classe
                  base de components/ui/sheet.tsx. O que sustentava o conteúdo
                  era margem peça a peça, e cada uma escolheu um valor: o
                  cabeçalho em 16px (`p-4`), os links em 12px, e os botões em
                  ZERO, colados na borda direita do drawer, que é a borda da
                  tela.

                  No container porque o que for acrescentado aqui amanhã já
                  nasce alinhado. Margem item a item é uma regra que a próxima
                  pessoa precisa lembrar de repetir. */}
              <nav className="mt-4 flex flex-col px-4">
                {navLinks.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={
                      <ScrollLink
                        href={link.href}
                        // `min-h-12` são os 48px de alvo de toque. `px-2` e não
                        // `px-3`: o realce de hover ainda ultrapassa o texto,
                        // agora sem furar a margem do container.
                        className="hover:bg-muted flex min-h-12 items-center rounded-lg px-2 text-sm font-medium transition-colors"
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}

                <div className="border-border/60 mt-3 flex flex-col gap-2 border-t pt-3">
                  <SheetClose
                    render={
                      <Link
                        href={destinoDeEntrada}
                        className={cn(
                          buttonVariants({ variant: 'outline' }),
                          'min-h-11 w-full',
                        )}
                      />
                    }
                  >
                    {rotuloDeEntrada}
                  </SheetClose>
                  <SheetClose
                    render={
                      <a
                        href={contatoEspecialista}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants(), 'min-h-11 w-full')}
                      />
                    }
                  >
                    Falar com especialista
                  </SheetClose>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
