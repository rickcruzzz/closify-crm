// Faz o build falhar se algum client component importar este módulo, direta ou
// indiretamente — mesma defesa de `lib/supabase/admin.ts`, e pela mesma razão:
// tudo em `lib/dono/**` existe para ler a base inteira com a service role.
import 'server-only'

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { ehAmbienteLocal } from './ambiente'

/**
 * O gate de ambiente da Central do Dono.
 *
 * ## Por que existe
 *
 * A Central lê o banco com `createAdminClient()`, que ignora RLS por completo:
 * nome, e-mail, telefone e valor de negócio de TODOS os clientes, não de um
 * workspace. Isso é dado pessoal de terceiro sob a LGPD — publicar é
 * vazamento, não bug de UI. E o RLS não pode ajudar aqui, porque a service
 * role existe justamente para passar por cima dele.
 *
 * O `middleware.ts` também não ajuda: o `matcher` dele é uma allowlist
 * explícita de rotas, então `/dono` não passa por middleware nenhum — sem
 * sessão, sem checagem de login, sem nada. Este arquivo é a única defesa.
 *
 * A decisão em si mora em `./ambiente.ts`, pura e testada
 * (`ambiente.test.ts`); aqui fica só a ligação com a requisição.
 */
export async function exigirAmbienteLocal(): Promise<void> {
  const cabecalhos = await headers()

  if (!ehAmbienteLocal(process.env.NODE_ENV, cabecalhos.get('host'))) {
    // 404 e não 403 de propósito: 403 confirmaria que a rota existe. Para
    // quem não for o dono na própria máquina, a Central simplesmente não é.
    notFound()
  }
}
