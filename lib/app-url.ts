// Remove barra final defensivamente — NEXT_PUBLIC_APP_URL configurada com
// "/" no fim (comum ao colar do navegador) já causou redirect_to com barra
// dupla ("app//auth/callback") em produção, o que quebra o allowlist de
// redirect do provider OAuth no Supabase.
export function appUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return url.replace(/\/+$/, '')
}
