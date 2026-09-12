// Sem `server-only` de propósito, ao contrário dos irmãos deste diretório:
// aqui não há I/O nenhum, e o pacote `server-only` lança fora de um Server
// Component, o que tornaria este arquivo impossível de testar no Vitest. Toda
// a leitura acontece nos outros módulos e chega como argumento.
import { dominioProvavelmenteErrado } from './dominios'
import type {
  AssinaturaNoAsaas,
  EmailEnviado,
  EmpresaComEstado,
  Pendencia,
  Resultado,
} from './tipos'

/** Sete dias em milissegundos. */
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000

/**
 * Quantos dias sem acessar até uma empresa contar como sumida.
 *
 * Catorze, não trinta: passado um mês a pessoa já esqueceu do produto e a
 * conversa de retomada é fria. Duas semanas ainda é "sumiu, o que aconteceu?".
 */
const DIAS_ATE_SUMIR = 14

/**
 * Assinaturas que só existem em ambiente de desenvolvimento.
 *
 * O checkout foi exercitado contra o Asaas de PRODUÇÃO durante o
 * desenvolvimento (decisão registrada em `docs/estado-atual.md`), e um script
 * gravou uma assinatura com id inventado direto no banco. Ela não existe no
 * gateway, nunca vai receber webhook, e dava Pro de graça a uma empresa.
 * Detectar pelo prefixo é frágil, e é justamente por isso que vale sinalizar:
 * id que não veio do Asaas é dado que não deveria estar lá.
 */
const PREFIXO_DE_TESTE = 'sub_teste'

type EntradaDoCruzamento = {
  empresas: EmpresaComEstado[]
  assinaturasNoBanco: {
    workspace_id: string
    status: string
    current_period_end: string | null
    asaas_subscription_id: string | null
  }[]
  assinaturasNoAsaas: Resultado<AssinaturaNoAsaas[]>
  /**
   * Quais assinaturas de fato RECEBERAM dinheiro (`RECEIVED` + `CONFIRMED`).
   *
   * Sem isto, o alerta mais caro desta tela mentia: `status = ACTIVE` no Asaas
   * significa que a assinatura existe e gera cobranças, e diz NADA sobre o
   * dinheiro ter entrado. Medido em 12/09 — as duas assinaturas vivas da conta
   * tinham só cobrança `OVERDUE`/`PENDING`, e a tela anunciava que duas
   * pessoas "não estavam recebendo o que assinaram".
   *
   * A direção do erro é o que custava: quem lesse liberaria Pro de cortesia
   * para quem nunca pagou.
   *
   * `central.ts` já calculava este conjunto (`idsPagas`) e o usava em
   * `classificarAcesso`, sem passar adiante. A regra existia; faltava chegar
   * aqui.
   */
  assinaturasPagas: Set<string>
  emails: Resultado<EmailEnviado[]>
  errosRecentes: number
  /** Id do erro mais recente. Carimba o alerta — ver o comentário no item 7. */
  idDoErroMaisRecente?: string | null
  /**
   * Todo e-mail que pertence a uma conta de verdade no banco.
   *
   * É o que separa cliente travado de lixo de script, ver o comentário do
   * filtro, mais abaixo.
   */
  emailsDeContasReais: Set<string>
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
 * (`lib/integrations/mensagem-bloqueio-pro.ts`).
 *
 * ## O que ela encontrou na primeira execução, em produção
 *
 * Três assinaturas ativas no Asaas que não estavam entregando o Pro, e uma
 * assinatura de teste dando Pro de graça. Nenhuma dessas quatro coisas gerava
 * erro em lugar nenhum — o sistema estava, do ponto de vista dele, funcionando.
 */
export function montarPendencias({
  empresas,
  assinaturasPagas,
  assinaturasNoBanco,
  assinaturasNoAsaas,
  emails,
  errosRecentes,
  idDoErroMaisRecente,
  emailsDeContasReais,
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
      tipo: 'assinatura-de-teste',
      titulo: 'Assinatura de teste dando Pro de graça',
      detalhe: `A empresa ${empresa?.nome ?? linha.workspace_id} está com Pro por causa de uma assinatura que só existe aqui no banco (${linha.asaas_subscription_id}). Ela não existe no Asaas, ninguém pagou, e nenhum webhook vai corrigir isso sozinho.`,
      empresa: empresa?.nome,
      email: empresa?.email ?? undefined,
    })
  }

  // 2. O cruzamento com o gateway. Só roda se a lista do Asaas veio: sem ela,
  //    silêncio é melhor que acusar divergência que pode não existir.
  if (assinaturasNoAsaas.ok) {
    const vivasNoAsaas = assinaturasNoAsaas.dados.filter((a) => a.status === 'ACTIVE' && !a.deleted)
    const porIdNoBanco = new Map(
      assinaturasNoBanco
        .filter((l) => l.asaas_subscription_id)
        .map((l) => [l.asaas_subscription_id as string, l]),
    )

    for (const assinatura of vivasNoAsaas) {
      // Assinatura sem nenhum pagamento recebido não é "alguém pagando sem
      // receber" — é alguém que ainda não pagou, e o produto está certo em
      // não liberar o Pro. Ver a nota em `assinaturasPagas`.
      if (!assinaturasPagas.has(assinatura.id)) continue

      const noBanco = porIdNoBanco.get(assinatura.id)

      if (!noBanco) {
        pendencias.push({
          id: `orfa:${assinatura.id}`,
          gravidade: 'dinheiro',
          tipo: 'assinatura-orfa',
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

      // Conta nossa não é "pessoa que não está recebendo o que assinou".
      // Medido em 30/08: o único alerta deste tipo era da empresa "Agência",
      // `cafin50100@joystill.com` — domínio descartável, e que nunca pagou um
      // centavo. Terceiro lugar da mesma classe nesta tela.
      if (empresa?.interna) continue

      // `estadoDoAcesso === 'pagante'` e não `pagando`: aquele é
      // `pro_vigente()`, que inclui trial. Uma empresa em trial COM assinatura
      // ativa no gateway não dispararia o alerta, mesmo sem estar recebendo o
      // que assinou — o trial mascararia o problema até vencer.
      if (empresa?.estadoDoAcesso !== 'pagante') {
        pendencias.push({
          id: `naoentrega:${assinatura.id}`,
          gravidade: 'dinheiro',
          tipo: 'assinatura-nao-entrega',
          titulo: 'Assinatura ativa que não virou Pro',
          detalhe: `${empresa?.nome ?? noBanco.workspace_id} tem assinatura ativa no Asaas, mas aqui está como "${noBanco.status}"${noBanco.current_period_end ? '' : ' e sem data de vencimento'}. Ou seja, a pessoa não está recebendo o que assinou.`,
          empresa: empresa?.nome,
          email: empresa?.email ?? undefined,
          acao: { tipo: 'consertar-assinatura', alvo: assinatura.id, rotulo: 'Corrigir agora' },
        })
      }
    }
  }

  // 3. Pro vencendo em até 7 dias — janela para cobrar antes de perder.
  const limite = agora.getTime() + SETE_DIAS
  for (const empresa of empresas) {
    // Conta nossa vencendo não é cobrança a fazer. Mesma regra do alerta 6.
    if (empresa.interna) continue
    if (!empresa.pagando || !empresa.proVenceEm) continue
    const vence = new Date(empresa.proVenceEm).getTime()
    if (vence > agora.getTime() && vence <= limite) {
      pendencias.push({
        id: `vencendo:${empresa.id}`,
        gravidade: 'atencao',
        tipo: 'pro-vencendo',
        titulo: 'Pro vencendo esta semana',
        detalhe: `O Pro de ${empresa.nome} vence em ${new Date(empresa.proVenceEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
        empresa: empresa.nome,
        email: empresa.email ?? undefined,
      })
    }
  }

  // 4. E-mail que saiu e não chegou.
  //
  //    O filtro por conta real é o que torna esta lista utilizável. Antes dele,
  //    8 dos 11 alertas eram endereços inventados por scripts de teste
  //    (`repeticao-1@...`, `medicao-signup-...@...`) que nunca viraram usuário
  //    — 6 dos 7 e-mails com falha nem existiam no banco. Uma fila que nasce
  //    com 70% de lixo ensina a pessoa a ignorar a fila inteira.
  //
  //    A regra cabe numa frase: se ninguém se cadastrou com aquele endereço, o
  //    bounce é de script, não de cliente. Nenhuma lista negra, nenhum regex
  //    frágil de "parece teste" — que foi justamente o que quase fez apagar uma
  //    cliente real (ver `dominios.ts`).
  //
  //    `sent` e `scheduled` ficam de fora: significam "ainda em trânsito", que
  //    é normal por alguns segundos e não é falha.
  if (emails.ok) {
    const falhados = emails.dados.filter(
      (e) =>
        !e.chegou &&
        e.ultimoEvento !== 'sent' &&
        e.ultimoEvento !== 'scheduled' &&
        // ## Endereço do próprio domínio não é cliente travado
        //
        // Em 09/09 o painel acusou `demo.pro@velofunil.com.br` como e-mail
        // que não chegou. E não chegou mesmo: `@velofunil.com.br` não tem
        // caixa de entrada, é o domínio que o produto usa para ENVIAR. O
        // endereço quicou e o Resend o pôs na lista de supressão.
        //
        // O alerta existe para dizer "uma pessoa está travada sem saber por
        // quê". Conta de teste do próprio dono não é essa pessoa, e o alerta
        // gasta a atenção que deveria ir para o cliente de verdade.
        !e.para.toLowerCase().endsWith('@velofunil.com.br') &&
        emailsDeContasReais.has(e.para),
    )

    for (const email of falhados) {
      pendencias.push({
        id: `email:${email.id}`,
        gravidade: 'atencao',
        tipo: 'email-nao-chegou',
        titulo: 'E-mail que não chegou',
        detalhe: `"${email.assunto}" para ${email.para} terminou como "${email.ultimoEvento}". Se era confirmação de cadastro ou recuperação de senha, essa pessoa está travada sem saber por quê.`,
        email: email.para,
      })
    }
  }

  // 5. E-mail com domínio digitado errado — a pessoa nunca vai receber NADA.
  //    Diferente do caso acima: aqui não houve bounce ainda, o defeito está no
  //    cadastro. Ver `dominios.ts` para o caso real que motivou isto.
  for (const empresa of empresas) {
    // Hoje não dispara para ninguém (medido em 30/08: 0 de 0), mas o buraco
    // era o mesmo dos alertas 3 e 6: e-mail descartável com domínio "quase
    // certo" geraria alerta sobre uma pessoa que não existe.
    if (empresa.interna) continue
    const sugestao = dominioProvavelmenteErrado(empresa.email)
    if (!sugestao) continue

    pendencias.push({
      id: `dominio:${empresa.id}`,
      gravidade: 'atencao',
      tipo: 'email-com-erro-de-digitacao',
      titulo: 'E-mail cadastrado com erro de digitação',
      detalhe: `${empresa.nome} cadastrou "${empresa.email}", e provavelmente quis dizer "${sugestao}". Essa pessoa nunca vai receber confirmação de cadastro, recuperação de senha nem cobrança${empresa.telefone ? `. Dá para falar com ela pelo telefone que ela cadastrou: ${empresa.telefone}` : ', e não há telefone cadastrado para avisá-la'}.`,
      empresa: empresa.nome,
      email: empresa.email ?? undefined,
    })
  }

  // 6. Cliente que sumiu. Só conta quem chegou a usar: empresa sem nenhum
  //    contato nunca ativou, e isso é outro problema (ativação), não abandono.
  //
  //    ## E só conta CLIENTE, não conta de teste
  //
  //    Medido em 30/08: **3 de 3** alertas de "cliente sumido" eram contas de
  //    teste do próprio dono — inclusive uma chamada "agencia de marketig
  //    teste". É a repetição exata do defeito de 20/08, quando 8 de 11 alertas
  //    da primeira execução eram e-mails inventados por script.
  //
  //    Uma fila com 100% de ruído ensina a ignorar a fila inteira, e junto com
  //    o item chato vai embora o alerta de dinheiro que aparecer amanhã.
  const corteDeSumico = agora.getTime() - DIAS_ATE_SUMIR * 24 * 60 * 60 * 1000
  for (const empresa of empresas) {
    if (empresa.interna) continue
    if (empresa.quantidadeDeContatos === 0) continue
    if (!empresa.ultimoAcesso) continue

    const ultimo = new Date(empresa.ultimoAcesso).getTime()
    if (ultimo >= corteDeSumico) continue

    const dias = Math.floor((agora.getTime() - ultimo) / (24 * 60 * 60 * 1000))
    const paganteDeVerdade = empresa.estadoDoAcesso === 'pagante'
    pendencias.push({
      id: `sumido:${empresa.id}`,
      gravidade: 'atencao',
      tipo: 'cliente-sumido',
      // `estadoDoAcesso === 'pagante'`, NÃO `empresa.pagando`.
      //
      // `pagando` é `pro_vigente()`, que é `assinatura viva OU trial válido`.
      // Com ela, alguém em trial gratuito que sumiu virava "Cliente PAGANTE
      // sumido" com o texto "está pagando e não está usando" — uma frase
      // factualmente falsa sobre dinheiro, no lugar da Central que existe
      // justamente para não errar sobre dinheiro. É o mesmo defeito da receita
      // (30/08), propagado até o alerta.
      titulo: paganteDeVerdade ? 'Cliente pagante sumido' : 'Cliente sumido',
      detalhe: `${empresa.nome} não acessa há ${dias} dias, mas tem ${empresa.quantidadeDeContatos} contato(s) cadastrado(s). Chegou a usar e parou.${paganteDeVerdade ? ' Está pagando e não está usando, que é o caminho mais curto para o cancelamento.' : ''}`,
      empresa: empresa.nome,
      email: empresa.email ?? undefined,
    })
  }

  // 7. Erros registrados. Um só já vale olhar: `error_logs` não tem tela de
  //    leitura no produto, então ninguém veria de outro jeito.
  //
  //    ## O id é CARIMBADO pelo erro mais recente, e isso não é detalhe
  //
  //    Os outros oito alertas desta função têm id ligado à entidade
  //    (`sumido:${empresa.id}`, `orfa:${assinatura.id}`), então silenciar
  //    afeta aquele item e nada mais — se aparecer outro cliente sumido, ele
  //    aparece.
  //
  //    Este era o único com id FIXO (`'erros'`), e a consequência, medida em
  //    31/08: clicar em "Silenciar" apagava a categoria inteira para sempre,
  //    inclusive erro que surgisse depois. O dono ficava entre ver os mesmos 4
  //    erros de 7 e 11 dias atrás para sempre, ou nunca mais ver erro nenhum.
  //
  //    Com o carimbo, silenciar vale para o conjunto que existe HOJE. Erro
  //    novo muda o id e o alerta reaparece sozinho.
  //
  //    Janela de tempo foi considerada e descartada: faria erro raro e grave
  //    sumir por decurso de prazo sem nunca ter sido visto, e nenhum outro
  //    alerta desta tela desaparece pelo relógio.
  if (errosRecentes > 0) {
    pendencias.push({
      id: idDoErroMaisRecente ? `erros:${idDoErroMaisRecente}` : 'erros',
      gravidade: 'atencao',
      tipo: 'erros-no-produto',
      titulo:
        errosRecentes === 1
          ? '1 erro nos últimos 7 dias'
          : `${errosRecentes} erros nos últimos 7 dias`,
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

/** Um grupo de pendências do mesmo tipo, para a tela não repetir cartão igual. */
export type GrupoDePendencias = {
  tipo: Pendencia['tipo']
  titulo: string
  gravidade: Pendencia['gravidade']
  itens: Pendencia[]
}

/**
 * Junta pendências do mesmo tipo.
 *
 * Cinco e-mails que falharam são cinco cartões idênticos empurrando tudo que
 * importa para baixo da dobra. Como grupo, viram uma linha ("5 e-mails não
 * chegaram") que a pessoa expande se quiser — a informação continua toda lá,
 * só para de competir por espaço com o resto.
 *
 * Tipo com um item só não vira grupo: "1 item" com seta de expandir é mais
 * clique para ver o que já caberia na tela.
 */
export function agruparPendencias(pendencias: Pendencia[]): GrupoDePendencias[] {
  const porTipo = new Map<Pendencia['tipo'], Pendencia[]>()

  for (const pendencia of pendencias) {
    const lista = porTipo.get(pendencia.tipo)
    if (lista) lista.push(pendencia)
    else porTipo.set(pendencia.tipo, [pendencia])
  }

  // `Array.from` em vez de espalhar o iterador: o `target` do tsconfig deste
  // projeto não habilita `downlevelIteration`.
  return Array.from(porTipo, ([tipo, itens]): GrupoDePendencias => {
    const temDinheiro = itens.some((i: Pendencia) => i.gravidade === 'dinheiro')

    return {
      tipo,
      // O título do grupo vem do primeiro item quando é um só, e vira contagem
      // quando são vários — "3 × E-mail que não chegou" diz mais que o mesmo
      // título repetido três vezes.
      titulo: itens.length === 1 ? itens[0].titulo : `${itens.length} × ${itens[0].titulo}`,
      gravidade: temDinheiro ? 'dinheiro' : 'atencao',
      itens,
    }
  })
}
