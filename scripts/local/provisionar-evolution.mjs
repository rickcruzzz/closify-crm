/**
 * Os DOIS logins do Max pela Evolution, criados ponta a ponta.
 *
 * ## O que ele faz, por login
 *
 *     1  conta em auth.users, e-mail JA CONFIRMADO
 *     2  empresa, com `plan = 'pro'`
 *     3  vinculo como admin, e onboarding marcado como concluido
 *     4  assinatura `active` / `plano = 'max'`
 *     5  PROVA: `max_vigente(empresa)` tem que devolver TRUE
 *     6  instancia na Evolution, webhook apontado, e o token CIFRADO no banco
 *     7  PROVA: o webhook lido de volta, e `escolherRemetente` achando evolution
 *
 * ## Uso
 *
 *     node --env-file=.env.local scripts/local/provisionar-evolution.mjs --ensaio
 *     node --env-file=.env.local scripts/local/provisionar-evolution.mjs --confirmar
 *     node --env-file=.env.local scripts/local/provisionar-evolution.mjs --limpar
 *
 * `--ensaio` e o padrao: ele confere credencial, fala com a Evolution, mostra o
 * que faria e **nao escreve nada**. Mesmo desenho de `publicar-instagram.mjs`.
 *
 * ## `plan = 'pro'` no Max nao e erro, e a leitura errada e facil
 *
 * `workspace_plan` e enum de DOIS valores, e a 0089 deixou assim de proposito:
 * `pro_vigente()` e lida por sete lugares, e acrescentar `'max'` ao enum
 * obrigaria a reler os sete — *"um esquecido vira cliente de R$ 250 tomando o
 * limite do Free na cara"*.
 *
 * Quem responde "tem Max" e `max_vigente()`, pela coluna `subscriptions.plano`.
 * E por isso que o passo 5 existe: sem ele, este script afirmaria Max e a unica
 * prova seria um `insert` que passou.
 *
 * ## O e-mail usa `+` de proposito
 *
 * `henriquestn24+maxN@gmail.com` entrega na MESMA caixa do dono. Ele recebe
 * confirmacao e recuperacao de senha de verdade, o que nao aconteceria com um
 * dominio inventado — e as contas continuam sendo dele, que e o requisito da
 * lista de `lib/whatsapp/evolution-permitida.ts`.
 *
 * ## A cifra e repetida aqui, e o teste que impede a divergencia existe
 *
 * `lib/integrations/crypto.ts` e TypeScript e este arquivo e `.mjs`; o projeto
 * nao tem runner de TS instalado. O caso
 * *"decifra o que a receita crua do Node produz"*, em
 * `lib/integrations/crypto.test.ts`, trava o layout dos dois lados.
 */

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto'

const REF = 'tmyeunithjqkbwvezyyn'
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CHAVE_CIFRA = process.env.INTEGRATIONS_ENCRYPTION_KEY
const TOKEN_MANAGEMENT = process.env.SUPABASE_ACCESS_TOKEN

const EVO = process.env.EVOLUTION_BASE_URL ?? 'https://8-evolution-api.zohnng.easypanel.host'
const EVO_KEY = process.env.EVOLUTION_GLOBAL_API_KEY ?? process.env.EVOLUTION_API_KEY

/**
 * O destino do webhook, e ele NAO sai do `.env.local`.
 *
 * `NEXT_PUBLIC_APP_URL` local vale `http://localhost:3000`, e a Evolution roda
 * numa VPS em Boston: ela nunca alcancaria esse endereco. Apontar para la
 * produziria o pior sintoma que este produto conhece — a tela dizendo conectado
 * e nenhuma mensagem chegando, sem nada falhar.
 *
 * E o defeito de 18/09 com outro nome: os webhooks da Z-API ficaram apontados
 * para um caminho sem rota, e so a primeira mensagem real expos isso.
 *
 * O padrao e producao. `--url=https://...` sobrepoe, e qualquer coisa que nao
 * seja HTTPS **aborta** em vez de gravar.
 */
const daLinha = process.argv.find((a) => a.startsWith('--url='))?.slice(6)
const APP = (daLinha ?? 'https://www.velofunil.com.br').replace(/\/+$/, '')
const URL_WEBHOOK = `${APP}/api/webhooks/evolution/cliente`

const CONFIRMAR = process.argv.includes('--confirmar')
const LIMPAR = process.argv.includes('--limpar')
const CONFERIR = process.argv.includes('--conferir')

/** Os dois. O `apelido` entra no nome da empresa e no e-mail. */
const LOGINS = [
  { apelido: 'max1', empresa: 'Velo Max 1' },
  { apelido: 'max2', empresa: 'Velo Max 2' },
]

const emailDe = (apelido) => `henriquestn24+${apelido}@gmail.com`

function faltando() {
  const f = []
  if (!URL_SUPABASE) f.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SERVICE) f.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!CHAVE_CIFRA) f.push('INTEGRATIONS_ENCRYPTION_KEY')
  if (!TOKEN_MANAGEMENT) f.push('SUPABASE_ACCESS_TOKEN')
  if (!EVO_KEY) f.push('EVOLUTION_GLOBAL_API_KEY')
  return f
}

/**
 * HTTPS e obrigatorio, e `localhost` nunca serve.
 *
 * A VPS fica em Boston e nao alcanca a sua maquina. Ver o comentario de
 * `URL_WEBHOOK`: gravar um destino inalcancavel entrega um QR que pareia o
 * numero do cliente e depois engole toda mensagem dele.
 */
function destinoInvalido() {
  if (!URL_WEBHOOK.startsWith('https://')) return 'o destino precisa ser HTTPS'
  if (/^https:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(URL_WEBHOOK)) {
    return 'a VPS nao alcanca localhost'
  }
  return null
}

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

/**
 * SQL pela Management API.
 *
 * O caminho que a sessao de 16/09 destravou depois de declarar bloqueio: o MCP
 * respondeu "is not connected" e o CLI nao esta linkado, e o token estava no
 * `.env.local` desde sempre.
 */
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_MANAGEMENT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`SQL ${r.status}: ${texto.slice(0, 400)}`)
  return texto ? JSON.parse(texto) : []
}

async function admin(caminho, opcoes = {}) {
  const r = await fetch(`${URL_SUPABASE}/auth/v1${caminho}`, {
    method: opcoes.method ?? 'GET',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`auth ${caminho} ${r.status}: ${texto.slice(0, 300)}`)
  return texto ? JSON.parse(texto) : {}
}

async function evolution(caminho, opcoes = {}) {
  const r = await fetch(`${EVO}${caminho}`, {
    method: opcoes.method ?? 'GET',
    headers: { apikey: opcoes.apikey ?? EVO_KEY, 'Content-Type': 'application/json' },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`evolution ${caminho} ${r.status}: ${texto.slice(0, 300)}`)
  return texto ? JSON.parse(texto) : {}
}

// ---------------------------------------------------------------------------
// Cifra e segredos
// ---------------------------------------------------------------------------

/** Ver o cabecalho: o layout e travado por `lib/integrations/crypto.test.ts`. */
function cifrar(textoPlano) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(CHAVE_CIFRA, 'hex'), iv)
  const cifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()])
  const hex = Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString('hex')
  return '\\x' + hex
}

/**
 * O inverso de `cifrar`, e existe SO para a conferencia.
 *
 * `setAuthTag` verifica integridade: payload cifrado com outra chave estoura
 * aqui em vez de devolver lixo em silencio.
 */
function decifrar(valorBytea) {
  const hex = valorBytea.startsWith('\\x') ? valorBytea.slice(2) : valorBytea
  const payload = Buffer.from(hex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(CHAVE_CIFRA, 'hex'), payload.subarray(0, 12))
  decipher.setAuthTag(payload.subarray(12, 28))
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8')
}

/** 32 bytes em hex, o mesmo formato que `instanciaPorSegredo` exige. */
const segredoNovo = () => randomBytes(32).toString('hex')

/**
 * Senha forte, IMPRESSA UMA VEZ e nunca gravada em arquivo.
 *
 * Quatro grupos garantidos: a politica do Supabase recusa senha fraca, e um
 * sorteio puro erra isso de vez em quando — o que apareceria como falha
 * intermitente numa criacao que nao tem nada de errado.
 */
function senhaNova() {
  const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?']
  const bytes = randomBytes(24)
  const escolhido = grupos.map((g, i) => g[bytes[i] % g.length])
  const resto = Array.from(bytes.subarray(4, 20), (b) => {
    const todos = grupos.join('')
    return todos[b % todos.length]
  })
  return [...escolhido, ...resto].join('')
}

const cru = (s) => `'${String(s).replace(/'/g, "''")}'`

// ---------------------------------------------------------------------------
// Limpar
// ---------------------------------------------------------------------------

async function limpar() {
  for (const { apelido } of LOGINS) {
    const email = emailDe(apelido)
    const achados = await sql(`select id from auth.users where email = ${cru(email)}`)
    if (achados.length === 0) {
      console.log(`  ${email}: nao existe`)
      continue
    }
    const userId = achados[0].id

    // A instancia sai do PROVEDOR primeiro. Esquecer a linha antes deixaria uma
    // instancia viva que nenhuma tela alcanca e nenhuma varredura reencontra,
    // que e a regra de "provedor primeiro" da 0091.
    const instancias = await sql(
      `select instance_id from public.whatsapp_instances
       where provider = 'evolution'
         and workspace_id in (select workspace_id from public.workspace_members where user_id = '${userId}')`,
    )
    for (const i of instancias) {
      try {
        await evolution(`/instance/delete/${encodeURIComponent(i.instance_id)}`, {
          method: 'DELETE',
        })
        console.log(`  instancia ${i.instance_id} apagada no provedor`)
      } catch (erro) {
        console.log(`  AVISO: ${i.instance_id} NAO foi apagada no provedor: ${erro.message}`)
      }
    }

    // `excluir_minha_conta` nao serve aqui: ela exige sessao do proprio usuario.
    // A empresa vai primeiro porque `workspaces.created_by` aponta para a conta.
    await sql(`delete from public.workspaces where created_by = '${userId}'`)
    await admin(`/admin/users/${userId}`, { method: 'DELETE' })
    console.log(`  ${email}: conta e empresa apagadas`)
  }
}

// ---------------------------------------------------------------------------
// Provisionar
// ---------------------------------------------------------------------------

async function provisionarUm({ apelido, empresa }) {
  const email = emailDe(apelido)
  const senha = senhaNova()

  const jaTem = await sql(`select id from auth.users where email = ${cru(email)}`)
  if (jaTem.length > 0) {
    console.log(`\n${email}: JA EXISTE (user ${jaTem[0].id}). Pulando.`)
    console.log('  Para refazer: --limpar antes.')
    return null
  }

  console.log(`\n${email}`)

  // 1. A conta, com e-mail JA confirmado: sem isso o login cai em /confirmar e
  // o primeiro acesso depende de abrir a caixa de entrada.
  const conta = await admin('/admin/users', {
    method: 'POST',
    body: { email, password: senha, email_confirm: true },
  })
  console.log(`  1. conta criada       ${conta.id}`)

  // ## 2 a 4 vao numa REQUISICAO so, e o motivo custou uma conta orfa
  //
  // A Management API abre **uma transacao por requisicao**: um `begin` numa
  // chamada e `commit` na seguinte nao existem como transacao, e a primeira e
  // desfeita quando a conexao fecha. A empresa "inserida" evaporou, e o
  // `workspace_members` da chamada seguinte tomou 23503 apontando para ela.
  //
  // A saida e gerar o id AQUI. Sem ele, pegar o `returning` de um `insert`
  // obrigaria a segunda requisicao, que e exatamente o que nao funciona.
  const workspaceId = randomUUID()

  try {
    await sql(`
      insert into public.workspaces (id, name, plan, created_by)
        values ('${workspaceId}', ${cru(empresa)}, 'pro', '${conta.id}');

      insert into public.workspace_members (workspace_id, user_id, role)
        values ('${workspaceId}', '${conta.id}', 'admin');

      insert into public.onboarding_state (user_id, status, tour_status, respostas)
        values ('${conta.id}', 'completed', 'completed', '{}'::jsonb);

      insert into public.subscriptions (workspace_id, status, plano, ciclo, current_period_end)
        values ('${workspaceId}', 'active', 'max', 'MONTHLY', now() + interval '30 days');
    `)
  } catch (erro) {
    // A conta ja existe neste ponto. Deixa-la sem empresa seria uma conta presa
    // em /bem-vindo, que nenhuma rodada deste script reencontra: o `select` de
    // entrada a veria como "JA EXISTE" e pularia para sempre.
    await admin(`/admin/users/${conta.id}`, { method: 'DELETE' })
    throw erro
  }

  console.log(`  2. empresa            ${workspaceId}`)
  console.log('  3. admin + onboarding concluido')
  console.log('  4. assinatura         active / max / MONTHLY / +30 dias')

  // 5. A PROVA do Max. `insert` que passou nao prova que a funcao concorda: ela
  // le `assinatura_compra_acesso`, que a 0098 acrescentou, e e ELA que a
  // trigger do passo 6 consulta.
  const [{ max_vigente: temMax, pro_vigente: temPro }] = await sql(
    `select public.max_vigente('${workspaceId}') as max_vigente,
            public.pro_vigente('${workspaceId}') as pro_vigente`,
  )
  if (temMax !== true) {
    throw new Error(`max_vigente devolveu ${temMax} para ${workspaceId}. A conexao seria recusada.`)
  }
  console.log(`  5. PROVA              max_vigente=${temMax} pro_vigente=${temPro}`)

  // 6. A instancia. O nome carrega o id da empresa: nome de empresa se repete, e
  // e isso que torna auditavel um painel com dezenas de linhas.
  const nome = `velofunil-${workspaceId}`
  const segredo = segredoNovo()

  const criada = await evolution('/instance/create', {
    method: 'POST',
    body: { instanceName: nome, integration: 'WHATSAPP-BAILEYS', qrcode: false },
  })
  const token = criada.hash
  if (!token) throw new Error('a Evolution criou a instancia e nao devolveu `hash`')
  console.log(`  6. instancia          ${nome}`)

  // O segredo vai no CABECALHO, nao na URL: a Vercel registra a URL de toda
  // requisicao em log, e log fica fora de qualquer purga.
  await evolution(`/webhook/set/${encodeURIComponent(nome)}`, {
    method: 'POST',
    body: {
      webhook: {
        enabled: true,
        url: URL_WEBHOOK,
        headers: { authorization: `Bearer ${segredo}` },
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        byEvents: false,
        base64: false,
      },
    },
  })

  // 7. A PROVA do webhook, lida de volta. Aceitar nao e entregar: o 201 do
  // `sendButtons` de 12/09 respondeu quatro vezes sem renderizar nada.
  const conferido = await evolution(`/webhook/find/${encodeURIComponent(nome)}`)
  const urlOk = conferido.url === URL_WEBHOOK
  const cabecalhoOk = Boolean(conferido.headers?.authorization)
  if (!urlOk || !cabecalhoOk || conferido.enabled !== true) {
    await evolution(`/instance/delete/${encodeURIComponent(nome)}`, { method: 'DELETE' }).catch(
      () => {},
    )
    throw new Error(
      `webhook nao confirmou: enabled=${conferido.enabled} url=${conferido.url} cabecalho=${cabecalhoOk}`,
    )
  }
  console.log(`  7. PROVA webhook      enabled=true url ok cabecalho presente`)

  // A linha. `status = 'conectando'`: ninguem leu QR nenhum ainda, e gravar
  // `conectado` faria a tela mentir — o defeito que a conferencia de 23/09
  // existe para pegar.
  try {
    await sql(`
      insert into public.whatsapp_instances
        (workspace_id, provider, instance_id, token_cifrado, segredo_do_webhook, status)
      values ('${workspaceId}', 'evolution', ${cru(nome)}, ${cru(cifrar(token))}, ${cru(segredo)}, 'conectando');
    `)
  } catch (erro) {
    // Instancia sem linha ocupa a VPS e nenhuma tela alcanca. Mesmo rollback da
    // Server Action.
    await evolution(`/instance/delete/${encodeURIComponent(nome)}`, { method: 'DELETE' }).catch(
      () => {},
    )
    throw erro
  }

  const [{ provider }] = await sql(
    `select provider from public.whatsapp_instances where workspace_id = '${workspaceId}'`,
  )
  console.log(`  8. PROVA banco        provider=${provider} (escolherRemetente le esta coluna)`)

  return { email, senha, workspaceId, nome }
}


/**
 * A conferencia que separa "gravou" de "funciona".
 *
 * ## O que so ela responde
 *
 * O provisionamento prova que o `insert` passou e que o webhook foi aceito. Nao
 * prova que o token GRAVADO ainda vale: se a cifra e a decifra divergirem, a
 * linha fica ali com aparencia de dado bom e o primeiro envio real toma 401 —
 * e o remetente traduz isso para *"o WhatsApp desta empresa perdeu a
 * autorizacao"*, que manda a pessoa reparear por nada.
 *
 * A prova e usar o token decifrado como `apikey` contra o proprio servidor. Se
 * a Evolution aceita, o ciclo cifrar/gravar/ler/decifrar fechou inteiro.
 *
 * ## E o CONTROLE, sem o qual isto nao prova nada
 *
 * Um token adulterado tem que ser RECUSADO. Sem esse caso, um servidor que
 * ignorasse o `apikey` por instancia daria "aceito" para qualquer coisa, e a
 * conferencia passaria dizendo que a cifra esta boa mesmo se estivesse quebrada.
 */
async function conferir() {
  const linhas = await sql(`
    select w.id, w.name, i.instance_id, i.token_cifrado, i.status,
           public.max_vigente(w.id) as tem_max
      from public.whatsapp_instances i
      join public.workspaces w on w.id = i.workspace_id
     where i.provider = 'evolution'
     order by w.name
  `)

  if (linhas.length === 0) {
    console.log('Nenhuma instancia `evolution` no banco.')
    return
  }

  for (const l of linhas) {
    console.log(`
${l.name}  (${l.id})`)
    console.log(`  banco        status=${l.status} max_vigente=${l.tem_max}`)

    let token
    try {
      token = decifrar(l.token_cifrado)
    } catch (erro) {
      console.log(`  CIFRA        FALHOU ao decifrar: ${erro.message}`)
      continue
    }
    console.log(`  cifra        decifrou ${token.length} caracteres`)

    // A PROVA: o token decifrado, contra o servidor, sem a chave global.
    try {
      const estado = await evolution(
        `/instance/connectionState/${encodeURIComponent(l.instance_id)}`,
        { apikey: token },
      )
      console.log(`  PROVA token   ACEITO  state=${estado.instance?.state ?? '?'}`)
    } catch (erro) {
      console.log(`  PROVA token   RECUSADO: ${erro.message}`)
      continue
    }

    // O CONTROLE. Ver o cabecalho.
    const adulterado = token.slice(0, -4) + 'zzzz'
    try {
      await evolution(`/instance/connectionState/${encodeURIComponent(l.instance_id)}`, {
        apikey: adulterado,
      })
      console.log('  CONTROLE      FALHOU: token adulterado foi ACEITO. A prova acima nao vale.')
    } catch {
      console.log('  CONTROLE      token adulterado recusado, como tem que ser')
    }

    const wh = await evolution(`/webhook/find/${encodeURIComponent(l.instance_id)}`)
    console.log(
      `  webhook      enabled=${wh.enabled} cabecalho=${Boolean(wh.headers?.authorization)} url=${wh.url}`,
    )
    console.log(`               eventos=${(wh.events ?? []).join(',')}`)
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const f = faltando()
  if (f.length > 0) {
    console.error(`Faltam variaveis no .env.local: ${f.join(', ')}`)
    process.exit(1)
  }

  const ruim = destinoInvalido()
  if (ruim) {
    console.error(`Destino de webhook invalido (${URL_WEBHOOK}): ${ruim}.`)
    console.error('Use --url=https://www.velofunil.com.br ou deixe o padrao.')
    process.exit(1)
  }

  if (CONFERIR) {
    await conferir()
    return
  }

  if (LIMPAR) {
    console.log('LIMPANDO os dois logins.\n')
    await limpar()
    return
  }

  // A Evolution primeiro: se ela nao responde, nao vale criar conta nenhuma.
  const versao = await evolution('/')
  console.log(`Evolution ${versao.version ?? '?'} em ${EVO}`)
  console.log(`Webhook de destino: ${URL_WEBHOOK}`)

  if (!CONFIRMAR) {
    console.log('\nENSAIO. Nada foi escrito. O que --confirmar faria:\n')
    for (const { apelido, empresa } of LOGINS) {
      console.log(`  ${emailDe(apelido).padEnd(34)} empresa "${empresa}", Max ativo, instancia nova`)
    }
    const existentes = await evolution('/instance/fetchInstances')
    const nomes = (Array.isArray(existentes) ? existentes : []).map(
      (i) => i.name ?? i.instance?.instanceName ?? '?',
    )
    console.log(`\n  instancias hoje no servidor: ${nomes.length} (${nomes.join(', ')})`)
    console.log('\n  Rode de novo com --confirmar.')
    return
  }

  const feitos = []
  for (const login of LOGINS) {
    feitos.push(await provisionarUm(login))
  }

  const criados = feitos.filter(Boolean)
  if (criados.length === 0) return

  console.log('\n' + '='.repeat(72))
  console.log('AS SENHAS APARECEM UMA VEZ SO. Guarde agora, elas nao ficam em disco.')
  console.log('='.repeat(72))
  for (const c of criados) {
    console.log(`\n  ${c.email}`)
    console.log(`  senha: ${c.senha}`)
    console.log(`  empresa: ${c.workspaceId}`)
  }

  console.log('\nFALTA UM PASSO, e ele e do dono:')
  console.log('  EVOLUTION_WORKSPACES_PERMITIDOS no .env.local e na Vercel:')
  console.log(`  ${criados.map((c) => c.workspaceId).join(',')}`)
  console.log('\n  Sem isso `conectarWhatsappEvolution` RECUSA as duas, de proposito.')
  console.log('  Ver lib/whatsapp/evolution-permitida.ts: a VPS fica em Boston.')
}

main().catch((erro) => {
  console.error(`\nFALHOU: ${erro.message}`)
  process.exit(1)
})
