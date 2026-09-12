import type { Metadata } from 'next'

import { hashDoToken, tokenPlausivel } from '@/lib/prospeccao/descadastro'
import { registrarDescadastro } from '@/lib/prospeccao/opt-out-queries'
import { assinaturaPublica } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Descadastro | Velo Funil',
  // A página não deve ser indexada: ela existe para quem tem o link, e um
  // resultado de busca chamado "descadastro" só atrai quem nunca foi
  // contatado.
  robots: { index: false, follow: false },
}

/**
 * A página de saída do e-mail de prospecção.
 *
 * ## Ela dá baixa no GET, e isso é decisão contra a recomendação comum
 *
 * O manual diz para não mudar estado num GET, e por um motivo real: pré-visualizador
 * de link e antivírus de e-mail visitam URLs sozinhos, e um GET que age
 * executa a ação sem ninguém clicar.
 *
 * Aqui o efeito colateral é **parar de mandar e-mail para alguém** — que é
 * exatamente o que a pessoa pediria se pudesse. Errar para o lado de
 * descadastrar demais é gratuito; errar para o lado de exigir uma segunda
 * confirmação faz o titular clicar, ver um botão, desistir, e continuar
 * recebendo. É a mesma lógica do vigia de 01/09: quando um dos erros é
 * recuperável e o outro não, o desenho escolhe o recuperável.
 *
 * É também o que o Art. 18, § 2º pede — oposição fácil, não oposição em dois
 * passos.
 *
 * ## Ela nunca diz qual e-mail saiu
 *
 * A página confirma sem exibir o endereço, e o token não é reversível. Sem
 * isso, o link virava um oráculo: quem tivesse um token descobriria a quem ele
 * pertence.
 */
export default async function NaoQueroPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  const token = t ?? null

  let estado: 'ok' | 'invalido' | 'falhou' = 'invalido'

  if (tokenPlausivel(token)) {
    try {
      // A gravação passa pelo MESMO ponto que o webhook da Evolution usa. Até
      // 12/09 esta página escrevia direto na tabela, com `email_hash` como
      // chave — e o disparo do WhatsApp, que casa por domínio e telefone, não
      // tinha um único campo em comum com ela. Um escritor só é o que impede
      // as duas superfícies de gravarem identidades que nunca se encontram.
      await registrarDescadastro({ emailHash: hashDoToken(token!), origem: 'link' })
      estado = 'ok'
    } catch {
      estado = 'falhou'
    }
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 px-6 py-16">
      {estado === 'ok' && (
        <>
          <h1 className="text-titulo-md">Pronto, não escrevo de novo.</h1>
          <p className="text-muted-foreground">
            Seu endereço saiu da lista agora. Não precisa responder nem confirmar nada.
          </p>
          <p className="text-muted-foreground text-sm">
            Se você chegou aqui sem querer, é só ignorar — nenhum outro e-mail vai sair
            de qualquer forma.
          </p>
        </>
      )}

      {estado === 'invalido' && (
        <>
          <h1 className="text-titulo-md">Este link não é válido.</h1>
          <p className="text-muted-foreground">
            Ele pode ter sido cortado ao copiar. Responda o e-mail que você recebeu com a
            palavra <strong>SAIR</strong> que eu tiro seu endereço da lista.
          </p>
        </>
      )}

      {estado === 'falhou' && (
        <>
          <h1 className="text-titulo-md">Não consegui registrar agora.</h1>
          <p className="text-muted-foreground">
            Foi uma falha nossa, não sua. Responda o e-mail que você recebeu com a palavra{' '}
            <strong>SAIR</strong> que eu tiro seu endereço da lista na mão.
          </p>
        </>
      )}

      <p className="text-muted-foreground mt-8 border-t pt-4 text-xs">
        {assinaturaPublica()}
      </p>
    </main>
  )
}
