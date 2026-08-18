'use client'

import * as React from 'react'

/**
 * Marca a área do Dashboard que vira o PDF exportado.
 *
 * Só um `ref` de encaminhamento: o botão de exportar (`export-report-button.tsx`)
 * fica no `PageHeader`, fora desta div, então precisa de uma forma de achar o
 * elemento a capturar sem prop drilling entre os dois. Um `id` fixo é mais
 * simples que Context para algo tão pontual — um único consumidor, sem
 * estado, só "onde está o elemento".
 */
export const REPORT_AREA_ID = 'dashboard-report-area'

export function ReportArea({ children }: { children: React.ReactNode }) {
  return (
    <div id={REPORT_AREA_ID} className="flex flex-col gap-6">
      {children}
    </div>
  )
}
