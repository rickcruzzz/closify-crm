import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Rode com: node --env-file=.env.local scripts/supabase/preparar-ambiente-cliente.mjs
// Mantém a instalação principal apontando para o banco atual. O arquivo gerado
// é ignorado pelo Git e deve ser usado somente na instalação deste cliente.
const credenciais = {
  CLIENTE_SUPABASE_URL: process.env.CLIENTE_SUPABASE_URL ?? process.env.url_supabase,
  CLIENTE_SUPABASE_ANON_KEY:
    process.env.CLIENTE_SUPABASE_ANON_KEY ??
    process.env.supabase_public_key ??
    process.env.supbasae_anon_public_key,
  CLIENTE_SUPABASE_SERVICE_ROLE_KEY:
    process.env.CLIENTE_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.supabase_secret_key ??
    process.env.supabasase_service_role_key,
}

const ausentes = Object.entries(credenciais)
  .filter(([, valor]) => !valor)
  .map(([nome]) => nome)

if (ausentes.length) {
  throw new Error('Credenciais do cliente ausentes em .env.local: ' + ausentes.join(', '))
}

const url = new URL(credenciais.CLIENTE_SUPABASE_URL)
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/$/.test(url.href)) {
  throw new Error('CLIENTE_SUPABASE_URL precisa apontar para um projeto Supabase HTTPS.')
}

const valores = {
  NEXT_PUBLIC_SUPABASE_URL: credenciais.CLIENTE_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: credenciais.CLIENTE_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: credenciais.CLIENTE_SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.CLIENTE_APP_URL ?? 'http://localhost:3000',
}

const destino = fileURLToPath(new URL('../../.env.enterprise.local', import.meta.url))
const linha = (nome, valor) => `${nome}=${JSON.stringify(valor)}\n`
const conteudo =
  '# Instalação exclusiva do cliente Enterprise; não versionar.\n' +
  Object.entries(valores).map(([nome, valor]) => linha(nome, valor)).join('')

await writeFile(destino, conteudo, { flag: 'wx', mode: 0o600 })
process.stdout.write('Ambiente isolado do cliente criado em .env.enterprise.local.\n')
