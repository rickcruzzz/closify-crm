'use server'

import { revalidatePath } from 'next/cache'

import { classificarRespostasPendentes } from '@/lib/prospeccao/classificar-pendentes'

import { exigirAmbienteLocal } from './somente-local'
import type { ResultadoDaAcao } from './actions'

/**
 * Lê as respostas pendentes agora, sem esperar o cron.
 *
 * ## Por que existe, se o cron já roda de hora em hora
 *
 * Porque a pergunta que o painel responde é de QUEM ESTÁ OLHANDO. Quem abre a
 * tela às 9h05 depois de uma rodada de disparo não tem por que esperar até
 * 9h15 para ver a leitura — e esperar é o tipo de atrito que faz a pessoa
 * parar de abrir a tela.
 *
 * **Os dois chamam a MESMA função.** Uma cópia da regra aqui gravaria um
 * estágio diferente do gravado pelo cron, e o painel somaria os dois como se
 * fossem a mesma coisa.
 *
 * O teto é menor que o do cron (10 contra 20) de propósito: isto roda dentro de
 * um clique, e uma Server Action que segura vinte chamadas à OpenAI deixa a
 * tela parecendo travada.
 */
export async function classificarAgora(): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, erro: 'OPENAI_API_KEY não está no .env.local.' }
  }

  try {
    const r = await classificarRespostasPendentes({ teto: 10 })
    revalidatePath('/dono/inteligencia')

    // ## "Nada pendente" passou a ser mentira possivel (18/09)
    //
    // Desde que o classificador filtra midia e quem esta fora da fila,
    // `pendentes` conta so o que FOI ao modelo. Uma rodada em que 41 mensagens
    // chegaram e nenhuma era resposta de prospect devolve `pendentes: 0`, e
    // "tudo que chegou ja foi lido" descreveria uma caixa vazia que nao esta
    // vazia.
    //
    // O numero pulado entra na frase, com o motivo: e a diferenca entre "nao
    // chegou nada" e "chegou e nao era para ca".
    const puladas = r.ignoradas.semTexto + r.ignoradas.foraDaFila
    if (r.pendentes === 0) {
      if (puladas === 0) {
        return { ok: true, mensagem: 'Nada pendente, tudo que chegou já foi lido.' }
      }
      return {
        ok: true,
        mensagem: `Nenhuma resposta de prospect na fila. ${r.ignoradas.semTexto} sem texto (mídia) e ${r.ignoradas.foraDaFila} de fora da prospecção ficaram de lado.`,
      }
    }
    if (r.falhas > 0 && r.classificadas === 0) {
      return { ok: false, erro: `Nenhuma classificada. ${r.erros.join(' | ')}` }
    }

    const sobra = r.classificadas === 10 ? ' Ainda há mais na fila.' : ''
    const humano = r.paraHumano > 0 ? ` ${r.paraHumano} precisa(m) de você.` : ''
    return {
      ok: true,
      mensagem: `${r.classificadas} de ${r.pendentes} lidas.${humano}${sobra}`,
    }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) }
  }
}
