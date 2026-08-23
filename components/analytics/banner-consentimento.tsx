'use client'

import * as React from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  CHAVE_CONSENTIMENTO,
  interpretarConsentimento,
  type Consentimento,
} from '@/lib/analytics/consentimento'

/**
 * O evento que avisa o resto da página que a escolha mudou.
 *
 * `storage` do navegador só dispara em OUTRAS abas, nunca na que escreveu —
 * então sem um evento próprio o pixel só ligaria no próximo carregamento, e
 * quem acabou de aceitar não seria medido na visita em que aceitou, que é
 * justamente a visita que veio do anúncio.
 */
export const EVENTO_CONSENTIMENTO = 'vf:consentimento'

export function lerConsentimentoDoNavegador(): Consentimento | null {
  if (typeof window === 'undefined') return null
  try {
    return interpretarConsentimento(window.localStorage.getItem(CHAVE_CONSENTIMENTO))
  } catch {
    // Navegador com storage bloqueado (aba anônima restrita, política de
    // empresa). Sem onde guardar a escolha, o seguro é não rastrear.
    return null
  }
}

/**
 * Banner de consentimento de cookies.
 *
 * ## As decisões que a LGPD obriga, e que aparecem no código
 *
 * **"Recusar" tem o mesmo peso visual que "Aceitar".** Os dois são botões, de
 * mesmo tamanho, lado a lado. A ANPD recomenda isso explicitamente, e é também
 * o que separa um banner de um dark pattern: esconder a recusa atrás de "saiba
 * mais" invalida o consentimento, porque ele deixa de ser livre.
 *
 * **Nada dispara antes da escolha.** O pixel não é carregado e depois desligado
 * — ele nem chega a existir enquanto não houver "aceito". Bloqueio prévio é o
 * ponto todo; consentimento pedido depois do rastreamento não é consentimento.
 *
 * **Não há botão de fechar.** Um "X" seria uma terceira saída ambígua: a pessoa
 * some com o banner sem ter dito nada, e alguém precisa decidir o que isso
 * significa. Aqui só existem duas respostas, as duas explícitas.
 *
 * O texto diz o que está em jogo em uma frase, sem juridiquês — quem quiser o
 * detalhe tem o link para a Política de Privacidade ali do lado.
 */
export function BannerConsentimento() {
  // Nasce `null` e só decide no cliente: o servidor não tem localStorage, e
  // renderizar o banner no HTML causaria descasamento de hidratação.
  const [decidido, setDecidido] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    setDecidido(lerConsentimentoDoNavegador() !== null)
  }, [])

  const responder = React.useCallback((resposta: Consentimento) => {
    try {
      window.localStorage.setItem(CHAVE_CONSENTIMENTO, resposta)
    } catch {
      // Sem storage a escolha não sobrevive ao recarregamento, mas vale para
      // esta visita: some o banner e o pixel liga (ou não) agora.
    }
    window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMENTO, { detail: resposta }))
    setDecidido(true)
  }, [])

  if (decidido !== false) return null

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      aria-live="polite"
      // `p-3` no telefone: medido em 390×844, a versão anterior ocupava 206px
      // — 27% da tela — e cobria exatamente o CTA do hero, que começa no mesmo
      // pixel. Quem chega de anúncio via o "Começar grátis" tapado por um aviso
      // de cookie. Banner de consentimento tem que ser inevitável, não
      // volumoso.
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-6"
    >
      <div className="bg-card border-border mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border p-3 shadow-lg sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        {/* O texto encurtou pelo mesmo motivo da altura: três linhas de
            explicação no telefone empurram os botões para fora do polegar.
            Diz o que é feito, com o link para quem quiser o detalhe. */}
        <p className="text-muted-foreground flex-1 text-xs sm:text-sm">
          Usamos cookies para saber de onde vêm as visitas.{' '}
          <Link
            href="/privacidade"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        {/* Ordem e tamanho iguais de propósito — ver o cabeçalho do arquivo. */}
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:size-auto sm:flex-none"
            onClick={() => responder('recusado')}
          >
            Recusar
          </Button>
          <Button
            size="sm"
            className="flex-1 sm:size-auto sm:flex-none"
            onClick={() => responder('aceito')}
          >
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  )
}
