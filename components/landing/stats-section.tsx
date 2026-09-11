import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { cn } from '@/lib/utils'
import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

// NÃO coloque métrica de resultado aqui ("+47% de conversão", "1.200+ times",
// "3.2x mais leads"). Esta seção já teve exatamente esses números, copiados de
// uma landing concorrente, enquanto o produto tinha zero clientes pagantes,
// eram afirmações falsas numa página que vende assinatura.
//
// A régua é simples: só entra aqui o que dá para provar hoje. Cada item abaixo
// é um atributo verificável do produto, não uma promessa de resultado. Quando
// existir dado real de uso (e a fonte puder ser citada), aí sim vale trocar.
//
// ## Por que estes quatro, e não outros (24/08)
//
// Esta é a faixa logo abaixo do hero — o lugar onde Agendor, Pipedrive, Attio e
// Tally, todos, colocam logos de clientes. Nós não temos logo para exibir, e
// inventar está fora de questão. Então a faixa passa a fazer o outro trabalho
// que ela pode fazer bem: **matar as quatro objeções que travam quem chegou de
// anúncio**, antes que virem motivo para fechar a aba.
//
// Os quatro anteriores não faziam isso. "R$ 0 / plano grátis para sempre"
// repetia o hero E contradizia o trial de sete dias que passou a existir na
// 0051. "100% / dados só da sua empresa" não é estatística: porcentagem sem
// unidade não mede nada, e o argumento de isolamento ficou melhor servido na
// seção de confiança, onde há espaço para dizer COMO. "Pix / boleto e cartão
// também" é lista de meio de pagamento com cara de número.
//
// Cada valor abaixo é verificável: o limite do Free vem de `FREE_LEAD_LIMIT`; os
// dois minutos são o tempo de criar a conta e entrar (ver a nota no próprio
// item — a versão anterior media até o primeiro contato, e o caminho real
// atravessa a caixa de entrada); o preço é o do plano Pro; e o banco roda em
// `sa-east-1` com as funções em `gru1` desde a correção de 22/08 — São Paulo é
// medição, não licença poética.
const stats = [
  {
    // Era "7 dias / de Pro completo, sem pedir cartao", verdade enquanto a
    // empresa nascia com trial. A 0057 tirou isso, e numero que descreve o
    // produto vira mentira no instante em que o produto muda — este arquivo ja
    // teve metrica inventada removida por copia de concorrente, e o comentario
    // acima existe justamente para isso nao voltar.
    //
    // O limite do Free e o numero equivalente: e o que a pessoa ganha sem
    // pagar, e ele sai da constante, nao escrito a mao.
    value: String(FREE_LEAD_LIMIT),
    label: 'contatos no plano grátis, sem pedir cartão',
    delay: 0,
  },
  {
    // Dizia "do cadastro ao primeiro contato", e o caminho real não cabe nisso:
    // o formulário termina em `/verifique-email`, a pessoa SAI DO SITE para
    // abrir a caixa de entrada, volta em `/confirmar`, e só então atravessa as
    // quatro perguntas do assistente. A ida ao e-mail sozinha já invalida
    // qualquer promessa de dois minutos, e ela aparecia em DUAS seções.
    //
    // Prometer na landing um prazo que o produto não cumpre é a forma mais
    // cara de queimar tráfego pago: a decepção acontece depois do clique pago,
    // não antes. O que sobrou é o que de fato leva dois minutos e é o passo
    // que a página está pedindo — criar a conta.
    value: '2 min',
    label: 'para criar a conta e entrar',
    delay: 130,
  },
  {
    // Derivado desde 10/09. Escrito a mao, este numero sobreviveu a troca de
    // preco e ficou dizendo 49 na barra de numeros da landing enquanto o
    // cartao de plano logo abaixo ja dizia 97 — na mesma pagina.
    value: `R$ ${PRO_PLAN_PRICE}`,
    label: 'por mês, pela empresa toda',
    delay: 260,
  },
  {
    value: 'Brasil',
    label: 'seus dados ficam em São Paulo',
    delay: 390,
  },
]

export function StatsSection() {
  return (
    <section className="border-border/60 relative border-y px-4 py-14 md:px-6 md:py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
        {stats.map((stat) => (
          <RevealOnScroll
            key={stat.label}
            delay={stat.delay}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <span
              className={cn(
                // `text-numero-md sm:text-numero-lg` no lugar de
                // `text-3xl md:text-4xl tracking-tighter`: o token carrega
                // tamanho, altura, peso e tracking casados, e é o MESMO que o
                // preço do cartão de plano usa. Antes os dois divergiam no
                // tracking sem que nada justificasse.
                'text-numero-md sm:text-numero-lg',
                // Um acento so, o da marca. Quatro matizes diferentes aqui
                // nao codificavam nada — "2 min", "R$ 49" e "Brasil" nao sao
                // categorias — e no claro leem como grafico de template.
                'text-primary',
              )}
            >
              {stat.value}
            </span>
            <span className="text-muted-foreground max-w-[16ch] font-mono text-sm leading-relaxed tracking-wide uppercase">
              {stat.label}
            </span>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  )
}
