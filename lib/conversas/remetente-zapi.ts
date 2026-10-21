import 'server-only'

import type { Remetente, ResultadoDoEnvio } from '@/lib/conversas/remetente'
import { explicacaoDoTeto, tetoPorHora } from '@/lib/conversas/aquecimento'
import { credenciaisDaEmpresa } from '@/lib/whatsapp/instancia'
import { enviarTexto, ZapiError } from '@/lib/whatsapp/zapi'
import { caminhoNoLog, corpoDeErroNoLog } from '@/lib/log/redigir'

/**
 * O `Remetente` que entrega pela Z-API.
 *
 * ## O que é daqui e o que não é
 *
 * A fronteira já estava desenhada em `lib/conversas/remetente.ts` desde 28/08, e
 * este arquivo só a preenche:
 *
 *     regra de produto      lib/conversas/actions.ts    nao muda nesta rodada
 *     transporte + limites  aqui                        e o que a Z-API impoe
 *
 * Quem chama nunca vê `zaapId`, `Client-Token` nem a forma da URL. É o que faz
 * a Cloud API da Meta, quando chegar, custar um arquivo novo.
 *
 * ## O aquecimento, e por que ele NÃO é opcional aqui
 *
 * A Z-API é conexão não oficial: ela pareia o número do cliente como se fosse
 * um WhatsApp Web. Quem decide se aquele número continua existindo é a Meta, e
 * o padrão que ela pune é volume súbito de um número novo.
 *
 * O número em risco é o **do cliente**, e não o nosso. Um CRM que faz a
 * marcenaria perder o WhatsApp da empresa não é um CRM com um bug: é um
 * fornecedor que destruiu o canal de vendas de quem pagou por ele.
 *
 *     ate  7 dias    10 por hora
 *     ate 21 dias    20 por hora
 *     depois         30 por hora
 *
 * A escada é a mesma que a ponte anterior usava, e ela vem do comportamento que
 * a Meta observa, não da capacidade do provedor. `docs/mercado/limites-e-bloqueios.md`
 * registra os quatro padrões que derrubam número, e volume de número novo é o
 * primeiro.
 *
 * ## `null` seria "sem teto", e não é o caso
 *
 * A interface aceita `null` para o dia em que a Cloud API entrar — lá o
 * controle é de outra natureza (níveis de qualidade e tiers de mensagem). Aqui
 * o número sempre tem teto.
 */

export const remetenteZapi: Remetente = {
  nome: 'Z-API',

  // A escada saiu para `./aquecimento`, pura e com teste. Ela sempre foi
  // pura; o que a prendia aqui era este arquivo importar `server-only` por
  // transitividade, o que impede o Vitest de carregá-lo.
  tetoPorHora,
  explicacaoDoTeto,

  async enviarTexto(workspaceId, numero, texto): Promise<ResultadoDoEnvio> {
    const instancia = await credenciaisDaEmpresa(workspaceId)
    if (!instancia) {
      // Chega aqui quando a linha sumiu entre a checagem e o envio, ou quando
      // o token não decifra. Os dois são raros e nenhum é culpa de quem está
      // escrevendo para um cliente, então a frase diz o que fazer.
      return {
        ok: false,
        motivo: 'A conexão do WhatsApp desta empresa não foi encontrada. Reconecte em Configurações.',
      }
    }

    try {
      const { messageId } = await enviarTexto(instancia, numero, texto)
      return { ok: true, externalId: messageId }
    } catch (erro) {
      if (erro instanceof ZapiError) {
        // O status separa o que a pessoa pode resolver do que ela não pode, e
        // é a diferença entre uma frase acionável e "algo deu errado".
        //
        // 405 e 415 são erro NOSSO de chamada (método ou content-type), e a
        // pessoa não tem o que fazer com eles — por isso caem no genérico.
        if (erro.status === 401 || erro.status === 403) {
          // O corpo REDIGIDO, e este ramo e a razao do redator existir: 401
          // e 403 sao onde um provedor ecoa a requisicao, e com ela o token.
          console.error('remetenteZapi: credencial recusada', corpoDeErroNoLog(erro.corpo))
          return {
            ok: false,
            motivo: 'O WhatsApp desta empresa perdeu a autorização. Reconecte em Configurações.',
          }
        }
        if (erro.status === 404) {
          return {
            ok: false,
            motivo: 'O WhatsApp desta empresa não está conectado. Reconecte em Configurações.',
          }
        }
        if (erro.status === 429) {
          return {
            ok: false,
            motivo: 'O provedor recusou por excesso de envios. Espere alguns minutos e tente de novo.',
          }
        }
        if (erro.status === 400) {
          // Quase sempre número inválido, e é o único 4xx que a pessoa conserta
          // sozinha — conferindo o telefone do contato.
          console.error('remetenteZapi: requisição recusada', corpoDeErroNoLog(erro.corpo))
          return {
            ok: false,
            motivo: 'O WhatsApp recusou este número. Confira o telefone do contato.',
          }
        }
        // O CAMINHO também é redigido, e não só o corpo: `comInstancia` monta
        // `/instances/{id}/token/{token}/{endpoint}`, então o token da
        // instância faz parte da URL. Esta linha logava a credencial inteira
        // logo abaixo de um corpo que já passava pelo redator.
        console.error(
          `remetenteZapi: ${erro.status} em ${caminhoNoLog(erro.caminho)}`,
          corpoDeErroNoLog(erro.corpo),
        )
        return { ok: false, motivo: 'O provedor de WhatsApp não respondeu. Tente de novo.' }
      }

      // `AbortError` do timeout de 8s cai aqui, e a frase precisa dizer a
      // verdade incômoda: pode ter saído. A mensagem fica marcada como falha, e
      // mandar de novo é melhor que o cliente ficar sem resposta — duplicar uma
      // mensagem custa menos que perder uma venda.
      console.error('remetenteZapi: falha de rede', erro)
      return {
        ok: false,
        motivo: 'Não deu para confirmar o envio. Confira no WhatsApp antes de mandar de novo.',
      }
    }
  },
}
