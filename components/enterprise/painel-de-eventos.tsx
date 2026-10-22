'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Building2, CalendarDays, Loader2, MessageCircle, Radar, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import {
  abrirConversaDoEvento,
  analisarPaginaDaExa,
  aprovarMensagemDoEvento,
  buscarEventosNaExa,
  criarContatosQueFaltam,
  criarEvento,
  enviarMensagemDoEvento,
  gerarMensagemDoEvento,
  salvarMensagemDoEvento,
} from '@/lib/enterprise/actions'
import type { DadosDoEvento } from '@/lib/enterprise/eventos'
import { contatoDoEventoCompleto } from '@/lib/enterprise/contato'
import { normalizarTelefoneBrasileiro } from '@/lib/leads/whatsapp'
import type { Database } from '@/types/supabase'

type Evento = Database['public']['Tables']['enterprise_eventos']['Row'] & { fotoUrl?: string | null }

const campo = 'border-input bg-background text-foreground placeholder:text-muted-foreground min-h-11 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
const botao = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Server Action que pode REJEITAR em vez de responder: função cortada pelo teto
 * da Netlify, 502, rede. Sem isto o `useTransition` ficaria pendurado e o
 * botão girando — o defeito do "Adotar instância" de 22/10.
 */
async function semRejeicao<T>(chamada: () => Promise<T>): Promise<T | null> {
  try {
    return await chamada()
  } catch {
    toast.error('A conexão com o servidor caiu antes da resposta. Confira a tela e tente de novo.')
    return null
  }
}

function CartaoDoEvento({ evento }: { evento: Evento }) {
  const [fotoFalhou, setFotoFalhou] = useState(false)
  const router = useRouter()
  const [mensagem, setMensagem] = useState(evento.mensagem_rascunho ?? '')
  const [ocupado, iniciar] = useTransition()
  const aprovada = !!evento.mensagem_aprovada && !!evento.aprovada_em && mensagem === evento.mensagem_aprovada
  const temContato = !!(evento.contato_email?.trim() || evento.contato_telefone?.trim())
  const temWhatsapp = normalizarTelefoneBrasileiro(evento.contato_telefone) !== null

  function abrirConversa() {
    iniciar(async () => {
      const resultado = await semRejeicao(() => abrirConversaDoEvento(evento.id))
      if (!resultado) return
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      router.push(`/conversas?c=${resultado.conversaId}`)
    })
  }

  function enviar() {
    iniciar(async () => {
      const resultado = await semRejeicao(() => enviarMensagemDoEvento(evento.id))
      if (!resultado) return
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success('Mensagem enviada pelo WhatsApp. A conversa continua no CRM.')
      router.push(`/conversas?c=${resultado.conversaId}`)
    })
  }

  function gerar() {
    iniciar(async () => {
      const resultado = await semRejeicao(() => gerarMensagemDoEvento(evento.id))
      if (!resultado) return
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success('Nova versão criada. Revise antes de enviar.')
      window.location.reload()
    })
  }

  function salvar() {
    iniciar(async () => {
      const resultado = await semRejeicao(() => salvarMensagemDoEvento(evento.id, mensagem))
      if (!resultado) return
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success('Mensagem salva para revisão.')
      window.location.reload()
    })
  }

  function aprovar() {
    iniciar(async () => {
      const resultado = await semRejeicao(() => aprovarMensagemDoEvento(evento.id))
      if (!resultado) return
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success('Mensagem aprovada. Envie pelo WhatsApp quando quiser.')
      window.location.reload()
    })
  }

  return (
    <article className="border-border bg-card rounded-2xl border p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        {evento.fotoUrl && !fotoFalhou ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={evento.fotoUrl} alt={`Imagem pública de ${evento.organizador ?? evento.nome}`} loading="lazy" decoding="async" onError={() => setFotoFalhou(true)} className="size-20 rounded-xl border bg-white object-contain" />
        ) : <Building2 aria-hidden className="bg-muted text-muted-foreground size-20 rounded-xl p-5" />}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
            {evento.cidade} · {new Date(`${evento.data_inicio}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </p>
          <h2 className="text-lg font-semibold">{evento.nome}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {evento.organizador ?? 'Organizador a confirmar'}
            {evento.contato_nome ? ` · ${evento.contato_nome}` : ''}
          </p>
        </div>
        {/* Percentual a pedido do dono (22/10), o mesmo número que o Kanban
            mostra. Continua sendo prioridade por sinais, não chance de fechar
            — o rodapé desta tela diz isso. */}
        <div className="bg-primary/10 text-primary rounded-xl px-3 py-2 text-center">
          <strong className="block text-xl leading-none">{evento.prioridade ?? 0}%</strong>
          <span className="text-[11px]">potencial</span>
        </div>
      </div>

      <p className="mt-3 text-xs">
        {evento.lead_id ? (
          <Link href={`/leads/${evento.lead_id}`} className="text-primary font-medium hover:underline">
            Contato criado no CRM
          </Link>
        ) : temContato ? (
          <span className="text-muted-foreground">O contato é criado na próxima varredura.</span>
        ) : (
          <span className="text-muted-foreground">
            Sem e-mail ou telefone público: ainda não dá para criar o contato no CRM.
          </span>
        )}
      </p>

      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        {evento.justificativa ?? 'Análise ainda não disponível.'}
      </p>
      {evento.compatibilidade_espacos && <p className="text-muted-foreground mt-2 text-sm">{evento.compatibilidade_espacos}</p>}
      {evento.informacoes_faltantes.length > 0 && (
        <p className="text-muted-foreground mt-2 text-sm"><strong>Falta confirmar:</strong> {evento.informacoes_faltantes.join('; ')}.</p>
      )}
      <a href={evento.fonte_url} target="_blank" rel="noopener noreferrer" className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline">
        Conferir fonte pública <ArrowUpRight className="size-4" />
      </a>
      {evento.fonte_contato_url && evento.fonte_contato_url !== evento.fonte_url && (
        <a href={evento.fonte_contato_url} target="_blank" rel="noopener noreferrer" className="text-primary ml-4 inline-flex items-center gap-1 text-sm font-medium hover:underline">Conferir contato <ArrowUpRight className="size-4" /></a>
      )}

      <div className="border-border mt-5 border-t pt-5">
        <label htmlFor={`mensagem-${evento.id}`} className="mb-2 block text-sm font-semibold">
          Primeira mensagem para revisão
        </label>
        <textarea
          id={`mensagem-${evento.id}`}
          className={`${campo} min-h-28 resize-y`}
          value={mensagem}
          maxLength={700}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Gere uma sugestão com IA ou escreva sua abordagem."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`${botao} bg-primary text-primary-foreground hover:bg-primary/90`} onClick={gerar} disabled={ocupado}>
            {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {evento.mensagem_rascunho ? 'Gerar outra versão' : 'Gerar com IA'}
          </button>
          <button type="button" className={`${botao} border-border border hover:bg-muted`} onClick={salvar} disabled={ocupado || !mensagem.trim() || mensagem === evento.mensagem_rascunho}>
            Salvar revisão
          </button>
          <button type="button" className={`${botao} border-border border hover:bg-muted`} onClick={aprovar} disabled={ocupado || !mensagem.trim() || mensagem !== evento.mensagem_rascunho || aprovada}>
            {aprovada ? 'Mensagem aprovada' : 'Aprovar mensagem'}
          </button>
          {/* Envia pelo número conectado e não por `wa.me`: a mensagem fica
              registrada na conversa do CRM, com o mesmo teto de aquecimento
              da caixa de entrada. O `wa.me` abria o celular de quem clicou e
              o envio sumia do histórico da empresa. */}
          {aprovada && (
            <button
              type="button"
              className={`${botao} bg-primary text-primary-foreground hover:bg-primary/90`}
              onClick={enviar}
              disabled={ocupado || !temWhatsapp}
              title={temWhatsapp ? undefined : 'Este contato não tem WhatsApp'}
            >
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {evento.status === 'contatado' ? 'Enviar de novo pelo WhatsApp' : 'Enviar pelo WhatsApp'}
            </button>
          )}
          <button
            type="button"
            className={`${botao} border-border border hover:bg-muted`}
            onClick={abrirConversa}
            disabled={ocupado || !temWhatsapp}
            title={temWhatsapp ? undefined : 'Este contato não tem WhatsApp'}
          >
            <MessageCircle className="size-4" />
            Abrir conversa
          </button>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          {temWhatsapp
            ? 'Só a mensagem aprovada é enviada, pelo WhatsApp conectado da empresa. A resposta do organizador chega na tela WhatsApp do CRM.'
            : 'Este contato não tem WhatsApp. A conversa pelo CRM fica disponível quando houver um telefone.'}
        </p>
      </div>
    </article>
  )
}

export function PainelDeEventos({ eventos, erro }: { eventos: Evento[]; erro: string | null }) {
  eventos = eventos.filter(contatoDoEventoCompleto)
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false)
  const [ocupado, iniciar] = useTransition()
  const [progresso, setProgresso] = useState<string | null>(null)

  /**
   * A varredura, em duas metades e uma página por vez.
   *
   * A busca devolve só endereços; cada página é uma Server Action própria.
   * Numa chamada só, oito páginas passariam do teto de ~10s da Netlify (ver
   * `lib/enterprise/exa.ts`). Em SEQUÊNCIA e não em paralelo: o progresso
   * fica legível, e um pico de chamadas simultâneas não estoura a cota da Exa.
   */
  function varrer() {
    iniciar(async () => {
      setProgresso('Buscando eventos na Exa…')
      const busca = await semRejeicao(() => buscarEventosNaExa())
      if (!busca) {
        setProgresso(null)
        return
      }
      if (!busca.ok) {
        toast.error(busca.erro)
        setProgresso(null)
        return
      }

      let adicionados = 0
      let contatos = 0
      let semContato = 0
      for (let i = 0; i < busca.paginas.length; i++) {
        const pagina = busca.paginas[i]
        setProgresso(`Analisando ${i + 1} de ${busca.paginas.length}: ${pagina.titulo ?? pagina.url}`)
        const r = await semRejeicao(() => analisarPaginaDaExa(pagina.url))
        if (r?.situacao !== 'adicionado') continue
        adicionados += 1
        if (r.contato === 'criado' || r.contato === 'vinculado') contatos += 1
        if (r.contato === 'sem_contato') semContato += 1
      }

      setProgresso('Criando os contatos que faltam…')
      const pendentes = await semRejeicao(() => criarContatosQueFaltam())
      if (pendentes?.ok) contatos += pendentes.criados

      setProgresso(null)
      if (adicionados === 0 && contatos === 0) {
        toast.info(
          busca.jaNoRadar > 0
            ? 'Nenhum evento novo: os que a Exa encontrou já estão no radar.'
            : 'A Exa não encontrou eventos novos com data e cidade confirmadas.',
        )
        return
      }
      toast.success(
        `${adicionados} evento(s) novo(s) e ${contatos} contato(s) no CRM.` +
          (semContato > 0 ? ` ${semContato} sem e-mail ou telefone público.` : ''),
      )
      window.location.reload()
    })
  }

  function enviar(formData: FormData) {
    const publicoCru = String(formData.get('publico_estimado') ?? '').trim()
    const entrada: DadosDoEvento = {
      nome: String(formData.get('nome') ?? ''),
      data_inicio: String(formData.get('data_inicio') ?? ''),
      cidade: String(formData.get('cidade') ?? ''),
      fonte_url: String(formData.get('fonte_url') ?? ''),
      organizador: String(formData.get('organizador') ?? ''),
      contato_nome: String(formData.get('contato_nome') ?? ''),
      contato_email: String(formData.get('contato_email') ?? ''),
      contato_telefone: String(formData.get('contato_telefone') ?? ''),
      publico_estimado: publicoCru ? Number(publicoCru) : null,
      perfil_publico: String(formData.get('perfil_publico') ?? ''),
    }
    iniciar(async () => {
      const resultado = await semRejeicao(() => criarEvento(entrada))
      if (!resultado) return
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success(
        resultado.contato === 'criado'
          ? 'Evento adicionado ao radar e contato criado no CRM.'
          : resultado.contato === 'vinculado'
            ? 'Evento adicionado ao radar e ligado a um contato que já existia.'
            : `Evento adicionado ao radar. ${resultado.contato ?? ''}`.trim(),
      )
      window.location.reload()
    })
  }

  return (
    <div className="space-y-7">
      <header className="border-border bg-card overflow-hidden rounded-2xl border p-6 md:p-8">
        <div className="text-primary mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em]">
          <Radar className="size-4" /> Enterprise · Inteligência comercial
        </div>
        <h1 className="max-w-3xl text-2xl font-bold tracking-tight md:text-3xl">Radar de oportunidades em eventos</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed md:text-base">
          Reúna eventos, confira o organizador, veja os sinais que sustentam a prioridade e prepare uma abordagem de mídia outdoor antes de falar com o responsável.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className={`${botao} bg-primary text-primary-foreground hover:bg-primary/90`} onClick={() => setMostrandoFormulario((v) => !v)}>
            {mostrandoFormulario ? 'Fechar formulário' : 'Adicionar evento'}
          </button>
          <button type="button" className={`${botao} border-border border hover:bg-muted`} onClick={varrer} disabled={ocupado}>
            {progresso ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />} Buscar eventos com a Exa
          </button>
          <Link href="/leads" className={`${botao} border-border border hover:bg-muted`}>Abrir contatos do CRM</Link>
        </div>
        {progresso && (
          <p role="status" className="text-muted-foreground mt-3 truncate text-sm">
            {progresso}
          </p>
        )}
      </header>

      {mostrandoFormulario && (
        <form action={enviar} className="border-border bg-card grid gap-4 rounded-2xl border p-5 md:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium" htmlFor="nome">Evento *</label><input id="nome" name="nome" required minLength={3} maxLength={200} className={campo} placeholder="Ex.: Feira de negócios" /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="data_inicio">Data *</label><input id="data_inicio" name="data_inicio" type="date" required className={campo} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="cidade">Cidade *</label><input id="cidade" name="cidade" required maxLength={120} defaultValue="Salvador" className={campo} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="fonte_url">Página oficial *</label><input id="fonte_url" name="fonte_url" type="url" required className={campo} placeholder="https://..." /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="organizador">Organizador</label><input id="organizador" name="organizador" className={campo} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="publico_estimado">Público estimado</label><input id="publico_estimado" name="publico_estimado" type="number" min="0" className={campo} placeholder="Se houver fonte confiável" /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="perfil_publico">Perfil do público</label><input id="perfil_publico" name="perfil_publico" className={campo} placeholder="Ex.: profissionais do setor" /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="contato_nome">Responsável</label><input id="contato_nome" name="contato_nome" className={campo} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="contato_email">E-mail público</label><input id="contato_email" name="contato_email" type="email" className={campo} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="contato_telefone">Telefone público</label><input id="contato_telefone" name="contato_telefone" type="tel" className={campo} /></div>
          <div className="flex items-end"><button type="submit" disabled={ocupado} className={`${botao} bg-primary text-primary-foreground w-full hover:bg-primary/90`}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : null} Salvar oportunidade</button></div>
          <p className="text-muted-foreground text-xs md:col-span-2">A fonte fica registrada para você confirmar cada informação antes de entrar em contato.</p>
        </form>
      )}

      <section aria-labelledby="lista-eventos">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="text-primary size-5" />
          <h2 id="lista-eventos" className="text-lg font-semibold">Oportunidades da empresa</h2>
          <span className="text-muted-foreground text-sm">{eventos.length}</span>
        </div>
        {erro && <p role="alert" className="text-destructive mb-4 text-sm">{erro}</p>}
        {eventos.length === 0 ? (
          <div className="border-border bg-card rounded-2xl border p-8 text-center">
            <p className="font-medium">Comece com a agenda de um centro de convenções.</p>
            <p className="text-muted-foreground mt-2 text-sm">Adicione um evento e a fonte pública para ver uma prioridade explicada e preparar a primeira abordagem.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">{eventos.map((evento) => <CartaoDoEvento key={evento.id} evento={evento} />)}</div>
        )}
      </section>
      <p className="text-muted-foreground text-xs">A prioridade organiza a pesquisa e não representa uma chance estatística de fechamento. A compatibilidade final depende dos pontos de outdoor e formatos realmente disponíveis.</p>
    </div>
  )
}
