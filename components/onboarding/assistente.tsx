'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
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
import { AuthAlerta } from '@/components/auth/auth-alerta'
import {
  ETAPAS,
  MODELOS_DE_VENDA,
  SEGMENTOS,
  TAMANHOS_DE_EQUIPE,
  etapaAnterior,
  proximaEtapa,
} from '@/lib/validations/onboarding'
import {
  finalizarOnboarding,
  pularOnboarding,
  salvarPasso,
} from '@/lib/onboarding/actions'
import type { ModeloVenda, OnboardingEtapa, TamanhoEquipe } from '@/types/supabase'

export type RespostasSalvas = {
  nomeEmpresa?: string
  segmento?: string
  modeloVenda?: ModeloVenda
  tamanhoEquipe?: TamanhoEquipe
}

/** Só as 4 perguntas entram na barra de progresso; processar não é pergunta. */
const PERGUNTAS: OnboardingEtapa[] = ETAPAS.filter((e) => e !== 'processando')

export function AssistenteDeOnboarding({
  etapaInicial,
  respostasIniciais,
  atalhoPro = false,
}: {
  etapaInicial: OnboardingEtapa
  respostasIniciais: RespostasSalvas
  /**
   * Quem clicou "Assinar Pro" na landing já decidiu, as perguntas de
   * segmento/modelo de venda/tamanho de equipe são só personalização, não
   * bloqueio. Aqui elas saem do caminho: nome da empresa e direto pro
   * pagamento. Continuam disponíveis depois via checklist de ativação.
   */
  atalhoPro?: boolean
}) {
  const router = useRouter()
  const [etapa, setEtapa] = React.useState<OnboardingEtapa>(etapaInicial)
  const [respostas, setRespostas] = React.useState<RespostasSalvas>(respostasIniciais)
  const [ocupado, setOcupado] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  const perguntas = atalhoPro ? (['empresa'] as OnboardingEtapa[]) : PERGUNTAS
  const indice = perguntas.indexOf(etapa)
  const naProcessando = etapa === 'processando'

  /**
   * Avança gravando ANTES de mudar de tela.
   *
   * É o que faz a retomada existir: se a pessoa fechar o navegador entre um
   * passo e outro, o que ela respondeu já está no banco. Gravar depois de
   * navegar perderia a última resposta em toda saída inesperada.
   */
  async function avancar(campos: Partial<RespostasSalvas>) {
    const atualizadas = { ...respostas, ...campos }
    setRespostas(atualizadas)
    setErro(null)
    setOcupado(true)

    const resultado = await salvarPasso({ etapa, ...campos })

    if ('error' in resultado) {
      setErro(resultado.error ?? 'Não foi possível salvar. Tente novamente.')
      setOcupado(false)
      return
    }

    setOcupado(false)

    if (atalhoPro && etapa === 'empresa') {
      setEtapa('processando')
      return
    }

    const seguinte = proximaEtapa(etapa)
    if (seguinte) setEtapa(seguinte)
  }

  function voltar() {
    const anterior = etapaAnterior(etapa)
    if (anterior) {
      setErro(null)
      setEtapa(anterior)
    }
  }

  async function pular() {
    setOcupado(true)
    const resultado = await pularOnboarding()

    if ('error' in resultado) {
      toast.error(resultado.error)
      setOcupado(false)
      return
    }

    router.push('/dashboard')
  }

  // O processamento roda uma vez, quando a etapa vira `processando`. Sem a
  // guarda de `ocupado`, o React em modo estrito chamaria duas vezes, a RPC é
  // idempotente e aguentaria, mas gastaria duas escritas por nada.
  const jaProcessou = React.useRef(false)

  React.useEffect(() => {
    if (!naProcessando || jaProcessou.current) return
    jaProcessou.current = true

    void (async () => {
      const resultado = await finalizarOnboarding({
        nomeEmpresa: respostas.nomeEmpresa ?? '',
        segmento: respostas.segmento,
        modeloVenda: respostas.modeloVenda,
        tamanhoEquipe: respostas.tamanhoEquipe,
      })

      if ('error' in resultado) {
        // Convite pendente: a pessoa não devia estar criando empresa nenhuma.
        if (resultado.error === 'convite_pendente' && 'destino' in resultado) {
          router.push(resultado.destino as string)
          return
        }

        setErro(resultado.error ?? 'Não foi possível concluir a configuração.')
        // Volta para a última pergunta em vez de travar na tela de
        // processamento: assim a pessoa vê o que respondeu e tenta de novo,
        // sem perder nada. `jaProcessou` reabre para a nova tentativa.
        jaProcessou.current = false
        setEtapa(atalhoPro ? 'empresa' : 'equipe')
        return
      }

      // Sem `?tour=1`: o tour abre pelo estado, não por parâmetro de URL.
      // `destino` já resolve pro checkout quando a pessoa veio querendo o Pro.
      router.push('destino' in resultado ? resultado.destino : '/dashboard')
    })()
  }, [naProcessando, respostas, router, atalhoPro])

  return (
    <Card>
      <CardHeader>
        {!naProcessando && (
          <div className="mb-3 flex flex-col gap-2">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>
                Passo {indice + 1} de {perguntas.length}
              </span>
              <span>{atalhoPro ? 'menos de 1 minuto' : 'cerca de 2 minutos'}</span>
            </div>
            {/* Barra segmentada em vez de percentual: a pessoa vê quantas
                perguntas faltam, que é a informação que ela quer. */}
            <div className="flex gap-1" aria-hidden>
              {perguntas.map((p, i) => (
                <span
                  key={p}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    i <= indice ? 'bg-primary' : 'bg-muted',
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* `h1` aqui e não só o `CardTitle`: esta é a página inteira, e página
            sem cabeçalho de nível 1 deixa o leitor de tela sem ponto de
            entrada. O mesmo vale para as outras sete telas do fluxo, onde o
            `AuthCabecalho` cuida disso — aqui não dá para usá-lo porque o
            header carrega a barra de progresso antes do título, e encaixar
            isso numa prop tornaria o componente pior para os oito casos. */}
        <CardTitle className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-2 text-xl">
          <h1>{TITULOS[etapa]}</h1>
        </CardTitle>
        <CardDescription className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-3">
          {SUBTITULOS[etapa]}
        </CardDescription>
      </CardHeader>

      <CardContent className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-4 flex flex-col gap-4">
        {erro && <AuthAlerta>{erro}</AuthAlerta>}

        {etapa === 'empresa' && (
          <PassoEmpresa
            valorInicial={respostas.nomeEmpresa ?? ''}
            ocupado={ocupado}
            onAvancar={(nomeEmpresa) => avancar({ nomeEmpresa })}
          />
        )}

        {etapa === 'segmento' && (
          <PassoDeEscolha
            opcoes={SEGMENTOS.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))}
            selecionado={respostas.segmento}
            ocupado={ocupado}
            colunas={2}
            onEscolher={(segmento) => avancar({ segmento })}
          />
        )}

        {etapa === 'venda' && (
          <PassoDeEscolha
            opcoes={MODELOS_DE_VENDA.map((m) => ({
              valor: m.valor,
              rotulo: m.rotulo,
              ajuda: m.ajuda,
            }))}
            selecionado={respostas.modeloVenda}
            ocupado={ocupado}
            colunas={1}
            onEscolher={(v) => avancar({ modeloVenda: v as ModeloVenda })}
          />
        )}

        {etapa === 'equipe' && (
          <PassoDeEscolha
            opcoes={TAMANHOS_DE_EQUIPE.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
            selecionado={respostas.tamanhoEquipe}
            ocupado={ocupado}
            colunas={2}
            onEscolher={(v) => avancar({ tamanhoEquipe: v as TamanhoEquipe })}
          />
        )}

        {naProcessando && <Processando />}

        {!naProcessando && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={ocupado || indice === 0}
              onClick={voltar}
              className={cn(indice === 0 && 'invisible')}
            >
              <ArrowLeft className="size-4" />
              Voltar
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={ocupado}
              onClick={pular}
            >
              Pular por enquanto
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const TITULOS: Record<OnboardingEtapa, string> = {
  empresa: 'Qual é o nome da sua empresa?',
  segmento: 'Qual é o segmento dela?',
  venda: 'Como sua empresa vende?',
  equipe: 'Quantas pessoas trabalham na sua empresa hoje?',
  processando: 'Preparando seu Velo Funil…',
}

const SUBTITULOS: Record<OnboardingEtapa, string> = {
  empresa: 'É o nome que aparece no topo do sistema e nos convites da equipe.',
  segmento: 'Usamos para deixar os exemplos e os textos com a sua cara.',
  venda: 'Ajuda a entender o que é uma oportunidade no seu negócio.',
  // Antes perguntava "quantas pessoas vão usar o Velo Funil", que soa como
  // promessa de vaga, e o Free trava em 2 pessoas de verdade
  // (accept_workspace_invite). Quem respondia "6 a 20" só descobria o teto
  // semanas depois, ao tentar convidar a 3ª pessoa, sem ligação nenhuma com
  // o que respondeu aqui. Isto é só perfil do negócio; o aviso do teto
  // fecha essa lacuna de expectativa antes dela virar surpresa.
  equipe:
    'É só pra personalizar sua experiência. No plano grátis, até 2 pessoas usam o sistema ao mesmo tempo, dá pra ampliar no Pro quando precisar.',
  processando: 'Leva alguns segundos.',
}

function PassoEmpresa({
  valorInicial,
  ocupado,
  onAvancar,
}: {
  valorInicial: string
  ocupado: boolean
  onAvancar: (nome: string) => void
}) {
  const [valor, setValor] = React.useState(valorInicial)
  const curto = valor.trim().length < 2

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!curto) onAvancar(valor.trim())
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nomeEmpresa">Nome da empresa</Label>
        <Input
          id="nomeEmpresa"
          autoFocus
          autoComplete="organization"
          placeholder="Ex: Agência Nova Era"
          value={valor}
          maxLength={80}
          disabled={ocupado}
          onChange={(e) => setValor(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={ocupado || curto}>
        {ocupado && <Loader2 className="size-4 animate-spin" />}
        Continuar
        <ArrowRight className="size-4" />
      </Button>
    </form>
  )
}

/**
 * Escolha única que avança no clique, sem botão de confirmar.
 *
 * Um passo com uma pergunta e um "Continuar" obriga dois cliques para uma
 * decisão só. Clicar É a resposta.
 */
function PassoDeEscolha({
  opcoes,
  selecionado,
  ocupado,
  colunas,
  onEscolher,
}: {
  opcoes: { valor: string; rotulo: string; ajuda?: string }[]
  selecionado: string | undefined
  ocupado: boolean
  colunas: 1 | 2
  onEscolher: (valor: string) => void
}) {
  return (
    <div
      role="group"
      className={cn('grid gap-2', colunas === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}
    >
      {opcoes.map((opcao) => {
        const ativo = selecionado === opcao.valor

        return (
          <button
            key={opcao.valor}
            type="button"
            disabled={ocupado}
            aria-pressed={ativo}
            onClick={() => onEscolher(opcao.valor)}
            className={cn(
              'focus-visible:ring-ring/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors outline-none',
              'hover:bg-accent/50 focus-visible:ring-3 disabled:opacity-50',
              ativo ? 'border-primary bg-primary/5' : 'border-input',
            )}
          >
            <span className="flex flex-col">
              <span className="font-medium">{opcao.rotulo}</span>
              {opcao.ajuda && (
                <span className="text-muted-foreground text-xs">{opcao.ajuda}</span>
              )}
            </span>
            {ativo && <Check className="text-primary size-4 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A etapa de processamento mostra trabalho real e some sozinha.
 *
 * Sem espera artificial: se a RPC responder em 300 ms, a tela passa em 300 ms.
 * Barra de progresso fingida é o tipo de coisa que denuncia um produto na
 * segunda vez que a pessoa a vê.
 */
function Processando() {
  const passos = [
    'Configurando sua empresa',
    'Preparando seu pipeline',
    'Personalizando seu ambiente',
  ]

  return (
    <ul className="flex flex-col gap-2.5 py-2" aria-live="polite">
      {passos.map((passo) => (
        <li key={passo} className="text-muted-foreground flex items-center gap-2.5 text-sm">
          <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
          {passo}
        </li>
      ))}
    </ul>
  )
}
