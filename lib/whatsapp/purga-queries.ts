import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { apagarInstancia } from '@/lib/whatsapp/zapi'
import { decidirPurga, resumoVazio, type ResumoDaPurga } from '@/lib/whatsapp/purga'

/**
 * A varredura diária que impede instância órfã de faturar para sempre.
 *
 * ## O que ela fecha
 *
 * A 0090 blindou a criação: instância que não vira linha no banco é apagada no
 * provedor antes de a Server Action devolver o erro. A saída ficou aberta.
 *
 * Cliente assina o Max, conecta, e para de pagar. `max_vigente()` cai e ele
 * deixa de enviar, o que está certo. E a instância **continua na fatura do
 * provedor, todo mês, para sempre**, porque nada a apaga.
 *
 * ## O apagar vem PRIMEIRO, e a linha some depois
 *
 * A ordem é a mesma da criação, ao contrário: lá a instância nasce e só então
 * vira linha; aqui ela morre no provedor e só então a linha sai.
 *
 * Se o provedor recusar, a linha FICA. Esquecê-la deixaria uma instância viva
 * que nenhuma tela alcança e nenhuma varredura reencontra — exatamente a
 * cobrança invisível que a 0090 existe para evitar, criada pela rotina que
 * deveria impedi-la.
 *
 * ## N+1 aqui é decisão, e o N é o número de clientes pagantes do Max
 *
 * Uma chamada a `max_vigente()` por instância. Com dezenas de clientes isso é
 * uma varredura de segundos, uma vez por dia, e evita uma RPC nova só para
 * juntar as duas coisas num `select`.
 *
 * O teto existe porque N+1 sem teto é como uma rotina barata vira uma rotina
 * que estoura o tempo da função. Quando o número de Max passar dele, a conta
 * muda e a junção no banco passa a valer a migration.
 */

/** Acima disto, a varredura para e avisa em vez de continuar em silêncio. */
const TETO_DE_INSTANCIAS = 500

export async function rodarPurgaDeInstancias(): Promise<ResumoDaPurga> {
  const admin = createAdminClient()
  const resumo = resumoVazio()
  const agora = new Date()

  const { data, error } = await admin
    .from('whatsapp_instances')
    .select('id, workspace_id, instance_id, sem_max_desde')
    .limit(TETO_DE_INSTANCIAS)

  if (error) {
    console.error('rodarPurgaDeInstancias: falha ao listar', error)
    // Zero conferidas, e não um resumo que parece bem-sucedido. Quem lê o
    // retorno precisa distinguir "não havia nada" de "não consegui olhar".
    return { ...resumo, falhas: 1 }
  }

  const instancias = data ?? []
  if (instancias.length >= TETO_DE_INSTANCIAS) {
    console.error(
      `rodarPurgaDeInstancias: bateu no teto de ${TETO_DE_INSTANCIAS}. Instancias acima disso NAO foram conferidas.`,
    )
    resumo.falhas += 1
  }

  for (const inst of instancias) {
    resumo.conferidas += 1

    const { data: vigente, error: erroRpc } = await admin.rpc('max_vigente', {
      target_workspace_id: inst.workspace_id,
    })

    if (erroRpc) {
      // Falha de leitura NÃO conta como "sem Max". Tratar as duas como a mesma
      // coisa faria uma indisponibilidade do banco virar uma marca de purga em
      // cliente pagante, e sete dias depois a instância dele sumiria.
      console.error('rodarPurgaDeInstancias: max_vigente falhou', inst.workspace_id, erroRpc)
      resumo.falhas += 1
      continue
    }

    const decisao = decidirPurga(
      { maxVigente: vigente === true, semMaxDesde: inst.sem_max_desde },
      agora,
    )

    if (decisao === 'nada') continue

    if (decisao === 'marcar' || decisao === 'limpar') {
      const { error: erroMarca } = await admin
        .from('whatsapp_instances')
        .update({
          sem_max_desde: decisao === 'marcar' ? agora.toISOString() : null,
          updated_at: agora.toISOString(),
        })
        .eq('id', inst.id)

      if (erroMarca) {
        console.error('rodarPurgaDeInstancias: falha ao marcar', inst.id, erroMarca)
        resumo.falhas += 1
        continue
      }

      if (decisao === 'marcar') resumo.marcadas += 1
      else resumo.limpas += 1
      continue
    }

    // `apagar`. Provedor primeiro, linha depois. Ver o cabeçalho.
    try {
      await apagarInstancia(inst.instance_id)
    } catch (erro) {
      console.error(
        `rodarPurgaDeInstancias: provedor recusou apagar ${inst.instance_id}, a linha FICA e ela continua faturando`,
        erro,
      )
      resumo.falhas += 1
      continue
    }

    const { error: erroDelete } = await admin
      .from('whatsapp_instances')
      .delete()
      .eq('id', inst.id)

    if (erroDelete) {
      // A instância já morreu no provedor: a cobrança parou, que é o objetivo.
      // A linha órfã no banco faz a tela dizer "conectado" para um número que
      // não existe, e a próxima varredura vai tentar apagar de novo e tomar
      // 404 do provedor. Ruim, e muito menos caro que o contrário.
      console.error('rodarPurgaDeInstancias: apagou no provedor e NAO no banco', inst.id, erroDelete)
      resumo.falhas += 1
      continue
    }

    resumo.apagadas += 1
  }

  return resumo
}
