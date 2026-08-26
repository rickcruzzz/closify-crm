import 'server-only'

import { obterTokenDaInstancia } from '@/lib/integrations/evolution/token'
import { enviarTexto } from '@/lib/integrations/evolution/api'
import { tierDaConexao } from '@/lib/integrations/evolution/aquecimento'

/**
 * Quem entrega a mensagem no WhatsApp.
 *
 * ## Por que existe uma camada aqui
 *
 * A integração vai TROCAR. O Evolution (não oficial, sobre `whatsmeow`, numa
 * VPS) é a ponte de hoje; a WhatsApp Cloud API oficial é o destino, e depende
 * de CNPJ ativo, verificação do negócio e App Review — semanas, não dias.
 *
 * Sem esta camada, trocar significaria reescrever `enviarMensagem`, que é onde
 * moram as regras que NÃO mudam: quem pode enviar, o que é uma mensagem
 * válida, o que fazer quando falha, como a conversa é marcada como respondida.
 * Misturar isso com "qual HTTP chamar" faria a troca custar duas vezes.
 *
 * Com ela, trocar é escrever um segundo objeto neste arquivo e mudar qual
 * `escolherRemetente` devolve.
 *
 * ## O que é de cada um
 *
 *     regra de produto      lib/conversas/actions.ts    não muda na troca
 *     transporte + limites  este arquivo                é o que muda
 *
 * O limite por hora é o exemplo de por que a fronteira está aqui e não lá: no
 * Evolution ele existe porque a Meta bane número que se comporta como robô;
 * na Cloud API ele não existe desse jeito (há níveis de qualidade e tiers de
 * mensagem, que são outra coisa). É característica do transporte, não do
 * produto.
 */

export type ResultadoDoEnvio =
  | { ok: true; externalId: string | null }
  | { ok: false; motivo: string }

export type Remetente = {
  /** Nome curto, para mensagem de erro e registro. */
  nome: string
  /**
   * Quantas mensagens podem sair por hora nesta conexão.
   *
   * `null` significa "sem teto próprio" — é o que a Cloud API vai devolver,
   * porque lá o controle é de outra natureza.
   */
  tetoPorHora(conectadoEm: string | null): number | null
  /** A explicação do teto, para a tela dizer por que segurou. */
  explicacaoDoTeto(conectadoEm: string | null): string
  enviarTexto(workspaceId: string, numero: string, texto: string): Promise<ResultadoDoEnvio>
}

/**
 * Evolution GO, a ponte não oficial.
 *
 * Sai de cena quando a Cloud API entrar. O que precisa continuar verdadeiro
 * depois disso é só o formato deste objeto.
 */
const evolution: Remetente = {
  nome: 'Evolution',

  tetoPorHora(conectadoEm) {
    return tierDaConexao(conectadoEm ? new Date(conectadoEm) : new Date()).porHora
  },

  explicacaoDoTeto(conectadoEm) {
    return tierDaConexao(conectadoEm ? new Date(conectadoEm) : new Date()).explicacao
  },

  async enviarTexto(workspaceId, numero, texto) {
    const token = await obterTokenDaInstancia(workspaceId)
    if (!token) {
      return { ok: false, motivo: 'A conexão do WhatsApp precisa ser refeita em Configurações.' }
    }

    try {
      const { id } = await enviarTexto(token, numero, texto)
      return { ok: true, externalId: id }
    } catch (err) {
      const motivo = err instanceof Error ? err.message : 'Falha desconhecida'
      console.error('Remetente Evolution: envio recusado', err)
      return { ok: false, motivo }
    }
  },
}

/**
 * Qual remetente esta empresa usa.
 *
 * Hoje devolve sempre o Evolution. Quando a Cloud API existir, a escolha passa
 * a ser por empresa — provavelmente lendo `integration_connections.provider` —
 * e as duas conviverão por um tempo: quem já está no Evolution continua nele
 * até migrar o número, porque migrar tira o WhatsApp do celular da pessoa.
 *
 * O parâmetro já entra na assinatura para essa mudança não virar refatoração.
 */
export function escolherRemetente(workspaceId: string): Remetente {
  // O parâmetro ainda não é lido, e está aqui de propósito: quando a Cloud API
  // entrar, a escolha passa a sair de `integration_connections` desta empresa,
  // e acrescentar um parâmetro depois obrigaria a tocar em todo chamador.
  void workspaceId
  return evolution
}
