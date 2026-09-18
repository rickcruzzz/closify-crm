import { FREE_WORKSPACE_LIMIT, MAX_WORKSPACE_LIMIT, PRO_WORKSPACE_LIMIT } from '@/lib/plans'

/**
 * Quem pode criar uma segunda empresa, e o que dizer a quem não pode.
 *
 * ## O defeito que isto fecha
 *
 * O seletor da barra lateral decidia assim:
 *
 *     const temPro = workspaces.some((w) => w.plan === 'pro')
 *
 * Lendo a **coluna** `plan`. A doutrina deste projeto, travada desde a
 * migration 0027, diz o contrário: *regra de plano lê a função, nunca a
 * coluna* — a coluna é o último valor gravado e não sabe que o tempo passou.
 *
 * E há um caso em que ela está certa e ainda assim engana: **durante o trial**,
 * `plan` vale `'pro'`, mas a trigger de criação (migration 0053) exige
 * `pro_vigente(w.id) and not em_trial(w.id)`. Ou seja, quem está nos 7 dias de
 * avaliação vê "Nova empresa", abre o diálogo, digita o nome, envia — e o
 * banco recusa.
 *
 * Medido em produção em 27/08/2026: **4 empresas em trial** naquele exato
 * estado, e a conta de demonstração reproduziu o caminho inteiro, terminando
 * em "empresa criada: NÃO". É literalmente o que o comentário do próprio
 * seletor dizia querer evitar: *"leva a pessoa a preencher o formulário
 * inteiro e só então tomar o erro"*.
 *
 * Pior, a mensagem que a RPC devolve é *"O plano Free inclui 1 empresa"* —
 * dita a quem tem o selo `pro` ao lado do nome da empresa, na mesma tela.
 *
 * ## Por que a entrada é esta, e não o plano
 *
 * `temAssinaturaPaga` vem de `situacaoDoPlanoDaEmpresaAtiva()`, que consulta
 * `pro_vigente` e `em_trial` — as MESMAS funções que a trigger usa. Nenhuma
 * coluna é lida, e as duas não têm como divergir.
 *
 * **Limitação dita em voz alta:** a situação é da empresa ATIVA. Quem tem Pro
 * pago numa empresa e está com outra aberta na tela recebe "não pode", quando
 * o banco deixaria. É falso negativo: manda para a comparação de planos em vez
 * de deixar criar. Incomoda, não custa formulário perdido — o oposto do
 * defeito que isto conserta. Fechar essa fresta exigiria uma consulta por
 * empresa a cada navegação, no caminho mais quente do produto.
 *
 * ## O teto do Pro faltava aqui, e era o MESMO defeito um andar acima
 *
 * Até 16/09 o caminho pago devolvia `{ pode: true }` incondicionalmente:
 *
 *     if (temAssinaturaPaga) return { pode: true, motivo: null }
 *
 * `quantidadeDeEmpresas` chegava na função e era ignorado. E havia um teste
 * travando exatamente isso, com o nome dizendo o que fazia: *"assinatura paga
 * libera, com quantas empresas já tiver"*.
 *
 * O banco nunca esteve de acordo. A migration 0078 aplica
 * `teto := case when tem_plano_pro then 5 else 1 end` e levanta
 * *"O plano Pro inclui 5 empresas"* na sexta. `lib/limits.ts` faz a mesma
 * conta no servidor.
 *
 * Ou seja: quem tinha Pro e cinco empresas via "Nova empresa" disponível,
 * abria o diálogo, digitava o nome, enviava — e o banco recusava. É
 * **literalmente o defeito que este arquivo nasceu para consertar**, repetido
 * um degrau acima: lá era o trial, aqui é o teto do pago.
 *
 * A frase devolvida é a MESMA de `lib/limits.ts` e da 0078, palavra por
 * palavra. Duas mensagens diferentes para a mesma recusa fazem a pessoa achar
 * que são dois problemas.
 */
export type DecisaoDeNovaEmpresa = {
  pode: boolean
  /** Por que não pode, escrito para quem lê. `null` quando pode. */
  motivo: string | null
  /**
   * QUAL recusa é esta. `null` quando pode.
   *
   * Existe porque as duas recusas pedem telas opostas, e a tela não pode
   * descobrir isso lendo a frase — comparar string para decidir navegação é
   * como uma correção de copy vira um defeito de roteamento.
   *
   *     'exige_pro'      quem está no Free ou no trial. Oferecer o Pro é a
   *                      resposta certa: existe uma compra que resolve
   *     'limite_do_pro'  quem JÁ pagou e tem as 5. Mandar para a tela de
   *                      cobrança oferece a ele o que ele já tem, e não há
   *                      nada para comprar que resolva
   */
  tipo: 'exige_pro' | 'limite_do_pro' | 'limite_do_max' | null
}

export function decidirNovaEmpresa({
  temAssinaturaPaga,
  temMax = false,
  emTrial,
  quantidadeDeEmpresas,
}: {
  /** Pro válido que NÃO vem de trial. É a condição da trigger da 0053. */
  temAssinaturaPaga: boolean
  /**
   * O dono tem Max vigente em ALGUMA empresa dele.
   *
   * Sobe o teto de criação de 5 para 10, e **só isso**: quantos WhatsApps ele
   * conecta continua sendo um por empresa paga, decidido por `max_vigente()`
   * em cada uma. Criar empresa não custa nada; conectar número custa.
   *
   * Padrão `false` para o chamador que ainda não sabe: errar para o lado do
   * teto MENOR nega uma criação legítima, que a pessoa refaz; errar para o
   * maior deixa criar o que o banco vai recusar, e aí o formulário inteiro foi
   * preenchido à toa.
   */
  temMax?: boolean
  emTrial: boolean
  quantidadeDeEmpresas: number
}): DecisaoDeNovaEmpresa {
  const teto = temMax
    ? MAX_WORKSPACE_LIMIT
    : temAssinaturaPaga
      ? PRO_WORKSPACE_LIMIT
      : FREE_WORKSPACE_LIMIT

  if (quantidadeDeEmpresas < teto) {
    return { pode: true, motivo: null, tipo: null }
  }

  if (temMax) {
    return {
      pode: false,
      // Palavra por palavra igual a 0094. Quem ja esta no Max e bateu no teto
      // nao pode ouvir "assine o Max": ele ja assinou.
      motivo: `O plano Max inclui ${MAX_WORKSPACE_LIMIT} empresas. Fale com a gente para ter mais.`,
      tipo: 'limite_do_max',
    }
  }

  if (temAssinaturaPaga) {
    return {
      pode: false,
      // Palavra por palavra igual a `lib/limits.ts` e a 0094.
      motivo: `O plano Pro inclui ${PRO_WORKSPACE_LIMIT} empresas. Assine o Max para gerenciar até ${MAX_WORKSPACE_LIMIT}.`,
      tipo: 'limite_do_pro',
    }
  }

  // Duas frases diferentes de propósito. "Disponível no plano Pro" para quem
  // está no Free está certo; dito a quem vê um selo `pro` na própria tela, lê
  // como erro do sistema.
  return {
    pode: false,
    motivo: emTrial ? 'Assine o Pro para ter mais de uma' : 'Disponível no plano Pro',
    tipo: 'exige_pro',
  }
}
