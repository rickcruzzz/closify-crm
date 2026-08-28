/**
 * O `z` do projeto inteiro, com a sondagem de JIT desligada.
 *
 * ## Por que este arquivo existe
 *
 * A CSP deste produto viveu em `Report-Only` desde que foi escrita, por causa
 * de **uma** violação por página — sempre a mesma, sempre `script-src`/`eval`.
 * Medida em produção em 27/08/2026 e rastreada até a origem:
 *
 *     chunks/6058-….js:62
 *     try { return Function(""), true } catch (e) { return false }
 *
 * É o `allowsEval` do Zod v4. Não é uso de `eval`: é **sondagem de recurso**,
 * uma chamada dentro de `try/catch` só para descobrir se o ambiente permite
 * compilar validador com JIT. Bloqueada pela CSP, o `catch` devolve `false` e
 * o Zod segue pelo caminho interpretado — nada quebra, mas o navegador
 * **reporta a violação assim mesmo**, porque a tentativa aconteceu.
 *
 * O próprio Zod documenta o caso e oferece a saída (`v4/core/util.js`):
 *
 *     // Skip the probe under `jitless`: strict CSPs report the caught
 *     // `new Function` as a `securitypolicyviolation` even though the throw
 *     // is swallowed.
 *
 * Com a sondagem desligada, a última violação some e a política pode passar a
 * BLOQUEAR de verdade, sem `'unsafe-eval'`.
 *
 * ## Por que importa mais do que um relatório limpo
 *
 * O cookie de sessão do Supabase é legível por `document.cookie` — é desenho
 * do `@supabase/ssr`, não descuido daqui, e está registrado em
 * `docs/estado-atual.md`. Sem CSP em bloqueio, um XSS futuro vira sessão
 * roubada sem nenhuma barreira no caminho. Esta é a defesa que faltava para
 * fechar essa combinação.
 *
 * ## Por que TODO import de zod passa por aqui
 *
 * `z.config` é global e precisa rodar **antes** de qualquer schema ser
 * construído — inclusive no pacote do cliente, que é onde a violação
 * acontece. Não existe ponto de entrada comum no projeto, e
 * `instrumentation.ts` não serviria: ele só roda no servidor.
 *
 * Importar daqui é o que garante a ordem: quem usa o schema já carregou a
 * configuração junto.
 *
 * **O custo, dito na cara:** sem JIT o Zod valida um pouco mais devagar. Os
 * schemas deste projeto são pequenos (um formulário, uma linha de planilha),
 * e a alternativa era manter a única defesa contra XSS desligada.
 */
import { z } from 'zod'

z.config({ jitless: true })

export { z }
