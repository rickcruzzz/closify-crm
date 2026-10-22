import type { Metadata } from 'next'

import { PublicNavbar } from '@/components/layout/public-navbar'
import { HeroSection } from '@/components/landing/hero-section'
import { CicloComercialSection } from '@/components/landing/ciclo-comercial-section'
import { RadarSection } from '@/components/landing/radar-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { ConfiancaSection } from '@/components/landing/confianca-section'
import { ContratacaoSection } from '@/components/landing/contratacao-section'
import { FaqSection, faqs } from '@/components/landing/faq-section'
import { OndeFicamosSection } from '@/components/landing/onde-ficamos-section'
import {
  organizacao,
  paraScript,
  perguntasFrequentes,
} from '@/lib/seo/dados-estruturados'
import { CtaSection } from '@/components/landing/cta-section'
import { PublicFooter } from '@/components/landing/public-footer'

// A landing usa o title default (sem o template "| Velo Funil"), já que
// aqui o nome do produto é o próprio título.
//
// ## O reposicionamento de 22/10: CRM B2B + Radar de Prospecção
//
// Até 21/10 a tese era "o CRM que lembra de dar o retorno do orçamento", para
// pequenos prestadores de serviço, com cadastro grátis. A página passou a
// vender o CRM junto com o Radar, para empresas B2B, e toda contratação começa
// por uma conversa com a equipe. O histórico das teses anteriores (WhatsApp,
// preço fixo, orçamento) está no git log deste arquivo.
//
// O que NÃO entra em nenhum texto daqui: "automático", "ilimitado" e
// quantidade de leads. O Radar é um projeto configurado com cada empresa
// (`lib/enterprise/`), e a página diz isso.
export const metadata: Metadata = {
  title: 'Velo Funil: CRM B2B com Radar de Prospecção',
  // O Google corta em ~160 caracteres: o diferencial (Radar) vem primeiro,
  // porque o fim da frase pode não aparecer.
  description:
    'CRM B2B com Radar de Prospecção: encontre oportunidades no perfil da sua empresa, organize cada lead e acompanhe a negociação até a venda.',
  alternates: { canonical: '/' },
  // ## Este bloco é o que o WHATSAPP mostra
  //
  // O link colado numa conversa exibe o `openGraph`, não a `description`. É a
  // primeira confirmação da promessa, antes do clique — por isso a versão
  // longa, que WhatsApp e LinkedIn mostram inteira.
  openGraph: {
    title: 'Velo Funil: CRM B2B com Radar de Prospecção',
    description:
      'O Velo Funil combina um CRM comercial com um Radar que busca oportunidades de acordo com os critérios da sua empresa. Encontre novos leads, centralize as informações e acompanhe cada oportunidade até a venda.',
    // Next.js não mescla `openGraph` entre layout e página, definir aqui
    // sobrescreve o do layout raiz por inteiro, e sem `siteName` a home
    // ficava sem `og:site_name` — o que o verificador de marca do Google
    // compara com o nome cadastrado no consent screen ("Velo Funil").
    siteName: 'Velo Funil',
  },
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* ## Dados estruturados, e por que eles ficam AQUI e não no layout
          Buscando pelo nome próprio em 03/09, o site não aparecia, e o
          JSON-LD era ZERO. Sem ele o Google lê a página como texto solto.

          Ficam nesta página porque descrevem ESTA página. A FAQ, em especial,
          só pode ser marcada onde as perguntas existem no HTML — marcá-la numa
          rota que não as mostra é violação de política, e a punição é ação
          manual que derruba todo rich snippet do site.

          ## `aplicacao()` saiu daqui em 22/10, pela mesma regra
          Ela marca as ofertas Free e Pro com preço. A home deixou de mostrar
          preço, e dado estruturado que afirma o que a página não exibe é a
          mesma violação da FAQ marcada fora do lugar. A função continua em
          `lib/seo/dados-estruturados.ts` para quando um preço voltar a
          aparecer aqui. */}
      <script
        type="application/ld+json"
        // O conteúdo é gerado por nós, a partir de constantes do próprio
        // código — nunca de entrada de usuário.
        dangerouslySetInnerHTML={{ __html: paraScript(organizacao()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: paraScript(perguntasFrequentes(faqs)),
        }}
      />
      <PublicNavbar />
      <main id="conteudo" className="flex-1">
        <HeroSection />
        <CicloComercialSection />
        {/* O Radar logo depois do hero: é o diferencial, e quem precisa rolar
            meia página para descobrir que ele existe não chega a descobrir. */}
        <RadarSection />
        {/* Depois de encontrar, o que acontece com a oportunidade: as telas
            reais do CRM, e só então a grade de recursos. */}
        <HowItWorksSection />
        <FeaturesSection />
        {/* Confiança antes da contratação, não depois: "posso entregar minha
            carteira de clientes a esta gente?" nasce antes da conversa
            comercial. */}
        <ConfiancaSection />
        <ContratacaoSection />
        {/* A FAQ entre a contratação e o CTA final: é onde a objeção aparece,
            a pessoa acabou de ver como contratar e ainda não decidiu. */}
        <FaqSection />
        {/* "Onde ficamos" entre a última objeção e o convite final: depois do
            CTA ele deixaria de ser a última coisa lida, e o fecho viraria um
            endereço, que informa e não converte. */}
        <OndeFicamosSection />
        <CtaSection />
      </main>
      <PublicFooter />
    </div>
  )
}
