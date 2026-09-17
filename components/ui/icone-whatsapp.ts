import { createElement, type SVGProps } from 'react'

/**
 * O glifo real do WhatsApp.
 *
 * ## Por que um SVG próprio, e não um ícone da biblioteca
 *
 * O `lucide-react` **não tem marcas**: ele removeu os ícones de marca do pacote,
 * e o que sobra por lá para representar WhatsApp é genérico — `MessageCircle`
 * (um balão qualquer, que aqui já serve "Conversas") ou `Smartphone` (um
 * celular, que não diz de qual aplicativo se trata).
 *
 * Num item de menu que existe para a pessoa reconhecer de relance, um balão
 * genérico ao lado de outro balão genérico anula a função do ícone, que é ser o
 * segundo caminho de reconhecimento além do texto. É a mesma regra que tirou
 * `Users` de "Equipe" quando ele já servia "Contatos", travada em
 * `nav-items.test.ts` desde 16/09.
 *
 * ## Por que `createElement` e não JSX, num arquivo `.ts`
 *
 * `lib/nav-items.ts` importa este módulo, e `lib/**` é testado por vitest **sem
 * transformação de JSX** — os testes daqui cobrem lógica pura e nunca montaram
 * componente. Um `.tsx` no caminho de importação quebra o `nav-items.test.ts`
 * inteiro com erro de parse, e consertar isso significaria ligar o plugin de
 * React no vitest por causa de um ícone.
 *
 * Um elemento só é perfeitamente legível em `createElement`, e o custo fica
 * aqui em vez de na configuração de teste do projeto.
 *
 * ## `currentColor`, e nada de verde fixo
 *
 * O verde é a cor da marca deles. Pintá-lo faria um item do menu gritar acima
 * dos outros seis e brigaria com o estado ativo, que pinta o fundo. O glifo
 * herda a cor do texto como todo ícone da barra e continua reconhecível pela
 * FORMA, que é o que a marca de fato é.
 *
 * ## Um caminho só, com `fill`
 *
 * O desenho do WhatsApp é sólido: balão recortado com o fone vazado.
 * Reproduzi-lo em traço aberto, como os ícones do lucide, vira borrão em 16px.
 */
const CAMINHO =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z'

export function IconeWhatsapp(props: SVGProps<SVGSVGElement>) {
  return createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      // O rótulo de texto ao lado já nomeia o item, e um leitor de tela
      // anunciando "WhatsApp WhatsApp" é ruído. Na barra recolhida quem nomeia
      // é o `title` do próprio item, não o ícone.
      'aria-hidden': 'true',
      ...props,
    },
    createElement('path', { d: CAMINHO }),
  )
}
