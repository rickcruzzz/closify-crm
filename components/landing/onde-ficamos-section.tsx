import Image from 'next/image'
import { MapPin, ExternalLink } from 'lucide-react'

import { CONTROLADOR } from '@/lib/legal'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'

/**
 * Onde a empresa fica, com foto do prédio.
 *
 * ## Por que isto existe, e por que não é redundante com o rodapé
 *
 * O endereço já aparece em `public-footer.tsx`, em texto, junto do CNPJ. Esta
 * seção não repete o dado — ela muda a **natureza** do que é mostrado.
 *
 * Endereço em texto é informação: prova que alguém preencheu um cadastro.
 * Foto do lugar é evidência: prova que o lugar existe e que a pessoa que
 * escreveu esteve lá. São coisas diferentes para quem está decidindo se põe
 * a carteira de clientes num site que nunca ouviu falar.
 *
 * E é a prova mais forte que este produto tem hoje. `confianca-section.tsx`
 * registra a auditoria de 24/08: as seis landings concorrentes sustentam a
 * página em prova social, e aqui não existe cliente externo para exibir —
 * inventar depoimento é decisão travada do projeto. Sobra o que é conferível,
 * e endereço com foto é conferível por qualquer um no Google Maps.
 *
 * ## A posição: antes do CTA, nunca depois
 *
 * O último bloco de uma landing é onde a decisão acontece, e `CtaSection` é
 * quem faz esse trabalho. Pôr "onde ficamos" depois dele empurraria o botão
 * para o meio da página e faria a última coisa lida ser um endereço — que
 * informa e não converte.
 *
 * Antes da FAQ também não: a FAQ responde objeção, e "vocês existem?" é
 * objeção. O lugar é entre a última objeção respondida e o convite final.
 *
 * ## O mapa NÃO é embutido, e isso é decisão
 *
 * Um `<iframe>` do Google Maps seria o reflexo. Três coisas o impedem, e as
 * três são regras que este projeto já paga em outro lugar:
 *
 *     CSP     `frame-src` nao libera google.com, e a CSP e BLOQUEIO desde
 *             27/08. O iframe apareceria em branco, em producao, sem nada
 *             falhar em desenvolvimento — a mesma classe do script do Google
 *             Ads que a CSP recusava em silencio em 04/09
 *     LGPD    iframe do Maps carrega cookie do Google ANTES de qualquer
 *             clique, e o banner de consentimento existe justamente para que
 *             isso nao aconteca sem escolha
 *     peso    ~900 KB de JavaScript de terceiro numa pagina cujo LCP foi
 *             defendido a 254 KB em 02/09
 *
 * Um link que abre o Maps em outra aba entrega a mesma coisa por 0 KB, e só
 * carrega o Google para quem pediu.
 */

/**
 * A busca no Maps sai do MESMO endereço publicado.
 *
 * Escrever a URL à mão criaria uma segunda fonte: no dia em que a empresa
 * mudar de sala, o texto diria um lugar e o link levaria a outro — e ninguém
 * perceberia, porque as duas coisas continuariam funcionando.
 */
function linkDoMapa(endereco: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`
}

/**
 * A foto do prédio, se ela existir.
 *
 * `null` é um estado legítimo e não um defeito: o endereço é preenchido a
 * partir do cadastro da Receita, e a foto depende de alguém ir até lá tirar.
 * Sem ela a seção continua de pé, mostrando o endereço e o link — que já é
 * mais do que o rodapé entrega.
 *
 * O oposto seria pior de duas formas: um `<img>` apontando para arquivo
 * inexistente desenha o ícone de imagem quebrada, que diz "site mal feito" na
 * seção que existe para dizer o contrário; e uma foto de banco de imagens
 * diria "prédio genérico", que é prova social inventada com outro nome.
 */
const FOTO: { src: string; alt: string; largura: number; altura: number } | null = null

export function OndeFicamosSection() {
  if (!CONTROLADOR.endereco) return null

  // O endereço vem numa linha só, do formato do cadastro. Aqui ele é quebrado
  // para ler como endereço e não como campo de formulário — a primeira parte
  // é o que a pessoa digita no Maps, o resto é contexto.
  const [logradouro, ...resto] = CONTROLADOR.endereco.split('—')

  return (
    <section
      id="onde-ficamos"
      /* Mesmo ritmo vertical das outras seções (`py-20 md:py-28`), e o mesmo
         `bg-muted/30` da seção de confiança: as duas respondem à mesma
         pergunta, e superfícies iguais dizem isso sem precisar de texto. */
      className="bg-muted/30 border-border/60 border-y px-4 py-20 md:px-6 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Tem gente por trás disso
          </span>
          <h2 className="text-titulo-md md:text-titulo-lg">Onde a gente fica</h2>
          <p className="text-muted-foreground text-balance">
            Sala comercial, com endereço que você pode conferir agora. Software se
            contrata de quem existe em algum lugar.
          </p>
        </RevealOnScroll>

        <RevealOnScroll
          delay={90}
          /* Coluna única até `lg`: a foto de um prédio e um bloco de endereço
             lado a lado em 700px ficam com 320px cada, e nessa largura a foto
             perde o que ela existe para mostrar. */
          className="bg-card border-border superficie-elevada mx-auto flex max-w-3xl flex-col gap-6 rounded-xl border p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-8"
        >
          {FOTO ? (
            <Image
              src={FOTO.src}
              alt={FOTO.alt}
              width={FOTO.largura}
              height={FOTO.altura}
              /* 60vw e não 100vw: dentro do card a imagem nunca ocupa a janela
                 inteira, e um `sizes` que mente faz o navegador baixar o
                 degrau maior do que precisa — o defeito medido em 03/09, que
                 fazia o telefone baixar 3840px para desenhar 1025. */
              sizes="(min-width: 1024px) 420px, 60vw"
              className="border-border h-auto w-full rounded-lg border object-cover lg:w-[420px]"
            />
          ) : null}

          <div className="flex flex-1 flex-col gap-4">
            <div className="flex gap-3">
              <MapPin aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
              <address className="flex flex-col gap-1 not-italic">
                <span className="font-medium">{logradouro.trim()}</span>
                {resto.length > 0 ? (
                  <span className="text-muted-foreground text-sm leading-relaxed">
                    {resto.join('—').trim()}
                  </span>
                ) : null}
              </address>
            </div>

            <a
              href={linkDoMapa(CONTROLADOR.endereco)}
              target="_blank"
              rel="noopener noreferrer"
              /* `min-h-11`: 44px é a régua de alvo de toque do projeto, e um
                 link de uma linha em corpo pequeno fica bem abaixo disso. */
              className="text-primary hover:text-primary/80 inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium underline-offset-4 transition-colors hover:underline"
            >
              Ver no Google Maps
              <ExternalLink aria-hidden className="size-4" />
            </a>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  )
}
