import Link from 'next/link'

import { LerRespostas } from '@/components/dono/ler-respostas'
import {
  CartaoDeNumero,
  FunilDaProspeccao,
  Objecoes,
  Ranking,
  Temperatura,
} from '@/components/dono/painel-de-inteligencia'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import {
  contarTemperaturas,
  medianaDeResposta,
  montarFunilDaProspeccao,
  porFaixaDePontos,
  rankingDeGanchos,
  rankingDeNichos,
  rankingDeObjecoes,
} from '@/lib/dono/inteligencia'
import { lerInteligencia } from '@/lib/dono/inteligencia-queries'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/** Ver `app/(dono)/dono/page.tsx`: monitoramento com número velho é pior que nenhum. */
export const dynamic = 'force-dynamic'

/**
 * O que a prospecção aprendeu — e o que ela ainda não pode dizer.
 *
 * ## A pergunta que esta tela existe para responder
 *
 * *"O que aconteceu com cada prospect depois que eu o abordei?"* Até 12/09 não
 * havia resposta: a mensagem saía, a resposta chegava no celular do dono, e o
 * sistema não via nada. A Fase 1 passou a capturar; a Fase 2 passou a
 * classificar; esta tela é onde as duas viram decisão.
 *
 * ## E o que ela se RECUSA a responder
 *
 * Toda taxa aqui tem piso de amostra. Com 837 prospects e uma taxa de resposta
 * de setor entre 3,8% e 7,2%, comparar dois nichos de trinta abordagens é ler
 * ruído — e este projeto já pagou por isso: em 29/08 uma classificação feita à
 * mão produziu *"6 de 9 clientes abandonaram"*, número plausível, repetido em
 * quatro documentos antes de alguém conferir.
 *
 * Por isso contagem sempre, taxa só acima do piso, e onde ela não aparece a
 * tela diz **quantas faltam** em vez de mostrar zero.
 *
 * ## Nada aqui muda o sistema sozinho
 *
 * Não reordena a fila, não mexe no score, não desliga nicho. A ordem é
 * capture, meça, compare, só então otimize — e o terceiro passo ainda não
 * aconteceu.
 */
export default async function PaginaDeInteligencia() {
  await exigirAmbienteLocal()

  const { descobertos, prospects, interacoes, aClassificar, filaHumana, lidoEm } =
    await lerInteligencia()

  const funil = montarFunilDaProspeccao({ descobertos, prospects })
  const nichos = rankingDeNichos(prospects)
  const ganchos = rankingDeGanchos(prospects)
  const faixas = porFaixaDePontos(prospects)
  const objecoes = rankingDeObjecoes(interacoes)
  const temperaturas = contarTemperaturas(prospects)
  const mediana = medianaDeResposta(prospects)

  const responderam = funil[2]?.quantidade ?? 0

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Inteligência</h1>
            <p className="text-muted-foreground text-sm">
              O que aconteceu com cada empresa depois da abordagem. Conferido{' '}
              {formatarTempoRelativo(lidoEm)}.
            </p>
          </div>
          <LerRespostas pendentes={aClassificar} />
        </div>

        {aClassificar > 0 && (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed p-3 text-xs">
            <strong className="text-foreground">
              {aClassificar} resposta{aClassificar === 1 ? '' : 's'} ainda sem leitura.
            </strong>{' '}
            Os números de objeção e temperatura abaixo ignoram{' '}
            {aClassificar === 1 ? 'ela' : 'elas'} — o cron lê de hora em hora, aos :15, e o botão
            acima adianta.
          </p>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoDeNumero
          rotulo="No universo"
          valor={String(descobertos)}
          detalhe="depois do não-perturbe"
        />
        <CartaoDeNumero
          rotulo="Abordados"
          valor={String(funil[1]?.quantidade ?? 0)}
          detalhe="a mensagem saiu"
        />
        <CartaoDeNumero
          rotulo="Responderam"
          valor={String(responderam)}
          detalhe={
            mediana === null
              ? 'sem resposta ainda'
              : `metade em até ${mediana < 1 ? `${Math.round(mediana * 60)} min` : `${mediana.toFixed(1)} h`}`
          }
        />
        <CartaoDeNumero
          rotulo="Precisam de você"
          valor={String(filaHumana.length)}
          detalhe="a IA se recusou a decidir"
          alerta={filaHumana.length > 0}
        />
      </section>

      {filaHumana.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Precisam de uma pessoa</h2>
          <p className="text-muted-foreground text-sm">
            Confiança baixa, assunto jurídico, irritação ou pedido fora de política. A IA
            classificou e parou — responder isso automaticamente custa mais que o silêncio.
          </p>
          <ul className="border-border bg-card divide-border divide-y rounded-lg border">
            {filaHumana.slice(0, 12).map((l) => (
              <li key={l.dominio} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                <span className="font-medium">{l.nome ?? l.dominio}</span>
                <span className="text-muted-foreground text-xs">{l.vertical ?? 'sem nicho'}</span>
                {l.intencao && (
                  <span className="bg-muted rounded px-1.5 py-0.5 text-xs">{l.intencao}</span>
                )}
                {l.objecao && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs">{l.objecao}</span>
                )}
                <span className="text-muted-foreground ml-auto text-xs">
                  {formatarTempoRelativo(l.respondidoEm)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">O funil da prospecção</h2>
        <FunilDaProspeccao funil={funil} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="text-lg font-medium">Temperatura</h2>
          <Temperatura contagem={temperaturas} />
        </section>

        <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="text-lg font-medium">O que trava a venda</h2>
          <Objecoes linhas={objecoes} respostas={interacoes.length} />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Por nicho</h2>
        <p className="text-muted-foreground text-sm">
          Ordenado por volume, não por taxa: o nicho com uma abordagem e uma resposta daria 100% e
          não diria nada. A régua de 07/09 aprovou cinco —{' '}
          <Link href="/dono/prospeccao" className="underline underline-offset-2">
            a fila usa ela
          </Link>
          .
        </p>
        <Ranking
          linhas={nichos}
          rotuloDaColuna="Nicho"
          vazio="Nenhum prospect registrado ainda."
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Por gancho</h2>
        <p className="text-muted-foreground text-sm">
          A segunda linha da mensagem — a pergunta que abre a conversa. Lida do texto que de fato
          saiu, não recalculada: no dia em que <code>abordagem.ts</code> mudar uma palavra, o que
          foi enviado continua sendo o que está escrito.
        </p>
        <Ranking
          linhas={ganchos}
          rotuloDaColuna="Gancho"
          vazio="Nenhuma mensagem registrada ainda. O disparo grava a partir de 12/09; rodadas antigas entraram por --sincronizar."
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">O score prevê resposta?</h2>
        <p className="text-muted-foreground text-sm">
          É a pergunta que o score nunca respondeu: ele foi escrito em 06/09 com pesos decididos
          por raciocínio, e desde então ordena a fila sem ninguém saber se acerta.{' '}
          <strong className="text-foreground">Nada aqui muda os pesos.</strong> Só depois de cada
          faixa ter sua amostra é que vale propor alteração.
        </p>
        <Ranking
          linhas={faixas}
          rotuloDaColuna="Pontos"
          vazio="Nenhum prospect registrado ainda."
        />
      </section>
    </div>
  )
}
