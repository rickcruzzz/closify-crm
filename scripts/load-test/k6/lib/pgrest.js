// Helpers pra Trilha C, PostgREST/RPC direto com JWT de usuário real. É a
// camada certa pros 5 riscos de corrida e pros achados de query: são bugs de
// banco (RLS, trigger, falta de lock), reproduzíveis inteiramente aqui, sem
// precisar simular o roteamento de Server Action do Next.
import http from 'k6/http'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

export function headersFor(token, extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token.accessToken}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export function pgGet(path, token, params = {}) {
  return http.get(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: headersFor(token, params.headers),
    tags: params.tags,
  })
}

export function pgPost(path, token, body, params = {}) {
  return http.post(`${SUPABASE_URL}/rest/v1${path}`, JSON.stringify(body), {
    headers: headersFor(token, params.headers),
    tags: params.tags,
  })
}

/** HEAD com Prefer: count=exact, equivalente a .select('id',{count:'exact',head:true}) do supabase-js. */
export function pgHeadCount(path, token, params = {}) {
  return http.request('HEAD', `${SUPABASE_URL}/rest/v1${path}`, null, {
    headers: headersFor(token, { Prefer: 'count=exact', ...params.headers }),
    tags: params.tags,
  })
}

export function pgPatch(path, token, body, params = {}) {
  return http.patch(`${SUPABASE_URL}/rest/v1${path}`, JSON.stringify(body), {
    headers: headersFor(token, params.headers),
    tags: params.tags,
  })
}

export function rpc(name, token, args, params = {}) {
  return pgPost(`/rpc/${name}`, token, args, params)
}
