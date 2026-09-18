'use client'

import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cadastrarNaReserva } from '@/lib/whatsapp/reserva-actions'
import type { LinhaDaReserva } from '@/lib/whatsapp/reserva'

/**
 * A reserva de instâncias, na Central do Dono.
 *
 * ## Por que esta tela existe, e a regra é do dono
 *
 * *"Tudo tem que ser de igual pra igual pra qualquer pagante."*
 *
 * Sem reserva, quem paga o Max dispara um e-mail e espera uma pessoa acordar.
 * Com ela, clica e recebe o QR, igual a quem conectaria pelo Partner. A
 * diferença entre os dois caminhos sai da tela do cliente e passa a aparecer só
 * na fatura.
 *
 * ## Por que na Central, e não em Configurações
 *
 * `app/(dono)/` devolve 404 fora de `localhost`. A tabela guarda **token de
 * instância**, que é credencial: quem o tivesse mandaria mensagem em nome de um
 * número de cliente. Nenhum usuário do produto tem o que fazer aqui, nem o
 * admin da própria empresa.
 */
export function ReservaDeInstancias({
  linhas,
  livres,
}: {
  linhas: LinhaDaReserva[]
  /** `-1` quer dizer que a contagem falhou, e não que a reserva está vazia. */
  livres: number
}) {
  const [instanceId, setInstanceId] = React.useState('')
  const [token, setToken] = React.useState('')
  const [observacao, setObservacao] = React.useState('')
  const [salvando, setSalvando] = React.useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const r = await cadastrarNaReserva({ instanceId, token, observacao })
      if (!r.ok) {
        toast.error(r.error ?? 'Não foi possível guardar.')
        return
      }
      toast.success('Instância guardada na reserva.')
      setInstanceId('')
      setToken('')
      setObservacao('')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Reserva de WhatsApp</CardTitle>
          <CardDescription>
            {/* O número vem primeiro porque é o que decide se há trabalho a
                fazer. Zero livre com cliente esperando é a única situação em
                que esta tela é urgente. */}
            {livres < 0
              ? 'Não foi possível contar a reserva agora.'
              : livres === 0
                ? 'Nenhuma instância livre. O próximo cliente que assinar o Max vai esperar.'
                : `${livres} instância${livres === 1 ? '' : 's'} livre${livres === 1 ? '' : 's'}, prontas para o próximo cliente.`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={salvar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reserva-id">ID da instância</Label>
              <Input
                id="reserva-id"
                value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)}
                placeholder="3F95055E59F461E9B0CCB6C91C51ECC2"
                autoComplete="off"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reserva-token">Token da instância</Label>
              {/* `type="password"`: a Central abre na sua máquina, e o risco
                  real aqui não é rede, é alguém olhando a tela ao lado. */}
              <Input
                id="reserva-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reserva-obs">Anotação (opcional)</Label>
              <Input
                id="reserva-obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="comprada em 18/09, fatura de outubro"
                autoComplete="off"
              />
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              As credenciais são conferidas com a Z-API antes de guardar. Um token errado
              falha aqui, e não na cara do cliente que clicar em Conectar.
            </p>

            <div>
              <Button type="submit" disabled={salvando || !instanceId || !token}>
                {salvando ? 'Conferindo com a Z-API...' : 'Guardar na reserva'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>O que foi comprado</CardTitle>
          <CardDescription>
            {/* A linha FICA depois de entregue, e a tela mostra para quem foi:
                a fatura do provedor chega com várias linhas e alguém precisa
                explicar cada uma. */}
            A linha continua aqui depois de entregue. É ela que explica cada
            cobrança quando a fatura chegar.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {linhas.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nada comprado ainda. Crie uma instância no painel da Z-API e cadastre acima.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr>
                    <th className="pb-2 font-medium">Instância</th>
                    <th className="pb-2 font-medium">Anotação</th>
                    <th className="pb-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className="border-border/60 border-t">
                      <td className="py-2 font-mono text-xs">
                        {/* Só o começo do id: a tabela existe para você
                            reconhecer a linha, e o id inteiro na tela é
                            credencial parcial exposta sem motivo. */}
                        {l.instanceId.slice(0, 10)}…
                      </td>
                      <td className="text-muted-foreground py-2">{l.observacao ?? 'sem anotação'}</td>
                      <td className="py-2">
                        {l.usadaEm ? (
                          <span className="text-muted-foreground">
                            entregue a <strong className="text-foreground">{l.entregueA}</strong>
                          </span>
                        ) : (
                          <span className="text-[#25D366]">livre</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
