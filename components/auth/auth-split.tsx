import Link from 'next/link'

import { Logo } from '@/components/branding/logo'
import { AuthArte } from '@/components/auth/auth-arte'

/**
 * A casca de login e cadastro: formulário à esquerda, produto à direita.
 *
 * **Por que `lg` (1024px) e não `md`.** É conta, não gosto. Cada linha do
 * `PipelinePreviewCard` reserva 304px em colunas fixas (rótulo 144 + valor 64
 * + contagem 20 + três vãos de 12), e só a barra é elástica. Em `md` a coluna
 * da arte teria ~380px e a barra sobraria com ~30px — um traço. Com
 * `minmax(32rem,1fr)` mais o respiro de `lg:p-10`, a barra fica com 80px em
 * 1024px e 240px em 1440px, que é onde o gráfico volta a comunicar proporção.
 *
 * **Por que a arte some no celular em vez de virar topo.** As larguras fixas
 * acima não comprimem; um mockup empilhado empurraria o formulário para baixo
 * da dobra, e o cadastro já é alto (nome, e-mail, duas senhas com medidor,
 * aceite de termos); e quem abre isto no celular veio entrar, não olhar
 * vitrine. Custa ~1,5KB de HTML mantê-lo montado e escondido, contra o risco
 * real de decidir por JavaScript.
 *
 * **Sem `<Card>` nestas duas telas.** Um cartão com superfície própria dentro
 * de meia tela é caixa dentro de caixa, e `max-w-sm` numa coluna de 500px lê
 * como acanhado. Sem ele o título usa a escala da landing e o formulário
 * respira. As seis telas de estado curto mantêm o cartão, porque lá ele
 * delimita uma mensagem curta em vez de encaixotar um formulário.
 *
 * Não pode chamar `cookies()`, `headers()` nem ler `searchParams`: qualquer um
 * torna `/login` e `/cadastro` dinâmicas e perde a renderização estática.
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(32rem,1fr)]">
      <div className="flex flex-col justify-center gap-8 px-4 py-10 sm:px-8 lg:px-10 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="animate-entrada fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-1 focus-visible:ring-ring mb-8 inline-flex w-fit -my-1.5 rounded-lg py-1.5 outline-none focus-visible:ring-3"
          >
            <Logo />
          </Link>
          {children}
        </div>
      </div>

      <AuthArte />
    </div>
  )
}
