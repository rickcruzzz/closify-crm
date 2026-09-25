import 'server-only'
import { AVISO_DE_MIGRACAO, FASE_DO_WHATSAPP } from '@/lib/integrations/whatsapp-estado'
import { remetenteEvolution } from '@/lib/conversas/remetente-evolution'
import { remetenteZapi } from '@/lib/conversas/remetente-zapi'
import { provedorDaEmpresa } from '@/lib/whatsapp/instancia'


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
 * Nenhum remetente, enquanto a API oficial não sai.
 *
 * Aqui vivia o `Remetente` do Evolution GO. A ponte não oficial saiu do
 * produto em 28/08/2026 junto com a VPS, e a Cloud API da Meta ainda depende
 * de App Review.
 *
 * O objeto continua existindo em vez de a função devolver `null` porque é a
 * **costura**: todo chamador já trata `{ ok: false, motivo }`, e trocar isso
 * por um caminho de "não há remetente" espalharia a condição por cada tela
 * que envia. Quando a Cloud API entrar, ela nasce aqui do lado e
 * `escolherRemetente` passa a decidir entre as duas.
 *
 * O teto por hora vira 0 de propósito: qualquer código que pergunte quanto
 * ainda dá para enviar recebe a resposta certa em vez de um número que não
 * significa nada.
 */
const emMigracao: Remetente = {
  nome: 'Em migração',

  tetoPorHora() {
    return 0
  },

  explicacaoDoTeto() {
    return AVISO_DE_MIGRACAO.curto
  },

  async enviarTexto() {
    // Diz o que está acontecendo e não promete data — prazo de App Review não
    // depende daqui, e prometer semana que não se cumpre custa mais do que não
    // prometer nada.
    return { ok: false, motivo: AVISO_DE_MIGRACAO.detalhe }
  },
}

/**
 * Qual remetente esta empresa usa.
 *
 * ## O dia chegou, e o parâmetro passou a ser lido
 *
 * Ele estava na assinatura desde 28/08 esperando o dia em que duas pontes
 * coexistissem, e o comentário anterior dizia, em texto, onde a resposta ia
 * morar: *"a escolha passa a sair de `whatsapp_instances.provider` desta
 * empresa, e é por isso que a coluna nasceu com `check (provider in
 * ('zapi'))`"*.
 *
 * A 0099 abriu esse `check` para `'evolution'`. Nenhum chamador mudou de
 * forma: os dois já eram `async`, que é a razão de o parâmetro ter entrado
 * cedo em vez de virar refatoração depois.
 *
 * ## Os dois convivem, e isso é o desenho
 *
 *     zapi        cobra por instância, provisiona por API
 *     evolution   VPS própria, já paga, cinco clientes cabem (medido em 18/09)
 *
 * Migrar um número tira o WhatsApp do celular da pessoa. Quem já está num
 * transporte fica nele até ter motivo para sair, e por isso a escolha é por
 * empresa e não uma constante global.
 *
 * ## `null` cai no remetente que RECUSA, e não em um padrão
 *
 * Empresa sem conexão, e falha de leitura, dão os dois `null`. Escolher um
 * transporte por padrão nesse caso mandaria a mensagem por uma instância que
 * pode não ser dela. `emMigracao` recusa com uma frase, que é o comportamento
 * que todo chamador já sabe tratar.
 *
 * **O que decide por empresa NÃO é esta função.** É `direitoAoWhatsapp`
 * (`lib/plans/max.ts`), que lê `max_vigente()` e o estado da conexão. Aqui a
 * pergunta é "qual transporte", lá é "esta empresa pode". Misturar as duas
 * faria o gate de plano viver dentro do módulo de transporte, que é
 * exatamente a fronteira que este arquivo existe para manter.
 */
export async function escolherRemetente(workspaceId: string): Promise<Remetente> {
  if (FASE_DO_WHATSAPP !== 'zapi') return emMigracao

  const provedor = await provedorDaEmpresa(workspaceId)
  if (provedor === 'evolution') return remetenteEvolution
  if (provedor === 'zapi') return remetenteZapi
  return emMigracao
}
