// Sem `server-only` de propósito, ao contrário dos irmãos deste diretório:
// aqui não há I/O nenhum, e o pacote `server-only` lança fora de um Server
// Component, o que tornaria este arquivo impossível de testar no Vitest. Toda
// a leitura acontece nos outros módulos e chega como argumento.
import type {
  AssinaturaNoAsaas,
  EmailEnviado,
  EmpresaNaCentral,
  Pendencia,
  Resultado,
} from './tipos'

/** Sete dias em milissegundos. */
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000

/**
 * Assinaturas que só existem em ambiente de desenvolvimento.
 *
 * O checkout foi exercitado contra o Asaas de PRODUÇÃO durante o
 * desenvolvimento (decisão registrada em `docs/estado-atual.md`, item 3 da fila
 * técnica), e um dos scripts gravou uma assinatura com id inventado direto no
 * banco. Ela não existe no gateway, nunca vai receber webhook, e está dando Pro
 * de graça a uma empresa até setembro. Detectar pelo prefixo é frágil, e é
 * justamente por isso que vale sinalizar: id que não veio do Asaas é dado que
 * não deveria estar lá.
 */
const PREFIXO_DE_TESTE = 'sub_teste'

type EntradaDoCruzamento = {
  empresas: EmpresaNaCentral[]
  assinaturasNoBanco: {
    workspace_id: string
    status: string
    current_period_end: string | null
    asaas_subscription_id: string | null
  }[]
  assinaturasNoAsaas: Resultado<AssinaturaNoAsaas[]>
  emails: Resultado<EmailEnviado[]>
  errosRecentes: number
  /** Injetável para o teste não depender do relógio. */
  agora?: Date
}

/**
 * Monta a fila de "precisa da sua atenção".
 *
 * ## Por que uma função pura
 *
 * Ela concentra a única inteligência real desta tela: decidir o que está
 * errado. Toda a leitura (banco, Asaas, Resend) acontece fora e chega como
 * argumento, então isto é testável sem mockar três serviços — mesmo padrão de
 * extração de `mensagemPorContagemDeConexoes`
 * (`lib/integrations/mensagem-bloqueio-pro.ts`) e de
 * `ordenarPorRelevancia` (`lib/calendario/`).
 *
 * ## O que ela encontrou na primeira execução, em produção
 *
 * Três assinaturas ativas no Asaas que não estavam entregando o Pro, e uma
 * assinatura de teste dando Pro de graça. Nenhuma dessas quatro coisas gerava
 * erro em lugar nenhum — o sistema estava, do ponto de vista dele, funcionando.
 */
export function montarPendencias({
  empresas,
  assinaturasNoBanco,
  assinaturasNoAsaas,
  emails,
  errosRecentes,
  agora = new Date(),
}: EntradaDoCruzamento): Pendencia[] {
  const pendencias: Pendencia[] = []
  const empresaPorId = new Map(empresas.map((e) => [e.id, e]))

  // 1. Assinatura de teste vivendo no banco de produção.
  for (const linha of assinaturasNoBanco) {
    if (!linha.asaas_subscription_id?.startsWith(PREFIXO_DE_TESTE)) continue

    const empresa = empresaPorId.get(linha.workspace_id)
    pendencias.push({
      id: `teste:${linha.asaas_subscription_id}`,
      gravidade: 'atencao',
      titulo: 'Assinatura de teste dando Pro de graça',
      detalhe: `A empresa ${empresa?.nome ?? linha.workspace_id} está com Pro por causa de uma assinatura que só existe aqui no banco (${linha.asaas_subscription_id}). Ela não existe no Asaas, ninguém pagou, e nenhum webhook vai corrigir isso sozinho.`,
      empresa: empresa?.nome,
      email: empresa?.email ?? undefined,
    })
  }

  // 2. O cruzamento com o gateway. Só roda se a lista do Asaas veio: sem ela,
  //    silêncio é melhor que acusar divergência que pode não existir.
  if (assinaturasNoAsaas.ok) {
    const vivasNoAsaas = assinaturasNoAsaas.dados.filter(
      (a) => a.status === 'ACTIVE' && !a.deleted,
    )
    const porIdNoBanco = new Map(
      assinaturasNoBanco
        .filter((l) => l.asaas_subscription_id)
        .map((l) => [l.asaas_subscription_id as string, l]),
    )

    for (const assinatura of vivasNoAsaas) {
      const noBanco = porIdNoBanco.get(assinatura.id)

      if (!noBanco) {
        pendencias.push({
          id: `orfa:${assinatura.id}`,
          gravidade: 'dinheiro',
          titulo: 'Assinatura ativa que o sistema não conhece',
          detalhe: `A assinatura ${assinatura.id} está ativa no Asaas, mas não existe nenhuma linha para ela aqui. Alguém pode estar pagando sem ter o Pro liberado.`,
          acao: {
            tipo: 'consertar-assinatura',
            alvo: assinatura.id,
            rotulo: 'Buscar no Asaas e corrigir',
          },
        })
        continue
      }

      const empresa = empresaPorId.get(noBanco.workspace_id)
      const entregandoPro = empresa?.pagando === true

      if (!entregandoPro) {
        pendencias.push({
          id: `naoentrega:${assinatura.id}`,
          gravidade: 'dinheiro',
          titulo: 'Assinatura ativa que não virou Pro',
          detalhe: `${empresa?.nome ?? noBanco.workspace_id} tem assinatura ativa no Asaas, mas aqui está como "${noBanco.status}"${noBanco.current_period_end ? '' : ' e sem data de vencimento'} — ou seja, a pessoa não está recebendo o que assinou.`,
          empresa: empresa?.nome,
          email: empresa?.email ?? undefined,
          acao: {
            tipo: 'consertar-assinatura',
            alvo: assinatura.id,
            rotulo: 'Corrigir agora',
          },
        })
      }
    }
  }

  // 3. Pro vencendo em até 7 dias — janela para cobrar antes de perder.
  const limite = agora.getTime() + SETE_DIAS
  for (const empresa of empresas) {
    if (!empresa.pagando || !empresa.proVenceEm) continue
    const vence = new Date(empresa.proVenceEm).getTime()
    if (vence > agora.getTime() && vence <= limite) {
      pendencias.push({
        id: `vencendo:${empresa.id}`,
        gravidade: 'atencao',
        titulo: 'Pro vencendo esta semana',
        detalhe: `O Pro de ${empresa.nome} vence em ${new Date(empresa.proVenceEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
        empresa: empresa.nome,
        email: empresa.email ?? undefined,
      })
    }
  }

  // 4. E-mail que saiu e não chegou. `sent` recente é normal (ainda em
  //    trânsito), então só entra o que já falhou de verdade.
  if (emails.ok) {
    const falhados = emails.dados.filter(
      (e) => !e.chegou && e.ultimoEvento !== 'sent' && e.ultimoEvento !== 'scheduled',
    )
    for (const email of falhados) {
      pendencias.push({
        id: `email:${email.id}`,
        gravidade: 'atencao',
        titulo: 'E-mail que não chegou',
        detalhe: `"${email.assunto}" para ${email.para} terminou como "${email.ultimoEvento}". Se era confirmação de cadastro ou recuperação de senha, essa pessoa está travada sem saber por quê.`,
        email: email.para,
      })
    }
  }

  // 5. Erros registrados. Um só já vale olhar: `error_logs` não tem tela de
  //    leitura no produto, então ninguém veria de outro jeito.
  if (errosRecentes > 0) {
    pendencias.push({
      id: 'erros',
      gravidade: 'atencao',
      titulo: errosRecentes === 1 ? '1 erro registrado' : `${errosRecentes} erros registrados`,
      detalhe:
        'Alguém bateu numa tela de erro dentro do produto. Os detalhes ficam na tabela error_logs, que não tem tela própria.',
    })
  }

  // Dinheiro primeiro: é o único tipo que custa caro por dia parado.
  return pendencias.sort((a, b) => {
    if (a.gravidade === b.gravidade) return 0
    return a.gravidade === 'dinheiro' ? -1 : 1
  })
}
