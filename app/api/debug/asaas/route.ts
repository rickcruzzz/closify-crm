import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

// ENDPOINT TEMPORÁRIO DE DIAGNÓSTICO — REMOVER APÓS O USO.
//
// Existe porque o checkout falha só dentro da Vercel: a mesma sequência de
// chamadas funciona 200 fora dela, e não há acesso ao painel nem à CLI para
// inspecionar o runtime. Sem isso o diagnóstico vira adivinhação.
//
// Nunca devolve material secreto: só comprimento e formato da chave (booleanos)
// e o que o Asaas responde. Protegido pelo mesmo `ASAAS_WEBHOOK_TOKEN` do
// webhook, que já está comprovadamente correto em produção — assim não é
// preciso cadastrar variável nova só para depurar.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ASAAS_BASE_URL = process.env.ASAAS_API_URL ?? 'https://api.asaas.com/v3'

function isValidToken(received: string | null): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (!received || !expected) return false

  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

/** Só formato, nunca conteúdo. */
function inspecionarChave(raw: string | undefined) {
  if (raw === undefined) return { definida: false as const }

  const normalizada = raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^\\/, '')

  return {
    definida: true as const,
    comprimentoBruto: raw.length,
    comprimentoNormalizado: normalizada.length,
    comecaComBarraInvertida: raw.startsWith('\\'),
    comecaComAspas: /^["']/.test(raw),
    temEspacoNasPontas: raw !== raw.trim(),
    comecaComAactAposNormalizar: normalizada.startsWith('$aact_'),
    ambienteDeProducao: normalizada.startsWith('$aact_prod_'),
  }
}

async function asaas(path: string, init?: RequestInit) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: (process.env.ASAAS_API_KEY ?? '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^\\/, ''),
      ...init?.headers,
    },
  })

  const texto = await res.text()

  // Faz o parse do corpo INTEIRO e só depois trunca para exibição. Truncar
  // antes quebrava o JSON no meio, o `JSON.parse` estourava, o id nunca era
  // capturado e a limpeza do `finally` não rodava — deixando cliente órfão na
  // conta real.
  let dados: unknown = null
  try {
    dados = JSON.parse(texto)
  } catch {
    dados = null
  }

  return { status: res.status, corpo: texto.slice(0, 300), dados }
}

export async function POST(request: Request) {
  if (!isValidToken(request.headers.get('asaas-access-token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'
  const nomeTeste = searchParams.get('nome') ?? 'Diagnostico Closify'

  const resultado: Record<string, unknown> = {
    chave: inspecionarChave(process.env.ASAAS_API_KEY),
    baseUrl: ASAAS_BASE_URL,
    // Confirma que o deploy servindo esta requisição é o que se espera.
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    ambienteVercel: process.env.VERCEL_ENV ?? null,
    statusDaConta: await asaas('/myAccount/status'),
  }

  if (!dryRun) return NextResponse.json(resultado)

  // Dry-run: percorre o mesmo caminho do createCheckout e desfaz tudo no fim.
  // É a única forma de provar que o cliente conseguirá pagar sem esperar que
  // alguém tente de verdade.
  const criados: { customerId?: string; subscriptionId?: string } = {}
  const etapas: Record<string, unknown> = {}

  try {
    const cliente = await asaas('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: nomeTeste,
        email: 'diagnostico.temporario@closify.dev',
        cpfCnpj: '86753375589',
        externalReference: JSON.stringify({ diagnostico: true }),
      }),
    })
    etapas.criarCliente = cliente
    if (cliente.status < 300) criados.customerId = (cliente.dados as { id?: string })?.id

    if (criados.customerId) {
      const assinatura = await asaas('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customer: criados.customerId,
          billingType: 'UNDEFINED',
          cycle: 'MONTHLY',
          value: 49,
          nextDueDate: new Date().toISOString().slice(0, 10),
          description: 'Closify CRM - Plano Pro',
          externalReference: JSON.stringify({ diagnostico: true }),
        }),
      })
      etapas.criarAssinatura = assinatura
      if (assinatura.status < 300)
        criados.subscriptionId = (assinatura.dados as { id?: string })?.id
    }

    if (criados.subscriptionId) {
      const pagamentos = await asaas(
        `/payments?subscription=${criados.subscriptionId}&limit=1`,
      )
      etapas.buscarLinkDePagamento = pagamentos
      if (pagamentos.status < 300) {
        etapas.invoiceUrlGerado = !!(
          pagamentos.dados as { data?: { invoiceUrl?: string }[] }
        )?.data?.[0]?.invoiceUrl
      }
    }
  } catch (err) {
    etapas.excecao = err instanceof Error ? err.message : String(err)
  } finally {
    // Limpeza mesmo se algo estourou no meio: nada de resíduo na conta real.
    if (criados.subscriptionId) {
      etapas.limpezaAssinatura = await asaas(`/subscriptions/${criados.subscriptionId}`, {
        method: 'DELETE',
      })
    }
    if (criados.customerId) {
      etapas.limpezaCliente = await asaas(`/customers/${criados.customerId}`, {
        method: 'DELETE',
      })
    }
  }

  resultado.dryRun = etapas
  return NextResponse.json(resultado)
}
