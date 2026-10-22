import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { imagensDaFonte, exaConfigurada } from '@/lib/enterprise/exa'
import { baixarImagemPublica } from '@/lib/enterprise/imagem'
import { BUCKET_DE_AVATARES } from '@/lib/whatsapp/foto'

/** Uma empresa por função para não bloquear o Radar nem exceder o tempo da Netlify. */
export async function rodarFotosDasEmpresas() {
  if (!exaConfigurada()) return { ok: false, guardadas: 0, verificadas: 0, erro: 'Exa não configurada.' }
  const banco = createAdminClient()
  const { data: empresas, error: erroEmpresas } = await banco.rpc('listar_empresas_enterprise_ativas')
  if (erroEmpresas) throw new Error('Falha ao ler as empresas Enterprise.')
  if (!empresas?.length) return { ok: true, guardadas: 0, verificadas: 0 }
  const agora = new Date()
  const retentarAte = new Date(agora.getTime() - 60 * 60_000).toISOString()
  const reverAte = new Date(agora.getTime() - 30 * 24 * 60 * 60_000).toISOString()
  const { data: eventos, error } = await banco.from('enterprise_eventos')
    .select('id, workspace_id, fonte_url, foto_tentada_em')
    .in('workspace_id', empresas.map((e) => e.workspace_id))
    .neq('status', 'descartado')
    .or(`foto_tentada_em.is.null,foto_tentada_em.lt.${retentarAte}`)
    .or(`foto_verificada_em.is.null,foto_verificada_em.lt.${reverAte}`)
    .order('foto_tentada_em', { ascending: true, nullsFirst: true })
    .order('criado_em', { ascending: true }).limit(1)
  if (error) throw new Error('Falha ao ler a fila de fotos das empresas.')
  const evento = eventos?.[0]
  if (!evento) return { ok: true, guardadas: 0, verificadas: 0 }
  const reservar = banco.from('enterprise_eventos')
    .update({ foto_tentada_em: agora.toISOString() }).eq('id', evento.id).eq('workspace_id', evento.workspace_id)
  if (evento.foto_tentada_em) reservar.eq('foto_tentada_em', evento.foto_tentada_em)
  else reservar.is('foto_tentada_em', null)
  const { data: reservada, error: erroTentativa } = await reservar.select('id').maybeSingle()
  if (erroTentativa) throw new Error('Não foi possível reservar a consulta de imagem.')
  if (!reservada) return { ok: true, guardadas: 0, verificadas: 0 }
  const imagens = await imagensDaFonte(evento.fonte_url)
  let ultimaFalha: unknown
  for (const url of imagens) {
    try {
      const imagem = await baixarImagemPublica(url, { reduzir: true })
      const caminho = `${evento.workspace_id}/empresas/${evento.id}.${imagem.extensao}`
      const { error: erroUpload } = await banco.storage.from(BUCKET_DE_AVATARES)
        .upload(caminho, imagem.bytes, { contentType: imagem.tipoMime, upsert: true })
      if (erroUpload) throw new Error('Falha ao guardar a foto da empresa.')
      const { error: erroFoto } = await banco.from('enterprise_eventos').update({
        foto_path: caminho, foto_fonte_url: url, foto_verificada_em: new Date().toISOString(),
      }).eq('id', evento.id).eq('workspace_id', evento.workspace_id)
      if (erroFoto) throw new Error('Falha ao registrar a foto da empresa.')
      return { ok: true, guardadas: 1, verificadas: 1 }
    } catch (error) { ultimaFalha = error }
  }
  if (imagens.length && ultimaFalha) throw ultimaFalha
  const { error: erroSemFoto } = await banco.from('enterprise_eventos')
    .update({ foto_verificada_em: new Date().toISOString() }).eq('id', evento.id).eq('workspace_id', evento.workspace_id)
  if (erroSemFoto) throw new Error('Falha ao registrar consulta sem imagem pública.')
  return { ok: true, guardadas: 0, verificadas: 1 }
}
