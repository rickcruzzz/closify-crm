import { PainelDoAnuncio } from '@/components/dono/painel-do-anuncio'
import { Card, CardContent } from '@/components/ui/card'
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


        {/* ## Sem token e "a Meta recusou" pedem coisas diferentes
            Este bloco so aparece quando a leitura da CONTA falha — as outras
            degradam sozinhas em `CardDeFalha`, sem derrubar a tela. A
            instrucao de gerar token so faz sentido no primeiro caso; mostra-la
            quando o token existe e a Meta esta fora do ar manda a pessoa
            refazer uma credencial que estava certa. */}
        <Card size="sm">
          <CardContent className="flex flex-col gap-2 py-6">
            <p className="text-sm font-medium">Ainda não consigo ler os números do anúncio.</p>
            <p className="text-muted-foreground text-sm text-pretty">{prontidao.erro}</p>
            {!process.env.META_ADS_TOKEN && (
              <p className="text-muted-foreground text-sm text-pretty">
                Para ligar: no Graph API Explorer da Meta, gere um token marcando{' '}
                <code>ads_read</code> e <code>ads_management</code>, e cole em{' '}
                <code>META_ADS_TOKEN</code> no <code>.env.local</code>. A página liga sozinha
                depois disso.
              </p>
            )}
          </CardContent>
        </Card>

      </div>
    )
  }

  // `utm_campaign` e `fbc` são o que liga uma empresa ao anúncio que a trouxe;
  // `utm_content` diz qual PEÇA, dentro da campanha. Ver `lib/dono/atribuicao.ts`
  // para por que este cruzamento é o número mais valioso da Central.
  const empresas: EmpresaAtribuivel[] = banco.empresas.map((e) => ({
    id: e.id,
    nome: e.nome,
    utmCampaign: e.utmCampaign,
    utmContent: e.utmContent,
    veioDeCliqueDeAnuncio: e.veioDeCliqueDeAnuncio,
    // Ativação é ter cadastrado o primeiro contato, e a contagem já vem do
    // banco na mesma leitura. Derivar daqui em vez de criar coluna nova mantém
    // uma definição só, igual à de `montarFunilDeAtivacao` e à do evento
    // `CustomizeProduct` que a Meta recebe.
    ativou: e.quantidadeDeContatos > 0,
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


      <PainelDoAnuncio
        prontidao={prontidao.dados}
        desempenho={desempenho}
        resumo={resumo}
        mensalidade={PRO_PLAN_PRICE}
      />

    </div>
  )
}
