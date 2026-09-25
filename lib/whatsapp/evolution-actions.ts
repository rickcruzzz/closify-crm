'use server'

import { revalidatePath } from 'next/cache'

import { appUrl } from '@/lib/app-url'
import { direitoAoWhatsapp } from '@/lib/plans/max'
import { situacaoDoMax } from '@/lib/plans/max-queries'
import { abrirSessao } from '@/lib/whatsapp/sessao'
import {
  apagarInstancia,
  apontarWebhook,
  criarInstancia,
  estadoDaInstancia,
  qrCode,
} from '@/lib/whatsapp/evolution'
import { podeUsarEvolution } from '@/lib/whatsapp/evolution-permitida'
import {
  conexaoDaEmpresa,
  credenciaisEvolutionDaEmpresa,
  guardarInstancia,
  registrarEstado,
  segredoNovo,
} from '@/lib/whatsapp/instancia'

/**
 * Conectar o WhatsApp pela Evolution, na VPS própria.
 *
 * ## Por que este caminho existe ao lado dos dois da Z-API
 *
 * `conectarWhatsapp` cria pelo Partner, que custa **R$ 899,90 por mês fixos** e
 * exige dez instâncias contratadas (medido em 17/09). `adotarInstancia` é a
 * ponte do trial de 48h, e o comentário dela diz o que ela é: *"existe para o
 * dono provar o que foi construído"*.
 *
 * Aqui a instância nasce num servidor que já existe e já está pago, sem trial,
 * sem Partner e sem o cliente ver credencial nenhuma. É o caminho mais parecido
 * com o do cliente que existe hoje: clicar, ler o QR, pronto.
 *
 * ## E mesmo assim ele NÃO é oferecido a todo cliente
 *
 * `podeUsarEvolution` é uma lista explícita, e o porquê inteiro está em
 * `lib/whatsapp/evolution-permitida.ts`: a VPS fica em Boston e a landing
 * promete que nada de cliente atravessa fronteira para ser processado.
 *
 * A checagem vem **antes** de qualquer chamada ao provedor, pelo mesmo motivo
 * que o gate de Max vem antes: chegar até ele gastaria uma criação de instância
 * por uma escrita que já ia ser negada.
 *
 * ## O rollback da instância órfã, e ele é a decisão de 16/09 aplicada de novo
 *
 * Se o `insert` falhar depois de a instância existir no servidor, ela é apagada
 * ANTES de a ação devolver o erro. Sem isso sobraria uma instância que nenhuma
 * tela alcança e nenhuma varredura reencontra, ocupando a VPS para sempre.
 *
 * Na Z-API o argumento era dinheiro: instância sem linha é cobrança invisível.
 * Aqui é capacidade, e o número que faz isso importar é o mesmo: a auditoria de
 * 18/09 mediu **cinco clientes no KVM 1 de hoje**. Duas órfãs comem 40% disso.
 */

export type RespostaDaConexao =
  | { ok: true; qrCode: string | null; estado: 'conectando' | 'conectado' }
  | { ok: false; error: string }

function revalidar() {
  revalidatePath('/conversas')
  revalidatePath('/settings/whatsapp')
}

export async function conectarWhatsappEvolution(): Promise<RespostaDaConexao> {
  const sessao = await abrirSessao()
  if ('error' in sessao) return { ok: false, error: sessao.error }
  if (!sessao.ehAdmin) {
    return { ok: false, error: 'Apenas administradores podem conectar o WhatsApp.' }
  }

  // Antes do provedor, e antes do plano: é a restrição mais estreita das três,
  // então é a que descarta mais rápido. Ver `evolution-permitida.ts`.
  if (!podeUsarEvolution(sessao.workspaceId)) {
    return {
      ok: false,
      error: 'Esta empresa não está habilitada para este servidor de WhatsApp.',
    }
  }

  // A trigger `whatsapp_instances_exige_max` recusaria de qualquer jeito com
  // 42501: `service_role` ignora RLS e NÃO ignora trigger. Checar aqui é para
  // não gastar uma criação de instância por uma escrita que já ia ser negada.
  const assinatura = await situacaoDoMax(sessao.workspaceId)
  const direito = direitoAoWhatsapp(assinatura, 'ausente')
  if (!direito.pode && direito.tipo !== 'sem_conexao') {
    return { ok: false, error: direito.motivo }
  }

  const jaExiste = await conexaoDaEmpresa(sessao.workspaceId)
  if (jaExiste.estado !== 'ausente') {
    return {
      ok: false,
      error: 'Esta empresa já tem uma conexão. Remova a atual antes de criar outra.',
    }
  }

  const segredo = segredoNovo()
  // O id da empresa entra no nome porque nome de empresa se repete, e porque é
  // o que torna auditável um painel com dezenas de instâncias. Mesmo raciocínio
  // já escrito no caminho da Z-API.
  const nome = `velofunil-${sessao.workspaceId}`

  let criada: { nome: string; token: string }
  try {
    criada = await criarInstancia(nome)
  } catch (erro) {
    console.error('conectarWhatsappEvolution: o servidor recusou criar a instância', erro)
    return {
      ok: false,
      error: 'Não foi possível preparar a conexão agora. Tente de novo em alguns minutos.',
    }
  }

  // ## O webhook é apontado ANTES de gravar a linha, e a ordem é de propósito
  //
  // Instância sem webhook é o pior sintoma que este produto conhece: a tela diz
  // conectado e nenhuma mensagem chega, sem nada falhar. Foi assim que os
  // webhooks da Z-API ficaram apontados para um caminho sem rota até 18/09.
  //
  // Falhar aqui aborta a conexão inteira e apaga a instância, em vez de
  // entregar um QR que produziria silêncio.
  try {
    await apontarWebhook({
      nome: criada.nome,
      url: `${appUrl()}/api/webhooks/evolution/cliente`,
      segredo,
    })
  } catch (erro) {
    console.error('conectarWhatsappEvolution: webhook não pôde ser apontado', erro)
    await apagarOrfa(criada.nome)
    return {
      ok: false,
      error: 'Não foi possível preparar a conexão agora. Tente de novo em alguns minutos.',
    }
  }

  const guardada = await guardarInstancia({
    provider: 'evolution',
    workspaceId: sessao.workspaceId,
    instanceId: criada.nome,
    token: criada.token,
    segredo,
  })

  if (!guardada.ok) {
    await apagarOrfa(criada.nome)
    return { ok: false, error: guardada.motivo }
  }

  revalidar()
  return lerQrCodeEvolution()
}

/**
 * Apaga uma instância que existe no servidor e não virou linha no banco.
 *
 * Nunca lança: ela é chamada nos caminhos de erro, e uma exceção aqui
 * substituiria a mensagem real por outra. Quando a remoção falha, o log DIZ que
 * sobrou trabalho manual, porque essa é a única forma de alguém reencontrá-la.
 */
async function apagarOrfa(nome: string): Promise<void> {
  try {
    await apagarInstancia(nome)
  } catch (erro) {
    console.error(
      `conectarWhatsappEvolution: a instância ${nome} ficou ÓRFÃ no servidor e PRECISA ser apagada à mão`,
      erro,
    )
  }
}

/**
 * O QR da vez, e o estado que a tela mostra ao lado dele.
 *
 * Chamada em laço pela tela enquanto o estado é `conectando`. O teto do laço
 * fica na tela, como já fica no caminho da Z-API: um laço sem teto bate no
 * servidor para sempre se a pessoa deixar a aba aberta.
 */
export async function lerQrCodeEvolution(): Promise<RespostaDaConexao> {
  const sessao = await abrirSessao()
  if ('error' in sessao) return { ok: false, error: sessao.error }

  const credenciais = await credenciaisEvolutionDaEmpresa(sessao.workspaceId)
  if (!credenciais) {
    return { ok: false, error: 'Esta empresa não tem conexão pela Evolution.' }
  }

  let estado: Awaited<ReturnType<typeof estadoDaInstancia>>
  try {
    estado = await estadoDaInstancia(credenciais.nome)
  } catch (erro) {
    console.error('lerQrCodeEvolution: o servidor não respondeu o estado', erro)
    return { ok: false, error: 'O servidor de WhatsApp não respondeu. Tente de novo.' }
  }

  if (estado === 'open') {
    // A conexão só é declarada a partir do que o PROVEDOR diz, nunca do clique.
    // É a mesma regra que a conferência de 23/09 existe para aplicar do outro
    // lado, quando a coluna diz conectado e o provedor discorda.
    await registrarEstado({ workspaceId: sessao.workspaceId, estado: 'conectado' })
    revalidar()
    return { ok: true, qrCode: null, estado: 'conectado' }
  }

  let imagem: string | null = null
  try {
    imagem = await qrCode(credenciais.nome)
  } catch (erro) {
    // `null` e não erro: o QR pode simplesmente não existir neste instante, e a
    // tela sabe mostrar "gerando". Erro aqui mandaria a pessoa tentar de novo
    // por um estado que se resolve sozinho no próximo laço.
    console.error('lerQrCodeEvolution: QR indisponível agora', erro)
  }

  return { ok: true, qrCode: imagem, estado: 'conectando' }
}
