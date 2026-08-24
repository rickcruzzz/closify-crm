import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

import { Logo } from '@/components/branding/logo'
import { SuporteEmailMenu } from '@/components/landing/suporte-email-menu'
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
          {/* O CNPJ entra na linha de copyright, não numa linha própria.
              No Brasil ele é o primeiro sinal que uma PME procura antes de
              confiar num site que nunca ouviu falar — e o rodapé é onde ela vai
              procurar, porque é onde todo site sério o coloca. Estava só nas
              páginas legais, a dois cliques de distância de quem estava
              decidindo. Vem de `lib/legal.ts`, a mesma fonte que a Política de
              Privacidade e os Termos citam, então não há como divergirem.

              Sem `razaoSocial` aqui, de propósito: nome civil do titular numa
              linha de reforço visual não ajuda confiança, só expõe. Ele
              continua em Privacidade/Termos, onde a LGPD (Art. 9º, I) exige
              identificar o controlador, e nos avisos de fatura, onde avisa o
              nome que vai aparecer no extrato do cartão — os dois por
              necessidade, não por escolha de marca. */}
          <span className="text-muted-foreground text-sm text-balance">
            © {new Date().getFullYear()} Velo Funil · CNPJ {CONTROLADOR.cnpj}
          </span>
        </div>

        {/* Número por extenso removido (24/08), a pedido do dono: página
            profissional não expõe o telefone cru, o link já abre o WhatsApp
            direto. `-my-3 inline-block py-3` continua nos dois links: são
            texto de 12px que mediam 14px de altura, contra os 44 mínimos de
            alvo de toque, e quem está no celular tentando falar com o
            suporte é justamente quem não pode errar o clique. O padding
            cresce a área tocável e a margem negativa cancela o efeito no
            layout, então a linha continua com a mesma aparência. Mesmo
            padrão já usado no link da FAQ. */}
        <p className="text-muted-foreground text-center text-xs">
          Central de suporte:{' '}
          <a
            href={`https://wa.me/${CONTROLADOR.whatsapp.numero}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground -my-3.5 inline-block py-3.5 underline underline-offset-4 transition-colors"
          >
            WhatsApp
          </a>{' '}
          ·{' '}
          {/* Menu em vez de `mailto:` puro: o endereço é encaminhado (Cloudflare
              Email Routing) para outra caixa, não uma conta própria, e um
              `mailto:` abre o app de e-mail PADRÃO DO SISTEMA — em máquina com
              Outlook desktop instalado, o clique tentava abrir ele e batia em
              erro de cache de contato, sem relação com a configuração de DNS.
              O menu deixa escolher onde abrir em vez de depender disso. */}
          <SuporteEmailMenu
            email={CONTROLADOR.email}
            className="hover:text-foreground -my-3.5 inline-block cursor-pointer py-3.5 underline underline-offset-4 transition-colors"
          />
          {/* Sinaliza o redirecionamento sem expor a mecânica interna do
              domínio — resposta ao relato de confusão de quem clicou esperando
              abrir a própria caixa e caiu direto no Outlook. */}
          <span className="text-muted-foreground/70 block text-[11px]">
            (você escolhe onde abrir; encaminha para nossa caixa de suporte)
          </span>
        </p>
      </div>
    </footer>
  )
}
