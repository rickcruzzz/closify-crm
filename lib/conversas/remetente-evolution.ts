import 'server-only'

import { explicacaoDoTeto, tetoPorHora } from '@/lib/conversas/aquecimento'
import type { Remetente, ResultadoDoEnvio } from '@/lib/conversas/remetente'
import { corpoDeErroNoLog } from '@/lib/log/redigir'
import { EvolutionError, enviarTexto } from '@/lib/whatsapp/evolution'
import { credenciaisEvolutionDaEmpresa } from '@/lib/whatsapp/instancia'

/**
 * O `Remetente` da Evolution API, na VPS própria.
 *
 * ## Por que existe um segundo transporte
 *
 * A Z-API cobra R$ 99,99 por instância e o Partner dela exige DEZ contratadas,
 * R$ 899,90 por mês fixos, medido em 17/09. Com receita externa zero, isso é
 * pagar por vaga vazia. A Evolution roda numa VPS que já existe e já está
 * paga, e a auditoria de 18/09 mediu que **cinco clientes cabem no KVM 1 de
 * hoje sem trocar nada**.
 *
 * Os dois convivem de propósito. Migrar um número tira o WhatsApp do celular
 * da pessoa, então quem já está num transporte fica nele até ter motivo para
 * sair. É exatamente o cenário que `escolherRemetente` foi escrito para
 * atender, em 28/08, com o parâmetro que ficou anos sem ser lido.
 *
 * ## O aquecimento é o MESMO, e isso não é economia de código
 *
 * `lib/conversas/aquecimento.ts` é compartilhado com a Z-API. A escada de
 * 10/20/30 por hora vem do comportamento que a Meta observa, não da capacidade
 * do provedor: os dois pareiam o número do cliente como um WhatsApp Web, e
 * quem decide se aquele número continua existindo é a Meta nos dois casos.
 *
 * Um teto diferente por transporte diria que o risco muda com o fornecedor, e
 * ele não muda. O número em risco é o do cliente.
 */

export const remetenteEvolution: Remetente = {
  nome: 'Evolution',

  tetoPorHora,
  explicacaoDoTeto,

  async enviarTexto(workspaceId, numero, texto): Promise<ResultadoDoEnvio> {
    const instancia = await credenciaisEvolutionDaEmpresa(workspaceId)
    if (!instancia) {
      // Chega aqui quando a linha sumiu entre a checagem e o envio, quando o
      // token não decifra, ou quando a empresa foi movida para outro
      // transporte no meio. Nenhum deles é culpa de quem está escrevendo para
      // um cliente, então a frase diz o que fazer.
      return {
        ok: false,
        motivo:
          'A conexão do WhatsApp desta empresa não foi encontrada. Reconecte em Configurações.',
      }
    }

    try {
      const { externalId } = await enviarTexto(instancia, numero, texto)
      return { ok: true, externalId }
    } catch (erro) {
      if (erro instanceof EvolutionError) {
        // O status separa o que a pessoa resolve do que ela não resolve, e é a
        // diferença entre uma frase acionável e "algo deu errado".
        if (erro.status === 401 || erro.status === 403) {
          // O corpo REDIGIDO: 401 e 403 são onde um provedor ecoa a
          // requisição, e com ela a credencial. Mesmo cuidado do irmão Z-API.
          console.error('remetenteEvolution: credencial recusada', corpoDeErroNoLog(erro.corpo))
          return {
            ok: false,
            motivo: 'O WhatsApp desta empresa perdeu a autorização. Reconecte em Configurações.',
          }
        }
        if (erro.status === 404) {
          // Na Evolution o 404 quer dizer que a INSTÂNCIA não existe mais no
          // servidor, não que o número é inválido. É um estado que só
          // reconectar resolve.
          return {
            ok: false,
            motivo: 'O WhatsApp desta empresa não está conectado. Reconecte em Configurações.',
          }
        }
        if (erro.status === 400) {
          // Quase sempre número inválido, e é o único que a pessoa conserta
          // sozinha, conferindo o telefone do contato.
          console.error('remetenteEvolution: requisição recusada', corpoDeErroNoLog(erro.corpo))
          return {
            ok: false,
            motivo: 'O WhatsApp recusou este número. Confira o telefone do contato.',
          }
        }
        console.error(
          `remetenteEvolution: ${erro.status} em ${erro.caminho}`,
          corpoDeErroNoLog(erro.corpo),
        )
        return { ok: false, motivo: 'O provedor de WhatsApp não respondeu. Tente de novo.' }
      }

      // `TimeoutError` do sinal de 10s cai aqui. A VPS já saiu do ar antes, e
      // a frase precisa dizer que o problema é temporário sem prometer quando
      // passa.
      console.error('remetenteEvolution: falha de transporte', erro)
      return {
        ok: false,
        motivo: 'O WhatsApp demorou para responder. A mensagem não saiu, tente de novo.',
      }
    }
  },
}
