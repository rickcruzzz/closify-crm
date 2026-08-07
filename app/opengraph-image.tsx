import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Closify CRM — pipeline de vendas em Kanban para PMEs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ImageResponse usa Satori, que só aceita um subconjunto de CSS via style
// inline — sem Tailwind, sem var(). Cores replicam o tema escuro do app
// (oklch convertido para hex, já que Satori não resolve oklch).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#111111',
          color: '#fafafa',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#ededed',
              color: '#111111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 34, fontWeight: 600 }}>Closify CRM</div>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 66,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1.5,
            maxWidth: 900,
          }}
        >
          Simples como planilha, premium como software líder.
        </div>

        <div style={{ marginTop: 28, fontSize: 30, color: '#a1a1a1', maxWidth: 860 }}>
          Pipeline de vendas em Kanban para PMEs de serviço no Brasil.
        </div>
      </div>
    ),
    size,
  )
}
