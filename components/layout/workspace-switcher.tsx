'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, ChevronsUpDown, Loader2, Plus, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { criarEmpresa, trocarEmpresa } from '@/lib/workspace/actions'

import { ConfirmarExclusao } from '@/components/comum/confirmar-exclusao'
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
import type { DecisaoDeNovaEmpresa } from '@/lib/plans/multi-empresa'
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
  novaEmpresa,
}: {
  workspaces: WorkspaceSummary[]
  /** Empresa em uso agora, resolvida no servidor a partir do cookie. */
  activeId: string
  /**
   * Se esta pessoa pode criar outra empresa, decidido no SERVIDOR.
   *
   * Chega pronto de propósito. A versão anterior deduzia aqui, de
   * `workspaces.some((w) => w.plan === 'pro')` — lendo a COLUNA, que a
   * doutrina da 0027 proíbe para regra de plano. E o caso que mais doía nem
   * era coluna velha: durante o trial ela vale `'pro'` de verdade, enquanto a
   * trigger da 0053 exige `pro_vigente and not em_trial`. Medido em produção
   * em 27/08/2026, com 4 empresas nesse estado: a pessoa via "Nova empresa",
   * digitava o nome, enviava, e o banco recusava.
   */
  novaEmpresa: DecisaoDeNovaEmpresa
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
  /**
   * Qual empresa esta sendo aberta agora.
   *
   * Sem isto o spinner nao tem onde morar: `trocando` e um booleano, e um
   * booleano so consegue dizer "alguma coisa esta acontecendo" — nao em qual
   * das linhas. Era por isso que o `Loader2` da lista nascia `opacity-0`.
   */
  const [idEmTroca, setIdEmTroca] = React.useState<string | null>(null)

  /**
   * A empresa que a pessoa clicou e ainda nao confirmou.
   *
   * ## Por que confirmar, contra o que o mercado faz
   *
   * Slack, Notion e Linear trocam de espaco sem perguntar — e o argumento
   * deles e bom: a troca se desfaz com outro clique.
   *
   * Aqui a decisao foi outra, pedida pelo dono. E ela tem base no proprio
   * produto: neste CRM as empresas nao sao espacos de trabalho intercambiaveis,
   * sao CARTEIRAS DE CLIENTE separadas. Escrever um contato, mover um negocio
   * ou mandar mensagem na empresa errada nao se desfaz com um clique de volta —
   * o dado ficou no lugar errado, e so se descobre depois.
   */
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = React.useState<{
    id: string
    nome: string
  } | null>(null)

  async function trocar(id: string) {
    if (id === activeId || trocando) return
    setIdEmTroca(id)
    setEnviando(true)
    const resultado = await trocarEmpresa(id)
    setEnviando(false)
    if (resultado?.error) setIdEmTroca(null)
    if (resultado?.error) {
      toast.error(resultado.error)
      return
    }
    // ## O aviso, em vez de um dialogo de confirmacao
    //
    // Slack, Notion e Linear trocam de espaco sem perguntar nada, e o motivo
    // e solido: trocar de empresa se desfaz com outro clique. Confirmacao
    // existe para o que nao volta — a regra que `anuncio-actions.ts` ja
    // escreve: "se o pior caso de um clique errado for 'desfaco agora',
    // entra".
    //
    // O que faltava nao era permissao, era CONFIRMACAO DO FATO: a tela toda
    // troca de dados de uma vez, e sem uma frase dizendo onde voce esta o
    // efeito e o de ter aberto outro sistema.
    const destino = workspaces.find((w) => w.id === id)
    if (destino) toast.success(`Você está em ${destino.name}`)

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

  // A decisão vem pronta do servidor (`decidirNovaEmpresa`, no layout), que a
  // calcula com `pro_vigente`/`em_trial` — as mesmas funções da trigger. Isto
  // continua sendo conveniência de interface; quem decide de verdade é a RPC
  // no banco. O que mudou é que agora os dois concordam.
  const podeCriarEmpresa = novaEmpresa.pode

  if (!active) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="hover:bg-muted flex w-full min-w-0 items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm transition-colors outline-none">
          <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
            <Building2 className="size-4" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{active.name}</span>
            <span className="text-muted-foreground text-xs capitalize">
              {active.plan}
            </span>
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
              onClick={() => {
                if (workspace.id === activeId) return
                setAguardandoConfirmacao({ id: workspace.id, nome: workspace.name })
              }}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                {/* ## O spinner nasce na linha CLICADA
                  Ele existia e era `opacity-0` — um placeholder de
                  alinhamento, nao um sinal. Clicar nao mostrava nada ate a
                  tela recarregar, e trocar de empresa custa uma ida ao
                  servidor mais um `router.refresh()`.
                  As outras linhas mantem o espaco reservado, senao a lista
                  inteira se desloca no instante do clique. */}
                {workspace.id === activeId && !trocando ? (
                  <Check aria-hidden className="size-4 shrink-0" />
                ) : workspace.id === idEmTroca ? (
                  <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
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
          {/* ## Por que ha mais empresa do que o plano permite
            O limite de uma empresa no Free chegou depois, e quem ja tinha
            manteve as suas — a mesma decisao da 0057, que preservou o prazo
            das 10 empresas em avaliacao quando o trial acabou. Cortar o que
            alguem ja usava seria quebrar contrato.
            Sem esta linha a tela se contradiz: lista tres empresas com selo
            `Free` e, logo abaixo, diz que empresa nova exige Pro. */}
          {!podeCriarEmpresa && workspaces.length > 1 && (
            <p className="text-muted-foreground px-2 py-1.5 text-xs text-pretty">
              Criadas antes do limite de uma empresa no Free. Você mantém todas.
            </p>
          )}
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
                  {novaEmpresa.motivo}
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
                Quer que alguém trabalhe com você nesta empresa, vendo os mesmos contatos?{' '}
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
                <Button
                  type="submit"
                  disabled={salvandoEmpresa || nomeNovaEmpresa.trim().length < 2}
                >
                  {salvandoEmpresa && <Loader2 className="size-4 animate-spin" />}
                  Criar empresa
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DropdownMenu>

      {/* ## O dialogo reusa `ConfirmarExclusao`, e o nome dele mente um pouco
          Ele nao e "de exclusao", e o dialogo de acao consequente deste
          projeto: `AlertDialog` por baixo, que prende o foco e NAO fecha ao
          clicar fora — as duas coisas que um `Dialog` comum faria e que
          transformariam a confirmacao em obstaculo que se pula sem ler.
          Reusa-lo evita uma segunda copia do mesmo comportamento, que
          divergiria na primeira manutencao. */}
      <ConfirmarExclusao
        open={aguardandoConfirmacao !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setAguardandoConfirmacao(null)
        }}
        titulo="Trocar de empresa?"
        descricao={
          <>
            {/* A explicacao do que e uma empresa saiu daqui: quem tem mais de
                uma ja sabe que os dados sao separados, e a frase so afastava do
                unico dado que importa no momento — para onde voce vai. */}
            Você vai para <strong>{aguardandoConfirmacao?.nome}</strong>.
          </>
        }
        rotuloDaAcao="Trocar"
        pendente={trocando}
        onConfirmar={() => {
          const alvo = aguardandoConfirmacao
          if (!alvo) return
          setAguardandoConfirmacao(null)
          void trocar(alvo.id)
        }}
      />
    </>
  )
}
