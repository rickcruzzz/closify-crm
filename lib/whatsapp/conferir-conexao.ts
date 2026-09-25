import 'server-only'

import { registrarNotificacao } from '@/lib/notificacoes/registrar'
import { createAdminClient } from '@/lib/supabase/admin'
import { decifrar } from '@/lib/integrations/crypto'
import { corpoDeErroNoLog } from '@/lib/log/redigir'
import { registrarEstado } from '@/lib/whatsapp/instancia'
import { ehVeredito } from '@/lib/whatsapp/veredito-do-provedor'
import { statusDaInstancia, ZapiError } from '@/lib/whatsapp/zapi'

/**
 * A coluna dizia `conectado` e o provedor dizia que não.
 *
 * ## O defeito, medido em 23/09 contra a instância real
 *
 *     banco    status "conectado"  ·  telefone 557185040900
 *     Z-API    "you must subscribe to this instance again"
 *              paymentStatus PENDING  ·  phone false
 *
 * O trial de 48h da Z-API venceu em 19/09 e ninguém assinou. A prova está no
 * volume, e ela é gradual em vez de abrupta:
 *
 *     18/09   107 recebidas
 *     19/09    78
 *     20/09    30
 *     21/09     5   e ZERO enviadas a partir daqui
 *     22/09     4
 *
 * ## Por que nada percebia
 *
 * `whatsapp_instances.status` é escrito em dois momentos: quando a pessoa
 * conecta, e quando o `DisconnectedCallback` chega. **Nenhum dos dois cobre
 * este caso**, porque a instância não foi desconectada — ela deixou de ser
 * paga. O provedor não manda evento para isso, e a coluna fica `conectado`
 * para sempre.
 *
 * O sintoma é o pior que este produto conhece: a tela afirma conectado, o
 * envio toma erro, e o cliente conclui que o CRM perdeu a mensagem dele.
 *
 * ## Por que dentro do cron de reenvio, e não num cron próprio
 *
 * Ele já roda aos :10 e :40, já fala com a Z-API e já existe para o caso em
 * que o envio falhou. Cron próprio seria mais uma entrada para falhar em
 * silêncio, que é o argumento que a purga de instâncias já usou em 17/09 para
 * morar dentro da reconciliação de assinaturas.
 *
 * ## `null` do provedor NÃO derruba a conexão
 *
 * Z-API fora do ar, timeout, 500: a instância é deixada como está. Marcar
 * desconectado por indisponibilidade de dez minutos mandaria a pessoa refazer
 * o pareamento com o celular por nada, e pareamento exige ler um QR de novo.
 * É a lição de 30/08: `null` significa NÃO SEI.
 */

export type ResultadoDaConferencia = {
  conferidas: number
  derrubadas: number
  naoRespondeu: number
  erros: string[]
}

export async function conferirConexoes(): Promise<ResultadoDaConferencia> {
  const admin = createAdminClient()
  const resultado: ResultadoDaConferencia = {
    conferidas: 0,
    derrubadas: 0,
    naoRespondeu: 0,
    erros: [],
  }

  // Só as que AFIRMAM estar conectadas. Quem já está marcado desconectado não
  // tem o que reconciliar, e perguntar por ele gastaria a chamada para
  // confirmar o que a tela já diz.
  const { data: instancias, error } = await admin
    .from('whatsapp_instances')
    .select('workspace_id, instance_id, token_cifrado, status')
    .eq('status', 'conectado')
    .limit(200)

  if (error) {
    resultado.erros.push('falha ao listar instâncias')
    return resultado
  }

  for (const linha of instancias ?? []) {
    resultado.conferidas += 1

    let credenciais: { instanceId: string; token: string }
    try {
      credenciais = { instanceId: linha.instance_id, token: decifrar(linha.token_cifrado) }
    } catch {
      // Decifrar falhou: a chave mudou, ou a linha foi gravada errada. Não é
      // resposta do provedor, então não derruba a conexão.
      resultado.erros.push(`${linha.workspace_id.slice(0, 8)}: token ilegível`)
      continue
    }

    // ## O caso REAL chega como ERRO, não como `connected: false`
    //
    // Medido em 23/09 contra a instância de produção:
    //
    //     GET /status  ->  HTTP 400
    //     {"error":"To continue sending a message, you must subscribe to this instance again"}
    //
    // `chamar` transforma todo não-ok em `ZapiError`, então a primeira versão
    // deste laço, que tratava qualquer exceção como "não respondeu", teria
    // engolido exatamente o defeito que ele existe para pegar. Conferido
    // antes de promover, e é a diferença entre um conserto e um conserto que
    // não conserta.
    //
    // ## O padrão é NÃO SEI, e só uma lista curta é veredito
    //
    // A primeira versão dizia "4xx é veredito, 5xx é não sei", e a faixa era
    // larga demais. `429` é 4xx e significa **tente de novo**, não "esta
    // instância morreu" — e é justamente o status que uma empresa enviando
    // muito recebe. Derrubar por ele faria o pior: o sino avisa a empresa
    // inteira que o WhatsApp caiu, o relógio da purga (0091) começa a contar
    // sete dias, e a pessoa vai reparear lendo um QR de novo, por nada.
    //
    // É o mesmo erro de desenho que a varredura do portão cometeu hoje,
    // invertido: lá o padrão aprovava e só o seguro reprovava. Aqui o padrão
    // passou a ser não mexer.
    //
    //     401 403        credencial revogada: esta instância não é mais nossa
    //     404            o provedor não conhece mais esta instância
    //     400            assinatura vencida, que é como a Z-API responde
    //                    "you must subscribe to this instance again"
    //     408 425 429    TENTE DE NOVO. Não é resposta sobre a instância
    //     5xx / rede     o provedor não conseguiu responder
    let conectado: boolean
    let motivo: string | null = null
    try {
      const estado = await statusDaInstancia(credenciais)
      // `connected` é o que decide. `smartphoneConnected` false com
      // `connected` true é o celular fora da rede por um instante, e derrubar
      // por isso faria a tela piscar a cada oscilação do aparelho do cliente.
      conectado = estado.connected
      motivo = estado.error
    } catch (erro) {
      const status = erro instanceof ZapiError ? erro.status : 0
      if (ehVeredito(status)) {
        conectado = false
        motivo =
          erro instanceof ZapiError ? corpoDeErroNoLog(erro.corpo) : 'O provedor recusou.'
      } else {
        resultado.naoRespondeu += 1
        resultado.erros.push(`${linha.workspace_id.slice(0, 8)}: ${String(erro).slice(0, 80)}`)
        continue
      }
    }

    if (conectado) continue

    const { anterior } = await registrarEstado({
      workspaceId: linha.workspace_id,
      estado: 'desconectado',
      erro: motivo ?? 'O provedor não reconhece mais esta conexão.',
    })
    resultado.derrubadas += 1

    // O aviso só sai na TRANSIÇÃO, mesma regra do webhook de desconexão e do
    // vigia de 01/09: varre sempre, avisa quando muda. Sem isto o sino
    // receberia o mesmo fato a cada meia hora até alguém reconectar.
    if (anterior === 'conectado') {
      await registrarNotificacao({
        workspaceId: linha.workspace_id,
        tipo: 'whatsapp_caiu',
        titulo: 'O WhatsApp da sua empresa desconectou',
        corpo:
          'As mensagens dos seus clientes pararam de chegar aqui. Reconecte para voltar a receber.',
        href: '/settings/whatsapp',
        // Para a empresa inteira: quem trabalha as conversas precisa saber por
        // que elas pararam, mesmo sem poder reconectar.
        userId: null,
      })
    }
  }

  return resultado
}
