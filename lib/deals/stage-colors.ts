import type { DealStage } from './types'

export const stageAccent: Record<DealStage, { text: string; bg: string; bar: string }> = {
  novo: {
    text: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-500/10 dark:bg-blue-400/10',
    bar: '#3987e5',
  },
  contato_realizado: {
    text: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-500/10 dark:bg-amber-400/10',
    bar: '#c98500',
  },
  proposta_enviada: {
    text: 'text-violet-500 dark:text-violet-400',
    bg: 'bg-violet-500/10 dark:bg-violet-400/10',
    bar: '#9085e9',
  },
  negociacao: {
    text: 'text-orange-500 dark:text-orange-400',
    bg: 'bg-orange-500/10 dark:bg-orange-400/10',
    bar: '#d95926',
  },
  fechado_ganho: {
    text: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    bar: '#199e70',
  },
  fechado_perdido: {
    text: 'text-red-500 dark:text-red-400',
    bg: 'bg-red-500/10 dark:bg-red-400/10',
    bar: '#e66767',
  },
}
