'use server'

import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { feedbackSchema } from '@/lib/validations/feedback'
import { excedeuLimite } from '@/lib/rate-limit'
import { ehContaDeTeste } from '@/lib/dono/contas-internas'
import { getResend } from '@/lib/resend/client'
import { renderFeedbackRecebidoEmail } from '@/lib/emails/feedback-recebido'
import { EMAIL_DE_AVISO_DO_DONO } from '@/lib/emails/destinatario'
import { CONTROLADOR } from '@/lib/legal'
import {
  ANEXO_BUCKET,
  ANEXO_QUANTIDADE_MAXIMA,
  caminhoDoAnexo,
  validarAnexo,
} from '@/lib/storage/anexo-de-feedback'

/**
 * O relato do cliente, enviado de dentro do produto.
 *
 * ## Server Action, não Route Handler
 *
 * Aqui há sessão garantida — o diálogo só existe na área logada. A doutrina do
 * projeto reserva Route Handler para webhook e para o que acontece SEM sessão,
 * que é por que `/api/log-erro` é rota: o erro pode estourar antes de qualquer
 * login resolver.
 *
 * ## Grava com `createAdminClient`, e isso é a tabela, não um atalho
 *
 * `feedback` tem RLS ligada e ZERO policy, igual a `error_logs` e
 * `asaas_webhook_events`. Nenhum papel de usuário escreve nela; só a chave de
 * serviço. A alternativa seria criar policy por workspace, e aí o cliente
 * poderia reler o que enviou — recurso que não foi pedido e que traria uma
 * segunda doutrina de autorização para uma tabela de sistema.
 */
export async function enviarFeedback(formulario: FormData) {
  // `FormData` e não objeto: é o único jeito de um arquivo atravessar de uma
  // Server Action. Os campos de texto vêm daqui e passam pelo MESMO schema de
  // antes — o formato do transporte mudou, a validação não.
  const parsed = feedbackSchema.safeParse({
    tipo: formulario.get('tipo'),
    mensagem: formulario.get('mensagem'),
    rota: formulario.get('rota') ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Não foi possível enviar.' }
  }

  const arquivos = formulario.getAll('anexos').filter((a): a is File => a instanceof File)

  // O teto é checado ANTES de ler byte nenhum. Ler três arquivos de 10 MB para
  // então recusar o quarto seria gastar 30 MB de memória do servidor por uma
  // decisão que não depende do conteúdo.
  if (arquivos.length > ANEXO_QUANTIDADE_MAXIMA) {
    return { error: `Envie no máximo ${ANEXO_QUANTIDADE_MAXIMA} arquivos.` }
  }

  const { user, workspaceId, workspaces } = await getCurrentUserAndWorkspace()

  // Por USUÁRIO, não por IP: aqui sempre há alguém identificado, e limitar por
  // IP puniria um escritório inteiro pelo excesso de uma pessoa. Checado antes
  // de qualquer outra coisa, para a tentativa nem chegar ao banco.
  if (await excedeuLimite('feedback', user.id)) {
    return { error: 'Você enviou várias mensagens seguidas. Tente de novo em alguns minutos.' }
  }

  const supabase = await createClient()

  // O plano vem de `pro_vigente()`, não da coluna `workspaces.plan`.
  //
  // Aqui ele é só rótulo — decide se o assunto do e-mail diz "Pro" ou
  // "Grátis". Mesmo assim lê a função, porque a coluna é o último valor
  // gravado e não sabe que o tempo passou: um Pro vencido ontem apareceria
  // como Pro e daria ao relato uma urgência que ele não tem. E porque criar
  // aqui um lugar onde a coluna é lida convida o próximo a copiar o padrão
  // para uma REGRA — que é exatamente o defeito que a 0028 pagou.
  const { data: temPro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })
  const plano = temPro ? 'pro' : 'free'

  const empresa = workspaces.find((w) => w.id === workspaceId)?.name ?? 'Empresa sem nome'
  const cabecalhos = await headers()

  // A MESMA função que a Central usa em Ativação, em Decidindo agora e no
  // `error_logs`. Escrever um filtro novo aqui repetiria o erro de 29/08, que
  // classificou 23 empresas como externas quando eram 6 — e o que torna esse
  // erro caro é que ele produz um número plausível, sem sinal de que está
  // errado até alguém conferir.
  const interno = ehContaDeTeste(user.email)

  const admin = createAdminClient()

  // O id é gerado AQUI, antes do insert, porque o caminho do anexo precisa
  // dele (`<workspace>/<relato>/<arquivo>`) e os arquivos sobem antes da linha
  // existir. A alternativa — inserir, subir, e dar update — deixaria uma linha
  // sem anexo visível na Central caso o upload falhasse no meio.
  const feedbackId = crypto.randomUUID()

  // ## Os bytes são lidos e validados no SERVIDOR, sempre
  //
  // O navegador já recusou o que dava para recusar sem subir nada — mas
  // medição do cliente é INFORMAÇÃO, não permissão. Isso foi provado em 20/08:
  // um arquivo de 720×720 declarado como 1080×1080 passou pela validação de
  // tela e entrou na biblioteca de criativos.
  //
  // Aqui a decisão é pelos bytes iniciais, então `.exe` renomeado para `.png`
  // com `Content-Type: image/png` é recusado mesmo tendo passado por tudo
  // antes.
  const anexos: { caminho: string; nome: string; tamanho: number }[] = []

  for (const arquivo of arquivos) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    const veredito = validarAnexo(bytes)

    if ('erro' in veredito) {
      // Limpa o que já subiu: metade dos anexos num relato que não existe é
      // lixo no bucket que ninguém encontraria depois.
      if (anexos.length > 0) {
        await admin.storage.from(ANEXO_BUCKET).remove(anexos.map((a) => a.caminho))
      }
      return { error: `${arquivo.name}: ${veredito.erro}` }
    }

    const caminho = caminhoDoAnexo(workspaceId, feedbackId, veredito.extensao)
    const { error: erroUpload } = await admin.storage
      .from(ANEXO_BUCKET)
      .upload(caminho, bytes, { contentType: veredito.tipoMime, upsert: false })

    if (erroUpload) {
      console.error('enviarFeedback: upload de anexo falhou', erroUpload)
      if (anexos.length > 0) {
        await admin.storage.from(ANEXO_BUCKET).remove(anexos.map((a) => a.caminho))
      }
      return { error: 'Não foi possível enviar o anexo. Tente de novo em instantes.' }
    }

    // O nome ORIGINAL é guardado à parte porque o caminho no bucket é
    // aleatório de propósito (dois anexos podem se chamar "Captura de
    // tela.png"). Cortado em 200: nome de arquivo não tem limite no sistema
    // operacional, e um nome de 4 KB entraria inteiro no JSON.
    anexos.push({
      caminho,
      nome: arquivo.name.slice(0, 200),
      tamanho: bytes.length,
    })
  }

  const { error } = await admin.from('feedback').insert({
    id: feedbackId,
    tipo: parsed.data.tipo,
    mensagem: parsed.data.mensagem,
    rota: parsed.data.rota ?? null,
    plano,
    user_agent: cabecalhos.get('user-agent'),
    workspace_id: workspaceId,
    user_id: user.id,
    interno,
    anexos,
  })

  if (error) {
    console.error('enviarFeedback: insert falhou', error)
    // Sem a linha, os arquivos ficariam órfãos: a purga acha anexo pela coluna
    // `anexos` do relato, então nada apontaria para eles nunca mais.
    if (anexos.length > 0) {
      await admin.storage.from(ANEXO_BUCKET).remove(anexos.map((a) => a.caminho))
    }
    return { error: 'Não foi possível enviar agora. Tente de novo em instantes.' }
  }

  // ## O e-mail passou a sair SEMPRE, e a regra anterior tinha duas falhas
  //
  // Era `tipo === 'problema' && !interno`, e a intenção estava certa: e-mail
  // para tudo vira ruído, e ruído treina a ignorar a caixa — a lição de 20/08,
  // com 8 de 11 alertas falsos na Central.
  //
  // Medido em 02/09, contra o banco e contra o Resend: **dez relatos
  // guardados, ZERO e-mails enviados.** As duas metades da condição estavam
  // barrando, e cada uma por um motivo diferente:
  //
  //     !interno   os dez relatos tem `interno = true`, porque quem testou foi
  //                o dono, e o e-mail dele esta em `EMAILS_DO_DONO`. O canal
  //                era IMPOSSIVEL de testar: testar e mandar de uma conta que
  //                e nossa, e conta nossa nunca dispara
  //
  //     problema   sugestao nunca avisava, e o dono esperava que avisasse
  //
  // A primeira é o mesmo defeito que a Central pagou em 31/08: relato interno
  // existia e não havia porta para vê-lo. A correção lá não foi apagar a
  // separação — foi dar uma porta (`?internos=1`) e marcar cada linha com um
  // selo. Aqui é o mesmo: o e-mail SAI, e o assunto diz o que ele é.
  //
  // ## E o argumento do ruído não se aplica no volume real
  //
  // Dez relatos em três dias, todos de teste. A regra foi desenhada para um
  // volume que ainda não existe. Quando existir — quando houver cliente de
  // verdade mandando sugestão toda semana — a decisão certa é voltar a
  // silenciar sugestão, e o comentário fica aqui para quem for fazer isso.
  //
  // Falha aqui NÃO desfaz o insert e não vira erro na tela: o relato já está
  // guardado e aparece na Central. Devolver erro faria a pessoa reenviar e
  // duplicar um registro que chegou inteiro.
  {
    try {
      const { subject, html } = renderFeedbackRecebidoEmail({
        emailDoCliente: user.email ?? 'sem e-mail',
        empresa,
        plano,
        rota: parsed.data.rota ?? null,
        mensagem: parsed.data.mensagem,
        // Só a CONTAGEM, não os arquivos. Anexar 3 imagens de 10 MB num
        // e-mail é 30 MB que o Gmail recusa (teto de 25 MB) e que o Resend
        // cobra — e o dono precisa dos arquivos na Central, onde estão com
        // link assinado, não na caixa de entrada.
        quantidadeDeAnexos: anexos.length,
      })

      // O retorno é `{ data, error }` — o SDK do Resend **não lança** em
      // falha de envio. Só o `try/catch` deixaria passar 401, domínio não
      // verificado e destinatário recusado em silêncio absoluto: o relato
      // ficaria na tabela, o dono nunca seria avisado, e nada apareceria em
      // lugar nenhum. Mesma classe do `activities.insert` sem checagem que
      // fez o webhook do WhatsApp perder mensagem em 24/08.
      //
      // Achado pela própria prova desta implementação: com a chave trocada
      // por uma inválida de propósito, o log ficou VAZIO — o que passaria por
      // "não tentou mandar" quando o certo é "tentou e falhou".
      // `from` continua sendo o dominio proprio, que e o verificado no
      // Resend — mandar de um Gmail derrubaria a entregabilidade. O que muda
      // e o DESTINO: vai para a mesma caixa do vigia, porque aviso operacional
      // espalhado em duas caixas significa que uma sera esquecida. Era
      // exatamente o caso: o vigia chegava, o suporte nao.
      //
      // O assunto carrega DE ONDE veio. Sem isso, um teste do dono e um
      // relato de cliente pagante chegam identicos, e a distincao que a regra
      // antiga fazia (silenciando o interno) se perderia de vez.
      const marca = interno ? '[interno] ' : ''
      const rotulo = parsed.data.tipo === 'sugestao' ? '[sugestao] ' : ''

      const { error: erroDoEmail } = await getResend().emails.send({
        from: `Velo Funil <${CONTROLADOR.email}>`,
        to: EMAIL_DE_AVISO_DO_DONO,
        // Responder ao cliente é a ação deste e-mail: com `replyTo`, o botão
        // "Responder" do celular já vai para a pessoa certa, sem copiar
        // endereço do corpo.
        replyTo: user.email ?? undefined,
        subject: `${marca}${rotulo}${subject}`,
        html,
      })

      if (erroDoEmail) {
        console.error('enviarFeedback: aviso por e-mail falhou', erroDoEmail)
      }
    } catch (err) {
      // `getResend()` lança quando a variável não existe, e a rede pode cair.
      console.error('enviarFeedback: aviso por e-mail falhou', err)
    }
  }

  return { success: true, tipo: parsed.data.tipo }
}
