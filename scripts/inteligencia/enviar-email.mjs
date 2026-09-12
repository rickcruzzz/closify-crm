/**
 * O disparo de e-mail frio. Ensaio por padrão.
 *
 *     node --env-file=.env.local scripts/inteligencia/enviar-email.mjs --dia=1
 *     node --env-file=.env.local scripts/inteligencia/enviar-email.mjs --confirmar --dia=1
 *
 * ## Ele não monta nada — só transporta
 *
 * Assunto, corpo, higiene da lista, rampa e token de saída vêm prontos de
 * `/dono/prospeccao/emails`. A razão é medida: `email-copy.ts` importa
 * `@/lib/legal`, e o alias `@/` **não resolve** num `.mjs` rodado por `node` —
 * `Cannot find package '@/lib'`, em 12/09.
 *
 * Reescrever o corpo aqui seria a armadilha que este projeto registra em letras
 * grandes, e o que divergiria é o texto que vai ao cliente, com o CNPJ e o link
 * de saída que a LGPD exige.
 *
 * ## As travas, e o que cada uma evita
 *
 *     --confirmar ausente   ensaio, e e o padrao
 *     dominio do remetente  ABORTA se apontar para velofunil.com.br ou
 *                           subdominio. Nao e preferencia: o Google mede
 *                           reputacao no dominio RAIZ, entao disparo frio dali
 *                           derruba quem manda recuperacao de senha
 *     --dia=N               a rampa. 5 nos dias 1-3, 10 ate o 7, 15 ate o 11,
 *                           20 ate o 14, 25 dali em diante e NUNCA mais
 *     opt-out               lido do banco, por chave de e-mail E por dominio
 *     estado ANTES do sono  Ctrl+C nunca reenvia
 *     3 falhas seguidas     param a rodada
 *     intervalo             45s a 180s sorteado
 *     texto puro            sem HTML e sem rastreador de abertura: imagem e
 *                           pixel sao o que o filtro le como campanha
 *
 * ## O `--dia` é de quem chama, e isso é decisão
 *
 * Ele não é deduzido do calendário: uma pausa de três dias não deve fazer a
 * caixa "pular" para o degrau seguinte, porque o que o provedor observa é
 * histórico de envio, não data.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const ESTADO = join(RAIZ, '.dono-email.json')
const ROTA = 'http://localhost:3000/dono/prospeccao/emails'

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND = process.env.RESEND_API_KEY
const DE = process.env.PROSPECCAO_EMAIL_DE
const RESPONDER_PARA = process.env.PROSPECCAO_EMAIL_RESPONDER ?? null

const args = process.argv.slice(2)
const confirmar = args.includes('--confirmar')
const DIA = Number(args.find((a) => a.startsWith('--dia='))?.split('=')[1] ?? 1)
const SO = args.find((a) => a.startsWith('--so='))?.split('=')[1] ?? null

const INTERVALO_MIN = 45_000
const INTERVALO_MAX = 180_000

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const sortear = (min, max) => Math.floor(min + Math.random() * (max - min))

function abortar(mensagem) {
  console.error(`\n  ${mensagem}\n`)
  process.exitCode = 1
}

async function lerEstado() {
  if (!existsSync(ESTADO)) return {}
  try {
    return JSON.parse(await readFile(ESTADO, 'utf-8'))
  } catch {
    return {}
  }
}

/**
 * Marca ANTES de dormir.
 *
 * Gravar depois do intervalo deixaria até três minutos em que o e-mail já saiu
 * e o arquivo não sabe. `Ctrl+C` ali reenviaria — e e-mail repetido para o
 * mesmo endereço é a reclamação mais fácil de provocar que existe.
 */
async function marcar(email, extra = {}) {
  const estado = await lerEstado()
  estado[email] = { em: new Date().toISOString(), ...extra }
  await writeFile(ESTADO, JSON.stringify(estado, null, 2), 'utf-8')
}

async function lerDescadastros() {
  if (!URL_SUPABASE || !SERVICE) return { chaves: new Set(), dominios: new Set() }
  const r = await fetch(
    `${URL_SUPABASE}/rest/v1/descadastro_de_prospeccao?select=chave,dominio&limit=5000`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
  )
  // Falha aqui ABORTA, ao contrário da descoberta: seguir sem a lista manda
  // e-mail para quem pediu para sair, e é o primeiro item da lista do que
  // derruba um domínio.
  if (!r.ok) throw new Error(`nao consegui ler o descadastro: HTTP ${r.status}`)
  const linhas = await r.json()
  return {
    chaves: new Set(linhas.map((l) => l.chave)),
    dominios: new Set(linhas.filter((l) => l.dominio).map((l) => String(l.dominio).toLowerCase())),
  }
}

async function main() {
  console.log('')

  if (!DE) {
    return abortar(
      'falta PROSPECCAO_EMAIL_DE no .env.local.\n' +
        '  Exemplo: PROSPECCAO_EMAIL_DE="Orlando · Velo Funil <orlando@dominio-novo.com>"',
    )
  }

  // ## A trava que protege a recuperação de senha
  //
  // `email-frio.ts` registra a medição: o Google Postmaster mede reputação no
  // domínio RAIZ, não no subdomínio. Reclamação em `mail.velofunil.com.br`
  // derruba `velofunil.com.br`, de onde sai recuperação de senha — e o estrago
  // aparece semanas depois, como cliente que não consegue mais entrar.
  const endereco = DE.match(/<([^>]+)>/)?.[1] ?? DE
  const dominioDoRemetente = endereco.split('@')[1]?.toLowerCase() ?? ''
  if (/(^|\.)velofunil\.com\.br$/.test(dominioDoRemetente)) {
    return abortar(
      `PROSPECCAO_EMAIL_DE aponta para "${dominioDoRemetente}", o domínio do produto.\n` +
        '  Prospecção fria dali derruba a reputação de quem manda recuperação de senha.\n' +
        '  Subdomínio NÃO protege: o Google mede no domínio raiz. Use um domínio separado.',
    )
  }

  let dados
  try {
    const r = await fetch(`${ROTA}?dia=${DIA}`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    dados = await r.json()
  } catch (e) {
    return abortar(
      `não consegui ler ${ROTA} (${e.message}).\n` +
        '  A rota é local: o `npm run dev` precisa estar de pé na porta 3000.',
    )
  }
  if (dados.erro) return abortar(dados.erro)

  if (dados.conformidade !== 'ok') {
    return abortar(
      `o corpo não passa na conformidade da LGPD: ${dados.conformidade}\n` +
        '  Ela exige CNPJ, link de saída e a origem do contato — as três são\n' +
        '  invisíveis quando faltam, e só viram problema quando alguém reclama.',
    )
  }

  const descadastros = await lerDescadastros()
  const jaEnviados = await lerEstado()

  let fila = dados.fila.filter((d) => {
    if (jaEnviados[d.email]) return false
    if (descadastros.chaves.has(d.chaveDoDescadastro)) return false
    if (d.dominio && descadastros.dominios.has(d.dominio)) return false
    return true
  })
  if (SO) fila = fila.filter((d) => d.email === SO || d.dominio === SO)

  const vaoHoje = fila.slice(0, dados.tetoDoDia)

  console.log(`  remetente         ${DE}`)
  console.log(`  domínio           ${dominioDoRemetente}  (separado do produto — conferido)`)
  console.log(`  na lista          ${dados.total}`)
  console.log(`  pessoais / papel  ${dados.pessoais} / ${dados.papel}`)
  console.log(`  recusados         ${dados.recusados}  |  repetidos ${dados.repetidos}`)
  console.log(`  já enviados       ${Object.keys(jaEnviados).length}`)
  console.log(`  descadastrados    ${descadastros.chaves.size} chave(s)`)
  console.log(`  dia da caixa      ${DIA}  ->  teto ${dados.tetoDoDia}/dia`)
  console.log(`  vão nesta rodada  ${vaoHoje.length}  (sobram ${Math.max(0, fila.length - vaoHoje.length)})`)
  console.log(`  conformidade      CNPJ, link de saída e origem do contato: ok`)

  if (vaoHoje.length === 0) return console.log('\n  Nada a enviar.\n')

  if (!confirmar) {
    console.log('\n  ENSAIO — nada será enviado. O primeiro da fila:\n')
    console.log(`  Para:    ${vaoHoje[0].email}   (${vaoHoje[0].dominio})`)
    console.log(`  Assunto: ${vaoHoje[0].assunto}`)
    console.log('  ' + '-'.repeat(66))
    console.log(
      vaoHoje[0].corpo
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n'),
    )
    console.log('  ' + '-'.repeat(66))
    console.log('\n  Para enviar de verdade, repita com --confirmar.\n')
    return
  }

  if (!RESEND) return abortar('falta RESEND_API_KEY.')

  console.log(`\n  ENVIANDO ${vaoHoje.length}. Ctrl+C para no próximo intervalo, sem reenviar.\n`)
  let enviados = 0
  let falhasSeguidas = 0

  for (const [i, d] of vaoHoje.entries()) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: DE,
        to: d.email,
        ...(RESPONDER_PARA ? { reply_to: RESPONDER_PARA } : {}),
        subject: d.assunto,
        // Texto puro, sem `html`: e-mail frio com imagem ou pixel de abertura é
        // o que o filtro classifica como campanha. Texto puro chega.
        text: d.corpo,
      }),
    })

    if (r.ok) {
      const corpo = await r.json().catch(() => ({}))
      await marcar(d.email, { dominio: d.dominio, id: corpo.id ?? null, dia: DIA })
      enviados++
      falhasSeguidas = 0
      console.log(`  ${String(i + 1).padStart(3)}/${vaoHoje.length}  ok   ${d.email}`)
    } else {
      falhasSeguidas++
      const texto = await r.text()
      console.error(
        `  ${String(i + 1).padStart(3)}/${vaoHoje.length}  ERRO ${d.email}: HTTP ${r.status} ${texto.slice(0, 150)}`,
      )
      if (falhasSeguidas >= 3) {
        console.error('\n  3 falhas seguidas — PARANDO. Nada do que já saiu será reenviado.\n')
        break
      }
    }

    if (i < vaoHoje.length - 1) await dormir(sortear(INTERVALO_MIN, INTERVALO_MAX))
  }

  console.log(`\n  enviados ${enviados} de ${vaoHoje.length}`)
  console.log(`  o estado está em ${ESTADO} — rodar de novo continua de onde parou.`)
  console.log(`  amanhã: --dia=${DIA + 1}\n`)
}

main().catch((e) => abortar(`falha inesperada: ${e.message}`))
