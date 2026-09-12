import { existsSync } from 'node:fs'
import { join } from 'node:path'

import Image from 'next/image'
import { MapPin, ExternalLink } from 'lucide-react'

import { CONTROLADOR, enderecoEmLinha, type Endereco } from '@/lib/legal'
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
function linkDoMapa(endereco: Endereco) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    enderecoEmLinha(endereco),
  )}`
}

/**
 * A foto do prédio.
 *
 * ## A ausência é segura POR CONSTRUÇÃO, e não por disciplina
 *
 * `existsSync` roda no build, porque isto é Server Component. Se o arquivo
 * não estiver em `public/`, a constante vira `null` e a seção fica de pé só
 * com o endereço e o link — que já é mais do que o rodapé entrega.
 *
 * A alternativa seria confiar em alguém lembrar de sincronizar o caminho com
 * o disco, e o modo de falhar desse acordo é o pior possível: `next/image`
 * com `src` inexistente renderiza o ícone de imagem quebrada, em produção, na
 * seção que existe justamente para dizer que o site é sério. Nada falha no
 * build, nenhum teste reprova, e o defeito só aparece para quem rolar a
 * página até o fim.
 *
 * Vale para os dois sentidos: o dia em que a foto for trocada de nome, ou em
 * que alguém podar `public/` achando que é sobra, a página degrada em vez de
 * quebrar.
 *
 * **Foto de banco de imagens está fora**, e por outra razão: ela diria
 * "prédio genérico" em vez de "este prédio", que é prova social inventada com
 * outro nome — a decisão travada do projeto desde que a `StatsSection` teve
 * métrica falsa copiada de concorrente.
 */
const ARQUIVO_DA_FOTO = '/local/fachada.jpg'

const FOTO = existsSync(join(process.cwd(), 'public', ARQUIVO_DA_FOTO))
  ? {
      src: ARQUIVO_DA_FOTO,
      /**
       * O `alt` descreve o que a foto PROVA, não o que ela mostra.
       *
       * "Fachada de um prédio comercial" seria a descrição literal e não
       * diria nada a quem usa leitor de tela — a pessoa perderia exatamente a
       * informação que a seção existe para dar. O número da placa entra no
       * texto porque é ele que casa com o endereço escrito ao lado.
       */
      alt: 'Entrada do CEO Salvador Shopping, com a placa do número 2539 na calçada',
      /**
       * As dimensoes REAIS do arquivo, e elas precisam bater.
       *
       * `next/image` usa as duas para reservar a caixa antes de a imagem
       * chegar — e o CLS que isso evita e a falha que o guia de UX do projeto
       * lista primeiro. Numero chutado aqui nao quebra nada visivelmente: a
       * caixa e reservada com a proporcao errada, o conteudo abaixo salta
       * quando a imagem carrega, e o salto e atribuido a "site pesado".
       */
      largura: 399,
      altura: 501,
    }
  : null

export function OndeFicamosSection() {
  const endereco = CONTROLADOR.endereco
  if (!endereco) return null

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
          className="bg-card border-border superficie-elevada mx-auto flex max-w-4xl flex-col gap-6 rounded-xl border p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-8"
        >
          {FOTO ? (
            /* ## A proporção mora no CONTAINER, não no arquivo
               A foto é retrato, e deixar a altura do card seguir a proporção
               dela produziria 560px de imagem ao lado de 180px de texto, com
               o endereço flutuando no topo e vazio embaixo. `aspect-[4/3]`
               fixa a caixa e `object-cover` recorta dentro dela — e recortar
               é honesto, porque o pedaço que aparece está em proporção real.
               É a mesma regra que o gerador de criativos aprendeu em 09/09,
               quando espremia o print em 2,7x.

               `object-[50%_72%]` e nao `center`, e o 72 saiu de conta, nao
               de gosto. A caixa 4:3 mostra 60% das 501 linhas da foto, e a
               placa com o CEO e o 2539 ocupa de 58% a 86% da altura:

                   38%   visivel 15% a 75%   corta a placa
                   55%   visivel 22% a 82%   corta a placa
                   65%   visivel 26% a 86%   corta a placa na borda
                   72%   visivel 29% a 89%   PLACA INTEIRA

               O que se perde em troca e o ceu do topo, que nao prova nada. O
               que sobrevive e o unico elemento da imagem que casa com o texto
               ao lado — sem ele isto vira foto de predio qualquer. */
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg lg:w-[420px]">
              <Image
                src={FOTO.src}
                alt={FOTO.alt}
                width={FOTO.largura}
                height={FOTO.altura}
                /* ## `quality: 78`, e o 92 do print NÃO se aplica aqui
                   `produto-print.tsx` usa 92 e explica por quê: print de
                   interface é o pior caso possível para compressão com
                   perda, porque texto pequeno sobre fundo chapado expõe cada
                   artefato. O mesmo comentário diz que o padrão do Next
                   serve bem FOTO — ruído fotográfico esconde artefato.
                   Copiar o 92 seria repetir um número sem o motivo dele, e
                   custaria ~40 KB por nada. */
                quality={78}
                /* Abaixo da dobra, a ~9.000px do topo: não disputa banda com
                   o LCP em nenhum cenário. */
                loading="lazy"
                /* Medido no navegador antes de escrever, pela lição de 03/09
                   (`vw` é a JANELA, não o container):

                       390px   card com 326px de largura util  ->  84vw
                       700px   card com 636px                  ->  91vw
                       1024px+ coluna fixa de 420px

                   Declarar `100vw` faria o navegador orçar para uma caixa
                   maior do que existe e atravessar um degrau inteiro. */
                sizes="(min-width: 1024px) 420px, (min-width: 640px) 91vw, 84vw"
                className="size-full object-cover object-[50%_72%]"
              />
              {/* A borda vai por dentro, sobre a imagem: `border` no
                  container seria coberto pelo `object-cover` do filho nos
                  cantos arredondados, e sobra um fio da foto por fora do
                  raio. `inset-0` com `ring` resolve sem somar ao layout. */}
              <div
                aria-hidden
                className="ring-border pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset"
              />
            </div>
          ) : null}

          <div className="flex flex-1 flex-col gap-5">
            <div className="flex gap-3">
              <MapPin aria-hidden className="text-primary mt-1 size-5 shrink-0" />
              {/* ## A hierarquia é o que faz "endereço claro"
                  Antes isto era a linha do cadastro quebrada num `split('—')`:
                  duas faixas de texto do mesmo peso, em que nada dizia o que
                  ler primeiro. Agora cada parte tem o papel dela — o que se
                  digita no aplicativo de mapa vem em destaque, o prédio e o
                  bairro dão contexto, e o CEP fecha em mono porque é código,
                  não frase (o mesmo uso que a seção de confiança já faz do
                  `font-mono` nos rótulos). */}
              <address className="flex flex-col gap-1.5 not-italic">
                {/* O numero fica SOZINHO na linha de destaque, e isso e o
                    ponto: ele e o unico dado do bloco que a foto ao lado
                    tambem mostra, na placa. Com o complemento junto, a linha
                    quebrava no meio de "— Sala 2609" e o 2539 perdia o peso
                    que faz a ligacao acontecer. */}
                <span className="text-lg leading-snug font-semibold">
                  {endereco.logradouro}, {endereco.numero}
                </span>
                <span className="text-muted-foreground text-sm leading-relaxed">
                  {[endereco.complemento, endereco.edificio]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className="text-muted-foreground text-sm leading-relaxed">
                  {endereco.bairro} · {endereco.cidade}/{endereco.uf}
                </span>
                <span className="text-muted-foreground font-mono text-xs tracking-wide">
                  CEP {endereco.cep}
                </span>
              </address>
            </div>

            <a
              href={linkDoMapa(endereco)}
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
