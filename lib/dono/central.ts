import 'server-only'

import { PRO_PLAN_PRICE } from '@/lib/plans'

import { lerDinheiro } from './dinheiro'
import { classificarAcesso, montarQuadroDeReceita, type EstadoDoAcesso } from './receita'
import type { AssinaturaNoAsaas, Resultado } from './tipos'
import { lerEmails } from './emails'
import { montarPendencias } from './pendencias'
import { lerBanco } from './queries'
import { lerSilenciados } from './silenciados'
import { exigirAmbienteLocal } from './somente-local'
import type { DadosDaCentral } from './tipos'

/**
 * Junta as fontes numa carga só.
 *
 * ## Por que tudo em paralelo, e por que cada fonte falha sozinha
 *
 * As quatro (banco, Asaas, Resend, Meta) são independentes: nenhuma precisa do
 * resultado da outra para começar. Encadear em série somaria quatro latências
 * de rede por abertura de tela — a mesma classe de desperdício já corrigida no
 * layout do dashboard e em `/settings/billing`.
 *
 * E cada uma devolve `Resultado<T>` em vez de lançar: o Asaas fora do ar não
 * pode apagar a lista de clientes, que vem do banco e está disponível. Uma
 * exceção não tratada aqui derrubaria a página inteira e esconderia os 90% que
 * funcionam — o oposto do que uma tela de monitoramento deve fazer quando algo
 * quebra.
 */
export async function lerCentral(): Promise<DadosDaCentral> {
  await exigirAmbienteLocal()

  // O anúncio NÃO entra aqui: ele tem página própria (`/dono/anuncio`), e a
  // leitura dele custa quatro chamadas à Meta. Fazer a Visão geral pagar isso
  // a cada abertura, para mostrar um bloco que o dono vai olhar uma vez por
  // dia, é o tipo de peso que só aparece quando a tela já está lenta.
  // UMA leitura do Asaas, não três. As outras duas funções faziam chamadas
  // próprias e repetiam `/subscriptions` e `/payments?status=RECEIVED` — eram
  // 8 idas ao gateway por F5, e em 30/08 o Asaas respondeu `429`.
  const [banco, dinheiro, emails, silenciados] = await Promise.all([
    lerBanco(),
    lerDinheiro(),
    lerEmails(),
    lerSilenciados(),
  ])

  // Tudo que vinha das duas chamadas extras sai daqui agora. Quando o Asaas
  // falha, `dinheiro.ok` é falso e os dois viram vazio — que é o mesmo
  // caminho de antes, com uma fonte só.
  const assinaturasNoAsaas: Resultado<AssinaturaNoAsaas[]> = dinheiro.ok
    ? { ok: true, dados: dinheiro.dados.assinaturas }
    : { ok: false, erro: dinheiro.erro }
  const idsPagas = dinheiro.ok ? dinheiro.dados.comPagamento : new Set<string>()

  // ## Onde o banco e o gateway se encontram
  //
  // A classificação acontece AQUI, e não em `queries.ts`, porque ela precisa
  // das duas fontes. `queries.ts` só conhece o banco, e decidir "é receita?"
  // sem o gateway foi exatamente o defeito de 30/08: `pro_vigente()` é
  // `assinatura viva OU trial válido`, então 10 empresas em trial gratuito
  // apareciam como R$ 490,00/mês.
  //
  // Quando o Asaas está fora do ar, `estadoDoAcesso` fica `null` em vez de
  // chutar: "não sei quem paga" é diferente de "ninguém paga", e a segunda é
  // uma afirmação falsa com aparência de dado.
  const vivasNoGateway = new Set(
    assinaturasNoAsaas.ok
      ? assinaturasNoAsaas.dados.filter((a) => a.status === 'ACTIVE' && !a.deleted).map((a) => a.id)
      : [],
  )
  const gatewayDisponivel = dinheiro.ok

  const empresas = banco.empresas.map((empresa) => {
    const assinatura = banco.assinaturas.find((a) => a.workspace_id === empresa.id)
    const idNoAsaas = assinatura?.asaas_subscription_id ?? null

    return {
      ...empresa,
      estadoDoAcesso: gatewayDisponivel
        ? classificarAcesso({
            interna: empresa.interna,
            temProVigente: empresa.pagando,
            emTrial: empresa.emTrial,
            assinaturaNoAsaas: idNoAsaas,
            assinaturaVivaNoGateway: Boolean(idNoAsaas && vivasNoGateway.has(idNoAsaas)),
            temPagamentoConfirmado: Boolean(idNoAsaas && idsPagas.has(idNoAsaas)),
          })
        : null,
    }
  })

  const receita = montarQuadroDeReceita(
    empresas.map((e) => e.estadoDoAcesso).filter((e): e is EstadoDoAcesso => e !== null),
    PRO_PLAN_PRICE,
  )

  const pendencias = montarPendencias({
    empresas,
    assinaturasNoBanco: banco.assinaturas,
    assinaturasNoAsaas,
    emails,
    errosRecentes: banco.errosRecentes,
    // É este conjunto que separa cliente travado de lixo de script. Ver o
    // comentário do filtro em `pendencias.ts`: sem ele, 8 dos 11 alertas da
    // primeira execução eram endereços inventados por testes meus.
    emailsDeContasReais: banco.emailsDeContasReais,
  })

  return {
    numeros: banco.numeros,
    // `null` quando o Asaas não respondeu: a tela precisa saber a diferença
    // entre "receita zero" e "não consegui perguntar".
    receita: gatewayDisponivel ? receita : null,
    empresas,
    podeEstarCortado: banco.podeEstarCortado,
    dinheiro,
    emails,
    // O silenciamento acontece DEPOIS de montar, não durante: assim
    // `montarPendencias` continua sendo uma função pura sobre "o que está
    // errado", sem saber nada sobre preferência de quem olha. E dá para contar
    // quantos foram escondidos, que é o que permite desfazer.
    pendencias: pendencias.filter((p) => !silenciados.has(p.id)),
    silenciadas: pendencias.filter((p) => silenciados.has(p.id)),
    errosRecentes: banco.errosRecentes,
    lidoEm: new Date().toISOString(),
  }
}
