'use client'

import * as React from 'react'
import { Check, Copy, Mail } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * O e-mail de suporte no rodapé, com escolha de onde abrir.
 *
 * ## Por que existe
 *
 * `suporte@velofunil.com.br` não é uma caixa própria — é uma regra de
 * encaminhamento (Cloudflare Email Routing) que entrega em outra conta. Um
 * `mailto:` puro abre o app padrão do SISTEMA operacional, não do navegador:
 * em máquina com Outlook desktop instalado (mesmo sem ser a conta de
 * suporte), o clique tentava abrir ele e esbarrava em cache de contato
 * quebrado, um erro sem relação nenhuma com a configuração de DNS.
 *
 * A pessoa que clica não sabe, e não precisa saber, que existe um
 * redirecionamento por trás. O menu resolve o problema prático — deixa
 * escolher onde o e-mail abre, sem depender do que está instalado — sem
 * expor a mecânica interna do domínio.
 *
 * ## Por que não usar `sonner` pro feedback de copiar
 *
 * A landing pública não carrega a lib de toast hoje: o hero é Server
 * Component puro (`PipelinePreviewCard`), e a página que mais recebe tráfego
 * pago não deveria puxar JavaScript extra por causa de um rodapé. O ícone
 * trocando pra `Check` por 2 segundos já comunica "copiado" sem dependência
 * nova.
 */
export function SuporteEmailMenu({ email, className }: { email: string; className?: string }) {
  const [copiado, setCopiado] = React.useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(email)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={className}
            aria-label={`${email}, clique para escolher onde abrir`}
          >
            {email}
          </button>
        }
      />
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuItem
          className="gap-2"
          render={
            <a
              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${email}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <Mail className="size-4" />
          Abrir no Gmail
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          render={
            <a
              href={`https://outlook.live.com/mail/0/deeplink/compose?to=${email}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <Mail className="size-4" />
          Abrir no Outlook
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" render={<a href={`mailto:${email}`} />}>
          <Mail className="size-4" />
          Abrir no app padrão
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onClick={(evento) => {
            // O primitivo fecha o menu no clique por padrão; aqui a pessoa
            // pode querer copiar mais de uma vez seguida (colar em dois
            // lugares), então mantém aberto.
            evento.preventDefault()
            void copiar()
          }}
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copiado ? 'Copiado!' : 'Copiar endereço'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
