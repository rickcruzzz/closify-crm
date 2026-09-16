'use server'

import { revalidatePath } from 'next/cache'

import { appUrl } from '@/lib/app-url'
import { direitoAoWhatsapp } from '@/lib/plans/max'
import { situacaoDoMax } from '@/lib/plans/max-queries'
import { excedeuLimite } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import {
  conexaoDaEmpresa,
  credenciaisDaEmpresa,
  esquecerInstancia,
  guardarInstancia,
  registrarEstado,
  segredoNovo,
} from '@/lib/whatsapp/instancia'
import {
  apagarInstancia,
  criarInstancia,
  desconectar as desconectarNoProvedor,
  qrCode,
  statusDaInstancia,
  telefoneConectado,
} from '@/lib/whatsapp/zapi'

/**
 * Conectar, conferir e desconectar o WhatsApp da empresa.
 *
 * ## O cliente nunca vê credencial, e é isso que estas funções entregam
 *
 * `instanceId`, token da instância e `Client-Token` são infraestrutura. Pedir
 * que o dono de uma marcenaria cole três strings de um painel de terceiro é
 * transformar um recurso em suporte.
 *
 * O caminho é: clicar Conectar, ler o QR, pronto. Tudo que está entre as duas
 * coisas acontece aqui, no servidor.
 *
 * ## Server Action é endpoint HTTP
 *
 * Dá para chamar sem passar pela tela, e três defeitos deste projeto vieram de
 * esquecer isso. Toda checagem abaixo existe porque a interface não é barreira
 * nenhuma — e a última delas nem está aqui: a trigger
 * `whatsapp_instances_exige_max` (0090) recusa o `insert` mesmo pelo admin
 * client, que ignora RLS e não ignora trigger.
 */

type Sessao = { userId: string; workspaceId: string; ehAdmin: boolean }

async function abrirSessao(): Promise<Sessao | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { error: 'Empresa não encontrada.' }

  const { data: ehAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })

  return { userId: user.id, workspaceId, ehAdmin: ehAdmin === true }
}

function revalidar() {
  revalidatePath('/settings/whatsapp')
  revalidatePath('/conversas')
}

export type RespostaDaConexao =
  | { ok: true; qr: string | null; estado: string }
  | { ok: false; error: string }

/**
 * Cria a instância no provedor e devolve o QR Code.
 *
 * ## A ordem é: gastar por último
 *
 * Plano, papel e teto de tentativas são conferidos ANTES de qualquer chamada à
 * Z-API. Criar instância provisiona um recurso **cobrado por mês**, e uma
 * tentativa que já ia ser recusada não pode deixar rastro na fatura.
 *
 * É a mesma ordem de `createCheckout`, pelo mesmo motivo, e com um agravante:
 * lá o desperdício é uma assinatura órfã, aqui é uma cobrança recorrente.
 *
 * ## E se o `insert` falhar depois de a instância existir
 *
 * A instância é apagada no provedor antes de devolver o erro. Sem isso ficaria
 * faturando sem nenhuma linha apontando para ela, ou seja invisível para
 * qualquer tela e para qualquer purga: só a fatura saberia.
 */
export async function conectarWhatsapp(): Promise<RespostaDaConexao> {
  const sessao = await abrirSessao()
  if ('error' in sessao) return { ok: false, error: sessao.error }
  if (!sessao.ehAdmin) {
    return { ok: false, error: 'Apenas administradores podem conectar o WhatsApp.' }
  }

  const assinatura = await situacaoDoMax(sessao.workspaceId)
  // `'ausente'` de propósito: aqui a pergunta é só sobre o PLANO, e passar o
  // estado real faria a função responder "conecte o WhatsApp" para quem está
  // clicando exatamente nisso.
  const direito = direitoAoWhatsapp(assinatura, 'ausente')
  if (!direito.pode && direito.tipo !== 'sem_conexao') {
    return { ok: false, error: direito.motivo }
  }

  const jaExiste = await conexaoDaEmpresa(sessao.workspaceId)
  if (jaExiste.estado !== 'ausente') {
    // Reconectar não cria instância nova: o QR sai da que já existe. Criar
    // outra deixaria a primeira faturando.
    return lerQrCode()
  }

  if (await excedeuLimite('whatsapp-conectar', sessao.userId)) {
    return {
      ok: false,
      error: 'Você tentou conectar várias vezes seguidas. Aguarde alguns minutos.',
    }
  }

  const segredo = segredoNovo()
  const base = appUrl()

  let criada: { id: string; token: string }
  try {
    criada = await criarInstancia({
      // O nome aparece no painel do provedor, e é o que torna uma fatura com
      // dezenas de linhas auditável. O id da empresa entra porque nome de
      // empresa se repete.
      nome: `velofunil-${sessao.workspaceId}`,
      webhookRecebida: `${base}/api/webhooks/zapi/receive/${segredo}`,
      webhookStatus: `${base}/api/webhooks/zapi/status/${segredo}`,
      webhookDesconexao: `${base}/api/webhooks/zapi/disconnected/${segredo}`,
    })
  } catch (erro) {
    console.error('conectarWhatsapp: provedor recusou', erro)
    return {
      ok: false,
      error: 'Não foi possível preparar a conexão agora. Tente de novo em alguns minutos.',
    }
  }

  const guardada = await guardarInstancia({
    workspaceId: sessao.workspaceId,
    instanceId: criada.id,
    token: criada.token,
    segredo,
  })

  if (!guardada.ok) {
    // Ver o cabeçalho: instância sem linha é cobrança invisível.
    try {
      await apagarInstancia(criada.id)
    } catch (erro) {
      console.error(
        `conectarWhatsapp: instancia ${criada.id} ficou ORFA no provedor e PRECISA ser apagada a mao`,
        erro,
      )
    }
    return { ok: false, error: guardada.motivo }
  }

  revalidar()
  return lerQrCode()
}

/**
 * O QR Code de agora.
 *
 * Chamado em laço pela tela. O QR da Z-API expira em segundos, então não há o
 * que cachear — e `cache: 'no-store'` no cliente HTTP garante que o Next não
 * guarde um código morto.
 */
export async function lerQrCode(): Promise<RespostaDaConexao> {
  const sessao = await abrirSessao()
  if ('error' in sessao) return { ok: false, error: sessao.error }
  if (!sessao.ehAdmin) {
    return { ok: false, error: 'Apenas administradores podem conectar o WhatsApp.' }
  }

  const instancia = await credenciaisDaEmpresa(sessao.workspaceId)
  if (!instancia) return { ok: false, error: 'Nenhuma conexão encontrada nesta empresa.' }

  try {
    const estado = await statusDaInstancia(instancia)
    if (estado.connected) {
      // Já conectou entre um giro e outro do laço. Registrar aqui e não só no
      // webhook: a Z-API não manda callback de CONEXÃO configurado por nós, e
      // sem isto a tela ficaria pedindo QR de um número que já está de pé.
      const telefone = await telefoneConectado(instancia).catch(() => null)
      await registrarEstado({
        workspaceId: sessao.workspaceId,
        estado: 'conectado',
        telefone,
      })
      revalidar()
      return { ok: true, qr: null, estado: 'conectado' }
    }

    const qr = await qrCode(instancia)
    await registrarEstado({ workspaceId: sessao.workspaceId, estado: 'conectando' })
    return { ok: true, qr, estado: 'conectando' }
  } catch (erro) {
    console.error('lerQrCode: provedor não respondeu', erro)
    // NÃO grava `erro` no banco: falha de leitura não é desconexão, e marcar
    // assim apagaria o último estado conhecido por causa de um timeout.
    return { ok: false, error: 'O provedor não respondeu. Tente de novo.' }
  }
}

/**
 * Tira o número do WhatsApp e MANTÉM a instância.
 *
 * É o que a pessoa quer ao trocar de aparelho. Quem para a cobrança é
 * `removerWhatsapp`, e é outro botão de propósito: as duas ações têm o mesmo
 * nome na cabeça de quem clica e consequências muito diferentes na fatura.
 */
export async function desconectarWhatsapp(): Promise<{ ok: boolean; error?: string }> {
  const sessao = await abrirSessao()
  if ('error' in sessao) return { ok: false, error: sessao.error }
  if (!sessao.ehAdmin) {
    return { ok: false, error: 'Apenas administradores podem desconectar o WhatsApp.' }
  }

  const instancia = await credenciaisDaEmpresa(sessao.workspaceId)
  if (!instancia) return { ok: false, error: 'Nenhuma conexão encontrada nesta empresa.' }

  try {
    await desconectarNoProvedor(instancia)
  } catch (erro) {
    // Segue mesmo assim: o estado local precisa refletir a intenção, senão a
    // tela continua dizendo "conectado" para quem acabou de desconectar.
    console.error('desconectarWhatsapp: provedor recusou', erro)
  }

  await registrarEstado({
    workspaceId: sessao.workspaceId,
    estado: 'desconectado',
    telefone: null,
    erro: null,
  })
  revalidar()
  return { ok: true }
}

/**
 * Apaga a instância no provedor e esquece a conexão.
 *
 * **É o que PARA a cobrança.** Desconectar sozinho tira o número e deixa a
 * instância faturando, e a diferença entre as duas coisas aparece na fatura do
 * mês seguinte.
 *
 * As conversas e as mensagens FICAM. Elas são da empresa, não da conexão, e
 * apagá-las junto puniria quem trocou de número com a perda do histórico de
 * venda — o mesmo raciocínio que faz `podeLerConversas` devolver `true` sempre.
 */
export async function removerWhatsapp(): Promise<{ ok: boolean; error?: string }> {
  const sessao = await abrirSessao()
  if ('error' in sessao) return { ok: false, error: sessao.error }
  if (!sessao.ehAdmin) {
    return { ok: false, error: 'Apenas administradores podem remover o WhatsApp.' }
  }

  const instancia = await credenciaisDaEmpresa(sessao.workspaceId)
  if (!instancia) return { ok: false, error: 'Nenhuma conexão encontrada nesta empresa.' }

  try {
    await apagarInstancia(instancia.instanceId)
  } catch (erro) {
    // Aqui NÃO segue: esquecer a linha sem apagar no provedor deixaria uma
    // instância faturando que nenhuma tela alcança. É o pior desfecho possível,
    // e o único jeito de descobrir seria a fatura.
    console.error('removerWhatsapp: provedor recusou', erro)
    return {
      ok: false,
      error: 'Não foi possível remover a conexão no provedor. Tente de novo.',
    }
  }

  await esquecerInstancia(sessao.workspaceId)
  revalidar()
  return { ok: true }
}
