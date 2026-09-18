import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { credenciaisDaEmpresa } from '@/lib/whatsapp/instancia'
import {
  BUCKET_DE_AVATARES,
  POR_RODADA,
  caminhoDaFoto,
  deveBuscarFoto,
  tipoAceito,
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

  // O índice parcial da 0096 é sobre `foto_verificada_em is null`, e por isso a
  // ordenação é por `created_at`: contato mais antigo primeiro, que é a ordem
  // em que as conversas aparecem na tela.
  const { data: candidatos, error: erroDosLeads } = await supabase
    .from('leads')
    .select('id, workspace_id, phone, foto_path, foto_verificada_em')
    .in('workspace_id', empresas)
    .not('phone', 'is', null)
    .is('foto_verificada_em', null)
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
  }))

  let perguntados = 0
  let guardadas = 0
  let semFoto = 0

  // As credenciais são lidas UMA vez por empresa, e não por contato: decifrar
  // o token é trabalho, e vinte contatos da mesma empresa pediriam a mesma
  // chave vinte vezes.
  const credenciais = new Map<string, Awaited<ReturnType<typeof credenciaisDaEmpresa>>>()

  for (const lead of fila) {
    const decisao = deveBuscarFoto(lead)
    if (!decisao.buscar) continue

    if (!credenciais.has(lead.workspaceId)) {
      credenciais.set(lead.workspaceId, await credenciaisDaEmpresa(lead.workspaceId))
    }
    const instancia = credenciais.get(lead.workspaceId)
    if (!instancia) continue

    try {
      perguntados += 1
      const url = await fotoDePerfil(instancia, lead.telefone!)

      if (url) {
        const guardou = await guardarFoto(supabase, lead, url)
        if (guardou) guardadas += 1
        else semFoto += 1
      } else {
        semFoto += 1
      }

      // ## A marca é gravada em TODO caminho que não lançou, inclusive sem foto
      //
      // É o que impede o laço infinito. Contato sem foto visível é comum, e
      // sem a marca ele voltaria à fila a cada passagem do cron, para sempre.
      await supabase
        .from('leads')
        .update({ foto_verificada_em: new Date().toISOString() })
        .eq('id', lead.id)
    } catch (erro) {
      // Falha de rede ou do provedor NÃO grava a marca: ela pede tentativa de
      // novo, e "não tem foto" não pede. Gravar aqui trataria uma indisponi-
      // bilidade de dez minutos como "esse contato não tem foto", para sempre.
      erros.push(`${lead.id.slice(0, 8)}: ${String(erro).slice(0, 80)}`)
    }
  }

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
): Promise<boolean> {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!resposta.ok) return false

  const tipo = resposta.headers.get('content-type')
  if (!tipoAceito(tipo)) {
    console.error(`foto: tipo recusado para o lead ${lead.id}: ${tipo}`)
    return false
  }

  const bytes = await resposta.arrayBuffer()
  // Zero byte com 200 acontece, e gravar produziria um avatar quebrado com
  // aparência de foto guardada.
  if (bytes.byteLength === 0) return false

  const caminho = caminhoDaFoto(lead.workspaceId, lead.id)
  const { error } = await supabase.storage
    .from(BUCKET_DE_AVATARES)
    .upload(caminho, bytes, { contentType: tipo!, upsert: true })

  if (error) {
    console.error(`foto: falha ao subir a do lead ${lead.id}`, error)
    return false
  }

  // O caminho só é gravado DEPOIS de o arquivo existir. Na ordem inversa, uma
  // falha de upload deixaria a coluna apontando para um arquivo que não está
  // lá, e a tela pediria uma URL assinada de nada.
  const { error: erroDaColuna } = await supabase
    .from('leads')
    .update({ foto_path: caminho })
    .eq('id', lead.id)

  if (erroDaColuna) {
    console.error(`foto: subiu e NAO gravou o caminho do lead ${lead.id}`, erroDaColuna)
    return false
  }

  return true
}
