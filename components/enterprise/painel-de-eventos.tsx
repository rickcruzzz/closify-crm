'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Loader2, Radar, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { criarEvento, gerarMensagemDoEvento, salvarMensagemDoEvento } from '@/lib/enterprise/actions'
import type { DadosDoEvento } from '@/lib/enterprise/eventos'
import type { Database } from '@/types/supabase'

type Evento = Database['public']['Tables']['enterprise_eventos']['Row']

const campo = 'border-input bg-background text-foreground placeholder:text-muted-foreground min-h-11 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
const botao = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

function CartaoDoEvento({ evento }: { evento: Evento }) {
  const [mensagem, setMensagem] = useState(evento.mensagem_rascunho ?? '')
  const [ocupado, iniciar] = useTransition()
  const numero = (evento.contato_telefone ?? '').replace(/\D/g, '')
  const podeAbrirWhatsapp = numero.length >= 10 && mensagem === evento.mensagem_rascunho && !!mensagem

  function gerar() {
    iniciar(async () => {
      const resultado = await gerarMensagemDoEvento(evento.id)
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
      const resultado = await salvarMensagemDoEvento(evento.id, mensagem)
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success('Mensagem salva para revisão.')
      window.location.reload()
    })
  }

  return (
    <article className="border-border bg-card rounded-2xl border p-5 shadow-sm">
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
        <div className="bg-primary/10 text-primary rounded-xl px-3 py-2 text-center">
          <strong className="block text-xl leading-none">{evento.prioridade ?? 0}</strong>
          <span className="text-[11px]">prioridade / 100</span>
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        {evento.justificativa ?? 'Análise ainda não disponível.'}
      </p>
      <a href={evento.fonte_url} target="_blank" rel="noopener noreferrer" className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline">
        Conferir fonte pública <ArrowUpRight className="size-4" />
      </a>

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
          {podeAbrirWhatsapp && (
            <a
              href={`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${botao} border-border border hover:bg-muted`}
            >
              Abrir no WhatsApp <ArrowUpRight className="size-4" />
            </a>
          )}
          <Link href="/conversas" className={`${botao} border-border border hover:bg-muted`}>
            Conversas do CRM
          </Link>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          O texto só é enviado depois da sua revisão e confirmação no WhatsApp.
        </p>
      </div>
    </article>
  )
}

export function PainelDeEventos({ eventos, erro }: { eventos: Evento[]; erro: string | null }) {
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false)
  const [ocupado, iniciar] = useTransition()

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
    }
    iniciar(async () => {
      const resultado = await criarEvento(entrada)
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success('Evento adicionado ao radar.')
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
          <Link href="/leads" className={`${botao} border-border border hover:bg-muted`}>Abrir contatos do CRM</Link>
        </div>
      </header>

      {mostrandoFormulario && (
        <form action={enviar} className="border-border bg-card grid gap-4 rounded-2xl border p-5 md:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium" htmlFor="nome">Evento *</label><input id="nome" name="nome" required minLength={3} maxLength={200} className={campo} placeholder="Ex.: Feira de negócios" /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="data_inicio">Data *</label><input id="data_inicio" name="data_inicio" type="date" required className={campo} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="cidade">Cidade *</label><input id="cidade" name="cidade" required maxLength={120} className={campo} placeholder="Ex.: Salvador" /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="fonte_url">Página oficial *</label><input id="fonte_url" name="fonte_url" type="url" required className={campo} placeholder="https://..." /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="organizador">Organizador</label><input id="organizador" name="organizador" className={campo} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="publico_estimado">Público estimado</label><input id="publico_estimado" name="publico_estimado" type="number" min="0" className={campo} placeholder="Se houver fonte confiável" /></div>
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
      <p className="text-muted-foreground text-xs">A prioridade organiza a pesquisa. Ela não representa uma chance estatística de fechamento e ainda precisa considerar os pontos de mídia disponíveis para o cliente.</p>
    </div>
  )
}
