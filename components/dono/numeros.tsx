import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  Banknote,
  Clock,
  Gift,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatarDinheiro } from '@/lib/dono/formato'
import type { DinheiroNoAsaas, NumerosDaCentral, Resultado } from '@/lib/dono/tipos'
import type { QuadroDeReceita } from '@/lib/dono/receita'
import { cn } from '@/lib/utils'

/**
 * Os números do topo, na ordem em que importam.
 *
 * ## Por que o que entra por mês vem primeiro e maior
 *
 * É o único número que responde "o negócio está de pé?". Contas criadas é
 * vaidade se ninguém paga; saldo é consequência. A hierarquia visual segue a
 * hierarquia da decisão, não o que é mais fácil de calcular.
 *
 * ## Por que os números do Asaas ficam na mesma fileira
 *
 * Porque a pergunta real do dono é uma só ("quanto tenho e quanto vou ter"), e
 * ela hoje exige abrir dois sistemas. Separar em duas seções por causa da
 * origem técnica do dado seria organizar a tela pela conveniência de quem a
 * escreveu.
 */
export function Numeros({
  numeros,
  receita,
  dinheiro,
}: {
  numeros: NumerosDaCentral
  /** `null` quando o Asaas não respondeu. Ver `lib/dono/receita.ts`. */
  receita: QuadroDeReceita | null
  dinheiro: Resultado<DinheiroNoAsaas>
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* ## O card que mentia, e o que mudou
            Até 30/08 ele fazia `pro_vigente() * R$ 49` e dizia
            "R$ 490,00 · 10 clientes pagando". `pro_vigente()` é
            `assinatura viva OU trial válido` — 10 empresas estavam em TRIAL
            gratuito, e o Asaas registrava um único pagamento de R$ 49, feito
            pelo próprio dono para provar o checkout.

            Agora só entra aqui quem tem assinatura viva no gateway COM
            pagamento confirmado. O resto aparece como o que é, no card ao
            lado — esconder o trial seria trocar um número inflado por um
            número mudo. */}
        <NumeroCard
          rotulo="Entra por mês"
          valor={receita ? formatarDinheiro(receita.entraPorMes) : '-'}
          icone={TrendingUp}
          destaque
          // `—` e não R$ 0,00 quando o Asaas não responde: "não sei" é
          // diferente de "ninguém paga", e a segunda é afirmação falsa com
          // cara de dado.
          tom={!receita ? 'atencao' : undefined}
          nota={
            !receita
              ? 'Asaas fora do ar, não dá para afirmar'
              : receita.pagantes === 0
                ? 'ninguém paga ainda'
                : receita.pagantes === 1
                  ? '1 cliente pagando de verdade'
                  : `${receita.pagantes} clientes pagando de verdade`
          }
        />
        {/* Acesso sem receita, num card próprio. É o número que decide quanto
            PODE virar dinheiro nos próximos dias — e que antes estava
            escondido DENTRO da receita, inflando-a. */}
        <NumeroCard
          rotulo="Usando sem pagar"
          valor={receita ? String(receita.emTrial + receita.cortesias + receita.assinaramSemPagar) : '-'}
          icone={Gift}
          nota={
            receita
              ? [
                  receita.emTrial > 0 ? `${receita.emTrial} em trial` : null,
                  receita.cortesias > 0 ? `${receita.cortesias} de cortesia` : null,
                  receita.assinaramSemPagar > 0
                    ? `${receita.assinaramSemPagar} assinou e não pagou`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'ninguém'
              : 'Asaas fora do ar'
          }
        />
        <NumeroCard
          rotulo="Contas criadas"
          valor={String(numeros.contasCriadas)}
          icone={Users}
          nota="desde o começo"
        />
        <NumeroCard
          rotulo="Novas esta semana"
          valor={String(numeros.novasEm7Dias)}
          icone={UserPlus}
          nota="últimos 7 dias"
        />
        {dinheiro.ok ? (
          <NumeroCard
            rotulo="Na conta"
            valor={formatarDinheiro(dinheiro.dados.saldo)}
            icone={Wallet}
            nota="saldo no Asaas"
          />
        ) : (
          <CardDeFalha mensagem="Não consegui falar com o Asaas" detalhe={dinheiro.erro} />
        )}
      </div>

      {dinheiro.ok && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <NumeroCard
            rotulo="A receber"
            valor={formatarDinheiro(dinheiro.dados.aReceber.total)}
            icone={Clock}
            nota={`${dinheiro.dados.aReceber.quantidade} cobrança(s) aberta(s)`}
          />
          <NumeroCard
            rotulo="Vencido"
            valor={formatarDinheiro(dinheiro.dados.vencido.total)}
            icone={AlertCircle}
            // Só fica vermelho quando há valor de verdade: pintar R$ 0,00 de
            // vermelho ensina o olho a ignorar a cor quando ela importar.
            tom={dinheiro.dados.vencido.total > 0 ? 'ruim' : undefined}
            nota={`${dinheiro.dados.vencido.quantidade} cobrança(s) atrasada(s)`}
          />
          <NumeroCard
            rotulo="Já recebido"
            valor={formatarDinheiro(dinheiro.dados.recebido.total)}
            icone={Banknote}
            nota={`${dinheiro.dados.recebido.quantidade} pagamento(s)`}
          />
          <NumeroCard
            rotulo="Assinaturas no Asaas"
            valor={String(dinheiro.dados.assinaturasAtivas)}
            icone={Users}
            // A comparação que expôs o problema: o gateway sabe quantas
            // assinaturas estão vivas, e o nosso banco pode discordar. Mostrar
            // os dois lado a lado torna a divergência impossível de não ver.
            // A comparação certa é contra quem PAGA, não contra quem tem
            // acesso: assinatura viva no gateway sem pagamento é uma venda
            // travada, e era isso que o número antigo escondia.
            tom={
              receita && dinheiro.dados.assinaturasAtivas !== receita.pagantes
                ? 'atencao'
                : undefined
            }
            nota={
              !receita
                ? 'sem comparação'
                : dinheiro.dados.assinaturasAtivas !== receita.pagantes
                  ? `mas só ${receita.pagantes} pagando de fato`
                  : 'bate com o dinheiro'
            }
          />
        </div>
      )}
    </section>
  )
}

/** Exportado desde 02/09: a tela de anuncio reusa em vez de manter uma copia. */
export function NumeroCard({
  rotulo,
  valor,
  icone: Icone,
  nota,
  destaque,
  tom,
}: {
  rotulo: string
  valor: string
  icone: LucideIcon
  nota?: string
  destaque?: boolean
  tom?: 'ruim' | 'atencao'
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <Icone aria-hidden className="size-4" />
          {rotulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        <span
          className={cn(
            'font-semibold tabular-nums',
            destaque ? 'text-3xl' : 'text-2xl',
            tom === 'ruim' && 'text-red-500',
            tom === 'atencao' && 'text-amber-500',
          )}
        >
          {valor}
        </span>
        {nota && <span className="text-muted-foreground text-xs">{nota}</span>}
      </CardContent>
    </Card>
  )
}

/** Idem. Bloco de fonte externa fora do ar, com o erro cru. */
export function CardDeFalha({ mensagem, detalhe }: { mensagem: string; detalhe: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <AlertCircle aria-hidden className="size-4" />
          {mensagem}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* O erro cru, não uma mensagem amigável: quem lê esta tela é quem
            conserta o sistema, e "algo deu errado" não ajuda ninguém a agir. */}
        <p className="text-muted-foreground line-clamp-3 text-xs">{detalhe}</p>
      </CardContent>
    </Card>
  )
}
