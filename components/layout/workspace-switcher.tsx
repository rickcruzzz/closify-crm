'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, ChevronsUpDown, Loader2, Plus, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { criarEmpresa, trocarEmpresa } from '@/lib/workspace/actions'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FREE_WORKSPACE_LIMIT } from '@/lib/plans'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type WorkspaceSummary = {
  id: string
  name: string
  plan: string
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: WorkspaceSummary[]
  /** Empresa em uso agora, resolvida no servidor a partir do cookie. */
  activeId: string
}) {
  const router = useRouter()
  const [enviando, setEnviando] = React.useState(false)
  const [atualizando, startTransition] = React.useTransition()
  const [navegando, startTransitionNavegacao] = React.useTransition()
  const trocando = enviando || atualizando
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0]

  /**
   * A escolha vai para o servidor, não para um estado local.
   *
   * Antes isto era `setActiveId(...)` e nada mais: o rótulo do seletor mudava
   * e os dados continuavam da outra empresa, porque cada página é um Server
   * Component e não enxerga estado de React. Quem foi convidado como
   * colaborador tendo empresa própria não conseguia abrir a empresa que o
   * convidou, o clique não fazia nada de verdade.
   *
   * `router.refresh()` não é um Promise que espera os dados novos, ele só
   * inicia a busca. Por isso vai dentro de `startTransition`: o spinner some
   * quando o React aplica o RSC payload novo, não quando o `refresh` é
   * disparado. Antes o spinner parava um instante depois do clique e a tela
   * mostrava a empresa antiga por ~1s, sem sinal nenhum de que algo mudou.
   */
  async function trocar(id: string) {
    if (id === activeId || trocando) return
    setEnviando(true)
    const resultado = await trocarEmpresa(id)
    setEnviando(false)
    if (resultado?.error) {
      toast.error(resultado.error)
      return
    }
    // `refresh` e não `push`: a pessoa continua na mesma tela, só que agora
    // preenchida com os dados da outra empresa.
    startTransition(() => {
      router.refresh()
    })
  }

  // Mesmo motivo do spinner de `trocar`: sem `useTransition` aqui, o clique
  // em "Nova empresa"/"upgrade" não mostra nada até a navegação terminar, e
  // Select/DropdownMenuItem não são `<a>`, então a barra de progresso global
  // (que só liga em clique de link) nunca cobre esses dois.
  // "Nova empresa" mandava para `/onboarding`, que redireciona de volta quem
  // já concluiu a configuração — o resultado era voltar para Resultados sem
  // criar nada. O assistente não serve para a segunda empresa: ele grava em
  // `onboarding_state`, uma linha por PESSOA, e refazê-lo apagaria as
  // respostas da primeira. Aqui o nome basta; o resto vai em Configurações.
  const [criandoEmpresa, setCriandoEmpresa] = React.useState(false)
  const [nomeNovaEmpresa, setNomeNovaEmpresa] = React.useState('')
  const [erroNovaEmpresa, setErroNovaEmpresa] = React.useState<string | null>(null)
  const [erroEDeLimite, setErroEDeLimite] = React.useState(false)
  const [salvandoEmpresa, setSalvandoEmpresa] = React.useState(false)

  async function confirmarNovaEmpresa() {
    setSalvandoEmpresa(true)
    setErroNovaEmpresa(null)
    setErroEDeLimite(false)
    const resultado = await criarEmpresa(nomeNovaEmpresa)
    setSalvandoEmpresa(false)

    if ('error' in resultado) {
      setErroNovaEmpresa(resultado.error)
      setErroEDeLimite(Boolean(resultado.limiteDoPlano))
      return
    }

    setCriandoEmpresa(false)
    setNomeNovaEmpresa('')
    // Entra na empresa recém-criada: criar e continuar na antiga faria a
    // pessoa achar que não funcionou.
    await trocarEmpresa(resultado.workspaceId)
    toast.success('Empresa criada.')
    // Cai em Configurações, que é onde ela vai preencher o resto — e não em
    // Resultados, que numa empresa recém-nascida só mostra zeros.
    router.push('/settings')
    router.refresh()
  }

  function navegarPara(destino: string) {
    startTransitionNavegacao(() => {
      router.push(destino)
    })
  }

  // Espelha `canAddWorkspace` no servidor: uma empresa Pro libera multi-empresa,
  // e quem já passou do limite antes da regra existir continua enxergando as
  // que criou, só não cria mais. Isto é conveniência de interface; quem
  // decide de verdade é a RPC no banco.
  const temPro = workspaces.some((w) => w.plan === 'pro')
  const podeCriarEmpresa = temPro || workspaces.length < FREE_WORKSPACE_LIMIT

  if (!active) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-muted flex w-full min-w-0 items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm transition-colors outline-none">
        <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
          <Building2 className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{active.name}</span>
          <span className="text-muted-foreground text-xs capitalize">{active.plan}</span>
        </div>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Suas empresas</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => void trocar(workspace.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              {workspace.id === activeId ? (
                <Check aria-hidden className="size-4 shrink-0" />
              ) : trocando ? (
                <Loader2 aria-hidden className="size-4 shrink-0 animate-spin opacity-0" />
              ) : (
                <span aria-hidden className="size-4 shrink-0" />
              )}
              <span className="truncate">{workspace.name}</span>
            </span>
            <Badge variant="secondary" className="shrink-0 capitalize">
              {workspace.plan}
            </Badge>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {/* No Free o limite é de uma empresa. Mostrar "Nova empresa" para quem
            não pode criar leva a pessoa a preencher o formulário inteiro e só
            então tomar o erro, melhor dizer o motivo aqui e mandar direto
            para a comparação de planos. */}
        {podeCriarEmpresa ? (
          <DropdownMenuItem
            className="gap-2"
            disabled={navegando}
            onClick={() => setCriandoEmpresa(true)}
          >
            {navegando ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Nova empresa
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="gap-2"
            disabled={navegando}
            onClick={() => navegarPara('/settings/billing')}
          >
            {navegando ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4" />
            )}
            <span className="flex flex-col">
              <span>Nova empresa</span>
              <span className="text-muted-foreground text-xs">
                Disponível no plano Pro
              </span>
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>

      <Dialog open={criandoEmpresa} onOpenChange={setCriandoEmpresa}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova empresa</DialogTitle>
            <DialogDescription>
              Uma empresa nova começa vazia e separada: contatos, funil e equipe
              próprios, sem nada em comum com esta.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void confirmarNovaEmpresa()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome-nova-empresa">Nome da empresa</Label>
              <Input
                id="nome-nova-empresa"
                autoFocus
                placeholder="Consultoria Aurora"
                value={nomeNovaEmpresa}
                disabled={salvandoEmpresa}
                aria-invalid={!!erroNovaEmpresa}
                onChange={(e) => setNomeNovaEmpresa(e.target.value)}
              />
              {erroNovaEmpresa && (
                <div role="alert" className="flex flex-col gap-2">
                  <p className="text-destructive text-xs">{erroNovaEmpresa}</p>
                  {/* Dizer "faça upgrade" sem mostrar onde deixa a pessoa num
                      beco: ela leu a frase e agora tem que descobrir sozinha o
                      que fazer. O caminho vai junto da recusa. */}
                  {erroEDeLimite && (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setCriandoEmpresa(false)
                        router.push('/settings/billing')
                      }}
                    >
                      <Zap className="size-4" />
                      Ver o plano Pro
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Muita gente abre esta caixa querendo outra coisa: colocar alguém
                para trabalhar JUNTO, no mesmo funil. São ações opostas, e a
                diferença só fica clara quando aparecem lado a lado. */}
            <p className="text-muted-foreground border-border border-t pt-3 text-xs">
              Quer que alguém trabalhe com você nesta empresa, vendo os mesmos
              contatos?{' '}
              <button
                type="button"
                className="text-foreground underline underline-offset-4 hover:no-underline"
                onClick={() => {
                  setCriandoEmpresa(false)
                  router.push('/settings?aba=equipe')
                }}
              >
                Convide um colaborador
              </button>
              .
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCriandoEmpresa(false)}
                disabled={salvandoEmpresa}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvandoEmpresa || nomeNovaEmpresa.trim().length < 2}>
                {salvandoEmpresa && <Loader2 className="size-4 animate-spin" />}
                Criar empresa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  )
}
