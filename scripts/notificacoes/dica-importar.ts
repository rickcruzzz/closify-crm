/**
 * Manda a dica de importação de lista: no sino e por e-mail.
 *
 *     npx tsx --env-file=.env.local scripts/notificacoes/dica-importar.ts <email>
 *     npx tsx --env-file=.env.local scripts/notificacoes/dica-importar.ts <email> --confirmar
 *
 * Sem `--confirmar` é ensaio: mostra o que sairia e não grava nem envia.
 *
 * ## Um destinatário por vez, e de propósito
 *
 * A alternativa era varrer todos os workspaces. Não serve aqui por duas razões
 * medidas: das 48 empresas, 40 são contas de teste do dono — encher o sino
 * dele de ruído é o oposto do que a regra do sino existe para proteger — e
 * várias das externas usam e-mail descartável (`fanzher.com`, `dd2car.com`),
 * que só geram bounce.
 *
 * E bounce não é inofensivo: o domínio que manda esta dica é o MESMO que manda
 * recuperação de senha. Reputação queimada aqui aparece semanas depois como
 * cliente que não consegue voltar para a conta.
 *
 * ## Idempotente nos dois canais
 *
 * A notificação confere se já existe uma do mesmo tipo para aquela empresa. O
 * e-mail não tem como conferir sozinho — o Resend não sabe o que é repetido —,
 * então ele só sai quando a notificação também sai. Os dois andam juntos.
 */
import { renderDicaImportarListaEmail } from '@/lib/emails/dica-importar-lista'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendKey = process.env.RESEND_API_KEY
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.velofunil.com.br'

const alvo = process.argv[2]
const CONFIRMAR = process.argv.includes('--confirmar')

if (!alvo || alvo.startsWith('--')) {
  console.error('\n  uso: dica-importar.ts <email> [--confirmar]\n')
  process.exit(1)
}
if (!url || !key || !resendKey) {
  console.error('\n  faltam SUPABASE_* ou RESEND_API_KEY\n')
  process.exit(1)
}

const h = { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' }

const AVISO = {
  tipo: 'dica_de_uso' as const,
  titulo: 'Dá para importar sua lista de uma planilha',
  corpo: 'Excel ou CSV, em segundos, em vez de cadastrar um a um. A gente lê as colunas sozinho.',
  // `?importar=1` abre o diálogo pronto. Mandar para `/leads` puro repetiria o
  // passo que já falhou: a pessoa chega na tela e tem que achar o botão.
  href: '/leads?importar=1',
}

async function main() {
  // Quem é, e quais empresas ele criou.
  const lista = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: h }).then((r) => r.json())
  const usuario = (lista.users ?? []).find((u: { email?: string }) => u.email === alvo)
  if (!usuario) {
    console.error(`\n  nao achei ${alvo}\n`)
    process.exit(1)
  }

  const empresas: { id: string; name: string }[] = await fetch(
    `${url}/rest/v1/workspaces?select=id,name&created_by=eq.${usuario.id}`,
    { headers: h },
  ).then((r) => r.json())

  const jaTem: { workspace_id: string }[] = await fetch(
    `${url}/rest/v1/notificacoes?select=workspace_id&tipo=eq.${AVISO.tipo}`,
    { headers: h },
  ).then((r) => r.json())
  const recebidos = new Set(jaTem.map((n) => n.workspace_id))
  const alvos = empresas.filter((e) => !recebidos.has(e.id))

  const email = renderDicaImportarListaEmail({ appUrl })

  console.log('')
  console.log(`  destinatario : ${alvo}`)
  console.log(`  empresas     : ${empresas.map((e) => e.name).join(', ') || '(nenhuma)'}`)
  console.log(`  vao receber  : ${alvos.length}`)
  console.log('')
  console.log('  ┌─ no sino ──────────────────────────────────────────')
  console.log(`  │  ·  ${AVISO.titulo}`)
  console.log(`  │     ${AVISO.corpo}`)
  console.log(`  │     ->  ${AVISO.href}`)
  console.log('  └────────────────────────────────────────────────────')
  console.log('')
  console.log(`  e-mail, assunto: "${email.subject}"`)
  console.log(`  html           : ${email.html.length} bytes`)
  console.log('')

  if (!alvos.length) {
    console.log('  ja recebeu. nada a fazer.\n')
    return
  }
  if (!CONFIRMAR) {
    console.log('  ENSAIO — nada gravado, nada enviado. Use --confirmar.\n')
    return
  }

  const r = await fetch(`${url}/rest/v1/notificacoes`, {
    method: 'POST',
    headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify(alvos.map((e) => ({ workspace_id: e.id, ...AVISO }))),
  })
  if (!r.ok) {
    console.error(`  notificacao FALHOU ${r.status}: ${(await r.text()).slice(0, 200)}\n`)
    process.exit(1)
  }
  console.log(`  notificacao gravada: ${(await r.json()).length}`)

  const env = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'Velo Funil <suporte@velofunil.com.br>',
      to: [alvo],
      subject: email.subject,
      html: email.html,
    }),
  })
  const corpo = await env.json()
  console.log(env.ok ? `  e-mail enviado     : ${corpo.id}\n` : `  e-mail FALHOU: ${JSON.stringify(corpo).slice(0, 200)}\n`)
}

main()
