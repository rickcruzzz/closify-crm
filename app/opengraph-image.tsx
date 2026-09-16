import { ImageResponse } from 'next/og'

export const runtime = 'edge'
// Esta imagem é o que aparece no WhatsApp, no Instagram e no Facebook antes de
// qualquer clique — para tráfego pago, é literalmente a primeira coisa que o
// lead vê do produto. Estava parada na headline e no vocabulário ANTERIORES ao
// docs/prd-copy-sem-jargao.md: "Simples como planilha, premium como software
// líder" é a linha listada como "antes" naquele documento, e "pipeline",
// "Kanban" e "PMEs" são três dos termos que ele proíbe por serem jargão para
// quem tem agência, clínica ou imobiliária pequena. O texto abaixo passou a
// ser o mesmo do hero.
//
// ## E em 09/09 ele ficou velho de novo, do jeito mais caro possível
//
// A frase era "O WhatsApp guarda a conversa. Não guarda o cliente." — a tese
// de 24/08, aposentada em 02/09 quando a ponte do WhatsApp saiu de operação e
// `FASE_DO_WHATSAPP` virou `migrando`. A landing, a mensagem de prospecção e o
// carrossel foram todos reescritos para orçamento; **esta imagem não**, e ela
// é a única superfície que o lead vê ANTES de clicar.
//
// O dono mandou a mensagem no WhatsApp e o cartão apareceu anunciando um
// recurso que o produto não tem, logo acima de um texto falando de orçamento.
// Foi visto na conversa, não em auditoria — nenhum portão olha o CONTEÚDO
// desta imagem.
//
// A frase agora é o eco literal da mensagem de prospecção e do hero, que é o
// que faz quem clica reconhecer que chegou no lugar certo.
export const alt = 'Velo Funil: o cliente pediu orçamento e sumiu, o sistema lembra você de dar o retorno'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ImageResponse usa Satori, que só aceita um subconjunto de CSS via style
// inline, sem Tailwind, sem var(). Cores replicam o tema escuro do app
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

      {/* ## A manchete usa o acento da marca em UMA palavra, e é a palavra certa
          A peça era branca do começo ao fim, com o teal só no selo. "Sumiu" é
          o verbo da dor e a única palavra que o leitor precisa reconhecer se
          ler nada mais — no tamanho de miniatura do WhatsApp, é a única que
          ele vai ler mesmo. */}
      <div
        style={{
          marginTop: 44,
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.14,
          letterSpacing: -1.5,
          maxWidth: 940,
          display: 'flex',
          flexWrap: 'wrap',
        }}
      >
        {/* ## O espaço entre os trechos é MARGEM, e não caractere
            Três renderizações para chegar aqui, todas saindo "sumiu.Aqui ele
            não some.". `&nbsp;` sai literal, porque o Satori trata o texto do
            JSX como está; e ` ` some, porque num container flex o espaço
            nas pontas do item é descartado no layout.

            Margem não depende de como o texto é tratado: ela é geometria. É a
            mesma razão pela qual o `gap` do selo funciona e o espaço não. */}
        <span style={{ marginRight: 20 }}>{'O cliente pediu orçamento e'}</span>
        <span style={{ color: '#00bfc0', marginRight: 20 }}>{'sumiu.'}</span>
        <span>{'Aqui ele não some.'}</span>
      </div>

      {/* ## O dado entrou no lugar da frase genérica, e ele foi MEDIDO
          A versão anterior dizia "o sistema lembra você de dar o retorno" —
          verdadeiro e sem prova. Com o Exa foram lidos 25 geradores de
          orçamento brasileiros, que é a categoria que este público de fato
          procura: 88% geram o PDF, 60% mandam pelo WhatsApp, 48% já guardam a
          validade. **Nenhum avisa antes de o prazo vencer.**

          Guardar não diferencia; avisar sim. É o único número não óbvio que
          este produto tem, e ele cabe numa linha. */}
      <div
        style={{
          marginTop: 34,
          paddingTop: 30,
          borderTop: '2px solid #2a2a2a',
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          maxWidth: 940,
        }}
      >
        {/* `flexShrink: 0` porque o número quebrou em duas linhas na primeira
            renderização ("0 de" / "25"), e um número partido deixa de ser
            número. Ele é o dado; quem cede espaço é a frase ao lado. */}
        <span style={{ fontSize: 46, fontWeight: 700, color: '#00bfc0', flexShrink: 0 }}>
          {'0 de 25'}
        </span>
        <span style={{ fontSize: 30, color: '#a1a1a1' }}>
          {'sistemas de orçamento avisam antes de o prazo vencer. O Velo Funil avisa.'}
        </span>
      </div>

      <div style={{ marginTop: 30, fontSize: 26, color: '#6f6f6f' }}>
        {'Grátis até 50 contatos, sem cartão  ·  velofunil.com.br'}
      </div>
    </div>,
    size,
  )
}
