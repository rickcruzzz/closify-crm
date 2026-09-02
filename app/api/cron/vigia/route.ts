import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import {
  alertasNaoAvisados,
  assuntoDoVigia,

  memoriaAtualizada,
  deveEnviar,
  leiturasQueFalharam,
  montarAlertas,
  DIAS_DE_ANTECEDENCIA_DO_TRIAL,
  HORAS_ATE_SUPORTE_VIRAR_ALERTA,
  type LeituraDoVigia,
} from '@/lib/dono/vigia'
import { renderVigiaEmail } from '@/lib/emails/vigia'
import { getResend } from '@/lib/resend/client'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * O vigia: uma varredura por dia, e um e-mail só quando há algo.
 *
 * ## Por que isto existe, e por que não é uma tela
 *
 * A Central (`/dono`) responde tudo isto e mais — e só abre em `localhost`,
 * por um gate de duas condições que protege dado pessoal de cliente sob a
 * LGPD. Publicá-la exigiria desligar esse gate.
 *
 * O vigia resolve a necessidade real sem tocar nele: em vez de uma tela que
 * alguém precisa lembrar de abrir, um e-mail que chega sozinho. E resolve
 * melhor, porque tela só informa quem foi olhar.
 *
 * ## Cada leitura é isolada, de propósito
 *
 * Cinco medições independentes, cada uma no seu `try`. Uma falha não derruba
 * as outras, e o campo fica `null` — que no vocabulário de `lib/dono/vigia.ts`
 * significa **não sei**, nunca "está zerado". A diferença já custou caro aqui:
 * em 30/08 a Central declarava R$ 490/mês de receita com R$ 0,00 real porque
 * as duas coisas tinham virado o mesmo valor.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

/** Para onde o alerta vai. Não é a lista de contas internas do dono, que serve
 *  para FILTRAR métrica — misturar as duas mandaria e-mail para cinco caixas. */
const DESTINATARIO = 'notificacaosistemavelofunil@gmail.com'

function autorizado(cabecalho: string | null): boolean {
  const esperado = process.env.CRON_SECRET
  if (!cabecalho || !esperado) return false

  const prefixo = 'Bearer '
  if (!cabecalho.startsWith(prefixo)) return false

  const a = Buffer.from(cabecalho.slice(prefixo.length))
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Igual a `medir`, para leitura que devolve lista em vez de contagem. */
async function medirLista(
  nome: string,
  fn: () => Promise<string[]>,
): Promise<string[] | null> {
  try {
    return await fn()
  } catch (err) {
    console.error(`vigia: falhou ao ler ${nome}`, err)
    return null
  }
}

/** Roda a leitura e devolve `null` se ela falhar, em vez de derrubar o resto. */
async function medir(nome: string, fn: () => Promise<number>): Promise<number | null> {
  try {
    return await fn()
  } catch (err) {
    console.error(`vigia: falhou ao ler ${nome}`, err)
    return null
  }
}

export async function GET(request: Request) {
  if (!autorizado(request.headers.get('authorization'))) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const agora = new Date()
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const limiteSuporte = new Date(
    agora.getTime() - HORAS_ATE_SUPORTE_VIRAR_ALERTA * 60 * 60 * 1000,
  ).toISOString()
  const limiteTrial = new Date(
    agora.getTime() + DIAS_DE_ANTECEDENCIA_DO_TRIAL * 24 * 60 * 60 * 1000,
  ).toISOString()

  // ## As tres leituras vao em PARALELO
  //
  // Escritas como `await` em sequencia, elas eram tres idas em serie ao
  // Supabase para responder perguntas que nao dependem umas das outras — o
  // mesmo defeito que a auditoria de 19/08 corrigiu em `/settings/billing` e
  // que o layout do dashboard ja resolvia com `Promise.all`. Numa rota com
  // teto de 60s isso e folga jogada fora.
  const [errosNovos, trialsVencendo, suporteParado, credenciaisMortas] = await Promise.all([
    medir('error_logs', async () => {
      const { count, error } = await admin
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', ontem)
      if (error) throw error
      return count ?? 0
    }),

    medir('trial_ate', async () => {
      const { count, error } = await admin
        .from('workspaces')
        .select('id', { count: 'exact', head: true })
        .not('trial_ate', 'is', null)
        .gte('trial_ate', agora.toISOString())
        .lte('trial_ate', limiteTrial)
      if (error) throw error
      return count ?? 0
    }),

    medir('feedback', async () => {
      // ## A fila precisa EXCLUIR conta de teste, e isto e a armadilha nº 1
      //
      // `lerFilaDeFeedback` ja faz isso na Central. Contar direto na tabela
      // repetiria o defeito de 20/08, quando 8 dos 11 alertas eram e-mails de
      // teste gerados por script — e uma fila com 70% de lixo ensina a ignorar
      // a fila inteira, junto com o alerta que importa.
      //
      // A tabela ja carrega `interno`, decidido por `ehContaDeTeste` no
      // momento da gravacao (0060). Filtrar por ele em vez de resolver o
      // e-mail aqui evita uma segunda copia da regra — e duas copias divergem
      // na primeira mudanca, com a que diverge em silencio sendo sempre a
      // escrita depois.
      const { count, error } = await admin
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('interno', false)
        .lte('created_at', limiteSuporte)
        // A 0061 chama isto de `status`, com `aberto` como estado inicial —
        // nao de `tratado_em`, que foi o palpite da primeira versao. Errar a
        // coluna nao derrubou nada: a leitura virou `null` e o e-mail disse
        // que nao conferiu a fila. E o comportamento certo funcionando, e foi
        // assim que o defeito apareceu.
        .in('status', ['aberto', 'em_andamento'])
      if (error) throw error
      return count ?? 0
    }),

    // ## As credenciais externas, que nenhum portao alcanca
    //
    // `tsc`, `lint`, `test` e `build` nao consultam a Graph API. Foi assim que
    // o `META_ADS_TOKEN` ficou tres dias marcado como morto DEPOIS de voltar a
    // funcionar, com a pendencia pedindo uma acao que nao era necessaria — e
    // e a mesma classe dos cinco e-mails que sairam 23 dias com um CNPJ que a
    // Receita desmentia.
    //
    // Uma leitura barata de cada, e o nome de quem parou. Sem detalhe tecnico:
    // o alerta precisa dizer O QUE parou de funcionar, nao o codigo do erro.
    medirLista('credenciais', async () => {
      const mortas: string[] = []

      const ads = (process.env.META_ADS_TOKEN ?? '').trim()
      if (ads) {
        const r = await fetch(
          `https://graph.facebook.com/v23.0/me?access_token=${encodeURIComponent(ads)}`,
        ).then((x) => x.json() as Promise<{ error?: unknown }>)
        if (r.error) mortas.push('Meta Ads (a tela de anuncio fica cega)')
      }

      const ig = (process.env.META_INSTAGRAM_TOKEN ?? '').trim()
      if (ig) {
        const r = await fetch(
          `https://graph.facebook.com/v23.0/me?access_token=${encodeURIComponent(ig)}`,
        ).then((x) => x.json() as Promise<{ error?: unknown }>)
        if (r.error) mortas.push('Instagram (nao publica carrossel)')
      }

      return mortas
    }),
  ])

  const leitura: LeituraDoVigia = {
    errosNovos,
    trialsVencendo,
    suporteParado,
    credenciaisMortas,

    // As duas do gateway ficam para uma rodada seguinte: `lerDinheiro()` já
    // existe em `lib/dono/dinheiro.ts` e é `import 'server-only'` amarrado ao
    // gate de ambiente. Trazê-lo para uma rota que roda na Vercel exige
    // separar a leitura do gate primeiro, e fazer isso às pressas é como se
    // desfaz uma trava de segurança sem perceber.
    //
    // Enquanto isso, `null` — e o e-mail diz, em texto, que não conferiu.
    // Silêncio sobre dinheiro seria pior que a ausência do dado.
    assinaturasSemPro: null,
    cobrancasVencidas: null,
  }

  const alertas = montarAlertas(leitura)
  const naoConferido = leiturasQueFalharam(leitura)

  if (!deveEnviar(leitura)) {
    // Nada vivo: a memória some junto, e é isso que faz um problema que
    // voltar ser tratado como novo em vez de ficar calado para sempre.
    await admin.from('vigia_ultimo_aviso').delete().neq('chave', '')
    return NextResponse.json({ enviado: false, motivo: 'nada a relatar' })
  }

  // ## A memória, e por que ela não pode derrubar o e-mail
  //
  // Rodando de hora em hora, um erro que apareceu de manhã geraria 24 e-mails
  // idênticos até alguém resolver — e aí a pessoa aprende a arquivar sem ler,
  // que é o estado que a fila de 20/08 produziu com 8 de 11 alertas de ruído.
  //
  // Se a leitura da memória falhar, `{}` faz tudo parecer novo e o e-mail sai.
  // Errar para o lado de avisar demais é recuperável; errar para o lado de
  // calar transforma o vigia no problema que ele existe para evitar.
  const memoria: Record<string, number> = {}
  try {
    const { data } = await admin.from('vigia_ultimo_aviso').select('chave, quantidade')
    for (const linha of data ?? []) memoria[linha.chave] = linha.quantidade
  } catch (err) {
    console.error('vigia: falhou ao ler a memoria, tratando tudo como novo', err)
  }

  const novidades = alertasNaoAvisados(alertas, memoria)

  // Leitura que falhou também respeita a memória: sem isto, uma falha
  // persistente do Asaas mandaria e-mail a cada hora dizendo a mesma coisa.
  const jaAvisouDasFalhas = naoConferido.every((n) => memoria[`falha-${n}`] === 1)

  if (novidades.length === 0 && jaAvisouDasFalhas) {
    return NextResponse.json({ enviado: false, motivo: 'nada novo desde o ultimo aviso' })
  }

  // ## O relogio do e-mail e o de Sao Paulo, e a HORA entra junto
  //
  // A Vercel dispara o cron em UTC e isso NAO e configuravel — nao existe
  // campo de fuso no `vercel.json`. Com `0 * * * *` isso nao muda nada (hora
  // cheia em UTC e hora cheia aqui, porque o offset e inteiro), mas o horario
  // que a pessoa le precisa ser o do relogio dela.
  //
  // A data ja saia em `America/Sao_Paulo`; faltava a HORA. Sem ela, dois
  // e-mails do mesmo dia sao indistinguiveis, e "isto e novo ou e o de
  // ontem?" vira uma pergunta que so o Resend responde.
  //
  // Para os outros dois crons deste projeto, a conversao e -3h:
  //     reconciliar-assinaturas  0 12 * * *  ->  09:00 em Sao Paulo
  //     limpar-eventos           0 6  * * *  ->  03:00 em Sao Paulo
  // (o comentario mora aqui e nao no `vercel.json` porque JSON nao aceita
  // comentario — tentar isso ja derrubou dois deploys deste projeto em 22/08,
  // com `should NOT have additional property`.)
  const dia = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(agora)

  const { error } = await getResend().emails.send({
    from: 'Velo Funil <suporte@velofunil.com.br>',
    to: DESTINATARIO,
    // O e-mail mostra as NOVIDADES, não a fila inteira: repetir o que já foi
    // comunicado obriga a reler tudo para achar o que mudou.
    subject: assuntoDoVigia(novidades, jaAvisouDasFalhas ? [] : naoConferido),
    html: renderVigiaEmail({
      alertas: novidades,
      naoConferido: jaAvisouDasFalhas ? [] : naoConferido,
      dia,
    }),
  })

  // O SDK do Resend NÃO lança em falha de envio — devolve `{ error }`. Com só
  // `try/catch`, um 401 ou domínio não verificado passaria em silêncio
  // absoluto, e o vigia ficaria mudo exatamente como o problema que ele existe
  // para evitar. Mesma classe do `activities.insert` sem checagem, de 24/08.
  if (error) {
    console.error('vigia: falha ao enviar', error)
    return NextResponse.json({ enviado: false, erro: String(error) }, { status: 500 })
  }

  // A memória só é gravada DEPOIS do envio confirmado. Gravar antes e falhar
  // no envio faria o vigia achar que já avisou de algo que ninguém recebeu —
  // o alerta ficaria enterrado até piorar de número.
  const nova = memoriaAtualizada(alertas)
  for (const n of naoConferido) nova[`falha-${n}`] = 1

  await admin.from('vigia_ultimo_aviso').delete().neq('chave', '')
  if (Object.keys(nova).length > 0) {
    await admin.from('vigia_ultimo_aviso').insert(
      Object.entries(nova).map(([chave, quantidade]) => ({ chave, quantidade })),
    )
  }

  return NextResponse.json({
    enviado: true,
    novidades: novidades.length,
    naoConferido: naoConferido.length,
  })
}
