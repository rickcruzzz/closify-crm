import { ImageResponse } from 'next/og'

// Mesmo runtime da opengraph-image: no runtime Node o @vercel/og tenta
// resolver o arquivo de fonte via fileURLToPath durante o prerender e estoura
// `TypeError: Invalid URL`, quebrando o build. O ícone não usa texto, mas o
// carregamento da fonte acontece na importação do módulo, antes disso.
export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Favicon gerado em vez de um .ico estático: mantém o símbolo do funil e a cor
// da marca numa fonte só, junto do resto do código, em vez de num binário que
// ninguém consegue revisar em diff.
//
// Este comentário dizia que o Next servia o ícone "junto de app/favicon.ico,
// que ainda carrega a marca antiga". O arquivo NÃO existe mais, conferido em
// 01/09/2026: este é o único ícone servido, e não há marca velha em produção.
//
// Mesmas cores e proporções do LogoMark e da OG image, com o vão entre as
// camadas proporcionalmente maior: a 32px o gap do SVG original fecharia e as
// três barras virariam um bloco só.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#00bfc0',
          borderRadius: 7,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <div style={{ width: 20, height: 4, borderRadius: 2, background: '#031010' }} />
        <div style={{ width: 12, height: 4, borderRadius: 2, background: '#031010' }} />
        <div style={{ width: 4, height: 4, borderRadius: 2, background: '#031010' }} />
      </div>
    ),
    size,
  )
}
