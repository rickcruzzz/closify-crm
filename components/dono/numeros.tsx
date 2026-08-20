import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Banknote, Clock, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatarDinheiro } from '@/lib/dono/formato'
import type { DinheiroNoAsaas, NumerosDaCentral, Resultado } from '@/lib/dono/tipos'
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
  dinheiro,
}: {
  numeros: NumerosDaCentral
  dinheiro: Resultado<DinheiroNoAsaas>
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <NumeroCard
          rotulo="Entra por mês"
          valor={formatarDinheiro(numeros.entraPorMes)}
          icone={TrendingUp}
          destaque
          nota={
            numeros.clientesPagando === 1
              ? '1 cliente pagando'
              : `${numeros.clientesPagando} clientes pagando`
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
            tom={
              dinheiro.dados.assinaturasAtivas !== numeros.clientesPagando ? 'atencao' : undefined
            }
            nota={
              dinheiro.dados.assinaturasAtivas !== numeros.clientesPagando
                ? `mas só ${numeros.clientesPagando} com Pro aqui`
                : 'bate com o sistema'
            }
          />
        </div>
      )}
    </section>
  )
}

function NumeroCard({
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

function CardDeFalha({ mensagem, detalhe }: { mensagem: string; detalhe: string }) {
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
