import { Building2, CreditCard, DoorOpen, Lock, MapPin, type LucideIcon } from 'lucide-react'

import { CONTROLADOR } from '@/lib/legal'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { cn } from '@/lib/utils'

/**
 * Por que confiar, para quem ainda não tem cliente para exibir.
 *
 * ## O buraco que esta seção fecha
 *
 * Auditei em 24/08 as landings de Agendor, Pipedrive, Attio, Basecamp, Tally e
 * Page AI. **Todas as seis** sustentam a página em prova social: "mais de 10
 * mil empresas", "30.000+ customers", logos de Scania e Railway, depoimento com
 * nome e cargo. Tally é a menor da lista e ainda assim abre com Notion e
 * Rakuten.
 *
 * Nós temos zero clientes externos pagantes, e inventar depoimento é decisão
 * travada deste projeto desde que a `StatsSection` teve métrica falsa copiada
 * de concorrente. Então a confiança precisa vir do único lugar que sobra:
 * **transparência sobre coisas verificáveis**.
 *
 * A vantagem é que nenhum dos seis faz isso direito. Attio empurra segurança
 * para um "Trust Center" fora da página; o Agendor esconde numa aba de recurso.
 * Para PME brasileira, que decide com desconfiança de site desconhecido, dizer
 * essas cinco coisas na cara vale mais que um logo que ela não reconhece.
 *
 * ## A régua de cada item
 *
 * Nenhum é aspiracional. Todos são estado atual do sistema, e cada um está
 * escrito para ser conferível por quem lê:
 *
 * - **isolamento** — RLS por `workspace_id`, provado 14/14 contra produção com
 *   sessão autenticada real, não `service_role`
 * - **dados no Brasil** — projeto Supabase em `sa-east-1`, funções em `gru1`
 *   desde a correção de 22/08
 * - **cartão** — nunca passa pelo nosso servidor; a decisão de não tokenizar
 *   está registrada em `lib/asaas/pix.ts` (escopo PCI-DSS)
 * - **saída** — cancelar devolve ao Free sem multa, e o dado continua lá; é o
 *   que a FAQ já promete, agora dito onde a objeção nasce
 * - **CNPJ** — o mesmo de `lib/legal.ts`, que já é citado nas páginas legais
 *
 * ## Por que o CNPJ aparece aqui e não só no rodapé
 *
 * No Brasil, CNPJ visível é o primeiro sinal que uma PME procura antes de pôr
 * cartão em site que ela nunca ouviu falar. Deixá-lo apenas no rodapé o entrega
 * a quem já rolou a página inteira — que é justamente quem já decidiu.
 */

type Garantia = {
  titulo: string
  descricao: string
  icone: LucideIcon
  accent: string
  delay: number
}

const garantias: Garantia[] = [
  {
    titulo: 'Uma empresa nunca vê a outra',
    descricao:
      'O isolamento é uma regra dentro do banco de dados, não uma tela que alguém pode esquecer de conferir. Mesmo com a interface burlada, o dado da sua empresa não sai.',
    icone: Lock,
    accent: 'text-emerald-500 dark:text-emerald-400',
    delay: 0,
  },
  {
    titulo: 'Seus dados ficam no Brasil',
    descricao:
      'Servidores em São Paulo. Nada de cliente seu atravessa fronteira para ser processado, e o tempo de resposta agradece junto.',
    icone: MapPin,
    accent: 'text-blue-500 dark:text-blue-400',
    delay: 90,
  },
  {
    titulo: 'Seu cartão não passa por aqui',
    descricao:
      'Pix, boleto e cartão são processados pelo Asaas. O número do seu cartão nunca chega ao nosso servidor, por decisão de arquitetura.',
    icone: CreditCard,
    accent: 'text-violet-500 dark:text-violet-400',
    delay: 180,
  },
  {
    titulo: 'A porta de saída fica aberta',
    descricao:
      'Cancele sozinho, sem multa e sem falar com ninguém. A conta volta para o plano grátis e seus contatos continuam lá. Não seguramos ninguém por dificuldade.',
    icone: DoorOpen,
    accent: 'text-orange-500 dark:text-orange-400',
    delay: 270,
  },
]

export function ConfiancaSection() {
  return (
    <section
      id="confianca"
      className="bg-muted/30 border-border/60 border-y px-4 py-20 md:px-6 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Antes de você confiar a sua carteira de clientes
          </span>
          <h2 className="text-titulo-md md:text-titulo-lg">
            O que a gente garante por escrito
          </h2>
          <p className="text-muted-foreground text-balance">
            Somos novos, e sabemos o que isso significa para quem está decidindo. Então
            em vez de pedir confiança, mostramos onde ela pode ser conferida.
          </p>
        </RevealOnScroll>

        <div className="grid gap-4 sm:grid-cols-2">
          {garantias.map((garantia) => (
            <RevealOnScroll
              key={garantia.titulo}
              delay={garantia.delay}
              className="bg-background border-border/60 flex gap-4 rounded-xl border p-5"
            >
              <garantia.icone
                aria-hidden
                className={cn('mt-0.5 size-5 shrink-0', garantia.accent)}
              />
              <div className="flex flex-col gap-1.5">
                <h3 className="font-medium">{garantia.titulo}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {garantia.descricao}
                </p>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        {/* O CNPJ fecha a seção em vez de abrir: quem chegou até aqui já leu as
            quatro garantias, e esta linha é a prova de que existe uma empresa
            respondendo por elas. Sozinha no topo seria burocracia; no fim, é
            assinatura.

            Sem `razaoSocial`, de propósito (24/08): nome civil do titular numa
            linha de reforço visual não ajuda confiança, só expõe. Ele continua
            em Privacidade/Termos, onde a LGPD exige identificar o controlador,
            e nos avisos de fatura, onde avisa o nome que vai aparecer no
            extrato do cartão — os dois por necessidade, não por marca. */}
        <RevealOnScroll
          delay={360}
          className="text-muted-foreground mt-8 flex flex-col items-center gap-2 text-center text-sm"
        >
          <Building2 aria-hidden className="size-4" />
          {/* Número por extenso removido (24/08): o link já abre o WhatsApp
              direto, escrever o número inteiro do lado do link que faz a MESMA
              coisa é redundância, não profissionalismo — nenhum concorrente
              auditado (Agendor, Pipedrive, Attio) expõe telefone cru na
              página, todos usam texto de link ou botão. */}
          <p>
            {CONTROLADOR.nomeFantasia}, CNPJ {CONTROLADOR.cnpj}.{' '}
            <a
              href={`https://wa.me/${CONTROLADOR.whatsapp.numero}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Falar no WhatsApp
            </a>
            .
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
