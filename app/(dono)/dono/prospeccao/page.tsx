import { PrateleiraDeProspeccao } from '@/components/dono/prateleira-de-prospeccao'
import { contarPorEstado } from '@/lib/dono/prateleira'
import { carregarPrateleira } from '@/lib/dono/prateleira-queries'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/** Ver o comentário em `app/(dono)/dono/page.tsx`: número velho é pior que nenhum. */
export const dynamic = 'force-dynamic'

/**
 * A prateleira de prospecção.
 *
 * ## O gargalo que ela desfaz
 *
 * Em 07/09 o motor tinha produzido **510 mensagens prontas e zero conversas**.
 * Não faltava lead — faltava enviar. O caminho até uma mensagem eram cinco
 * passos: trocar de empresa no seletor, Contatos, abrir o contato, rolar a
 * timeline, achar o link. Ninguém repete isso quinhentas vezes.
 *
 * Aqui é um clique por empresa, e a lista inteira numa tela só.
 *
 * ## Por que ela mora na Central, e não no produto
 *
 * A lista é o ativo comercial do dono, não dado de cliente. Publicá-la como
 * recurso exigiria RLS por empresa, teto de custo do Exa por cliente e uma
 * linha nova na Política de Privacidade. Nada disso é necessário para resolver
 * o problema de hoje, que é o dono não estar ligando para ninguém.
 *
 * O gate de `exigirAmbienteLocal` é o mesmo do resto da Central: 404 fora de
 * localhost, porque `carregarPrateleira` lê com `createAdminClient()`.
 */
export default async function PaginaDeProspeccao() {
  await exigirAmbienteLocal()

  const { prospects, naoPerturbe, excluidos } = await carregarPrateleira()
  const contagem = contarPorEstado(prospects)
  const trabalhadas = contagem.enviado + contagem.confirmado + contagem.descartado

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Prospecção</h1>
        <p className="text-muted-foreground text-sm">
          Tudo que o Exa achou, numa fila só: o universo dos CSVs mais os contatos que já
          viraram lead. Um clique abre o WhatsApp com a mensagem pronta.
        </p>
      </header>

      <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
        <span>
          <span className="text-foreground font-semibold">{prospects.length}</span> empresas
        </span>
        <span>
          <span className="text-foreground font-semibold">{contagem.novo}</span> na fila
        </span>
        <span>
          <span className="text-foreground font-semibold">{trabalhadas}</span> já
          trabalhadas
        </span>
        {/* Os dois números abaixo existem para a subtração não ser silenciosa:
            sem eles, "sumiram 14 empresas" e "o merge quebrou" seriam a mesma
            tela. É a mesma razão de `comCampanhaNaoReconhecida` na atribuição. */}
        {naoPerturbe > 0 ? (
          <span>
            <span className="text-foreground font-semibold">{naoPerturbe}</span> pediram
            para não receber
          </span>
        ) : null}
        {excluidos > 0 ? (
          <span>
            <span className="text-foreground font-semibold">{excluidos}</span> fora do
            perfil
          </span>
        ) : null}
      </div>

      <PrateleiraDeProspeccao prospects={prospects} />

      <p className="text-muted-foreground border-border/60 border-t pt-4 text-xs">
        <strong className="text-foreground">Nada é enviado automaticamente.</strong> O
        botão abre o WhatsApp com o texto pronto e quem aperta enviar é você — enviador
        automático é o que bane número, e o número aqui é o seu. Quem responder que não
        quer entra em <code>scripts/inteligencia/nao-perturbe.txt</code> e some desta
        lista. <strong className="text-foreground">Falei</strong> cria o contato no CRM com
        a mensagem na timeline: a partir daí o acompanhamento acontece no funil, com
        tarefa e prazo.
      </p>
    </div>
  )
}
