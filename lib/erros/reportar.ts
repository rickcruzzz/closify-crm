/**
 * Marca de "este erro já foi reportado COM a árvore de componentes".
 *
 * `Symbol.for` e não `Symbol()` de propósito: o registro global é o mesmo
 * mesmo que o módulo seja duplicado entre chunks do webpack, e aqui ele é —
 * `CapturaDeComponente` vive no chunk da página e `error.tsx` no do segmento.
 * Com `Symbol()` cada cópia teria a própria chave e a marca não seria vista.
 */
const JA_REPORTADO_COM_ARVORE = Symbol.for('velofunil.erro.reportado-com-arvore')

/**
 * O erro já passou por `CapturaDeComponente` e foi gravado com `componentStack`?
 *
 * Existe porque o relance de `CapturaDeComponente` sobe o MESMO objeto `Error`
 * para o `error.tsx` do segmento, e os dois reportam. Sem esta checagem, cada
 * incidente gravaria duas linhas em `error_logs` — e a segunda é a pior das
 * duas, porque é a que não nomeia componente nenhum.
 */
export function jaReportadoComArvore(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false
  return (erro as Record<symbol, unknown>)[JA_REPORTADO_COM_ARVORE] === true
}

/**
 * Os tetos do schema de `app/api/log-erro/route.ts`.
 *
 * Repetidos aqui de propósito, e o motivo é o defeito que os pôs aqui: a rota
 * responde **400 e descarta a linha inteira** quando um campo passa do teto —
 * ela valida, não corta. Medido: uma árvore de componentes de verdade, com os
 * wrappers do App Router, passa de 8000 caracteres com folga, e o relato mais
 * valioso era justamente o que sempre seria recusado.
 *
 * Cortar no CLIENTE troca "linha nenhuma" por "linha com o que importa".
 */
const TETO = { message: 2000, stack: 8000, componentStack: 8000, url: 2000 } as const

/**
 * Corta pelo FIM, preservando o começo.
 *
 * A ordem não é indiferente: tanto no `stack` quanto na árvore de componentes,
 * o quadro mais interno — o que nomeia quem quebrou — vem PRIMEIRO. O que se
 * perde no corte são os wrappers do framework, que são iguais em todo erro.
 */
export function cortarParaCaber(texto: string | undefined, teto: number) {
  if (!texto) return texto
  if (texto.length <= teto) return texto
  const aviso = '\n[cortado]'
  return texto.slice(0, teto - aviso.length) + aviso
}

/**
 * Manda o erro capturado por um error boundary para `/api/log-erro`, sem
 * bloquear nem lançar: um boundary que falha ao REPORTAR o erro não pode
 * virar um segundo erro visível ao usuário. `keepalive` garante o envio
 * mesmo que a navegação mude logo em seguida (ex.: a pessoa clica em
 * "Tentar novamente" antes do fetch terminar).
 */
export function reportarErro(
  error: Error & { digest?: string },
  /**
   * De onde veio.
   *
   * `funil` nasceu em 11/09 com `FunilResiliente`: separa a falha de INTERAÇÃO
   * dentro do Kanban da falha de CARGA da rota, que reporta como `dashboard`.
   * Sem a distinção as duas viram a mesma linha no banco, e a investigação
   * começa sem saber qual das duas foi.
   *
   * A coluna `error_logs.origem` é texto livre — conferido com insert real
   * contra produção antes de acrescentar, então não houve migration.
   */
  origem: 'dashboard' | 'funil' | 'global' | 'publico',
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
  if (componentStack) marcarComoReportado(error)

  try {
    fetch('/api/log-erro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: cortarParaCaber(error.message, TETO.message),
        digest: error.digest,
        stack: cortarParaCaber(error.stack, TETO.stack),
        componentStack: cortarParaCaber(componentStack, TETO.componentStack),
        url: cortarParaCaber(
          typeof window !== 'undefined' ? window.location.href : undefined,
          TETO.url,
        ),
        origem,
      }),
    }).catch(() => {})
  } catch {
    // `fetch`/`JSON.stringify` falhando aqui não pode propagar.
  }
}

/**
 * A marca vai como propriedade não enumerável para não aparecer em nenhuma
 * serialização do erro. `try/catch` porque `Error` congelado (`Object.freeze`)
 * faria `defineProperty` lançar — e perder a dedupe é bem melhor que derrubar
 * o boundary que está tratando um erro.
 */
function marcarComoReportado(erro: object) {
  try {
    Object.defineProperty(erro, JA_REPORTADO_COM_ARVORE, {
      value: true,
      enumerable: false,
      configurable: true,
    })
  } catch {
    // Erro congelado: segue sem dedupe.
  }
}
