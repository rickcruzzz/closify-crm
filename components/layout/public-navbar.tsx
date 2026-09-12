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
import { NavCtaLink } from '@/components/landing/nav-cta-link'
import { useHeroCtaVisivel } from '@/hooks/use-hero-cta-visivel'
import { useSessaoAtiva } from '@/hooks/use-sessao-ativa'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Planos', href: '#planos' },
  { label: 'Dúvidas', href: '#faq' },
] as const

export function PublicNavbar() {
  /**
   * ## O botao passa a dizer o que faz
   *
   * O middleware desvia quem tem sessao de `/login` para `/dashboard`
   * (`lib/supabase/middleware.ts:168`), e isso e correto — mas com o botao
   * escrito "Entrar" o efeito e o de abrir o sistema de surpresa: a pessoa
   * clica esperando a tela de login e cai dentro do produto.
   *
   * O desvio fica; o rotulo e que passa a acompanhar. Deslogado le "Entrar" e
   * vai ao login; logado le "Ir para o sistema" e vai ao painel. Nenhum
   * clique muda de destino sem avisar antes.
   */
  const logado = useSessaoAtiva()
  const rotuloDeEntrada = logado ? 'Ir para o sistema' : 'Entrar'
  const destinoDeEntrada = logado ? '/dashboard' : '/login'
  // Fonte única compartilhada com `mobile-sticky-cta` — ver o hook.
  const heroVisivel = useHeroCtaVisivel()

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
          <NavCtaLink
            href={destinoDeEntrada}
            className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
          >
            {rotuloDeEntrada}
          </NavCtaLink>

          {/* 48px de alvo de toque no celular, 32 no desktop. Os links do
              menu lateral já estavam em `min-h-12`; o cabeçalho ficava em 44 e
              destoava. O `h-16` do container não muda, então nada é empurrado.

              Escondido abaixo de 340px. O corte era em 360 enquanto o
              seletor de tema dividia o cabeçalho; com ele fora (24/08) sobram
              48px, e a soma passa a ser logo 120 + este botão 123 + menu 48 =
              291, que cabe nos ~305 úteis de uma tela de 320. Medido, sem
              rolagem horizontal.

              Continua havendo um piso: abaixo de ~340 não cabe mesmo, e aí o
              mesmo "Começar grátis" segue disponível dentro do menu.

              O corte é em 360 e não mais alto de propósito: 375 e 390 são
              iPhone e Android correntes, e esconder o CTA do cabeçalho neles
              custaria caminho de conversão em troca de nada, já que ali ele
              cabe. Abaixo de 360 o mesmo "Começar grátis" continua no menu
              lateral e no Hero, que fica logo abaixo. */}
          {/* ## Este botão voltou a acompanhar a rolagem no celular — 12/09

              Até aqui ele SUMIA ao rolar, porque a barra fixa do rodapé subia
              para substituí-lo: medido em 24/08, os dois apareciam juntos com
              o mesmo texto e a mesma cor, somando 138px (16% da viewport) de
              moldura fixa, e dois CTAs iguais dividem a atenção em vez de
              somar.

              A barra saiu por decisão do dono em 12/09. Manter o `hidden`
              deixaria a pessoa rolar 12.000px sem nenhum "Começar grátis"
              alcançável — que é pior do que os dois botões que a regra
              evitava. Agora ele é o ÚNICO CTA persistente no celular.

              A condição continua existindo para o caso oposto: com o hero
              visível, o botão dele está logo abaixo, e repetir o mesmo convite
              a 500px de distância é a redundância de 24/08 com outro nome. */}
          <NavCtaLink
            href="/cadastro"
            className={cn(
              buttonVariants(),
              'min-h-12 md:min-h-8',
              // Trocar a STRING inteira, não somar `max-md:hidden` por cima:
              // medido, `min-[340px]:inline-flex` vence a classe somada e o
              // botão continuava visível. Duas utilities de `display` no mesmo
              // elemento é briga de especificidade que o Tailwind resolve pela
              // ordem no CSS gerado, não pela ordem que se escreve aqui.
              heroVisivel ? 'hidden min-[340px]:inline-flex' : 'inline-flex',
            )}
          >
            Começar grátis
          </NavCtaLink>

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
                      <NavCtaLink
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
