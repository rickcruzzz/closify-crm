import { Navegacao } from '@/components/dono/navegacao'
import { PainelDoAnuncio } from '@/components/dono/painel-do-anuncio'
import { Card, CardContent } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import {
  cruzarCampanhasComClientes,
  resumirAtribuicao,
  type EmpresaAtribuivel,
} from '@/lib/dono/atribuicao'
import { lerProntidao } from '@/lib/dono/meta-ads'
import { lerBanco } from '@/lib/dono/queries'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'
import { PRO_PLAN_PRICE } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export default async function PaginaDoAnuncio() {
  await exigirAmbienteLocal()

  // As duas leituras em paralelo: a Meta não depende do banco nem o contrário,
  // e é o cruzamento delas que produz o número que importa.
  const [prontidao, banco] = await Promise.all([lerProntidao(), lerBanco()])

  if (!prontidao.ok) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Anúncio</h1>
          <p className="text-muted-foreground text-sm">
            Gasto, resultado e controle das campanhas.
          </p>
        </header>

        <Navegacao />

        <Card size="sm">
          <CardContent className="flex flex-col gap-2 py-6">
            <p className="text-sm font-medium">Ainda não consigo ler os números do anúncio.</p>
            <p className="text-muted-foreground text-sm text-pretty">{prontidao.erro}</p>
            <p className="text-muted-foreground text-sm text-pretty">
              Para ligar: no Graph API Explorer da Meta, gere um token marcando{' '}
              <code>ads_read</code> e <code>ads_management</code>, e cole em{' '}
              <code>META_ADS_TOKEN</code> no <code>.env.local</code>. A página liga sozinha depois
              disso.
            </p>
          </CardContent>
        </Card>

        <Toaster />
      </div>
    )
  }

  // `utm_campaign` e `fbc` são o que liga uma empresa ao anúncio que a trouxe.
  // Ver `lib/dono/atribuicao.ts` para por que este cruzamento é o número mais
  // valioso da Central.
  const empresas: EmpresaAtribuivel[] = banco.empresas.map((e) => ({
    id: e.id,
    nome: e.nome,
    utmCampaign: e.utmCampaign,
    veioDeCliqueDeAnuncio: e.veioDeCliqueDeAnuncio,
    pagando: e.pagando,
    criadoEm: e.criadoEm,
  }))

  const desempenho = cruzarCampanhasComClientes(
    prontidao.dados.campanhas,
    empresas,
    PRO_PLAN_PRICE,
  )
  const resumo = resumirAtribuicao(desempenho, empresas, PRO_PLAN_PRICE)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Anúncio</h1>
        <p className="text-muted-foreground text-sm">
          Conta {prontidao.dados.contaNome} · fuso {prontidao.dados.fusoHorario}
        </p>
      </header>

      <Navegacao />

      <PainelDoAnuncio
        prontidao={prontidao.dados}
        desempenho={desempenho}
        resumo={resumo}
        mensalidade={PRO_PLAN_PRICE}
      />

      <Toaster />
    </div>
  )
}
