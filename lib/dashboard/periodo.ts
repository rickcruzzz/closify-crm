import { diaEmSaoPaulo } from '@/lib/tasks/buckets'
import type { PeriodoDoDashboard } from '@/lib/dashboard/queries'

export type PresetDePeriodo = '7d' | '30d' | 'mes' | 'ano'

export const rotuloDoPreset: Record<PresetDePeriodo, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  mes: 'Este mês',
  ano: 'Este ano',
}

// Brasil não tem mais horário de verão desde 2019 — mesma premissa que
// lib/tasks/buckets.ts já usa pra distância entre dias. Offset fixo evita
// puxar timezone de biblioteca externa só pra isso.
const OFFSET_BRASIL = '-03:00'

function inicioDoDia(diaYyyyMmDd: string): string {
  return `${diaYyyyMmDd}T00:00:00${OFFSET_BRASIL}`
}

function fimDoDia(diaYyyyMmDd: string): string {
  return `${diaYyyyMmDd}T23:59:59.999${OFFSET_BRASIL}`
}

function subtrairDias(diaYyyyMmDd: string, dias: number): string {
  const [ano, mes, dia] = diaYyyyMmDd.split('-').map(Number)
  return new Date(Date.UTC(ano!, mes! - 1, dia! - dias)).toISOString().slice(0, 10)
}

/**
 * Resolve o período escolhido (preset ou datas livres) em `desde`/`ate`
 * prontos pra RPC — instantes absolutos com offset, não datas soltas, porque
 * `ate: "2026-08-13"` seria interpretado como meia-noite do dia, excluindo
 * tudo criado depois disso no mesmo dia.
 *
 * `agora` vem de fora, não `new Date()` aqui dentro — mesmo motivo de
 * `lib/tasks/buckets.ts`: testável sem depender do relógio real, e o "hoje"
 * que importa é o de São Paulo, não o UTC do servidor da Vercel.
 *
 * `undefined` (sem período nenhum reconhecido) faz as queries caírem no
 * comportamento padrão: todo o histórico, sem filtro — mesmo que sempre foi.
 */
export function resolverPeriodo(
  agora: Date,
  preset: string | null,
  desdeCustom: string | null,
  ateCustom: string | null,
): PeriodoDoDashboard | undefined {
  if (desdeCustom && ateCustom) {
    return { desde: inicioDoDia(desdeCustom), ate: fimDoDia(ateCustom) }
  }

  const hoje = diaEmSaoPaulo(agora)

  switch (preset as PresetDePeriodo | null) {
    case '7d':
      return { desde: inicioDoDia(subtrairDias(hoje, 7)), ate: fimDoDia(hoje) }
    case '30d':
      return { desde: inicioDoDia(subtrairDias(hoje, 30)), ate: fimDoDia(hoje) }
    case 'mes': {
      const [ano, mes] = hoje.split('-') as [string, string]
      return { desde: inicioDoDia(`${ano}-${mes}-01`), ate: fimDoDia(hoje) }
    }
    case 'ano': {
      const [ano] = hoje.split('-') as [string]
      return { desde: inicioDoDia(`${ano}-01-01`), ate: fimDoDia(hoje) }
    }
    default:
      return undefined
  }
}
