'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'

import { registrarNoDiario } from './diario'
import { marcar } from './prateleira-estado'
import { mensagemPara, type Prospect } from './prateleira'
import { exigirAmbienteLocal } from './somente-local'
import type { ResultadoDaAcao } from './actions'

/**
 * As ações da prateleira de prospecção.
 *
 * Mesmo desenho de `trial-actions.ts`: gate primeiro, diário sempre,
 * `revalidatePath` no fim. O diário existe pela mesma razão registrada lá —
 * daqui a um mês a única pergunta que importa é *o contato mudou alguma
 * coisa?*, e ela só tem resposta se a data de cada toque estiver escrita em
 * algum lugar que sobreviva ao fechamento do terminal.
 */

const ROTA = '/dono/prospeccao'

/**
 * A empresa onde o contato confirmado é gravado.
 *
 * "Prospeccao" e não "Orne": a decisão do dono em 07/09 foi separar as duas,
 * para a empresa que um dia terá cliente pagante de verdade não virar depósito
 * de lista fria.
 */
const EMPRESA_DA_PROSPECCAO = 'Prospeccao'

/**
 * Marca que a mensagem foi aberta no WhatsApp.
 *
 * Dispara no MESMO clique que abre o `wa.me`, sem confirmação. É a decisão do
 * dono: um clique por empresa, com Desfazer. Em 500 empresas, o passo de
 * confirmar custaria 500 cliques a mais, e o custo de errar aqui é uma linha na
 * prateleira errada — recuperável em um clique.
 */
export async function marcarEnviado(dominio: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  await marcar(dominio, 'enviado')
  await registrarNoDiario('prospeccao-enviei', { dominio })

  revalidatePath(ROTA)
  return { ok: true, mensagem: `${dominio} foi para Enviados.` }
}

/** Devolve à fila. Marcar sem poder desmarcar é o mesmo que errar de vez. */
export async function desfazerEnvio(dominio: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  await marcar(dominio, 'novo')
  await registrarNoDiario('prospeccao-desfiz', { dominio })

  revalidatePath(ROTA)
  return { ok: true, mensagem: `${dominio} voltou para a fila.` }
}

/** Tira da fila sem contatar. Fila que nunca esvazia deixa de ser fila. */
export async function descartar(dominio: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  await marcar(dominio, 'descartado')
  await registrarNoDiario('prospeccao-descartei', { dominio })

  revalidatePath(ROTA)
  return { ok: true, mensagem: `${dominio} saiu da fila.` }
}

/**
 * Confirma que a conversa aconteceu — e é aqui que o CRM ganha o registro.
 *
 * ## Por que o lead nasce na CONFIRMAÇÃO, e não no envio
 *
 * Abrir o WhatsApp não é falar com ninguém: dá para fechar a aba, ver que o
 * número está errado, desistir. Criar contato a cada clique encheria o CRM de
 * empresas que nunca ouviram falar do produto — e a lição de 20/08 é exatamente
 * essa: fila com lixo dentro ensina a ignorar a fila inteira.
 *
 * Confirmado significa "falei com essa empresa". Aí o acompanhamento passa a
 * ter onde morar: timeline, tarefa e funil já existem.
 *
 * ## A nota é a MESMA que o script grava
 *
 * Mesmo formato de `anotarAbordagem` em `prospectar.mjs`, com `author_id` nulo
 * pela mesma razão: a nota não foi escrita por ninguém da equipe, e assinar com
 * o nome de uma pessoa seria atribuir a ela um texto que ela nunca leu.
 */
export async function confirmarEnvio(prospect: Prospect): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  const dominio = prospect.dominio
  const supabase = createAdminClient()

  // Idempotente de propósito: confirmar duas vezes não pode gerar dois
  // contatos. O `leadId` já vem preenchido quando a empresa virou lead numa
  // rodada do script.
  let leadId = prospect.leadId

  if (!leadId) {
    const { data: empresa } = await supabase
      .from('workspaces')
      .select('id')
      .eq('name', EMPRESA_DA_PROSPECCAO)
      .limit(1)
      .maybeSingle()

    if (!empresa) {
      // Marcar assim mesmo: a confirmação é a verdade do que aconteceu, e
      // perder a marca porque a empresa não existe seria punir o registro
      // certo por causa de configuração faltando.
      await marcar(dominio, 'confirmado')
      revalidatePath(ROTA)
      return {
        ok: false,
        erro: `Marquei como confirmado, mas não achei a empresa "${EMPRESA_DA_PROSPECCAO}" para gravar o contato.`,
      }
    }

    const telefone = prospect.whatsapp ?? prospect.telefone
    const { data: criado, error } = await supabase
      .from('leads')
      .insert({
        workspace_id: empresa.id,
        // O nome do site é o que a pessoa reconhece na lista; o domínio vai em
        // `company` porque é ele que a dedupe usa e é único.
        name: (prospect.nome ?? dominio).slice(0, 120),
        company: dominio,
        email: prospect.email,
        phone: telefone,
        status: 'novo',
      })
      .select('id')
      .single()

    if (error) {
      // 23505: dois prospects com o MESMO telefone, que acontece quando o dono
      // tem dois sites. É a dedupe do produto funcionando, não falha — e a
      // confirmação continua valendo.
      await marcar(dominio, 'confirmado')
      revalidatePath(ROTA)
      return {
        ok: false,
        erro:
          error.code === '23505'
            ? 'Confirmado. O contato não foi criado porque esse telefone já existe na base.'
            : `Confirmado, mas não consegui criar o contato: ${error.message}`,
      }
    }
    leadId = criado.id
  }

  // A nota só entra se ainda não existir uma automática — rodar de novo não
  // deve encher a timeline de cópias. Mesma guarda do script.
  const { data: jaTem } = await supabase
    .from('activities')
    .select('id')
    .eq('lead_id', leadId)
    .is('author_id', null)
    .limit(1)

  if (!jaTem || jaTem.length === 0) {
    const { texto, link } = mensagemPara(prospect)
    const abrir = link ? `\n\nAbrir no WhatsApp com o texto pronto:\n${link}` : ''

    const { data: dono } = await supabase
      .from('leads')
      .select('workspace_id')
      .eq('id', leadId)
      .single()

    if (dono) {
      await supabase.from('activities').insert({
        workspace_id: dono.workspace_id,
        lead_id: leadId,
        author_id: null,
        type: 'nota',
        description:
          `Prospecção automática (${prospect.vertical}, ${prospect.pontos} pontos).\n` +
          `Por quê: ${prospect.motivos.join(', ')}.\n\n` +
          `Sugestão de primeira mensagem:\n${texto}${abrir}`,
      })
    }
  }

  await marcar(dominio, 'confirmado')
  await registrarNoDiario('prospeccao-confirmei', { dominio, leadId })

  revalidatePath(ROTA)
  return { ok: true, mensagem: `${dominio} confirmado e no CRM.` }
}
