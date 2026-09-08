import { MensagensQueVaoSair } from '@/components/dono/mensagens-que-vao-sair'
import { aberturasSuspeitas, agruparPorModelo } from '@/lib/dono/mensagens'
import { carregarPrateleira } from '@/lib/dono/prateleira-queries'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/** Ver o comentário em `app/(dono)/dono/page.tsx`: número velho é pior que nenhum. */
export const dynamic = 'force-dynamic'

/**
 * O que vai ser mandado, antes de ser mandado.
 *
 * ## A pergunta que criou esta tela
 *
 * *"A mensagem é a mesma para todas as empresas?"* — e não havia como
 * responder olhando: o texto só aparecia depois do clique, dentro do `wa.me`,
 * ou enterrado numa nota da timeline. Oitocentas e oitenta e duas mensagens
 * prontas e nenhuma superfície para revisá-las.
 *
 * ## A resposta, medida
 *
 * Quase. Das 790 do universo, em 08/09: 788 textos distintos, mas **786 dessas
 * diferenças estão só na primeira linha**, que carrega o nome. O gancho tem 5
 * variantes (uma por nicho) e o corpo tem 2 (com e sem a linha de equipe).
 *
 * São **dez modelos**, e é por isso que a tela agrupa em vez de listar: uma
 * lista de 882 textos esconderia justamente a repetição, que é o achado.
 *
 * ## E a repetição é risco, não estética
 *
 * `docs/mercado/limites-e-bloqueios.md` lista "texto idêntico" entre o que faz
 * o WhatsApp banir — a mesma string para centenas de destinos é o padrão mais
 * fácil de detectar. O número em risco é o do dono, e ele é ao mesmo tempo o
 * canal de venda e o de suporte do produto.
 */
export default async function PaginaDeMensagens() {
  await exigirAmbienteLocal()

  const { prospects } = await carregarPrateleira()
  // Só quem ainda não foi contatado: rever o texto de quem já recebeu não muda
  // mais nada, e infla a contagem com trabalho já feito.
  const naFila = prospects.filter((p) => p.estado === 'novo')

  const modelos = agruparPorModelo(naFila)
  const suspeitas = aberturasSuspeitas(naFila)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="text-muted-foreground text-sm">
          Exatamente o que sai para cada empresa da fila, agrupado pelo que se repete.
          Clique num modelo para ler o texto inteiro.
        </p>
      </header>

      <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
        <span>
          <span className="text-foreground font-semibold">{naFila.length}</span> empresas na
          fila
        </span>
        <span>
          <span className="text-foreground font-semibold">{modelos.length}</span>{' '}
          {modelos.length === 1 ? 'modelo de mensagem' : 'modelos de mensagem'}
        </span>
      </div>

      <MensagensQueVaoSair modelos={modelos} suspeitas={suspeitas} />

      <p className="text-muted-foreground border-border/60 border-t pt-4 text-xs">
        <strong className="text-foreground">
          Cada mensagem é única só no nome da empresa.
        </strong>{' '}
        O gancho muda por nicho e o corpo muda conforme o site revelou equipe de vendas —
        o resto é igual. Isso importa porque{' '}
        <strong className="text-foreground">texto quase idêntico em volume</strong> é o
        padrão que o WhatsApp detecta melhor, e o número em risco é o seu. Mensagens
        espaçadas, em horário comercial, respondendo quem responde: uma conversa real por
        hora vale mais que cem disparos.
      </p>
    </div>
  )
}
