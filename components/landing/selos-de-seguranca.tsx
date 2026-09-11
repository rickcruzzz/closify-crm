import { CreditCard, Lock, MapPin, Scale } from 'lucide-react'
import Link from 'next/link'

/**
 * A faixa de selos do rodapé.
 *
 * ## Por que nenhum selo de terceiro
 *
 * O reflexo, ao pedir "selo de segurança", é colar um badge de McAfee, Norton
 * ou "Site 100% Seguro". Aqui isso está fora, e não é preferência estética: a
 * decisão travada deste projeto é **sem prova social inventada**, e um selo
 * que anuncia auditoria que ninguém fez é exatamente isso. A `StatsSection` já
 * teve métrica falsa copiada de concorrente e foi removida pelo mesmo motivo.
 *
 * Pior, esses badges cobram mensalidade para exibir uma imagem, e quem
 * reconhece a marca sabe que ela não significa auditoria de código — significa
 * assinatura paga.
 *
 * ## O que entra: fato conferível, e o caminho de conferir
 *
 * Cada linha abaixo é verdadeira hoje e **a pessoa consegue checar sozinha**,
 * que é a mesma regra que governa a `ConfiancaSection`: *"em vez de pedir
 * confiança, mostramos onde ela pode ser conferida"*.
 *
 *     criptografia   o cadeado do proprio navegador, na barra de endereco
 *     Sao Paulo      declarado na Politica, secao de transferencia de dados
 *     LGPD           a Politica nomeia o controlador e a base legal
 *     Asaas          o checkout abre no dominio DELES, da para ver na URL
 *
 * Os dois do meio linkam para `/privacidade` de propósito: selo que afirma e
 * não deixa conferir é o mesmo problema do badge comprado, só que de graça.
 *
 * ## Onde ele fica, e por que não mais acima
 *
 * No rodapé, acima da linha de CNPJ. Quem chega ao fim da página já leu as
 * quatro garantias da `ConfiancaSection` — esta faixa é o lembrete final, não
 * o argumento. Subi-la para perto do CTA transformaria uma nota de rodapé em
 * promessa de destaque, e "criptografia" não é motivo para ninguém comprar um
 * CRM: é o mínimo que se espera, e só pesa quando está ausente.
 */

type Selo = {
  texto: string
  icone: typeof Lock
  href?: string
}

const SELOS: Selo[] = [
  // Sem link: a prova é o cadeado que o navegador já desenha na barra de
  // endereço. Mandar para uma página explicando seria pedir um clique para
  // confirmar o que está visível a dois centímetros dali.
  { texto: 'Conexão criptografada', icone: Lock },
  { texto: 'Dados hospedados em São Paulo', icone: MapPin, href: '/privacidade' },
  { texto: 'Tratamento conforme a LGPD', icone: Scale, href: '/privacidade' },
  // O texto diz "pelo Asaas", e não "seguro": o que protege o cliente aqui é
  // o cartão não passar por este servidor, e é isso que a frase afirma.
  { texto: 'Pagamento processado pelo Asaas', icone: CreditCard },
]

export function SelosDeSeguranca() {
  return (
    <ul className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px]">
      {SELOS.map(({ texto, icone: Icone, href }) => {
        const conteudo = (
          <>
            <Icone aria-hidden className="size-3.5 shrink-0" />
            {texto}
          </>
        )

        return (
          <li key={texto}>
            {href ? (
              <Link
                href={href}
                className="hover:text-foreground flex items-center gap-1.5 underline-offset-4 transition-colors hover:underline"
              >
                {conteudo}
              </Link>
            ) : (
              <span className="flex items-center gap-1.5">{conteudo}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
