import {
  BarChart3,
  Calendar,
  MessageCircle,
  KanbanSquare,
  ListChecks,
  Building2,
  Bell,
  FileClock,
  FileSpreadsheet,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { ProdutoPrint } from '@/components/landing/produto-print'
import { Card, CardContent } from '@/components/ui/card'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'

type Feature = {
  title: string
  description: string
  icon: LucideIcon
  /** Stagger em milissegundos, aplicado pelo RevealOnScroll. */
  delay: number
}

const features: Feature[] = [
  {
    // ## Primeiro da lista desde 09/09, e a ordem e a decisao
    //
    // E o que a mensagem de prospecao promete com estas palavras: "cada
    // orcamento vira um card, com a data do retorno". Ate 09/09 a landing
    // mencionava "orcamento" UMA vez em 191 KB de HTML, e quem chegava pelo
    // WhatsApp nao encontrava a frase que tinha acabado de ler.
    //
    // E o angulo que nenhum CRM ocupa: medido no Exa, 58% do que o ICP acha
    // quando procura software e categoria ORCAMENTO, contra 28% de CRM.
    title: 'O orçamento tem prazo, e o sistema avisa',
    description:
      'Registre valor, validade e o que foi proposto. Dois dias antes de vencer, o lembrete do retorno aparece na sua lista do dia — sem você anotar nada.',
    icon: FileClock,
    delay: 0,
  },
  {
    title: 'Funil visual, arrasta e solta',
    description:
      'Veja cada cliente em potencial numa etapa da venda e arraste o card conforme a conversa avança, sem montar tabela, sem fórmula.',
    icon: KanbanSquare,
    delay: 65,
  },
  {
    title: 'O histórico fica com a empresa',
    description:
      'Cada ligação, e-mail e conversa fica registrada no contato. Quando um vendedor sai, o relacionamento continua aqui, e não no celular dele.',
    icon: ListChecks,
    delay: 130,
  },
  {
    // A importação existia desde antes e não aparecia na landing, é a
    // resposta para "vou ter que digitar tudo de novo?", a objeção que mais
    // trava a troca da planilha.
    title: 'Importação de planilha',
    description:
      'Traga seus contatos de uma vez com um arquivo .csv, sem redigitar nada. Duplicados são ignorados sozinhos.',
    icon: FileSpreadsheet,
    delay: 260,
  },
  {
    title: 'Quanto você tem para fechar este mês',
    description:
      'O valor que está em jogo, o que já virou venda e o que travou no caminho. Sem montar fórmula, sem esperar alguém consolidar planilha.',
    icon: BarChart3,
    delay: 0,
  },
  {
    title: 'Várias empresas, um login só',
    description:
      'Gerencie mais de uma empresa com a mesma conta e troque entre elas sem perder nada de vista.',
    icon: Building2,
    delay: 130,
  },
  {
    title: 'A tela que diz o que fazer hoje',
    description:
      'Abriu o sistema, já sabe com quem falar: o que venceu, o que é de hoje e o que vem nos próximos dias, em ordem de urgência.',
    icon: Bell,
    delay: 260,
  },
  {
    // Vizinho de "A tela que diz o que fazer hoje" de propósito: os dois
    // falam de tempo, e a distância entre eles é o que cada um responde.
    //
    //     Hoje         o que fazer AGORA
    //     Calendário   o que vem nas próximas semanas
    //
    // Sem essa separação no texto, os dois cards viram o mesmo card.
    //
    // Não cita Google: a sincronia com o Google Calendar é integração do Pro
    // e vive na seção de planos. Prometê-la aqui, na grade que descreve o
    // produto inteiro, ofereceria no Free o que só existe no Pro — a classe
    // de defeito que esta página já pagou com os "contatos ilimitados".
    title: 'O que vem pela frente, por dia',
    description:
      'Veja tudo o que está marcado por mês, semana ou lista. O compromisso que você agendou aparece no dia certo, sem depender de você lembrar dele.',
    // `Calendar`, o mesmo da barra lateral. `CalendarCheck` já é o ícone de
    // "Hoje" no produto, e repeti-lo aqui anularia a função do ícone, que é
    // dar um segundo caminho de reconhecimento além do texto.
    icon: Calendar,
    delay: 0,
  },
  {
    // O canal onde a PME brasileira realmente vende não aparecia em lugar
    // nenhum desta página. É a feature mais reconhecível do produto para
    // quem chega de anúncio, e estava invisível.
    title: 'Fala com o cliente sem procurar o número',
    // ## O "em breve" saiu em 02/09, e o motivo vale mais que a frase
    //
    // A descricao terminava em "Em breve, pela API oficial da Meta, a mensagem
    // que chega vira contato e tarefa sozinha". Era honesta: dizia que nao
    // funciona hoje.
    //
    // Mas honesto nao basta numa pagina que recebe TRAFEGO PAGO. Promessa
    // futura ao lado de recurso entregue e lida como recurso, porque ninguem
    // le cartao de anuncio com atencao de contrato — e quando a pessoa
    // descobre, o clique ja foi cobrado.
    //
    // Fica so o que roda: o link `wa.me` abre a conversa a partir do contato.
    // Isso e verdade, e util, e nao promete nada.
    //
    // O "em breve" volta quando `FASE_DO_WHATSAPP` sair de 'migrando'. A
    // decisao e do dono, e esta registrada em `docs/estado-atual.md`.
    description:
      'Um toque abre a conversa direto do contato, com o número certo, sem procurar na agenda nem copiar e colar.',
    icon: MessageCircle,
    delay: 130,
  },
  {
    title: 'Cada um vê o que precisa ver',
    description:
      'Dono acompanha a operação inteira; colaborador trabalha na parte dele. Sem planilha compartilhada onde qualquer um apaga a linha errada.',
    icon: ShieldCheck,
    delay: 260,
  },
]

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-5xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-xs tracking-wide uppercase">
            <span aria-hidden className="bg-primary h-px w-4" />
            Funcionalidades
            <span aria-hidden className="bg-primary h-px w-4" />
          </span>
          <h2 className="text-titulo-md md:text-titulo-lg">
            O que você para de fazer na mão
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            Cada recurso aqui existe porque alguém estava resolvendo aquilo com
            planilha, post-it ou memória, e perdendo venda no caminho.
          </p>
        </RevealOnScroll>

        {/* `gap-px` sobre um fundo de borda: as divisórias viram linhas de 1px
            perfeitas, sem borda dupla entre células nem canto quebrado. É o
            truque que dá o acabamento de grade contínua. */}
        <div className="bg-border ring-border grid grid-cols-1 gap-px overflow-hidden rounded-xl ring-1 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            // Célula vazia no fim do grid pinta a cor do fundo (o truque de
            // `bg-border`+`gap-px` logo acima) e vira um retângulo escuro sem
            // nada dentro. O último card estica para cobrir o que sobrar — e
            // quanto sobra depende de quantos cards existem, então a conta é
            // feita, não fixada.
            //
            // Com 9 cards: em 3 colunas fecha exato, 3x3, nada a esticar; em 2
            // colunas sobra uma célula, e o último ocupa a linha inteira. Se a
            // lista mudar de tamanho de novo, isto continua certo sozinho.
            //
            // Eram 8, e 8 % 3 = 2 punha `lg:col-span-2` no último — o card
            // saía com o DOBRO da largura dos outros (682px contra 341px,
            // medido em produção), e o texto travado em `max-w-md` deixava
            // 186px de vazio dentro dele. Ler como proposital dependia de o
            // card usar o tamanho, e ele não usava. O 9º card fecha a conta em
            // vez de tratar a sobra.
            const ultimo = i === features.length - 1
            const sobramEm2 = features.length % 2
            const sobramEm3 = features.length % 3
            // Cada faixa declara o próprio span, e `lg` declara SEMPRE, mesmo
            // quando é 1. Utility de breakpoint no Tailwind vale dali para
            // cima: `sm:col-span-2` continua valendo em 1440px, e sem um
            // `lg:col-span-1` explícito para desfazê-lo o card fica esticado
            // numa grade que já fechava exata.
            //
            // Isso passou despercebido enquanto a lista tinha 8 cards, porque
            // `8 % 2 = 0` nunca ligava o span de `sm` — o de `lg` era o único
            // que existia, e não havia o que vazar. Com 9 o vazamento
            // apareceu na primeira medição.
            const spanUltimo = ultimo
              ? cn(
                  sobramEm2 === 1 && 'sm:col-span-2',
                  sobramEm3 === 0 && 'lg:col-span-1',
                  sobramEm3 === 1 && 'lg:col-span-3',
                  sobramEm3 === 2 && 'lg:col-span-2',
                )
              : undefined
            // O card só vira faixa horizontal quando de fato atravessa a linha
            // INTEIRA; esticado por uma coluna, o layout de coluna continua
            // sendo o certo. E isso é decidido por breakpoint, pelo mesmo
            // motivo do span acima: `sm:flex-row` sozinho seguiria valendo em
            // 1440px, deitando um card de 341px que não tem largura para isso.
            const faixaEmSm = ultimo && sobramEm2 === 1
            const faixaEmLg = ultimo && sobramEm3 === 1
            const layoutDoConteudo = cn(
              'flex flex-col gap-3',
              // Deitado, mas ancorado no mesmo canto que todos os outros
              // cards. `justify-center` empurrava ícone e texto para o meio da
              // faixa, e a coluna da esquerda deixava de alinhar com a grade
              // inteira logo acima — o olho procura essa linha vertical antes
              // de ler qualquer coisa. `items-center` tinha efeito parecido no
              // outro eixo: com três linhas de texto, o ícone caía na altura
              // da segunda, longe do título que ele identifica.
              faixaEmSm && 'sm:flex-row sm:items-start sm:gap-4',
              // Desfaz a faixa de `sm` quando em 3 colunas o card volta a ser
              // uma célula normal. Sem este reset o vazamento é silencioso: o
              // layout fica errado só no tamanho de tela que ninguém abriu.
              faixaEmSm && !faixaEmLg && 'lg:flex-col lg:gap-3',
            )
            const tetoDoTexto = cn(
              faixaEmSm && 'sm:flex sm:max-w-md sm:flex-col sm:gap-1',
              faixaEmSm && !faixaEmLg && 'lg:max-w-none lg:gap-0',
            )

            return (
              <RevealOnScroll
                key={feature.title}
                delay={feature.delay}
                className={spanUltimo}
              >
                <Card
                  className={cn(
                    'bg-card h-full rounded-none border-0 shadow-none ring-0',
                    'transition-colors duration-200',
                    'pointer:hover:bg-primary/[0.04]',
                  )}
                >
                  <CardContent className={layoutDoConteudo}>
                    {/* Sem a numeração que ficava ao lado do ícone.
                        Numeração é um device estrutural: comunica que a ORDEM
                        carrega informação. Em "Como funciona" isso é verdade
                        (traga a planilha → arraste → veja o dinheiro é uma
                        sequência real, e lá os números ficam). Aqui não: são
                        recursos independentes, e numerar sugere um passo a
                        passo que não existe — além de dividir a atenção com o
                        ícone, que é o que de fato identifica cada um.

                        A contagem saiu do texto de propósito: dizia "sete"
                        desde que o oitavo card entrou, e voltaria a mentir no
                        décimo. Comentário que afirma número envelhece sozinho. */}
                    <div
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-lg',
                        'bg-primary/10',
                      )}
                    >
                      <feature.icon className="text-primary size-5" />
                    </div>
                    {/* O teto de largura acompanha a faixa, não o "último":
                        ele existe para o texto não atravessar uma linha
                        inteira, e num card de coluna normal não há o que
                        limitar. Presas ao card errado, as duas condições
                        divergem na próxima vez que a lista mudar de tamanho —
                        que é exatamente o que acabou de acontecer. */}
                    <div className={tetoDoTexto}>
                      <h3 className="text-base font-semibold">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </RevealOnScroll>
            )
          })}
        </div>

        {/* O "Painel de resultados" é a feature que mais depende de ver para
            entender: a lista consegue dizer que existem gráficos, não como
            eles se parecem nem que são simples de ler. Um print do painel real
            responde a pergunta que a grade acima deixa aberta.

            Fica DEPOIS da grade, e não no meio: interromper sete cards para
            enfiar uma imagem quebraria a leitura em varredura, que é como
            grade de features é lida. */}
        <RevealOnScroll delay={520} className="mt-12">
          <ProdutoPrint nome="dashboard" alt="painel de resultados · Acme Corp" />
        </RevealOnScroll>
      </div>
    </section>
  )
}
