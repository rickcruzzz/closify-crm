import { LinkComOrigem } from '@/components/landing/link-com-origem'
import { buttonVariants } from '@/components/ui/button'
import { FREE_LEAD_LIMIT } from '@/lib/plans'
import { cn } from '@/lib/utils'

/**
 * Uma saída no meio do texto, onde o argumento fecha.
 *
 * ## O vão que isto preenche, medido em 04/09
 *
 * `/quanto-custa-um-crm` é o destino dos anúncios de busca — o título dela casa
 * com o que a pessoa digitou, e é isso que sobe o Índice de Qualidade e derruba
 * o CPC, a única alavanca que faz R$ 25/dia caber num leilão onde RD Station e
 * Pipedrive pagam R$ 12 por clique.
 *
 * Medido no telefone (390x659), ela tinha **dois** botões de cadastro:
 *
 *     y = 8       o da navbar, pequeno, no canto
 *     y = 3.986   o do rodape
 *     entre os dois: NADA, por quase 6 telas
 *
 * A landing, para comparar, tem seis botões, o primeiro a 532px. Quem se
 * convencia no meio do artigo — que é exatamente onde a conta de R$ 300 contra
 * R$ 49 aparece — precisava rolar mais quatro telas ou voltar ao topo.
 *
 * ## Por que a resposta não foi trocar o destino pela landing
 *
 * A landing converte melhor por estrutura, e **perde no CPC**: o h1 dela fala de
 * planilha, não responde "quanto custa um crm", e Índice de Qualidade baixo pode
 * triplicar o preço do clique. Converter melhor sobre um terço das visitas é
 * conta pior.
 *
 * E tem o lado de quem chega: quem digitou aquela pergunta quer **a resposta**.
 * A landing vende. Mandar para lá é o mesmo atrito de um anúncio de feed, que é
 * justamente o que a busca existe para evitar.
 *
 * Então não se troca a página: tira-se o defeito conhecido dela.
 *
 * ## O que este bloco NÃO é
 *
 * Não é um segundo hero. Ele entra depois do argumento, não antes — quem ainda
 * está lendo não decidiu, e interromper com botão grande no meio da explicação
 * quebra a única coisa que esta página faz melhor que a landing: responder.
 *
 * O número sai de `lib/plans.ts`, nunca escrito à mão: mudar o limite do Free
 * não pode deixar uma página de tráfego pago mentindo.
 */
export function CtaNoMeio({
  chamada,
  children,
}: {
  /** A frase que continua o argumento que acabou de ser feito. */
  chamada: string
  children?: React.ReactNode
}) {
  return (
    <div className="bg-card ring-border my-8 rounded-xl p-5 ring-1 sm:p-6">
      <p className="text-foreground text-base font-medium text-pretty">{chamada}</p>
      <p className="text-muted-foreground mt-2 text-sm text-pretty">
        Grátis até {FREE_LEAD_LIMIT} contatos, sem cartão. Traga sua planilha do jeito
        que ela está — as colunas são reconhecidas sozinhas.
      </p>
      <div className="mt-4">
        <LinkComOrigem
          href="/cadastro"
          className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 w-full sm:w-auto')}
        >
          {children ?? 'Começar grátis'}
        </LinkComOrigem>
      </div>
    </div>
  )
}
