'use server'

import { revalidatePath } from 'next/cache'
import { z } from '@/lib/validations/zod'

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
  assinarInstancia,
  cancelarAssinaturaDaInstancia,
  criarInstancia,
  tentarConfigurarWebhooks,
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
  const urls = urlsDoWebhook(segredo)

  let criada: { id: string; token: string }
  try {
    criada = await criarInstancia({
      // O nome aparece no painel do provedor, e é o que torna uma fatura com
      // dezenas de linhas auditável. O id da empresa entra porque nome de
      // empresa se repete.
      nome: `velofunil-${sessao.workspaceId}`,
      webhookRecebida: urls.recebida,
      webhookStatus: urls.status,
      webhookDesconexao: urls.desconexao,
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
    //
    // Ela ainda está em TRIAL neste ponto — `assinarInstancia` só é chamada
    // depois que o QR é lido —, então a Z-API a apagaria sozinha em 48h de
    // qualquer jeito. Cancelar mesmo assim é o cinto: o trial pode acabar
    // depois de alguém assinar por engano, e uma instância órfã que nenhuma
    // tela alcança só aparece na fatura.
    try {
      await cancelarAssinaturaDaInstancia({ instanceId: criada.id, token: criada.token })
    } catch (erro) {
      console.error(
        `conectarWhatsapp: instancia ${criada.id} ficou ORFA no provedor e PRECISA ser cancelada a mao`,
        erro,
      )
    }
    return { ok: false, error: guardada.motivo }
  }

  revalidar()
  return lerQrCode()
}

/**
 * As três URLs que a instância desta empresa precisa chamar.
 *
 * Uma função e não três strings soltas: elas nascem juntas, do mesmo segredo, e
 * qualquer caminho que monte uma delas por conta própria vai errar o dia em que
 * uma rota mudar de lugar.
 */
function urlsDoWebhook(segredo: string) {
  const base = appUrl()
  return {
    base: `${base}/api/webhooks/zapi`,
    recebida: `${base}/api/webhooks/zapi/receive/${segredo}`,
    status: `${base}/api/webhooks/zapi/status/${segredo}`,
    desconexao: `${base}/api/webhooks/zapi/disconnected/${segredo}`,
  }
}

const adocaoSchema = z.object({
  // A Z-API entrega os dois em hexadecimal maiúsculo. A validação é de FORMA e
  // não de conteúdo: quem decide se as credenciais valem é o `GET /status`
  // abaixo, contra o provedor. Recusar aqui só evita gastar uma chamada com
  // texto que obviamente não é credencial.
  instanceId: z
    .string()
    .trim()
    .min(8, 'O ID da instância parece curto demais. Copie do painel da Z-API.')
    .max(120, 'O ID da instância parece longo demais.'),
  token: z
    .string()
    .trim()
    .min(8, 'O token parece curto demais. Copie do painel da Z-API.')
    .max(200, 'O token parece longo demais.'),
})

export type RespostaDaAdocao =
  | {
      ok: true
      /** Os webhooks foram configurados por API, ou precisam ser colados à mão? */
      webhooksConfirmados: boolean
      urls: { recebida: string; status: string; desconexao: string }
    }
  | { ok: false; error: string }

/**
 * Adota uma instância criada À MÃO no painel da Z-API.
 *
 * ## Por que este caminho existe ao lado de `conectarWhatsapp`
 *
 * `conectarWhatsapp` cria a instância por API e é o caminho do cliente: ele
 * nunca vê credencial nenhuma, que é o que a seção 10 do desenho exige.
 *
 * Ele depende do **Partner token**, e o programa Partner tem condição comercial
 * a partir de dez instâncias. Contra a receita externa de hoje, que é zero, isso
 * é um contrato antes do primeiro cliente.
 *
 * Esta função é a ponte: com o trial de dois dias da Z-API, que não pede cartão,
 * dá para criar UMA instância no painel e exercitar o produto inteiro — parear
 * um número, receber, responder, ver o status andar — sem Partner e sem gastar.
 *
 * **Não é o caminho do cliente**, e é por isso que ela pede as credenciais e o
 * outro não. Ela existe para o dono provar o que foi construído.
 *
 * ## As credenciais são validadas CONTRA O PROVEDOR antes de gravar
 *
 * `GET /status` é contrato confirmado na documentação. Gravar primeiro e
 * descobrir depois deixaria uma linha dizendo "conectado" para uma instância que
 * não existe, e a trigger da 0090 teria sido gasta à toa.
 *
 * ## E os webhooks podem não ser confirmados, o que é dito em vez de escondido
 *
 * A documentação da Z-API publica o corpo e o método do endpoint de webhook, e
 * **não publica o segmento de caminho**. Se a chamada falhar, esta função NÃO
 * finge que deu certo: devolve `webhooksConfirmados: false` e as três URLs, para
 * a pessoa colar no painel.
 *
 * Um webhook que não foi configurado de verdade produz o pior sintoma possível
 * aqui: silêncio, com a tela dizendo conectado. É a lição do `sendButtons` de
 * 12/09, que respondeu 201 quatro vezes sem renderizar nada.
 */
export async function adotarInstancia(valores: unknown): Promise<RespostaDaAdocao> {
  const lido = adocaoSchema.safeParse(valores)
  if (!lido.success) {
    return { ok: false, error: lido.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const sessao = await abrirSessao()
  if ('error' in sessao) return { ok: false, error: sessao.error }
  if (!sessao.ehAdmin) {
    return { ok: false, error: 'Apenas administradores podem conectar o WhatsApp.' }
  }

  // O mesmo gate do caminho automático: a trigger da 0090 recusaria de qualquer
  // jeito, e chegar até ela gastaria uma chamada ao provedor por uma escrita
  // que já ia ser negada.
  const assinatura = await situacaoDoMax(sessao.workspaceId)
  const direito = direitoAoWhatsapp(assinatura, 'ausente')
  if (!direito.pode && direito.tipo !== 'sem_conexao') {
    return { ok: false, error: direito.motivo }
  }

  const jaExiste = await conexaoDaEmpresa(sessao.workspaceId)
  if (jaExiste.estado !== 'ausente') {
    return {
      ok: false,
      error: 'Esta empresa já tem uma conexão. Remova a atual antes de adotar outra.',
    }
  }

  const instancia = { instanceId: lido.data.instanceId, token: lido.data.token }

  try {
    await statusDaInstancia(instancia)
  } catch (erro) {
    console.error('adotarInstancia: credenciais recusadas pelo provedor', erro)
    return {
      ok: false,
      error: 'A Z-API não reconheceu este ID e token. Confira os dois no painel dela.',
    }
  }

  const segredo = segredoNovo()
  const urls = urlsDoWebhook(segredo)

  const guardada = await guardarInstancia({
    workspaceId: sessao.workspaceId,
    instanceId: instancia.instanceId,
    token: instancia.token,
    segredo,
  })
  if (!guardada.ok) return { ok: false, error: guardada.motivo }

  // Depois de gravar, e não antes: aqui a instância NÃO foi criada por nós, e
  // falhar a configuração não deixa nada órfão faturando. O risco que sobra é o
  // oposto — webhook não apontado —, e ele é devolvido para a tela dizer.
  const webhooks = await tentarConfigurarWebhooks(instancia, urls.base)

  revalidar()
  return {
    ok: true,
    webhooksConfirmados: webhooks.confirmado,
    urls: { recebida: urls.recebida, status: urls.status, desconexao: urls.desconexao },
  }
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
      // ## A ASSINATURA começa aqui, e não na criação
      //
      // `criarInstancia` devolve um trial de DOIS DIAS, e a Z-API apaga sozinha
      // o que ninguém assinar. Sem esta chamada, um cliente que pagasse o Max
      // numa sexta teria o WhatsApp da empresa desligado no domingo, **sem nada
      // falhar do nosso lado**: a linha diria "conectado", o envio passaria a
      // tomar 404, e o sintoma seria silêncio.
      //
      // Depois do QR lido, e não antes, porque é aqui que a instância deixa de
      // ser uma aposta: assinar na criação pagaria por quem nunca pareia.
      //
      // Falhar NÃO derruba a conexão que acabou de dar certo. O cliente está
      // com o celular na mão e o número já está pareado; o que se perde é a
      // renovação, e ela tem 48h de folga para uma segunda tentativa.
      try {
        await assinarInstancia(instancia)
      } catch (erro) {
        console.error(
          `lerQrCode: instancia ${instancia.instanceId} CONECTOU e NAO foi assinada. Ela expira em 48h se ninguem assinar no painel.`,
          erro,
        )
      }

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
 * O número NÃO cai na hora: a Z-API mantém a instância ativa até o fim do ciclo
 * de cobrança, que é o último dia do mês. Isso é do provedor, e está dito no
 * toast da tela — sem essa frase a pessoa acha que quebrou e tenta reconectar.
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
    await cancelarAssinaturaDaInstancia(instancia)
  } catch (erro) {
    // Aqui NÃO segue: esquecer a linha sem apagar no provedor deixaria uma
    // instância faturando que nenhuma tela alcança. É o pior desfecho possível,
    // e o único jeito de descobrir seria a fatura.
    // Aqui NÃO segue: esquecer a linha sem cancelar no provedor deixaria uma
    // instância faturando que nenhuma tela alcança.
    console.error('removerWhatsapp: provedor recusou cancelar', erro)
    return {
      ok: false,
      error: 'Não foi possível remover a conexão no provedor. Tente de novo.',
    }
  }

  await esquecerInstancia(sessao.workspaceId)
  revalidar()
  return { ok: true }
}
