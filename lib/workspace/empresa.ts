'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { empresaSchema } from '@/lib/validations/empresa'
import { LOGO_BUCKET, caminhoDaLogo, validarLogo } from '@/lib/storage/logo'

type Sessao = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  workspaceId: string
}

async function abrirSessao(): Promise<Sessao | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { error: 'Workspace não encontrado.' }

  return { supabase, userId: user.id, workspaceId }
}

/**
 * Salva os dados da empresa.
 *
 * Não há checagem de admin aqui de propósito: quem decide é a política
 * `workspaces_update`, que exige `is_workspace_admin(id)`. Um `if` no
 * TypeScript seria uma segunda fonte de verdade a manter em dia, e esta é uma
 * Server Action — endpoint HTTP que dá para chamar sem passar pela tela.
 *
 * Membro comum recebe 0 linha afetada, e a mensagem abaixo explica por quê.
 */
export async function salvarEmpresa(values: unknown) {
  const parsed = empresaSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const { error, data } = await sessao.supabase
    .from('workspaces')
    .update(parsed.data)
    .eq('id', sessao.workspaceId)
    .select('id')

  if (error) {
    console.error('salvarEmpresa falhou', error)
    return { error: 'Não foi possível salvar suas informações. Tente novamente.' }
  }

  if (!data || data.length === 0) {
    return { error: 'Só o administrador da empresa pode alterar estes dados.' }
  }

  // O nome aparece no seletor de empresas da barra lateral, que vive no layout.
  revalidatePath('/', 'layout')

  return { success: true }
}

/**
 * Envia a logo.
 *
 * O arquivo chega por `FormData` porque Server Action não serializa `File` de
 * outro jeito. A validação é pelos BYTES: extensão e `Content-Type` são
 * escolhidos por quem envia, e o `allowed_mime_types` do bucket compara
 * justamente com o que o cliente declarou.
 */
export async function enviarLogo(formData: FormData) {
  const arquivo = formData.get('logo')

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { error: 'Escolha um arquivo de imagem.' }
  }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const veredito = validarLogo(bytes)

  if ('erro' in veredito) {
    return { error: veredito.erro }
  }

  const caminho = caminhoDaLogo(sessao.workspaceId, veredito.extensao)

  const { error: erroUpload } = await sessao.supabase.storage
    .from(LOGO_BUCKET)
    .upload(caminho, bytes, { contentType: veredito.tipoMime, upsert: false })

  if (erroUpload) {
    console.error('enviarLogo falhou no upload', erroUpload)
    // A política `logos_insert` recusa quem não é admin. A mensagem crua do
    // Storage aqui é "new row violates row-level security policy", que não
    // ajuda ninguém.
    return { error: 'Não foi possível enviar a imagem. Só o administrador pode trocá-la.' }
  }

  // Guarda o caminho, não uma URL. Bucket privado não tem URL fixa: a de
  // exibição é assinada e expira, e gravar uma URL vencida deixaria a tela
  // com imagem quebrada dias depois.
  const anterior = await caminhoAtual(sessao)

  const { error: erroBanco, data } = await sessao.supabase
    .from('workspaces')
    .update({ logo_url: caminho })
    .eq('id', sessao.workspaceId)
    .select('id')

  if (erroBanco || !data || data.length === 0) {
    // O arquivo subiu mas a referência não gravou: sem esta limpeza ele ficaria
    // ocupando espaço para sempre, invisível.
    await sessao.supabase.storage.from(LOGO_BUCKET).remove([caminho])
    console.error('enviarLogo falhou ao gravar a referência', erroBanco)
    return { error: 'Não foi possível salvar a imagem. Tente novamente.' }
  }

  // Só agora apaga a antiga: fazê-lo antes deixaria a empresa sem logo nenhuma
  // se o upload novo falhasse no meio.
  if (anterior && anterior !== caminho) {
    await sessao.supabase.storage.from(LOGO_BUCKET).remove([anterior])
  }

  revalidatePath('/', 'layout')
  return { success: true, caminho }
}

export async function removerLogo() {
  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const caminho = await caminhoAtual(sessao)

  const { error, data } = await sessao.supabase
    .from('workspaces')
    .update({ logo_url: null })
    .eq('id', sessao.workspaceId)
    .select('id')

  if (error || !data || data.length === 0) {
    console.error('removerLogo falhou', error)
    return { error: 'Não foi possível remover a imagem. Só o administrador pode fazer isso.' }
  }

  // A referência sai primeiro. Se o arquivo resistir, sobra um órfão — melhor
  // do que a tela apontar para um arquivo que não existe mais.
  if (caminho) {
    await sessao.supabase.storage.from(LOGO_BUCKET).remove([caminho])
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

async function caminhoAtual(sessao: Sessao): Promise<string | null> {
  const { data } = await sessao.supabase
    .from('workspaces')
    .select('logo_url')
    .eq('id', sessao.workspaceId)
    .maybeSingle()

  return data?.logo_url ?? null
}

/**
 * URL temporária para exibir a logo.
 *
 * O bucket é privado — não existe URL fixa. Uma hora é o bastante para a
 * sessão de quem está mexendo nas configurações, e curto o bastante para um
 * link vazado não valer nada amanhã.
 */
export async function urlDaLogo(caminho: string | null): Promise<string | null> {
  if (!caminho) return null

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(caminho, 3600)

  if (error) {
    console.error('urlDaLogo falhou', error)
    return null
  }

  return data?.signedUrl ?? null
}
