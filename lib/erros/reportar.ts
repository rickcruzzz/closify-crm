/**
 * Manda o erro capturado por um error boundary para `/api/log-erro`, sem
 * bloquear nem lançar: um boundary que falha ao REPORTAR o erro não pode
 * virar um segundo erro visível ao usuário. `keepalive` garante o envio
 * mesmo que a navegação mude logo em seguida (ex.: a pessoa clica em
 * "Tentar novamente" antes do fetch terminar).
 */
export function reportarErro(
  error: Error & { digest?: string },
  origem: 'dashboard' | 'global' | 'publico',
) {
  try {
    fetch('/api/log-erro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        origem,
      }),
    }).catch(() => {})
  } catch {
    // `fetch`/`JSON.stringify` falhando aqui não pode propagar.
  }
}
