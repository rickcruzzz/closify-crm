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
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Planos', href: '#planos' },
  { label: 'Dúvidas', href: '#faq' },
]

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
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
          >
            Entrar
          </Link>

          <Link
            href="/cadastro"
            className={cn(buttonVariants(), 'min-h-11 md:min-h-8')}
          >
            Começar grátis
          </Link>

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
                  className="md:hidden"
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

              <nav className="mt-4 flex flex-col">
                {navLinks.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={
                      <Link
                        href={link.href}
                        className="hover:bg-muted flex min-h-12 items-center rounded-lg px-3 text-sm font-medium transition-colors"
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
                      <Link
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
