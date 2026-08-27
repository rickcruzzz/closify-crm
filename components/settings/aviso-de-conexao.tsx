'use client'

import * as React from 'react'
import { CheckCircle2, X } from 'lucide-react'

/**
 * O aviso de "conectado com sucesso", que sai sozinho.
 *
 * ## Por que pode sair sozinho
 *
 * Sumir com informação é errado quase sempre. Aqui não é, e o motivo é
 * específico: **este aviso é redundante**. O card ao lado mostra o selo
 * "✓ Conectado" e o e-mail da conta, permanentemente. Quem perder a faixa não
 * perde nada — a resposta continua na tela, no lugar onde ela é procurada
 * depois.
 *
 * O erro, por outro lado, **não** sai sozinho, e a diferença é deliberada:
 * ele carrega a única cópia da explicação e do que fazer. Um erro que
 * desaparece enquanto a pessoa lê é pior do que não avisar.
 *
 * ## Os 4 segundos
 *
 * A faixa nasce da URL (`?conectado=gmail`), não de um evento de cliente. Sem
 * limpar o endereço, recarregar ou voltar traria o aviso de volta dias depois,
 * afirmando que algo acabou de acontecer. `history.replaceState` tira o
 * parâmetro **sem** navegar — `router.replace` custaria uma ida ao servidor
 * para reconstruir a mesma tela.
 *
 * A saída é em duas etapas porque desmontar no mesmo instante em que a
 * opacidade muda faz o elemento sumir sem transição nenhuma: primeiro marca
 * `saindo`, depois desmonta quando a transição acabou. Quem pede menos
 * animação no sistema recebe o mesmo comportamento sem o movimento — o bloco
 * `prefers-reduced-motion` de `globals.css` zera a duração.
 */
const ESPERA_ANTES_DE_SAIR_MS = 4_000

/** Casado com `--transition-duration-estado`, o token de 320ms do projeto. */
const DURACAO_DA_SAIDA_MS = 320

export function AvisoDeConexao({
  titulo,
  detalhe,
}: {
  /** "Gmail conectado." — o fato. */
  titulo: string
  /** O que a pessoa pode fazer agora. */
  detalhe: string
}) {
  const [visivel, setVisivel] = React.useState(true)
  const [saindo, setSaindo] = React.useState(false)

  const fechar = React.useCallback(() => {
    setSaindo(true)
    window.setTimeout(() => setVisivel(false), DURACAO_DA_SAIDA_MS)
  }, [])

  React.useEffect(() => {
    // Tira `?conectado=` do endereço assim que a faixa aparece. Não espera os
    // 4 segundos: quem recarregar antes disso também não deve ver de novo.
    const url = new URL(window.location.href)
    if (url.searchParams.has('conectado')) {
      url.searchParams.delete('conectado')
      window.history.replaceState(null, '', url.pathname + url.search)
    }

    const saida = window.setTimeout(() => setSaindo(true), ESPERA_ANTES_DE_SAIR_MS)
    const desmonte = window.setTimeout(
      () => setVisivel(false),
      ESPERA_ANTES_DE_SAIR_MS + DURACAO_DA_SAIDA_MS,
    )

    return () => {
      window.clearTimeout(saida)
      window.clearTimeout(desmonte)
    }
  }, [])

  if (!visivel) return null

  return (
    <div
      // `status` e não `alert`: sucesso não interrompe quem está usando um
      // leitor de tela, é anunciado quando ele terminar a frase atual.
      role="status"
      className={[
        'flex items-start gap-3 rounded-lg border p-3 transition-[opacity,transform]',
        // Token, nao `emerald-500/10` solto: o verde daqui e o verde do
        // toast passam a ser o MESMO verde, e mudam juntos.
        'border-success/25 bg-success/10',
        'duration-estado',
        // Saída com `ease-in`, entrada com `ease-out`: é a convenção que a
        // própria auditoria de UX aponta, e o olho lê como o elemento indo
        // embora em vez de ser cortado.
        saindo ? 'ease-in -translate-y-1 opacity-0' : 'ease-entrada translate-y-0 opacity-100',
      ].join(' ')}
    >
      <CheckCircle2
        aria-hidden
        className="text-success mt-0.5 size-5 shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-success text-sm font-medium">
          {titulo}
        </span>
        {/* O que MUDA para a pessoa. "Conectado com sucesso" afirma um estado
            que o selo do card já afirma; a frase útil é a que diz o que passou
            a ser possível. */}
        <span className="text-muted-foreground text-sm text-pretty">{detalhe}</span>
      </div>

      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar aviso"
        // 44px de alvo no telefone, a regra de toque do projeto; no desktop
        // volta ao compacto. `-m-1` compensa o alvo maior para o ícone não
        // empurrar o texto.
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -m-1 flex size-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none md:size-8"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}
