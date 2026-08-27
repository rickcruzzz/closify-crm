import { FREE_WORKSPACE_LIMIT } from '@/lib/plans'

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
 */
export type DecisaoDeNovaEmpresa = {
  pode: boolean
  /** Por que não pode, escrito para quem lê. `null` quando pode. */
  motivo: string | null
}

export function decidirNovaEmpresa({
  temAssinaturaPaga,
  emTrial,
  quantidadeDeEmpresas,
}: {
  /** Pro válido que NÃO vem de trial. É a condição da trigger da 0053. */
  temAssinaturaPaga: boolean
  emTrial: boolean
  quantidadeDeEmpresas: number
}): DecisaoDeNovaEmpresa {
  if (temAssinaturaPaga) return { pode: true, motivo: null }

  if (quantidadeDeEmpresas < FREE_WORKSPACE_LIMIT) {
    return { pode: true, motivo: null }
  }

  // Duas frases diferentes de propósito. "Disponível no plano Pro" para quem
  // está no Free está certo; dito a quem vê um selo `pro` na própria tela, lê
  // como erro do sistema.
  return {
    pode: false,
    motivo: emTrial ? 'Assine o Pro para ter mais de uma' : 'Disponível no plano Pro',
  }
}
