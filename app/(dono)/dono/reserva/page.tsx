import { ReservaDeInstancias } from '@/components/dono/reserva-de-instancias'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'
import { contarReservaLivre, lerReserva } from '@/lib/whatsapp/reserva'

/** Ver o comentário em `app/(dono)/dono/page.tsx`: monitoramento com número velho é pior que nenhum. */
export const dynamic = 'force-dynamic'

/**
 * A reserva de instâncias de WhatsApp.
 *
 * ## A regra que fez esta tela existir
 *
 * *"Tudo tem que ser de igual pra igual pra qualquer pagante."*
 *
 * Antes dela, um cliente que pagava R$ 250 e clicava em "Conectar" disparava um
 * e-mail para o dono, e daí em diante o caminho dependia de uma pessoa estar
 * disponível: criar a instância no painel, mandar o token por fora, e pedir que
 * o cliente colasse num bloco escrito *"Já tenho uma instância na Z-API"* — que
 * era falso para ele.
 *
 * Isso era atendimento pessoal disfarçado de recurso, e quebrava no primeiro
 * cliente que assinasse num domingo.
 *
 * ## O dinheiro que ela economiza
 *
 * O caminho limpo seria o Partner da Z-API, que cria instância por API. Ele
 * exige **dez contratadas**, R$ 899,90/mês fixos, e o empate com a avulsa só
 * acontece no nono cliente. Com zero cliente Max, é pagar por vaga vazia.
 *
 * A reserva entrega o mesmo resultado ao cliente sem esse custo: compra avulsa,
 * uma de cada vez, e o dinheiro de quem paga financia a próxima.
 *
 * ## Por que aqui, e não em Configurações
 *
 * `app/(dono)/` devolve 404 fora de `localhost`. A tabela guarda token de
 * instância, que é credencial: quem o tivesse mandaria mensagem em nome de um
 * número de cliente. Nem o admin da própria empresa tem o que fazer com isto.
 */
export default async function ReservaPage() {
  // `await` obrigatório: sem ele o `notFound()` vira promise rejeitada que
  // ninguém observa, e a página segue montando. O `layout.tsx` ainda seguraria,
  // mas isto é a terceira camada que ele próprio documenta, e camada que não
  // roda não é camada.
  await exigirAmbienteLocal()

  // Em paralelo: são duas leituras independentes, e em série a tela pagaria as
  // duas idas ao banco somadas.
  const [linhas, livres] = await Promise.all([lerReserva(), contarReservaLivre()])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-titulo-lg">Reserva de WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          Instâncias compradas esperando o próximo cliente do plano Max.
        </p>
      </div>

      <ReservaDeInstancias linhas={linhas} livres={livres} />
    </div>
  )
}
