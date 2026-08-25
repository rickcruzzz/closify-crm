'use server'

import { randomBytes } from 'node:crypto'

import { revalidatePath } from 'next/cache'

import { appUrl } from '@/lib/app-url'
import { normalizarTelefoneBrasileiro } from '@/lib/leads/whatsapp'
import { mensagemBloqueioPro } from '@/lib/integrations/mensagem-bloqueio-pro'
import { cifrar } from '@/lib/integrations/crypto'
import { obterTokenDaInstancia } from '@/lib/integrations/evolution/token'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import {
  conectarInstancia,
  criarOuAdotarInstancia,
  obterEstado,
  obterQrCode,
  pedirCodigoDePareamento,
  recomecarSessaoDePareamento,
  ultimoErroDaInstancia,
} from './api'

/**
 * Conectar e desconectar o WhatsApp de uma empresa.
 *
 * ## Uma instância por empresa, nunca compartilhada
 *
 * O `unique(workspace_id, provider)` de `integration_connections` (migration
 * 0034) já garante isso no banco, e é o que isola o risco: um número
 * restringido pela Meta afeta **um** cliente, não a base inteira. Número
 * compartilhado entre empresas seria um ponto único de falha com consequência
 * proporcional ao número de clientes.
 *
 * ## O token da instância, cifrado como um token OAuth qualquer
 *
 * O Evolution GO (ver `./api.ts` para o porquê do nome) exige um token
 * PRÓPRIO por instância — nós escolhemos o valor na criação, e ele vira a
 * senha de acesso a partir daí. É gravado em `access_token_enc`, a mesma
 * coluna cifrada que Google Calendar/Gmail já usam para o access token deles
 * — mesmo risco (quem lê essa coluna pode agir em nome da conexão), mesma
 * defesa.
 */
export type ResultadoDaConexao =
  | { ok: true; qrCode: string | null; jaConectado?: boolean }
  | { ok: false; erro: string }

export type ResultadoDoCodigo =
  | { ok: true; codigo: string }
  | { ok: false; erro: string }

/** Só admin mexe em integração — mesma regra do Google Calendar e do Gmail. */
async function exigirAdmin(workspaceId: string): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sessão expirada.')
  const { data: membro } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membro?.role !== 'admin') {
    throw new Error('Só quem administra a empresa pode conectar o WhatsApp.')
  }
  return user.id
}

/**
 * Cria a instância no Evolution GO e devolve o QR Code para leitura.
 *
 * O QR expira em ~20 segundos e o Evolution gera outro sozinho, então ele
 * **nunca é gravado** — a tela busca ao vivo enquanto o diálogo está aberto.
 * Persistir um QR seria persistir algo que já nasce vencido.
 */
export async function conectarWhatsapp(workspaceId: string): Promise<ResultadoDaConexao> {
  try {
    const userId = await exigirAdmin(workspaceId)
    // Integração é recurso Pro, igual a Calendar e Gmail. A regra real está na
    // policy de `integration_connections` (migration 0037); a checagem aqui
    // existe para dar mensagem clara em vez de erro de permissão cru.
    //
    // Lê `pro_vigente()`, nunca a coluna `workspaces.plan`: a coluna é o último
    // valor gravado e não sabe que o tempo passou — doutrina travada do
    // projeto desde o bug da migration 0028.
    const supabase = await createClient()
    const { data: podeUsar } = await supabase.rpc('pro_vigente', {
      target_workspace_id: workspaceId,
    })
    if (!podeUsar) {
      return { ok: false, erro: await mensagemBloqueioPro(supabase, workspaceId) }
    }

    // Reconectar depois de uma queda é o caminho comum numa API não oficial:
    // reusa o token já gravado em vez de criar instância nova (o Evolution
    // GO recusaria o mesmo instanceId com token diferente) — só gera um
    // token novo quando esta empresa nunca conectou antes.
    // `criarOuAdotarInstancia` e não `criarInstancia`: se o servidor já tiver
    // uma instância com este id e o banco não souber dela, readota em vez de
    // morrer com "instance already exists". Sem isso a empresa fica presa para
    // sempre — ver o cabeçalho da função para o defeito medido em produção.
    let token = await obterTokenDaInstancia(workspaceId)
    if (!token) {
      const instancia = await criarOuAdotarInstancia(
        workspaceId,
        `velofunil-${workspaceId}`,
        randomBytes(24).toString('hex'),
      )
      token = instancia.token
    }

    // O Evolution não assina o payload do webhook, então a URL carrega um
    // segredo que autentica a chamada. Ver o cabeçalho da rota.
    const segredo = process.env.EVOLUTION_WEBHOOK_SECRET
    const webhookUrl = segredo
      ? `${appUrl()}/api/webhooks/evolution/${encodeURIComponent(workspaceId)}/${segredo}`
      : ''
    const { qrCode, jaConectado } = await conectarInstancia(token, webhookUrl)

    // Sem QR e sem conexão, o motivo só existe do lado do servidor — a
    // resposta da API é a mesma para causa transitória e para falha de
    // infraestrutura. Registrar aqui é o que separa "tente de novo" de
    // "o Postgres da VPS está sem conexões livres".
    if (!qrCode && !jaConectado) {
      console.error('whatsapp: sessão não gerou QR', {
        workspaceId,
        motivo: await ultimoErroDaInstancia(workspaceId),
      })
    }

    // `upsert` e não `insert`: reconectar depois de uma queda é o caminho
    // comum numa API não oficial, e um insert cru estouraria na chave única.
    const admin = createAdminClient()
    await admin.from('integration_connections').upsert(
      {
        workspace_id: workspaceId,
        provider: 'whatsapp',
        // Reconectar um número que já estava pareado não devolve QR — e
        // gravar 'disconnected' aqui apagaria uma conexão viva do registro,
        // deixando a tela de Integrações dizendo "Não conectado" para quem
        // está conectado.
        status: jaConectado ? 'connected' : 'disconnected',
        external_id: workspaceId,
        access_token_enc: cifrar(token) as unknown as never,
        connected_by: userId,
        scopes: [],
      },
      { onConflict: 'workspace_id,provider' },
    )
    revalidatePath('/settings')
    return { ok: true, qrCode, jaConectado }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui falar com o servidor do WhatsApp.',
    }
  }
}

/**
 * Busca o código enquanto o diálogo está aberto.
 *
 * `recomecar` separa as duas coisas diferentes de que a tela precisa:
 *
 * - `false` — só pegar o código atual. Barato, e é o caso comum de "ainda não
 *   estava pronto quando a tela pediu".
 * - `true` — começar uma sessão nova, apagando e recriando a instância. É a
 *   ÚNICA forma de escapar do corte que o Evolution aplica aos ~160s; nem
 *   `connect` de novo nem `disconnect`+`connect` reiniciam nada
 *   (ver `recomecarSessaoDePareamento`).
 */
export async function renovarQrCode(
  workspaceId: string,
  recomecar = false,
): Promise<ResultadoDaConexao> {
  try {
    await exigirAdmin(workspaceId)

    // `recomecar` APAGA e recria a instância no servidor Evolution. Sem o gate,
    // uma empresa sem Pro conseguiria repetir o pareamento indefinidamente,
    // consumindo recurso da VPS — o gasto é por instância viva, não por
    // assinatura.
    //
    // Renovar o QR de uma sessão já em curso (`recomecar` falso) segue livre:
    // ele só faz sentido logo depois de `conectarWhatsapp`, que já checou, e
    // travá-lo aqui deixaria o diálogo preso com um código expirado em tela.
    if (recomecar) {
      const supabase = await createClient()
      const { data: podeUsar } = await supabase.rpc('pro_vigente', {
        target_workspace_id: workspaceId,
      })
      if (!podeUsar) {
        return { ok: false, erro: await mensagemBloqueioPro(supabase, workspaceId) }
      }
    }

    const token = await obterTokenDaInstancia(workspaceId)
    if (!token) return { ok: false, erro: 'Conexão não encontrada. Tente conectar de novo.' }

    if (!recomecar) return { ok: true, qrCode: await obterQrCode(token) }

    // Confere o estado IMEDIATAMENTE antes de apagar: se a pessoa acabou de
    // parear, recriar a instância derrubaria o número recém-conectado —
    // trocaria um código velho na tela por um cliente desconectado.
    const { estado } = await obterEstado(token)
    if (estado === 'open') return { ok: true, qrCode: null, jaConectado: true }

    const segredo = process.env.EVOLUTION_WEBHOOK_SECRET
    const webhookUrl = segredo
      ? `${appUrl()}/api/webhooks/evolution/${encodeURIComponent(workspaceId)}/${segredo}`
      : ''
    const qrCode = await recomecarSessaoDePareamento(
      workspaceId,
      `velofunil-${workspaceId}`,
      token,
      webhookUrl,
    )
    return { ok: true, qrCode }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui buscar o código.',
    }
  }
}

/**
 * Diz se o número já foi conectado.
 *
 * A tela chama isso em intervalo enquanto o QR está na frente da pessoa: é
 * assim que o diálogo fecha sozinho quando ela termina de escanear.
 */
/**
 * NÃO exige Pro, e isso é decisão, não esquecimento.
 *
 * É leitura pura: não cria instância, não consome recurso da VPS e não dá
 * acesso a nada. E a tela PRECISA dela justamente para quem perdeu o plano —
 * é assim que o card mostra "Pausado" com o motivo, em vez de um estado
 * desconhecido. Travar aqui esconderia a informação de quem mais precisa dela
 * para decidir voltar ao Pro.
 */
export async function estadoDaConexao(
  workspaceId: string,
): Promise<{ conectado: boolean; numero: string | null }> {
  try {
    await exigirAdmin(workspaceId)
    const token = await obterTokenDaInstancia(workspaceId)
    if (!token) return { conectado: false, numero: null }

    const instancia = await obterEstado(token)
    const conectado = instancia.estado === 'open'
    if (conectado) {
      const admin = createAdminClient()
      await admin
        .from('integration_connections')
        .update({
          status: 'connected',
          account_label: instancia.numero,
          last_error: null,
        })
        .eq('workspace_id', workspaceId)
        .eq('provider', 'whatsapp')
      revalidatePath('/settings')
    }
    return { conectado, numero: instancia.numero }
  } catch {
    // Falhar aqui é normal enquanto a instância ainda está subindo — a tela
    // continua tentando em vez de mostrar erro no meio da leitura do QR.
    return { conectado: false, numero: null }
  }
}

/**
 * Conecta pelo código de 8 letras, em vez do QR Code.
 *
 * É o caminho mais confiável dos dois, e existe porque o QR tem uma janela
 * curta demais: vive ~20s e a sessão inteira morre em ~160s, o que fazia o
 * WhatsApp recusar a leitura com "verifique sua conexão e tente mais tarde".
 * Digitar 8 letras não depende de câmera nem de tempo de foco — e funciona
 * para quem abre o CRM no próprio celular, que não tem como escanear a
 * própria tela.
 *
 * O número é validado pela MESMA função que o botão "Chamar no WhatsApp" usa
 * (`normalizarTelefoneBrasileiro`), então um número torto é recusado aqui, com
 * mensagem clara, em vez de virar um código que nunca chega.
 */
export async function conectarPorCodigo(
  workspaceId: string,
  telefone: string,
): Promise<ResultadoDoCodigo> {
  try {
    const userId = await exigirAdmin(workspaceId)

    // Mesma checagem de `conectarWhatsapp`, e ela precisa estar aqui também.
    //
    // Este é o caminho ALTERNATIVO de pareamento (código de 8 letras, para
    // quem abre o CRM pelo próprio celular e não consegue escanear a própria
    // tela). Ele cria instância, configura webhook e pareia — tudo que o
    // caminho do QR faz — mas era a única das duas portas sem o gate de plano.
    //
    // Achado auditando o caso de 24/08 em que uma empresa Free estava com o
    // WhatsApp ativo: a defesa existia num caminho e faltava no outro, que é
    // como esse tipo de furo sobrevive a revisão.
    const supabase = await createClient()
    const { data: podeUsar } = await supabase.rpc('pro_vigente', {
      target_workspace_id: workspaceId,
    })
    if (!podeUsar) {
      return { ok: false, erro: await mensagemBloqueioPro(supabase, workspaceId) }
    }

    const numero = normalizarTelefoneBrasileiro(telefone)
    if (!numero) {
      return {
        ok: false,
        erro: 'Informe o número com DDD, como (11) 98888-7777.',
      }
    }

    // Mesmo caminho de `conectarWhatsapp`: reusa o token já gravado e só cria
    // instância nova quando esta empresa nunca conectou antes.
    // `criarOuAdotarInstancia` e não `criarInstancia`: se o servidor já tiver
    // uma instância com este id e o banco não souber dela, readota em vez de
    // morrer com "instance already exists". Sem isso a empresa fica presa para
    // sempre — ver o cabeçalho da função para o defeito medido em produção.
    let token = await obterTokenDaInstancia(workspaceId)
    if (!token) {
      const instancia = await criarOuAdotarInstancia(
        workspaceId,
        `velofunil-${workspaceId}`,
        randomBytes(24).toString('hex'),
      )
      token = instancia.token
    }

    const segredo = process.env.EVOLUTION_WEBHOOK_SECRET
    const webhookUrl = segredo
      ? `${appUrl()}/api/webhooks/evolution/${encodeURIComponent(workspaceId)}/${segredo}`
      : ''
    await conectarInstancia(token, webhookUrl)

    const codigo = await pedirCodigoDePareamento(token, numero)
    if (!codigo) {
      console.error('whatsapp: servidor não devolveu código', {
        workspaceId,
        motivo: await ultimoErroDaInstancia(workspaceId),
      })
      return { ok: false, erro: 'O servidor não gerou o código. Tente de novo em instantes.' }
    }

    const admin = createAdminClient()
    await admin.from('integration_connections').upsert(
      {
        workspace_id: workspaceId,
        provider: 'whatsapp',
        status: 'disconnected',
        external_id: workspaceId,
        access_token_enc: cifrar(token) as unknown as never,
        connected_by: userId,
        scopes: [],
      },
      { onConflict: 'workspace_id,provider' },
    )
    revalidatePath('/settings')
    return { ok: true, codigo }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui falar com o servidor do WhatsApp.',
    }
  }
}
