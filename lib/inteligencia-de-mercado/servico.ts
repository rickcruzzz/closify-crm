import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { reportarErro } from '@/lib/erros/reportar'
import type { Database } from '@/types/supabase'

import { criarPortaDeLeads, TAMANHO_DO_LOTE } from './adapters/leads-supabase'
import { dominioDoEmail, montarConsulta } from './dominio/consulta'
import { extrairSinais } from './dominio/dor'
import { centavosDe, podeConsultar } from './dominio/orcamento'
import { buscarNoExa } from './exa/cliente'
import { ehTransitorio, ExaSemCredito } from './exa/erros'
import { relogioDoSistema, type Relogio } from './ports/relogio'

/**
 * Orquestra uma passagem do cron: pega o lote pendente, consulta o Exa, extrai
 * e grava.
 *
 * ## Cotação do real, e por que ela é constante
 *
 * O custo do Exa vem em dólar. Converter exige uma cotação, e buscar cotação em
 * tempo real acrescentaria uma dependência de rede ao caminho que existe para
 * controlar gasto — se ela caísse, o teto pararia de funcionar. Um número fixo
 * e conservador erra para o lado de contar gasto A MAIS, que é o lado seguro:
 * o teto dispara antes, nunca depois.
 */
const COTACAO_CONSERVADORA = 6.5

export type ResultadoDaPassagem = {
  processados: number
  comSinal: number
  semSinal: number
  falharam: number
  custoCentavos: number
  /** Workspaces que bateram o teto nesta passagem. */
  bloqueadosPorTeto: string[]
}

export async function enriquecerLote(
  limite: number = TAMANHO_DO_LOTE,
  relogio: Relogio = relogioDoSistema,
): Promise<ResultadoDaPassagem> {
  const leads = criarPortaDeLeads()
  const admin = createAdminClient()
  const resultado: ResultadoDaPassagem = {
    processados: 0,
    comSinal: 0,
    semSinal: 0,
    falharam: 0,
    custoCentavos: 0,
    bloqueadosPorTeto: [],
  }

  const fila = await leads.pendentes(limite)
  if (fila.length === 0) return resultado

  // Uma leitura de gasto por WORKSPACE, não por lead: o lote costuma ser de
  // poucas empresas, e consultar por lead multiplicaria a ida ao banco sem
  // mudar a resposta.
  const gastoPorWorkspace = new Map<string, number>()

  for (const lead of fila) {
    try {
      if (!gastoPorWorkspace.has(lead.workspaceId)) {
        gastoPorWorkspace.set(lead.workspaceId, await leads.gastoDoMes(lead.workspaceId))
      }

      const veredito = podeConsultar({
        gastoNoMesCentavos: gastoPorWorkspace.get(lead.workspaceId) ?? 0,
      })
      if (!veredito.pode) {
        // PARA e diz por quê, em vez de degradar. O lead continua `pendente` e
        // volta na primeira passagem do mês seguinte.
        if (!resultado.bloqueadosPorTeto.includes(lead.workspaceId)) {
          resultado.bloqueadosPorTeto.push(lead.workspaceId)
        }
        continue
      }

      const consulta = montarConsulta(
        {
          nome: lead.nome,
          empresa: lead.empresa,
          dominio: dominioDoEmail(lead.email),
        },
        relogio.agora(),
      )

      // Sem empresa e sem domínio não há o que perguntar. Marcar como
      // `sem_sinal` em vez de deixar `pendente` é o que impede o lead de voltar
      // ao lote para sempre, consumindo a vaga de quem tem chance.
      if (!consulta) {
        await marcar(admin, lead.id, { status: 'sem_sinal', consultado_em: agoraIso(relogio) })
        resultado.processados += 1
        resultado.semSinal += 1
        continue
      }

      const resposta = await buscarNoExa(consulta)
      const custo = centavosDe(resposta.custoDolares, COTACAO_CONSERVADORA)
      gastoPorWorkspace.set(
        lead.workspaceId,
        (gastoPorWorkspace.get(lead.workspaceId) ?? 0) + custo,
      )
      resultado.custoCentavos += custo

      const sinais = extrairSinais(resposta.trechos, consulta.texto)

      if (sinais.length > 0) {
        // `upsert` com `ignoreDuplicates`: a trava `unique (lead_id, fonte_url)`
        // da 0072 é a segunda linha de defesa contra a mesma fonte entrar
        // duas vezes, e aqui ela não pode derrubar o lote inteiro — foi assim
        // que um telefone repetido derrubou uma importação de planilha em
        // 02/09, com o `23505` matando as outras 999 linhas.
        const { error } = await admin.from('sinal_de_mercado').upsert(
          sinais.map((s) => ({
            workspace_id: lead.workspaceId,
            lead_id: lead.id,
            tipo: s.tipo,
            resumo: s.resumo,
            fonte_url: s.fonteUrl,
            publicado_em: s.publicadoEm,
            confianca: s.confianca,
          })),
          { onConflict: 'lead_id,fonte_url', ignoreDuplicates: true },
        )
        if (error) throw error
      }

      await marcar(admin, lead.id, {
        status: sinais.length > 0 ? 'ok' : 'sem_sinal',
        consultado_em: agoraIso(relogio),
        custo_centavos: custo,
        ultimo_erro: null,
      })
      resultado.processados += 1
      if (sinais.length > 0) resultado.comSinal += 1
      else resultado.semSinal += 1
    } catch (erro) {
      resultado.falharam += 1
      await marcar(admin, lead.id, {
        // Transitório continua `pendente` para tentar de novo; recusa vira
        // `falhou` para não bater na mesma porta fechada a cada 15 minutos.
        status: ehTransitorio(erro) ? 'pendente' : 'falhou',
        ultimo_erro: mensagemCurta(erro),
      })

      // Sem crédito para o lote inteiro: insistir nos outros onze só produz
      // onze vezes o mesmo erro.
      if (erro instanceof ExaSemCredito) break
    }
  }

  return resultado
}

function agoraIso(relogio: Relogio): string {
  return relogio.agora().toISOString()
}

/**
 * Tipado pelo `Update` da tabela e não por `Record<string, unknown>`: com o
 * tipo frouxo, escrever `statuss` ou um valor fora do `check` compilaria e só
 * falharia em produção, contra o banco.
 */
type CamposDoEnriquecimento = Database['public']['Tables']['enriquecimento_de_lead']['Update']

async function marcar(
  admin: ReturnType<typeof createAdminClient>,
  leadId: string,
  campos: CamposDoEnriquecimento,
): Promise<void> {
  const { error } = await admin
    .from('enriquecimento_de_lead')
    .update(campos)
    .eq('lead_id', leadId)

  // Falhar ao MARCAR não pode derrubar a passagem: o pior caso é o lead ser
  // reconsultado, que custa US$ 0,007. Mesma decisão de `registrarNotificacao`,
  // que não derruba o webhook de pagamento.
  if (error) reportarErro(error as unknown as Error, 'global')
}

/** 200 caracteres é o teto do `check` de `ultimo_erro` na 0072. */
function mensagemCurta(erro: unknown): string {
  const texto = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro)
  return texto.slice(0, 200)
}
