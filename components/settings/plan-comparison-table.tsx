import { Building2, Check, ShieldCheck, Users } from 'lucide-react'

import { CartaoDePlano, type LimiteDoPlano } from '@/components/settings/cartao-de-plano'
import { SubscribeButton } from '@/components/settings/subscribe-button'
import type { PlanoEfetivo } from '@/lib/plans'
import {
  FREE_COLABORADORES,
  FREE_LEAD_LIMIT,
  FREE_PLAN_PRICE,
  FREE_WORKSPACE_LIMIT,
  PAPEIS_DO_COLABORADOR,
  PRO_WORKSPACE_LIMIT,
  PRO_PLAN_PRICE,
} from '@/lib/plans'

/**
 * Os dois planos lado a lado, em Configurações → Cobrança.
 *
 * ## O que esta tela não fazia, e era o principal
 *
 * Ela comparava e **não oferecia**. Os dois cartões terminavam na última linha
 * da lista, sem botão nenhum — quem se convencia lendo o cartão do Pro tinha
 * que rolar de volta para achar o "Assinar Pro" que mora no card de cima,
 * dentro de outro bloco. Comparar é o momento em que a decisão acontece, e o
 * botão estava noutro lugar.
 *
 * ## Os limites viraram uma FAIXA, e não mais três linhas de lista
 *
 * Empresas, colaboradores e contatos são a pergunta que a pessoa de fato traz
 * ("cabe o meu caso?"), e estavam dissolvidos no meio de sete linhas com o
 * mesmo peso de "Funil visual". Agora abrem o cartão, com ícone e número
 * grande, e a lista fica só para o que é recurso.
 *
 * Isso também resolve o espaço vazio: o cartão do Free tinha sete linhas e o do
 * Pro seis, e a diferença de altura deixava um buraco embaixo de um deles.
 */

/** O que cada plano LIMITA. Número grande, porque é o que decide. */
type Limite = LimiteDoPlano

const LIMITES_FREE: Limite[] = [
  {
    icone: Building2,
    valor: String(FREE_WORKSPACE_LIMIT),
    rotulo: FREE_WORKSPACE_LIMIT === 1 ? 'empresa' : 'empresas',
  },
  {
    // "Você + 1" e não "2 colaboradores": `FREE_MEMBER_LIMIT` conta PESSOAS na
    // empresa, e `verificarLimiteDeMembros` soma o dono. Dizer "2
    // colaboradores" prometia três pessoas — e a terceira tomava erro depois
    // de o convite já ter sido mandado.
    icone: Users,
    valor: `Você + ${FREE_COLABORADORES}`,
    rotulo: FREE_COLABORADORES === 1 ? 'colaborador' : 'colaboradores',
  },
  { icone: Check, valor: String(FREE_LEAD_LIMIT), rotulo: 'contatos' },
]

const LIMITES_PRO: Limite[] = [
  { icone: Building2, valor: String(PRO_WORKSPACE_LIMIT), rotulo: 'empresas' },
  { icone: Users, valor: 'Ilimitados', rotulo: 'colaboradores' },
  { icone: Check, valor: 'Ilimitados', rotulo: 'contatos' },
]

/**
 * O que cada plano FAZ. Sem os limites, que subiram para a faixa.
 *
 * A MESMA lista da seção de planos da landing, na mesma ordem.
 *
 * Antes eram três descrições diferentes do mesmo plano — aqui, no
 * `plan-card.tsx` e na landing — e as três discordavam. Divergência entre
 * superfícies é a classe que este projeto já pagou com o CNPJ em dois lugares
 * e com a promessa de trial em três. Ao mexer numa, mexer nas três.
 */
const FREE_FEATURES = [
  'Funil visual, arrasta e solta',
  'Orçamento com prazo, e o lembrete nasce junto',
  'Painel de resultados',
  'Convites por e-mail',
  // Nenhum gate de plano no caminho, conferido em `api/leads/exportar` e no
  // diálogo de importação. A landing lista os dois; esta ficaria a menos.
  'Importe e exporte seus contatos',
]

const PRO_FEATURES = [
  'Tudo do Free',
  // Google Calendar e Gmail são exclusivos do Pro desde 12/08 e são o recurso
  // mais concreto do plano: o resto é "mais do mesmo, sem limite", estes dois
  // são coisa que o Free não faz de jeito nenhum.
  'Agenda ligada ao Google Calendar',
  'E-mail pelo Gmail, registrado no cliente',
  'PDF do orçamento para mandar ao cliente',
  // Não há linha de suporte, e ela NÃO deve voltar como "prioritário": era
  // falso, não existe fila nem SLA. Se um dia voltar, só como PRAZO cumprível.
]

export function PlanComparisonTable({
  plan,
  isAdmin = false,
  assinarDeInicio = false,
}: {
  /** O plano EFETIVO, de `planoEfetivo()`. Ver o comentario em `lib/plans.ts`. */
  plan: PlanoEfetivo
  /**
   * Só admin assina — `createCheckout` recusa os demais. Mostrar o botão a
   * quem não pode usar produz um caminho morto, e caminho morto numa tela de
   * conversão é pior que ausência: ele gasta a decisão e devolve um erro.
   */
  isAdmin?: boolean
  /** Abre o formulario direto, para quem chega por `?assinar=1` ja decidido. */
  assinarDeInicio?: boolean
}) {
  return (
    <div id="comparar" className="flex flex-col gap-4">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <CartaoDePlano
          nome="Free"
          preco={FREE_PLAN_PRICE}
          descricao="Para começar a organizar o funil."
          limites={LIMITES_FREE}
          recursos={FREE_FEATURES}
          ehAtual={plan === 'free'}
        />
        <CartaoDePlano
          nome="Pro"
          preco={PRO_PLAN_PRICE}
          descricao="Para quem já vive de orçamento."
          limites={LIMITES_PRO}
          recursos={PRO_FEATURES}
          // `!== 'free'` e não `=== 'pro'`: quem tem Max tem tudo do Pro, e o
          // cartão do Pro marcado como "não é o seu" para quem paga R$ 250
          // convidaria a assinar o plano de baixo.
          ehAtual={plan !== 'free'}
          recomendado
          // O botão mora AQUI, no cartão que convence. Ver o cabeçalho.
          //
          // `plan` vem de `planoEfetivo`, que lê a FUNÇÃO e não a coluna. Com a
          // coluna, uma empresa coberta pela assinatura de outra do mesmo dono
          // (ramo 3 de `pro_vigente`) aparecia como Free e via este botão: a
          // pessoa pagaria R$ 97 de novo por um plano que já tem.
          acao={plan === 'free' && isAdmin ? <SubscribeButton className="w-full" abrirDeInicio={assinarDeInicio} /> : null}
          aviso={
            plan === 'free' && !isAdmin
              ? 'Peça a um administrador da empresa para fazer o upgrade.'
              : null
          }
        />
      </div>

      <Permissoes />
    </div>
  )
}

/**
 * As permissões, fora dos cartões.
 *
 * O pedido era explicar Membro e Administrador "sem poluir o card principal".
 * Elas valem para os DOIS planos — o Free também escolhe o papel do único
 * colaborador que cabe —, então repeti-las em cada cartão diria duas vezes a
 * mesma coisa e roubaria espaço de onde os planos de fato diferem.
 */
function Permissoes() {
  return (
    <div className="border-border/60 bg-muted/20 flex flex-col gap-2 rounded-lg border p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck aria-hidden className="text-muted-foreground size-4" />
        Cada colaborador entra com um papel
      </p>
      <dl className="flex flex-col gap-1.5 sm:flex-row sm:gap-6">
        {PAPEIS_DO_COLABORADOR.map((p) => (
          <div key={p.papel} className="flex items-baseline gap-2 text-sm">
            <dt className="font-medium">{p.papel}</dt>
            <dd className="text-muted-foreground">{p.pode}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
