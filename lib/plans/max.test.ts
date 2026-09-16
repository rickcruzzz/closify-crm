import { describe, expect, it } from 'vitest'

import {
  MAX_ANUAL_PRICE,
  MAX_PLAN_PRICE,
  PLANOS_PAGOS,
  PRO_PLAN_PRICE,
  valorDoPlano,
} from '@/lib/plans'
import type { PlanoPago } from '@/lib/plans'
import type { PlanoDaAssinatura } from '@/types/supabase'
import {
  direitoAoWhatsapp,
  podeLerConversas,
  type EstadoDaConexao,
} from './max'

const SEM_ASSINATURA = { plano: null, maxVigente: false } as const
const PRO = { plano: 'pro', maxVigente: false } as const
const MAX_VENCIDO = { plano: 'max', maxVigente: false } as const
const MAX_VIVO = { plano: 'max', maxVigente: true } as const

describe('direitoAoWhatsapp', () => {
  it('quem nunca assinou recebe o argumento de venda, com o preço', () => {
    const r = direitoAoWhatsapp(SEM_ASSINATURA, 'ausente')
    expect(r.pode).toBe(false)
    expect(r.pode === false && r.tipo).toBe('exige_max')
    expect(r.pode === false && r.motivo).toContain(String(MAX_PLAN_PRICE))
  })

  it('quem está no Pro também recebe o argumento, e não a frase de vencimento', () => {
    // O defeito de 18/08, em outra superfície: "Seu Pro venceu, reative"
    // aparecia para quem NUNCA teve Pro. A distinção é `plano === 'max'`, não
    // "existe assinatura".
    const r = direitoAoWhatsapp(PRO, 'ausente')
    expect(r.pode === false && r.tipo).toBe('exige_max')
  })

  it('quem TEVE Max e venceu recebe outra frase, e ela promete o histórico', () => {
    const r = direitoAoWhatsapp(MAX_VENCIDO, 'conectado')
    expect(r.pode).toBe(false)
    expect(r.pode === false && r.tipo).toBe('max_vencido')
    expect(r.pode === false && r.motivo).toMatch(/conversas continuam/i)
  })

  it('o plano vem ANTES da conexão: Max vencido com tudo conectado continua barrado', () => {
    // A ordem importa. Invertida, quem não paga veria "tudo certo" enquanto o
    // envio falharia depois, no provedor — erro de cobrança com cara de bug.
    const r = direitoAoWhatsapp(MAX_VENCIDO, 'conectado')
    expect(r.pode === false && r.tipo).toBe('max_vencido')
  })

  it('Max vivo e conectado envia', () => {
    expect(direitoAoWhatsapp(MAX_VIVO, 'conectado').pode).toBe(true)
  })

  it('Max vivo sem conexão manda conectar, não manda pagar', () => {
    const r = direitoAoWhatsapp(MAX_VIVO, 'ausente')
    expect(r.pode === false && r.tipo).toBe('sem_conexao')
    // Cliente pagante lendo preço é o pior desfecho desta árvore.
    expect(r.pode === false && r.motivo).not.toContain(String(MAX_PLAN_PRICE))
  })

  it('conectando pede para ler o QR, e não diz que caiu', () => {
    const r = direitoAoWhatsapp(MAX_VIVO, 'conectando')
    expect(r.pode === false && r.tipo).toBe('conexao_caiu')
    expect(r.pode === false && r.motivo).toMatch(/QR/)
  })

  it('desconectado, erro e desconhecido pedem reconexão', () => {
    for (const estado of ['desconectado', 'erro', 'desconhecido'] as EstadoDaConexao[]) {
      const r = direitoAoWhatsapp(MAX_VIVO, estado)
      expect(r.pode).toBe(false)
      expect(r.pode === false && r.tipo).toBe('conexao_caiu')
    }
  })

  it('TODO estado de conexão tem resposta, e nenhum cai no vazio', () => {
    // Sem este caso, um estado novo no tipo passaria despercebido e a função
    // devolveria o ramo final por acidente — a mesma classe do `indexOf` que
    // devolvia -1 para estágio fora da ordenação, em 12/09.
    const estados: EstadoDaConexao[] = [
      'ausente',
      'conectando',
      'conectado',
      'desconectado',
      'erro',
      'desconhecido',
    ]
    for (const estado of estados) {
      const r = direitoAoWhatsapp(MAX_VIVO, estado)
      if (!r.pode) expect(r.motivo.length).toBeGreaterThan(20)
    }
  })
})

describe('podeLerConversas', () => {
  it('lê SEMPRE, inclusive sem assinatura nenhuma', () => {
    // Seção 6 do desenho: assinatura inativa bloqueia ação nova e preserva
    // histórico. Uma caixa de entrada que some quando a cobrança falha apaga da
    // tela a conversa em que o cliente estava negociando.
    expect(podeLerConversas()).toBe(true)
  })
})

describe('preço do Max', () => {
  it('o Max custa mais que o Pro, e é o único recurso com custo por empresa', () => {
    expect(MAX_PLAN_PRICE).toBeGreaterThan(PRO_PLAN_PRICE)
  })

  it('o anual é DERIVADO, doze meses pelo preço de dez', () => {
    // Escrito à mão, os dois divergiriam no dia em que a política de desconto
    // mudar — e o Asaas cobraria um número que a tela não mostra.
    expect(MAX_ANUAL_PRICE).toBe(MAX_PLAN_PRICE * 10)
  })

  it('valorDoPlano devolve o que vai ao Asaas, nos quatro cruzamentos', () => {
    expect(valorDoPlano('pro', 'MONTHLY')).toBe(PRO_PLAN_PRICE)
    expect(valorDoPlano('max', 'MONTHLY')).toBe(MAX_PLAN_PRICE)
    expect(valorDoPlano('max', 'YEARLY')).toBe(MAX_ANUAL_PRICE)
    expect(valorDoPlano('max', 'YEARLY')).toBeGreaterThan(valorDoPlano('pro', 'YEARLY'))
  })

  it('TODO plano pago tem preço nos dois ciclos, e nenhum é zero', () => {
    // Sem isto, um plano novo em `PLANOS_PAGOS` compilaria com `PRECO_DO_PLANO`
    // incompleto só até alguém rodar o `satisfies` na cabeça. Aqui ele é
    // exercitado: um plano sem preço vira `undefined` e o caso reprova.
    for (const p of PLANOS_PAGOS) {
      for (const c of ['MONTHLY', 'YEARLY'] as const) {
        expect(valorDoPlano(p, c)).toBeGreaterThan(0)
      }
    }
  })
})

/**
 * ## A trava que o `tsc` faz, e nenhum caso de teste faria
 *
 * Mesmo desenho de `anual.test.ts` para `CicloDeCobranca`, e pelo mesmo motivo:
 * `types/supabase.ts` descreve o `check` do banco (e não importa nada, por
 * convenção), enquanto `lib/plans.ts` descreve o que o produto oferece.
 *
 * Duas definições divergem em silêncio. Esta igualdade estrutural **para de
 * compilar** no instante em que uma das duas ganhar ou perder um valor — e aqui
 * a divergência seria cara de um jeito específico: um plano que existe no banco
 * e não no produto é uma assinatura que `max_vigente()` pode aprovar sem que
 * nenhuma tela saiba cobrar por ela.
 *
 * Não roda em tempo de execução: o trabalho é do `npx tsc --noEmit`.
 */
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

const _osPlanosBatemComOBanco: Igual<PlanoPago, PlanoDaAssinatura> = true
void _osPlanosBatemComOBanco
