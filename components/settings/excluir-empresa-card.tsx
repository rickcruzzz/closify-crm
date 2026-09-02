'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { excluirEmpresa } from '@/lib/workspace/actions'
import { ConfirmarExclusao } from '@/components/comum/confirmar-exclusao'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Excluir a empresa, de dentro do produto.
 *
 * ## Por que digitar o nome, e não só clicar "confirmar"
 *
 * Um diálogo de "tem certeza?" é respondido no reflexo — quem chegou até ali
 * já decidiu clicar, e o botão vira mais um passo, não uma barreira. Digitar o
 * nome obriga a ler qual empresa está prestes a sumir, que é exatamente a
 * pergunta que erra quem tem várias.
 *
 * É o mesmo padrão de `excluirConta` e do `apagarEmpresa` da Central. E a
 * conferência acontece **no servidor**, dentro da RPC (0064): a daqui só evita
 * uma ida perdida, e conferência que mora no cliente é sugestão.
 *
 * ## Por que este card não checa nada
 *
 * Criador, empresa única e assinatura viva são decididos pela RPC, que lança
 * mensagem própria — e o botão repassa. Duplicar as regras aqui criaria uma
 * segunda cópia que divergiria da primeira, e a que diverge em silêncio é
 * sempre a escrita depois.
 */
export function ExcluirEmpresaCard({ nomeDaEmpresa, workspaceId }: {
  nomeDaEmpresa: string
  workspaceId: string
}) {
  const [aberto, setAberto] = React.useState(false)
  const [nomeDigitado, setNomeDigitado] = React.useState('')
  const [excluindo, setExcluindo] = React.useState(false)

  const confere = nomeDigitado.trim() === nomeDaEmpresa.trim()

  async function excluir() {
    setExcluindo(true)
    const r = await excluirEmpresa(workspaceId, nomeDigitado)
    setExcluindo(false)

    if (r?.error) {
      // A mensagem vem da RPC e diz o motivo E o caminho ("Cancele a
      // assinatura...", "Para sair de vez, exclua a conta em Perfil").
      // Duração maior porque são frases, não avisos de um segundo.
      toast.error(r.error, { duration: 8000 })
      return
    }

    setAberto(false)
    toast.success(`A empresa ${nomeDaEmpresa} foi excluída.`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-destructive text-base">Excluir esta empresa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm text-pretty">
          Apaga <strong className="text-foreground">{nomeDaEmpresa}</strong> com todos os
          contatos, negócios, tarefas e histórico dela. Não tem como desfazer, e as outras
          empresas da sua conta não são afetadas.
        </p>

        <div>
          <Button variant="destructive" onClick={() => setAberto(true)}>
            Excluir empresa
          </Button>
        </div>

        <ConfirmarExclusao
          open={aberto}
          onOpenChange={(v) => {
            setAberto(v)
            if (!v) setNomeDigitado('')
          }}
          titulo={`Excluir ${nomeDaEmpresa}?`}
          descricao={
            <div className="flex flex-col gap-3">
              <span>
                Todos os contatos, negócios, tarefas e histórico desta empresa serão
                apagados. Não tem como desfazer.
              </span>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmar-nome-da-empresa">
                  Digite <strong>{nomeDaEmpresa}</strong> para confirmar
                </Label>
                <Input
                  id="confirmar-nome-da-empresa"
                  value={nomeDigitado}
                  onChange={(e) => setNomeDigitado(e.target.value)}
                  autoComplete="off"
                  placeholder={nomeDaEmpresa}
                />
              </div>
            </div>
          }
          rotuloDaAcao={excluindo ? 'Excluindo…' : 'Excluir empresa'}
          pendente={excluindo || !confere}
          onConfirmar={() => void excluir()}
        />

        {excluindo && (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 aria-hidden className="size-3 animate-spin" />
            Apagando os dados desta empresa…
          </p>
        )}
      </CardContent>
    </Card>
  )
}
