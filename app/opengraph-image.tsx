import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Velo Funil: pipeline de vendas em Kanban para PMEs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ImageResponse usa Satori, que só aceita um subconjunto de CSS via style
// inline — sem Tailwind, sem var(). Cores replicam o tema escuro do app
// (oklch convertido para hex, já que Satori não resolve oklch):
//   #00bfc0 = --primary  do .dark → oklch(0.72 0.14 195)
//   #031010 = --primary-foreground do .dark → oklch(0.16 0.02 195)
//
// O símbolo é remontado com três <div> em vez do <path> do LogoMark porque o
// suporte de Satori a path SVG arbitrário é irregular. As proporções das três
// camadas (larguras 56/30/8) seguem as do SVG real.
export default function OpengraphImage() {
  return new ImageResponse(
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
            width: 76,
            height: 76,
            borderRadius: 18,
            background: '#00bfc0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <div style={{ width: 44, height: 9, borderRadius: 4, background: '#031010' }} />
          <div style={{ width: 26, height: 9, borderRadius: 4, background: '#031010' }} />
          <div style={{ width: 9, height: 9, borderRadius: 4, background: '#031010' }} />
        </div>
        <div style={{ display: 'flex', fontSize: 36, gap: 9 }}>
          <span style={{ fontWeight: 700 }}>Velo</span>
          <span style={{ fontWeight: 400, color: '#a1a1a1' }}>Funil</span>
        </div>
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
    </div>,
    size,
  )
}
