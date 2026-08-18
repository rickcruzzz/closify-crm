import { diaEmSaoPaulo } from '@/lib/tasks/buckets'
import type { PeriodoDoDashboard } from '@/lib/dashboard/queries'

export type PresetDePeriodo =
  | 'hoje'
  | 'ontem'
  | '7d'
  | '30d'
  | 'mes'
  | 'mes_passado'
  | 'trimestre'
  | 'ano'

export const rotuloDoPreset: Record<PresetDePeriodo, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  mes: 'Este mês',
  mes_passado: 'Mês passado',
  trimestre: 'Este trimestre',
  ano: 'Este ano',
}

/** A ordem em que os presets aparecem no filtro, do mais curto ao mais largo. */
export const ordemDosPresets: PresetDePeriodo[] = [
  'hoje',
  'ontem',
  '7d',
  '30d',
  'mes',
  'mes_passado',
  'trimestre',
  'ano',
]

// Brasil não tem mais horário de verão desde 2019, mesma premissa que
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
 * Último dia de um mês, dado ano e mês (1-indexado).
 *
 * `Date.UTC(ano, mes, 0)` é o dia zero do mês SEGUINTE, que o JS normaliza
 * para o último dia do mês pedido — evita tabela de "30 ou 31" e o caso de
 * fevereiro em ano bissexto.
 */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/**
 * Resolve o período escolhido (preset ou datas livres) em `desde`/`ate`
 * prontos pra RPC, instantes absolutos com offset, não datas soltas, porque
 * `ate: "2026-08-13"` seria interpretado como meia-noite do dia, excluindo
 * tudo criado depois disso no mesmo dia.
 *
 * `agora` vem de fora, não `new Date()` aqui dentro, mesmo motivo de
 * `lib/tasks/buckets.ts`: testável sem depender do relógio real, e o "hoje"
 * que importa é o de São Paulo, não o UTC do servidor da Vercel.
 *
 * `undefined` (sem período nenhum reconhecido) faz as queries caírem no
 * comportamento padrão: todo o histórico, sem filtro, mesmo que sempre foi.
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
    case 'hoje':
      return { desde: inicioDoDia(hoje), ate: fimDoDia(hoje) }
    case 'ontem': {
      const ontem = subtrairDias(hoje, 1)
      return { desde: inicioDoDia(ontem), ate: fimDoDia(ontem) }
    }
    case '7d':
      return { desde: inicioDoDia(subtrairDias(hoje, 7)), ate: fimDoDia(hoje) }
    case '30d':
      return { desde: inicioDoDia(subtrairDias(hoje, 30)), ate: fimDoDia(hoje) }
    case 'mes': {
      const [ano, mes] = hoje.split('-') as [string, string]
      return { desde: inicioDoDia(`${ano}-${mes}-01`), ate: fimDoDia(hoje) }
    }
    case 'mes_passado': {
      const [anoAtual, mesAtual] = hoje.split('-').map(Number) as [number, number]
      // Mês 0 (janeiro) volta pro ano anterior, dezembro — mesma normalização
      // que `Date.UTC` já faz sozinho, sem `if` de virada de ano à mão.
      const referencia = new Date(Date.UTC(anoAtual, mesAtual - 2, 1))
      const ano = referencia.getUTCFullYear()
      const mes = referencia.getUTCMonth() + 1
      const ultimoDia = ultimoDiaDoMes(ano, mes)
      const mesStr = String(mes).padStart(2, '0')
      return {
        desde: inicioDoDia(`${ano}-${mesStr}-01`),
        ate: fimDoDia(`${ano}-${mesStr}-${String(ultimoDia).padStart(2, '0')}`),
      }
    }
    case 'trimestre': {
      const [ano, mes] = hoje.split('-').map(Number) as [number, number]
      // Trimestre corrente, não "3 meses pra trás": alguém em fevereiro está
      // no 1º trimestre inteiro (jan-mar), não num intervalo que começa em
      // novembro. `Math.floor((mes-1)/3)*3+1` dá o mês inicial do trimestre.
      const mesInicial = Math.floor((mes - 1) / 3) * 3 + 1
      const mesInicialStr = String(mesInicial).padStart(2, '0')
      return { desde: inicioDoDia(`${ano}-${mesInicialStr}-01`), ate: fimDoDia(hoje) }
    }
    case 'ano': {
      const [ano] = hoje.split('-') as [string]
      return { desde: inicioDoDia(`${ano}-01-01`), ate: fimDoDia(hoje) }
    }
    default:
      return undefined
  }
}
