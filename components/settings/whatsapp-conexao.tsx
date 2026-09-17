'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, MessageCircle, Plug, RefreshCw, Trash2, Unplug, Zap } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  adotarInstancia,
  conectarWhatsapp,
  desconectarWhatsapp,
  lerQrCode,
  removerWhatsapp,
} from '@/lib/whatsapp/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EstadoDaConexao, MotivoDoBloqueio } from '@/lib/plans/max'
import { MAX_PLAN_PRICE, PLANO_NA_TELA } from '@/lib/plans'

/**
 * Conectar o WhatsApp da empresa, e ver quando ele cai.
 *
 * ## O polling é controlado, e o motivo não é custo
 *
 * O QR da Z-API expira em segundos, então a tela precisa buscar de novo. O que
 * ela NÃO pode fazer é buscar para sempre: uma aba esquecida aberta na sexta
 * bateria no provedor o fim de semana inteiro, e quem paga a conta de
 * requisição é o produto.
 *
 * Doze tentativas a cada cinco segundos dão um minuto, que é tempo de sobra
 * para pegar o celular e ler um código. Depois disso a tela PARA e oferece
 * "Gerar novo QR Code" — decisão da pessoa, não do laço.
 *
 * ## O intervalo é limpo em toda saída
 *
 * `useEffect` com `clearInterval` no retorno. Sem isso, trocar de aba do
 * produto deixaria o laço rodando contra um componente desmontado: o React
 * avisa no console e o pedido continua saindo.
 */

const INTERVALO_MS = 5_000
const TENTATIVAS = 12

type Bloqueio = { tipo: MotivoDoBloqueio; motivo: string }

export function WhatsappConexao({
  estado,
  telefone,
  ultimoErro,
  conectadaEm,
  ehAdmin,
  temMax,
  bloqueio,
  automatico,
}: {
  estado: EstadoDaConexao
  telefone: string | null
  ultimoErro: string | null
  conectadaEm: string | null
  ehAdmin: boolean
  temMax: boolean
  bloqueio: Bloqueio | null
  /**
   * O produto cria a instância sozinho, ou o dono cria à mão?
   *
   * Vem do servidor porque depende de `ZAPI_PARTNER_TOKEN`, que o navegador não
   * vê. Ela muda só o TEXTO e o que acontece depois do clique: o gate de plano,
   * o QR, o estado e a remoção são idênticos nos dois modos.
   */
  automatico: boolean
}) {
  const router = useRouter()
  const [qr, setQr] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const [buscando, setBuscando] = React.useState(false)
  const [tentativas, setTentativas] = React.useState(0)
  const [expirou, setExpirou] = React.useState(false)
  const [urlsParaColar, setUrlsParaColar] = React.useState<string[] | null>(null)
  const [pedido, setPedido] = React.useState(false)

  const pararBusca = React.useCallback(() => {
    setBuscando(false)
    setTentativas(0)
  }, [])

  // O laço. `buscando` liga e desliga; `tentativas` conta e é o que dá o teto.
  React.useEffect(() => {
    if (!buscando) return

    const id = setInterval(async () => {
      const r = await lerQrCode()

      if (!r.ok) {
        // Falha de leitura NÃO para o laço: o provedor pode ter engasgado num
        // giro e responder no seguinte. O teto de tentativas continua valendo,
        // então isto não vira laço infinito.
        setTentativas((n) => n + 1)
        return
      }

      if (r.estado === 'conectado') {
        setQr(null)
        pararBusca()
        toast.success('WhatsApp conectado.')
        // `refresh` e não estado local: o número conectado e a data vêm do
        // servidor, e montá-los aqui criaria uma segunda verdade.
        router.refresh()
        return
      }

      setQr(r.qr)
      setTentativas((n) => n + 1)
    }, INTERVALO_MS)

    return () => clearInterval(id)
  }, [buscando, pararBusca, router])

  // O teto, separado do laço de propósito: misturar os dois faria o
  // `clearInterval` depender da contagem e o intervalo ser recriado a cada giro.
  React.useEffect(() => {
    if (buscando && tentativas >= TENTATIVAS) {
      pararBusca()
      setExpirou(true)
    }
  }, [buscando, tentativas, pararBusca])

  async function conectar() {
    setOcupado(true)
    setExpirou(false)
    const r = await conectarWhatsapp()
    setOcupado(false)

    if (!r.ok) {
      toast.error(r.error)
      return
    }

    // ## `preparando` e o modo manual respondendo, e ele NAO liga o laco
    //
    // Nao existe QR para buscar: ninguem criou instancia. Ligar o polling aqui
    // bateria no provedor doze vezes por nada e terminaria em "o QR expirou",
    // que e a mesma mentira por outro caminho.
    if (r.estado === 'preparando') {
      setPedido(true)
      toast.success('Pedido recebido. Avisamos assim que o número estiver pronto.')
      return
    }

    setQr(r.qr)
    if (r.estado === 'conectado') {
      router.refresh()
      return
    }
    setTentativas(0)
    setBuscando(true)
  }

  async function desconectar() {
    setOcupado(true)
    const r = await desconectarWhatsapp()
    setOcupado(false)
    pararBusca()
    if (!r.ok) {
      toast.error(r.error ?? 'Não foi possível desconectar.')
      return
    }
    toast.success('WhatsApp desconectado. As conversas continuam aqui.')
    router.refresh()
  }

  async function remover() {
    setOcupado(true)
    const r = await removerWhatsapp()
    setOcupado(false)
    pararBusca()
    if (!r.ok) {
      toast.error(r.error ?? 'Não foi possível remover.')
      return
    }
    // A Z-API mantem a instancia ativa ate o fim do ciclo, que e o ultimo dia
    // do mes. Dizer "removida" e ponto faria a pessoa achar que o numero caiu
    // agora, e ela tentaria reconectar por nada.
    toast.success(
      automatico
        ? 'Conexão removida. O número segue ativo até o fim do mês e a cobrança para.'
        : 'Conexão removida. As conversas continuam aqui.',
    )
    router.refresh()
  }

  // ## Quem não tem o plano vê o argumento, e um caminho
  //
  // A frase vem do servidor, pronta. A tela só decide o BOTÃO: `exige_max`
  // manda para a comparação de planos, `max_vencido` manda para o pagamento.
  // São telas diferentes porque as duas pessoas estão em momentos diferentes.
  if (bloqueio && (bloqueio.tipo === 'exige_max' || bloqueio.tipo === 'max_vencido')) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="text-muted-foreground size-5" />
            <CardTitle>WhatsApp no {PLANO_NA_TELA.max}</CardTitle>
          </div>
          <CardDescription>{bloqueio.motivo}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
            <li>Cada mensagem cai na conversa do contato, com o negócio dele do lado.</li>
            <li>O que você responde pelo celular aparece aqui também.</li>
            <li>Quem espera há mais tempo fica no topo da lista.</li>
            <li>Um número por empresa, conectado por QR Code em um minuto.</li>
          </ul>

          {ehAdmin ? (
            <Link
              href={
                bloqueio.tipo === 'max_vencido'
                  ? '/settings/billing?pagar=1'
                  : '/settings/billing#comparar'
              }
              className={buttonVariants({ size: 'sm', className: 'w-fit' })}
            >
              <Zap className="size-4" />
              {bloqueio.tipo === 'max_vencido'
                ? 'Reativar o plano'
                : `Conhecer o ${PLANO_NA_TELA.max}, R$ ${MAX_PLAN_PRICE} por mês`}
            </Link>
          ) : (
            // Membro não mexe em cobrança, e mandá-lo para uma tela que vai
            // recusar é a viagem inútil que `integration-card` já documenta.
            <p className="text-muted-foreground text-xs">
              Peça a um administrador da empresa para assinar o plano{' '}
              {PLANO_NA_TELA.max}.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-muted-foreground size-5" />
            <CardTitle>Conexão</CardTitle>
          </div>
          <Selo estado={estado} />
        </div>
        <CardDescription>
          {estado === 'conectado' && telefone
            ? `Conectado no número +${telefone}.`
            : 'Leia o QR Code com o WhatsApp da empresa, como se fosse o WhatsApp Web.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {ultimoErro && estado !== 'conectado' ? (
          <p className="text-muted-foreground border-border/60 rounded-lg border p-3 text-xs">
            O provedor informou: {ultimoErro}
          </p>
        ) : null}

        {qr ? (
          <div className="flex flex-col items-start gap-3">
            {/* `next/image` não serve: o QR é um base64 que muda a cada cinco
                segundos, e otimizar uma imagem descartável seria pagar uma
                requisição de otimização por giro do laço. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
              alt="QR Code para conectar o WhatsApp"
              className="size-64 rounded-lg border bg-white p-2"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              No celular: WhatsApp, Aparelhos conectados, Conectar um aparelho.
            </p>
          </div>
        ) : null}

        {expirou ? (
          <p className="text-muted-foreground text-xs">
            O QR Code expirou sem ser lido. Gere um novo quando estiver com o celular
            na mão.
          </p>
        ) : null}

        {/* ## A espera HONESTA, no lugar de um botao que mentia
            Sem Partner o numero e preparado a mao, e isso leva minutos. A
            versao anterior chamava a API, tomava erro e dizia "tente de novo em
            alguns minutos" — mentira nas duas metades, para quem acabou de
            pagar R$ 250. */}
        {pedido ? (
          <p className="text-muted-foreground border-border/60 rounded-lg border p-3 text-xs leading-relaxed">
            Estamos preparando o número da sua empresa. Assim que ele estiver pronto,
            esta tela mostra o QR Code para você ler no celular. Costuma levar alguns
            minutos em horário comercial.
          </p>
        ) : !automatico && estado === 'ausente' && ehAdmin && temMax ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Seu número é preparado por nós, um a um. Peça aqui e avisamos quando o QR
            Code estiver pronto.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {!ehAdmin ? (
            <p className="text-muted-foreground text-xs">
              Apenas administradores conectam ou desconectam o WhatsApp.
            </p>
          ) : estado === 'conectado' ? (
            <>
              <Button variant="outline" size="sm" onClick={desconectar} disabled={ocupado}>
                {ocupado ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Unplug className="size-4" />
                )}
                Desconectar
              </Button>
              {/* Remover PARA a cobrança; desconectar não. São dois botões de
                  propósito: têm o mesmo nome na cabeça de quem clica e
                  consequências muito diferentes na fatura.

                  E remover não desliga o número na hora: o provedor mantém a
                  instância até o fim do ciclo. Está no toast, porque quem não
                  lê isso tenta reconectar achando que quebrou. */}
              <Button variant="ghost" size="sm" onClick={remover} disabled={ocupado}>
                <Trash2 className="size-4" />
                Remover conexão
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={conectar}
                disabled={ocupado || buscando || pedido}
              >
                {ocupado || buscando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : expirou ? (
                  <RefreshCw className="size-4" />
                ) : (
                  <Plug className="size-4" />
                )}
                {pedido
                  ? 'Pedido enviado'
                  : expirou
                    ? 'Gerar novo QR Code'
                    : automatico
                      ? 'Conectar WhatsApp'
                      : 'Pedir meu número'}
              </Button>
              {estado !== 'ausente' && temMax ? (
                <Button variant="ghost" size="sm" onClick={remover} disabled={ocupado}>
                  <Trash2 className="size-4" />
                  Remover conexão
                </Button>
              ) : null}
            </>
          )}
        </div>

        {conectadaEm && estado === 'conectado' ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Número novo manda devagar nos primeiros dias, de propósito: é o que
            protege o WhatsApp da sua empresa de ser bloqueado.
          </p>
        ) : null}

        {urlsParaColar ? (
          <div className="border-border/60 flex flex-col gap-2 rounded-lg border p-3">
            <span className="text-sm font-medium">Falta apontar os webhooks</span>
            {/* A configuração automática NÃO foi confirmada, e dizer isso é o
                ponto. Webhook que não aponta produz o pior sintoma daqui:
                silêncio, com a tela dizendo conectado. É a lição do 201 do
                `sendButtons`, que aceitou quatro vezes sem entregar nada. */}
            <p className="text-muted-foreground text-xs leading-relaxed">
              Cole estas três URLs nos webhooks da instância, no painel da Z-API. Sem
              elas a conexão fica de pé e nenhuma mensagem chega aqui.
            </p>
            {urlsParaColar.map((u) => (
              <code
                key={u}
                className="bg-muted overflow-x-auto rounded px-2 py-1 text-[11px] break-all"
              >
                {u}
              </code>
            ))}
          </div>
        ) : null}

        {/* ## O caminho manual, e ele NÃO é o caminho do cliente
            `conectarWhatsapp` cria a instância por API e o cliente nunca vê
            credencial. Ele depende do Partner token, cuja condição comercial
            começa em dez instâncias. Este bloco existe para o DONO provar o
            produto com o trial de dois dias, que não pede cartão. */}
        {ehAdmin && estado === 'ausente' && temMax ? (
          <details className="border-border/60 rounded-lg border p-3">
            <summary className="cursor-pointer text-xs font-medium">
              Já tenho uma instância na Z-API
            </summary>
            <FormularioDeAdocao
              onAdotado={(urls, confirmados) => {
                setUrlsParaColar(confirmados ? null : urls)
                router.refresh()
              }}
            />
          </details>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * Adotar uma instância criada à mão no painel.
 *
 * As credenciais vão direto para a Server Action e **não ficam no estado depois
 * do envio**: elas são segredo de infraestrutura, e deixá-las num `useState`
 * montado as põe no heap do navegador e em qualquer extensão que leia o React
 * DevTools. O campo é limpo no sucesso.
 */
function FormularioDeAdocao({
  onAdotado,
}: {
  onAdotado: (urls: string[], confirmados: boolean) => void
}) {
  const [instanceId, setInstanceId] = React.useState('')
  const [token, setToken] = React.useState('')
  const [enviando, setEnviando] = React.useState(false)

  async function enviar() {
    setEnviando(true)
    const r = await adotarInstancia({ instanceId, token })
    setEnviando(false)

    if (!r.ok) {
      toast.error(r.error)
      return
    }

    setInstanceId('')
    setToken('')
    toast.success(
      r.webhooksConfirmados
        ? 'Instância adotada. Gere o QR Code para parear o número.'
        : 'Instância adotada. Falta apontar os webhooks no painel da Z-API.',
    )
    onAdotado([r.urls.recebida, r.urls.status, r.urls.desconexao], r.webhooksConfirmados)
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        Copie o ID e o token da instância no painel da Z-API. Eles ficam cifrados aqui
        e nunca voltam para a tela.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="zapi-instance">ID da instância</Label>
        <Input
          id="zapi-instance"
          value={instanceId}
          onChange={(e) => setInstanceId(e.target.value)}
          disabled={enviando}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="zapi-token">Token da instância</Label>
        <Input
          id="zapi-token"
          // `type="password"` porque isto é credencial, e a tela pode estar
          // sendo compartilhada numa chamada.
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={enviando}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <Button
        size="sm"
        className="w-fit"
        onClick={enviar}
        disabled={enviando || !instanceId.trim() || !token.trim()}
      >
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
        Adotar instância
      </Button>
    </div>
  )
}

function Selo({ estado }: { estado: EstadoDaConexao }) {
  if (estado === 'conectado') {
    return (
      <Badge variant="outline" className="border-emerald-600/40 text-emerald-600">
        Conectado
      </Badge>
    )
  }
  if (estado === 'conectando') return <Badge variant="outline">Conectando</Badge>
  if (estado === 'desconectado' || estado === 'erro') {
    return (
      <Badge variant="outline" className="border-amber-600/40 text-amber-600">
        Desconectado
      </Badge>
    )
  }
  // `desconhecido` NÃO vira "Desconectado": falha de leitura não é queda, e
  // dizer que caiu quem está de pé manda a pessoa reconectar à toa.
  if (estado === 'desconhecido') return <Badge variant="outline">Sem resposta</Badge>
  return <Badge variant="outline">Não conectado</Badge>
}
