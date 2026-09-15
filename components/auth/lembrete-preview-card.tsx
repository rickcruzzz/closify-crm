import { CalendarClock, Phone } from 'lucide-react'

import { formatBRL } from '@/lib/deals/metrics'

/**
 * O lembrete de orçamento, desenhado em HTML, para o painel de login.
 *
 * ## Por que UM card e não a tela inteira
 *
 * Este painel já teve duas coisas antes, e as duas falharam por motivos
 * diferentes:
 *
 *     ate 15/09   `PipelinePreviewCard`, o MESMO componente do hero da landing.
 *                 Quem chegava pelo site via a mesma figura duas telas seguidas
 *     em 15/09    `ProdutoPrint nome="hoje"`, a captura real da tela. A
 *                 repeticao sumiu e a legibilidade foi junto
 *
 * O segundo foi medido: a coluna é `minmax(32rem,1fr)` menos `p-10`, ou seja
 * ~640px numa tela de 1440, e o print mostra 1440px de interface. Dá **0,44x**,
 * e texto de 14px vira 6,2px. Este projeto já registrou em 09/09 que print
 * abaixo de **0,80x falha a geração**, depois de o criativo do Instagram sair a
 * 0,60x e ser recusado. Estava em metade do mínimo.
 *
 * A causa é a mesma nos dois casos: **captura de tela inteira não sobrevive a
 * caixa estreita**. O card do funil era legível justamente por ser HTML em
 * tamanho real. O erro não foi trocar o funil; foi trocar HTML por bitmap.
 *
 * Um card grande resolve os dois de uma vez: não repete o hero e não depende de
 * escala nenhuma. Lista numa caixa de 512px é exatamente o que falhou.
 *
 * ## A cor do chip é `--warning`, e isso não é escolha estética
 *
 * `orcamento-do-negocio.tsx` já pinta o prazo em âmbar quando faltam 2 dias ou
 * menos, e em `destructive` quando venceu. Se a ilustração usasse outra cor,
 * ela ensinaria um código visual que o produto não usa, e a primeira tela real
 * desmentiria a peça.
 *
 * ## Os textos são literais, nunca calculados
 *
 * "vence em 2 dias" e "09:00" não saem de `new Date()`. Num Server Component
 * estático o valor seria congelado no build e iria derivando dia após dia, e
 * `auth-split.tsx` proíbe qualquer leitura dinâmica aqui sob pena de `/login` e
 * `/cadastro` perderem renderização estática.
 *
 * ## Por que não reusar `DealCardOverlay` nem `TaskItem`
 *
 * `TaskItem` é `'use client'` com três `useState` e exige `onConcluir`;
 * `DealCardOverlay` renderiza `ProximaAcao`, que também é client. Qualquer um
 * dos dois transformaria este painel em client component e mataria o zero
 * JavaScript que ele custa hoje.
 *
 * O valor sai de `formatBRL`, o mesmo formatador do produto, para a peça não
 * inventar uma convenção de moeda própria.
 */
export function LembretePreviewCard() {
  return (
    <div className="border-border bg-card superficie-elevada overflow-hidden rounded-2xl border">
      {/* Mesma moldura de "janela do app" do hero e dos prints: a ilustração
          entra como parte da linguagem da marca, não como cartão colado por
          cima.

          O `LogoMark` chegou a entrar aqui, ao lado dos pontos, e saiu: em
          3,5px de altura ele virava um borrão colorido espremido, e logo
          ele já está grande e legível no canto superior esquerdo da mesma
          tela. Marca repetida em miniatura não reforça marca, polui. */}
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-amber-500/70" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <span className="text-muted-foreground font-mono text-xs">hoje · Acme Corp</span>
      </div>

      <div className="flex flex-col gap-6 p-8">
        {/* O chip é a única coisa colorida do card, de propósito: ele carrega a
            urgência sozinho, e é o que a pessoa lê primeiro. */}
        <span className="text-warning bg-warning/10 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs font-medium tracking-wide uppercase">
          <CalendarClock aria-hidden className="size-4" />
          Vence em 2 dias
        </span>

        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tracking-tight text-balance">
            Retorno do orçamento
          </p>
          <p className="text-muted-foreground inline-flex items-center gap-2 text-base">
            <Phone aria-hidden className="size-4 shrink-0" />
            Marcenaria Silva
          </p>
        </div>

        {/* `tabular-nums` porque o valor é o número que a pessoa procura, e
            dígito de largura variável faz coluna de dinheiro dançar. */}
        <div className="border-border flex items-end justify-between border-t pt-6">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">
            {formatBRL(8400)}
          </span>
          <span className="text-muted-foreground font-mono text-base tabular-nums">09:00</span>
        </div>
      </div>
    </div>
  )
}
