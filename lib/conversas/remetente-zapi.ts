import 'server-only'

import type { Remetente, ResultadoDoEnvio } from '@/lib/conversas/remetente'
import { credenciaisDaEmpresa } from '@/lib/whatsapp/instancia'
import { enviarTexto, ZapiError } from '@/lib/whatsapp/zapi'

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

const UMA_HORA = 60 * 60 * 1000
const UM_DIA = 24 * UMA_HORA

function diasDeConexao(conectadoEm: string | null): number {
  if (!conectadoEm) return 0
  const inicio = new Date(conectadoEm).getTime()
  // Data ilegível conta como conexão NOVA, que é o lado seguro: o pior que
  // acontece é uma empresa antiga mandar devagar por uma hora, contra um número
  // novo mandando 30 e sendo derrubado.
  if (!Number.isFinite(inicio)) return 0
  return Math.max(0, Math.floor((Date.now() - inicio) / UM_DIA))
}

export const remetenteZapi: Remetente = {
  nome: 'Z-API',

  tetoPorHora(conectadoEm) {
    const dias = diasDeConexao(conectadoEm)
    if (dias < 7) return 10
    if (dias < 21) return 20
    return 30
  },

  explicacaoDoTeto(conectadoEm) {
    const dias = diasDeConexao(conectadoEm)
    if (dias < 7) {
      return 'Número conectado há menos de uma semana: 10 mensagens por hora enquanto ele aquece. É o que protege o número de ser bloqueado pelo WhatsApp.'
    }
    if (dias < 21) {
      return 'Número em aquecimento: 20 mensagens por hora até completar três semanas de uso.'
    }
    return 'Número aquecido: 30 mensagens por hora.'
  },

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
          console.error('remetenteZapi: credencial recusada', erro.corpo)
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
          console.error('remetenteZapi: requisição recusada', erro.corpo)
          return {
            ok: false,
            motivo: 'O WhatsApp recusou este número. Confira o telefone do contato.',
          }
        }
        console.error(`remetenteZapi: ${erro.status} em ${erro.caminho}`, erro.corpo)
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
