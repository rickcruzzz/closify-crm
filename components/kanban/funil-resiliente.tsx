'use client'

import * as React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { reportarErro } from '@/lib/erros/reportar'

/**
 * Um erro dentro do funil troca o FUNIL, não a tela.
 *
 * ## O defeito relatado em 11/09
 *
 * Mover um negócio entre etapas mostrava o toast de sucesso e, logo depois, a
 * tela inteira virava *"Não foi possível carregar esta tela"*. `error_logs` de
 * produção confirma React #185 em `/kanban` — a última às 17:26 do próprio dia
 * do relato.
 *
 * O `error.tsx` da rota estava fazendo o que foi escrito para fazer. **O que
 * estava errado era o alcance**: ele é a tela de "não consegui CARREGAR", e
 * passou a responder também por "não consegui MOVER um card". São falhas de
 * tamanhos diferentes e a segunda não justifica apagar o cabeçalho, os filtros,
 * a busca e a navegação de quem estava no meio do trabalho.
 *
 * ## Por que um boundary novo em vez de mexer no `error.tsx`
 *
 * Boundary do React captura para BAIXO. Enquanto o único existia em volta da
 * página, qualquer erro da página parava nele — e a única resposta possível era
 * trocar a página. Descer um boundary para dentro, em volta do board, cria a
 * distinção que faltava:
 *
 *     falha de CARGA da rota    -> error.tsx da rota, que continua certo
 *     falha DENTRO do funil     -> este, e so o funil e substituido
 *
 * ## Ele NÃO esconde o erro
 *
 * `reportarErro` é chamado igual, com origem própria, então o incidente
 * continua chegando a `error_logs` com a mesma informação. O que muda é o que a
 * pessoa perde enquanto isso — e perder o board é diferente de perder a sessão
 * de trabalho inteira.
 *
 * Isso importa porque a causa do React #185 **não está determinada**: o commit
 * de 06/09 já registrou *"não reproduzi o laço"*. Enquanto ela não for achada,
 * o que dá para garantir é que a ocorrência custe menos.
 *
 * ## `componentDidCatch` e não `getDerivedStateFromError` sozinho
 *
 * O primeiro roda no commit e recebe `errorInfo.componentStack`, que é a árvore
 * por nome — a informação que faz a próxima ocorrência ser investigável em vez
 * de adivinhada. É a mesma razão de `CapturaDeComponente` existir, e o porquê
 * inteiro está lá.
 */
export class FunilResiliente extends React.Component<
  { children: React.ReactNode },
  { erro: Error | null }
> {
  state: { erro: Error | null } = { erro: null }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    // Origem própria: no banco, "funil" separa a falha de interação da falha
    // de carga da rota, que já reporta como "dashboard". Sem a distinção, as
    // duas viram a mesma linha e a investigação começa sem saber qual foi.
    reportarErro(erro, 'funil', info.componentStack ?? undefined)
  }

  render() {
    if (!this.state.erro) return this.props.children

    return (
      <div
        role="alert"
        className="border-border/60 bg-muted/30 flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center"
      >
        <div className="bg-destructive/10 text-destructive rounded-full p-3">
          <AlertTriangle aria-hidden className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">O funil parou de responder.</p>
          {/* Diz o que NÃO aconteceu, porque é a primeira pergunta de quem
              acabou de arrastar um card e viu a tela mudar. */}
          <p className="text-muted-foreground max-w-md text-sm text-pretty">
            Nenhum negócio foi perdido — o que você moveu antes disso está
            salvo. Recarregar costuma resolver.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" />
          Recarregar o funil
        </Button>
      </div>
    )
  }
}
