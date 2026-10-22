import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { credenciaisDaEmpresa } from '@/lib/whatsapp/instancia'
import { baixarImagemPublica } from '@/lib/enterprise/imagem'
import {
  BUCKET_DE_AVATARES,
  POR_RODADA,
  DIAS_ATE_RECONFERIR,
  INTERVALO_DE_RETENTATIVA_MS,
  caminhoDaFoto,
  deveBuscarFoto,
  type LeadParaFoto,
} from '@/lib/whatsapp/foto'
import { fotoDePerfil } from '@/lib/whatsapp/zapi'

/**
 * Busca a foto de perfil de quem escreve, e guarda a NOSSA cópia.
 *
 * ## Por que uma cópia, e não a URL do provedor
 *
 * Duas medições de 18/09 fecham as saídas mais baratas:
 *
 *     a URL expira        o parametro `oe` da Z-API carrega a validade, e a
 *                         que medimos morria em DEZ dias
 *     a CSP bloqueia      `pps.whatsapp.net` nao esta no `img-src`, e a CSP
 *                         deste projeto e header de PRODUCAO em modo bloqueio
 *
 * Um `<img>` apontando para lá não renderiza **e não dá erro na tela**. É a
 * classe que já custou três vezes aqui: a logo do Storage em 31/08, o script
 * do Google Ads em 04/09 e o `robots.txt` do Cloudflare em 03/09.
 *
 * O Supabase Storage já está no `img-src`, então a nossa cópia resolve os dois
 * de uma vez.
 *
 * ## Por que um cron, e não o webhook
 *
 * O webhook de recebimento tem que responder rápido: fila que demora é fila
 * que o provedor penaliza, e a do Asaas parou quatro vezes em doze dias
 * exatamente assim. Pendurar uma chamada ao provedor mais um download e um
 * upload dentro dele poria a caixa de entrada inteira atrás de um avatar.
 *
 * Aqui a foto chega minutos depois, e minutos depois é o suficiente: a lista
 * já mostra as iniciais enquanto isso.
 */
export type ResultadoDaRodada = {
  ok: boolean
  /** Quantos contatos foram perguntados ao provedor. */
  perguntados: number
  /** Quantas fotos novas entraram no Storage. */
  guardadas: number
  /** Perguntados que simplesmente não têm foto visível. É o caso comum. */
  semFoto: number
  erros: string[]
}

export async function rodarBuscaDeFotos(): Promise<ResultadoDaRodada> {
  const supabase = createAdminClient()
  const erros: string[] = []
  const inicio = Date.now()
  const agora = new Date(inicio)
  const limiteDeVerificacao = new Date(inicio - DIAS_ATE_RECONFERIR * 86_400_000).toISOString()
  const limiteDeTentativa = new Date(inicio - INTERVALO_DE_RETENTATIVA_MS).toISOString()

  // ## Só empresas COM conexão, e a leitura vem primeiro de propósito
  //
  // Foto de perfil só existe para quem tem um número conectado: é dele que a
  // pergunta sai. Varrer `leads` primeiro e descobrir depois que a empresa não
  // tem instância gastaria uma consulta grande para jogar fora.
  const { data: instancias, error: erroDasInstancias } = await supabase
    .from('whatsapp_instances')
    .select('workspace_id')
    .eq('status', 'conectado')

  if (erroDasInstancias) {
    return {
      ok: false,
      perguntados: 0,
      guardadas: 0,
      semFoto: 0,
      erros: ['falha ao ler as conexões'],
    }
  }

  const empresas = (instancias ?? []).map((i) => i.workspace_id)
  if (empresas.length === 0) {
    return { ok: true, perguntados: 0, guardadas: 0, semFoto: 0, erros: [] }
  }

  // Tentativas e verificações são fatos separados: falhar não significa
  // "sem foto". A ordenação deixa os ainda não tentados passarem na frente
  // das falhas, que só voltam depois de uma hora.
  const { data: candidatos, error: erroDosLeads } = await supabase
    .from('leads')
    .select('id, workspace_id, phone, foto_path, foto_verificada_em, foto_tentada_em')
    .in('workspace_id', empresas)
    .not('phone', 'is', null)
    .or(`foto_verificada_em.is.null,foto_verificada_em.lte.${limiteDeVerificacao}`)
    .or(`foto_tentada_em.is.null,foto_tentada_em.lte.${limiteDeTentativa}`)
    .order('foto_tentada_em', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(POR_RODADA)

  if (erroDosLeads) {
    return { ok: false, perguntados: 0, guardadas: 0, semFoto: 0, erros: ['falha ao ler contatos'] }
  }

  const fila: LeadParaFoto[] = (candidatos ?? []).map((l) => ({
    id: l.id,
    workspaceId: l.workspace_id,
    telefone: l.phone,
    fotoPath: l.foto_path,
    fotoVerificadaEm: l.foto_verificada_em,
    fotoTentadaEm: l.foto_tentada_em,
  }))

  let perguntados = 0
  let guardadas = 0
  let semFoto = 0

  // As credenciais são lidas UMA vez por empresa, e não por contato: decifrar
  // o token é trabalho, e vinte contatos da mesma empresa pediriam a mesma
  // chave vinte vezes.
  const credenciais = new Map<string, ReturnType<typeof credenciaisDaEmpresa>>()

  async function processar(lead: LeadParaFoto) {
    if (!deveBuscarFoto(lead, agora).buscar) return
    let etapa = 'reserva'
    try {
      // Reserva atômica: duas rodadas simultâneas não consultam o mesmo lead.
      // Também evita que falhas no download ocupem as primeiras vagas sempre.
      const tentativaEm = new Date().toISOString()
      const { data: reservado, error: erroDaReserva } = await supabase
        .from('leads')
        .update({ foto_tentada_em: tentativaEm })
        .eq('id', lead.id)
        .eq('workspace_id', lead.workspaceId)
        .or(`foto_tentada_em.is.null,foto_tentada_em.lte.${limiteDeTentativa}`)
        .select('id')
        .maybeSingle()
      if (erroDaReserva) throw new Error('falha ao reservar contato')
      if (!reservado) return

      etapa = 'credenciais'
      if (!credenciais.has(lead.workspaceId)) {
        credenciais.set(lead.workspaceId, credenciaisDaEmpresa(lead.workspaceId))
      }
      const instancia = await credenciais.get(lead.workspaceId)
      if (!instancia) throw new Error('conexão indisponível')

      perguntados += 1
      etapa = 'provedor'
      const url = await fotoDePerfil(instancia, lead.telefone!, { timeoutMs: 8_000 })

      if (url) {
        etapa = 'imagem'
        await guardarFoto(supabase, lead, url)
        guardadas += 1
      } else {
        semFoto += 1
      }

      // ## A marca é gravada em TODO caminho que não lançou, inclusive sem foto
      //
      // É o que impede o laço infinito. Contato sem foto visível é comum, e
      // sem a marca ele voltaria à fila a cada passagem do cron, para sempre.
      etapa = 'confirmação'
      const { error: erroDaVerificacao } = await supabase
        .from('leads')
        .update({ foto_verificada_em: new Date().toISOString(), ...(url ? {} : { foto_path: null }) })
        .eq('id', lead.id)
        .eq('workspace_id', lead.workspaceId)
        .eq('phone', lead.telefone!)
      if (erroDaVerificacao) throw new Error('falha ao registrar verificação')
    } catch (erro) {
      // Falha de rede ou do provedor NÃO grava a marca: ela pede tentativa de
      // novo, e "não tem foto" não pede. Gravar aqui trataria uma indisponi-
      // bilidade de dez minutos como "esse contato não tem foto", para sempre.
      // Erros do provedor podem conter tokens na URL. Telemetria não registra
      // URL, telefone, credencial nem corpo bruto da resposta.
      // Somente categorias conhecidas: nunca serializa erros/URLs do provedor.
      const statusImagem = erro instanceof Error ? /^Imagem indisponível: (\d{3})\.$/.exec(erro.message)?.[1] : null
      const motivo = erro instanceof Error && (erro.name === 'AbortError' || erro.name === 'TimeoutError')
        ? 'tempo limite'
        : statusImagem ? `HTTP ${statusImagem}` : 'falha'
      erros.push(`${etapa}: ${motivo}`)
    }
  }

  let proximo = 0
  await Promise.all(Array.from({ length: Math.min(3, fila.length) }, async () => {
    // Preserva orçamento para o retorno HTTP; não entra no webhook de mensagem.
    while (proximo < fila.length && Date.now() - inicio < 10_000) {
      await processar(fila[proximo++]!)
    }
  }))

  return { ok: erros.length === 0, perguntados, guardadas, semFoto, erros }
}

/**
 * Baixa e sobe. Devolve se a foto de fato entrou.
 *
 * ## O tipo é conferido nos BYTES, e não no cabeçalho
 *
 * `allowed_mime_types` do bucket compara com o `Content-Type` declarado, e
 * quem declara pode mentir. A checagem que vale é aqui, e ela recusa **SVG**
 * em particular: SVG é executável no navegador, e um arquivo servido do nosso
 * domínio com script dentro é XSS com a nossa origem, que é exatamente o que a
 * CSP existe para impedir.
 */
async function guardarFoto(
  supabase: ReturnType<typeof createAdminClient>,
  lead: LeadParaFoto,
  url: string,
): Promise<void> {
  // O helper limita o download a 512 KiB, confere a assinatura do arquivo e
  // permite apenas HTTPS público sem redirects ou troca de IP após validar DNS.
  const { bytes, tipoMime } = await baixarImagemPublica(url)

  const caminho = caminhoDaFoto(lead.workspaceId, lead.id)
  const { error } = await supabase.storage
    .from(BUCKET_DE_AVATARES)
    .upload(caminho, bytes, { contentType: tipoMime, upsert: true })

  if (error) {
    throw new Error('falha ao guardar imagem')
  }

  // O caminho só é gravado DEPOIS de o arquivo existir. Na ordem inversa, uma
  // falha de upload deixaria a coluna apontando para um arquivo que não está
  // lá, e a tela pediria uma URL assinada de nada.
  const { error: erroDaColuna } = await supabase
    .from('leads')
    .update({ foto_path: caminho })
    .eq('id', lead.id)
    .eq('workspace_id', lead.workspaceId)
    .eq('phone', lead.telefone!)

  if (erroDaColuna) {
    throw new Error('falha ao registrar caminho da imagem')
  }
}
