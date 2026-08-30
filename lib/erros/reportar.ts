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
  /**
   * A árvore de componentes React, por NOME.
   *
   * Só quem chama daqui é `CapturaDeComponente`, o boundary de classe — o
   * `error.tsx` do App Router recebe apenas `{ error, reset }` e não tem
   * acesso a isto. É a diferença entre um stack minificado que não nomeia
   * arquivo nenhum e saber qual componente entrou em loop.
   */
  componentStack?: string,
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
        componentStack,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        origem,
      }),
    }).catch(() => {})
  } catch {
    // `fetch`/`JSON.stringify` falhando aqui não pode propagar.
  }
}
