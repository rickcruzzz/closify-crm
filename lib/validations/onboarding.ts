import { z } from '@/lib/validations/zod'

import type { ModeloVenda, OnboardingEtapa, TamanhoEquipe } from '@/types/supabase'

/**
 * Os segmentos oferecidos no onboarding.
 *
 * Lista aberta de propósito: o schema aceita qualquer texto de até 40
 * caracteres (o teto do banco), e esta constante só alimenta os botões da
 * tela. Acrescentar "Petshop" amanhã é uma linha aqui, sem migration e sem
 * mexer em nada que já foi respondido, que é justamente o que o pedido
 * exigia.
 *
 * Um `enum` no banco faria o oposto: cada segmento novo viraria migration, e
 * remover um quebraria as empresas que já o tinham escolhido.
 */
export const SEGMENTOS = [
  { valor: 'clinica', rotulo: 'Clínica' },
  { valor: 'academia', rotulo: 'Academia' },
  { valor: 'restaurante', rotulo: 'Restaurante' },
  { valor: 'imobiliaria', rotulo: 'Imobiliária' },
  { valor: 'agencia', rotulo: 'Agência' },
  { valor: 'loja', rotulo: 'Loja' },
  { valor: 'prestador', rotulo: 'Prestador de serviços' },
  { valor: 'tecnologia', rotulo: 'Tecnologia' },
  { valor: 'educacao', rotulo: 'Educação' },
  { valor: 'consultoria', rotulo: 'Consultoria' },
  { valor: 'outro', rotulo: 'Outro' },
] as const

export const MODELOS_DE_VENDA: { valor: ModeloVenda; rotulo: string; ajuda: string }[] = [
  { valor: 'servicos', rotulo: 'Serviços', ajuda: 'Consultoria, atendimento, projetos' },
  { valor: 'produtos', rotulo: 'Produtos', ajuda: 'Itens físicos ou digitais' },
  { valor: 'ambos', rotulo: 'Serviços e produtos', ajuda: 'Os dois juntos' },
]

export const TAMANHOS_DE_EQUIPE: { valor: TamanhoEquipe; rotulo: string }[] = [
  { valor: 'so_eu', rotulo: 'Só eu' },
  { valor: '2_5', rotulo: '2 a 5 pessoas' },
  { valor: '6_20', rotulo: '6 a 20 pessoas' },
  { valor: '21_mais', rotulo: '21 ou mais' },
]

/** A ordem do assistente. Também define para onde "voltar" leva. */
export const ETAPAS: OnboardingEtapa[] = ['empresa', 'segmento', 'venda', 'equipe', 'processando']

export function proximaEtapa(atual: OnboardingEtapa): OnboardingEtapa | null {
  const i = ETAPAS.indexOf(atual)
  return i >= 0 && i < ETAPAS.length - 1 ? ETAPAS[i + 1]! : null
}

export function etapaAnterior(atual: OnboardingEtapa): OnboardingEtapa | null {
  const i = ETAPAS.indexOf(atual)
  return i > 0 ? ETAPAS[i - 1]! : null
}

/**
 * O que cada passo do assistente manda para o servidor.
 *
 * Tudo opcional menos a etapa: cada passo envia só o campo dele, e o banco
 * preserva o resto com `coalesce`. Isto é o que faz voltar um passo e avançar
 * de novo não apagar a resposta anterior.
 */
export const passoDoOnboardingSchema = z.object({
  etapa: z.enum(['empresa', 'segmento', 'venda', 'equipe', 'processando'], {
    error: 'Etapa inválida.',
  }),
  nomeEmpresa: z.string().trim().min(2, 'Informe o nome da empresa.').max(80).optional(),
  segmento: z.string().trim().max(40, 'Segmento longo demais.').optional(),
  modeloVenda: z.enum(['servicos', 'produtos', 'ambos']).optional(),
  tamanhoEquipe: z.enum(['so_eu', '2_5', '6_20', '21_mais']).optional(),
})

export type PassoDoOnboarding = z.output<typeof passoDoOnboardingSchema>

/** Rótulo do segmento para a tela. Valor desconhecido aparece como veio. */
export function rotuloDoSegmento(valor: string | null | undefined): string | null {
  if (!valor) return null
  return SEGMENTOS.find((s) => s.valor === valor)?.rotulo ?? valor
}
