import { readFile } from 'node:fs/promises'

import { listarDestaques } from '@/lib/dono/destaques-queries'
import { caminhoSeguroDoCriativo } from '@/lib/dono/criativos'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'
import { montarZip, type ArquivoDoZip } from '@/lib/dono/zip'

/**
 * Entrega um destaque inteiro num `.zip`, para o WhatsApp não estragar as telas.
 *
 * ## O problema que esta rota resolve
 *
 * Mandar as telas pelo WhatsApp como **foto** degrada duas vezes: recomprime em
 * JPEG e, pior, **reduz a resolução** de imagens acima do teto do aplicativo. O
 * Story é 1080×1920; ele chega menor do lado de lá, o Instagram amplia de volta
 * na hora de publicar, e o texto sai borrado. Não existe ajuste que desligue
 * isso — o modo "HD" reduz o estrago e ainda depende de alguém lembrar de
 * ligá-lo a cada envio.
 *
 * **Documento o WhatsApp não toca.** E um `.zip` não pode ser enviado como
 * foto: o aplicativo não sabe abri-lo, então só oferece o caminho de documento.
 * Por isso a saída é um `.zip` em vez de um aviso na tela — instrução depende
 * de alguém lembrar; formato de arquivo, não.
 *
 * De quebra, resolve o outro atrito: cinco arquivos viram um envio.
 *
 * ## Por que reusa `caminhoSeguroDoCriativo`
 *
 * O nome do arquivo vem do manifesto, que é escrito por um script — não pela
 * URL. Ainda assim ele passa pela mesma validação que a rota de imagem usa,
 * com a recusa de travessia de diretório já testada. Um caminho novo para
 * chegar ao disco é uma segunda chance de errar a mesma coisa, e manifesto é
 * arquivo: quem editar um à mão não deveria conseguir ler o `.env.local`.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await exigirAmbienteLocal()

  const { id } = await params
  const destaques = await listarDestaques()
  const destaque = destaques.find((d) => d.id === decodeURIComponent(id))

  if (!destaque) {
    return new Response('Destaque não encontrado.', { status: 404 })
  }

  const arquivos: ArquivoDoZip[] = []

  for (const tela of destaque.telas) {
    const caminho = await caminhoSeguroDoCriativo('organico', tela.arquivo)
    if (!caminho) continue

    // O número entra no NOME, não só no manifesto. Fora da Central ninguém tem
    // o mapa da ordem, e o Instagram exibe o destaque na sequência em que os
    // Stories foram postados — sem chance de reordenar depois. Um zip cujos
    // arquivos ordenam sozinhos na galeria é o que impede o erro de subir a
    // comparação de preço antes de dizer qual é o preço.
    const ordem = String(tela.ordem).padStart(2, '0')
    arquivos.push({
      nome: `${ordem}-${tela.arquivo}`,
      conteudo: new Uint8Array(await readFile(caminho)),
    })
  }

  if (arquivos.length === 0) {
    return new Response('Nenhuma tela encontrada para este destaque.', { status: 404 })
  }

  const zip = montarZip(arquivos)

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      // `filename*` com UTF-8 porque o nome do destaque tem acento ("Dicas de
      // venda" não, mas "Perguntas frequentes" ou qualquer outro pode ter), e
      // o `filename` simples ao lado atende quem não entende a forma estendida.
      'Content-Disposition':
        `attachment; filename="destaque-${destaque.id}.zip"; ` +
        `filename*=UTF-8''${encodeURIComponent(`Velo Funil ${destaque.nome}.zip`)}`,
      'Content-Length': String(zip.length),
      'Cache-Control': 'no-store',
    },
  })
}
