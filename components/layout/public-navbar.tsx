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
import { ThemeToggle } from '@/components/theme-toggle'
import { Logo } from '@/components/branding/logo'
import { ScrollLink } from '@/components/landing/scroll-link'
import { NavCtaLink } from '@/components/landing/nav-cta-link'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Planos', href: '#planos' },
  { label: 'Dúvidas', href: '#faq' },
] as const

export function PublicNavbar() {
  const [menuAberto, setMenuAberto] = React.useState(false)

  return (
    // `backdrop-blur` em header sticky é o pior caso de scroll no mobile: o
    // navegador repinta o backdrop a cada frame e perde o caminho rápido de
    // scroll composto. Fundo sólido abaixo de `md`, blur só no desktop, onde
    // sobra GPU.
    <header className="border-border/60 bg-background md:bg-background/80 sticky top-0 z-50 border-b md:backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/">
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

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <NavCtaLink
            href="/login"
            className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
          >
            Entrar
          </NavCtaLink>

          {/* 48px de alvo de toque no celular, 32 no desktop. Os links do
              menu lateral já estavam em `min-h-12`; o cabeçalho ficava em 44 e
              destoava. O `h-16` do container não muda, então nada é empurrado. */}
          <NavCtaLink
            href="/cadastro"
            className={cn(buttonVariants(), 'min-h-12 md:min-h-8')}
          >
            Começar grátis
          </NavCtaLink>

          {/* Abaixo de `md` os links da seção sumiam e o "Entrar" ficava oculto
              — quem já é cliente não tinha como acessar a conta pelo celular, e
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

                  O `SheetContent` não tem padding nenhum — conferido na classe
                  base de components/ui/sheet.tsx. O que sustentava o conteúdo
                  era margem peça a peça, e cada uma escolheu um valor: o
                  cabeçalho em 16px (`p-4`), os links em 12px, e os botões em
                  ZERO — colados na borda direita do drawer, que é a borda da
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
                      <NavCtaLink
                        href="/login"
                        className={cn(
                          buttonVariants({ variant: 'outline' }),
                          'min-h-11 w-full',
                        )}
                      />
                    }
                  >
                    Entrar
                  </SheetClose>
                  <SheetClose
                    render={
                      <NavCtaLink
                        href="/cadastro"
                        className={cn(buttonVariants(), 'min-h-11 w-full')}
                      />
                    }
                  >
                    Começar grátis
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
