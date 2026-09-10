import { createHash } from 'node:crypto'

/**
 * O token que viaja no link de saída do e-mail, e como ele volta a ser decisão.
 *
 * ## O token É o hash, e isso resolve dois problemas de uma vez
 *
 * A alternativa óbvia seria gerar um id aleatório por destinatário e guardar a
 * relação `id -> e-mail` numa tabela antes de enviar. Isso exigiria gravar a
 * lista inteira de prospecção em produção — 358 endereços de pessoas que nunca
 * ouviram falar do produto — só para poder descadastrá-las depois. Criar o
 * vazamento para poder atender a LGPD.
 *
 * Com o token sendo o próprio hash do endereço, **nada é gravado antes**. A
 * linha só nasce quando alguém clica, e o que nasce é o hash, não o e-mail.
 *
 * ## O tempero existe para o link não ser adivinhável
 *
 * Sem ele, qualquer um calcularia o sha256 de um endereço e descadastraria
 * terceiros — chato, mas não grave. O que importa mais é o contrário: sem
 * tempero, quem obtivesse a tabela poderia testar endereços conhecidos contra
 * os hashes e reconstruir a lista. O tempero quebra isso.
 *
 * Ele vem do ambiente e **não tem padrão**: um valor embutido no código é o
 * mesmo que não ter tempero, porque o código está no Git.
 */
export function tokenDeSaida(email: string, tempero: string): string {
  if (!tempero) throw new Error('tempero ausente: token de saída seria adivinhável')
  return createHash('sha256')
    .update(`${tempero}:${normalizar(email)}`)
    .digest('hex')
}

/**
 * O identificador guardado na tabela.
 *
 * É derivado do token, não do e-mail: assim a rota de saída consegue gravar
 * sabendo só o token, sem nunca ver o endereço de quem clicou.
 */
export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Minúsculo e sem espaço nas pontas — `João@X.com.br ` e `joao@x.com.br` são o mesmo titular. */
export function normalizar(email: string): string {
  return email.trim().toLowerCase()
}

/** O token tem forma de sha256 em hexadecimal? Barra lixo antes de tocar o banco. */
export function tokenPlausivel(token: string | null | undefined): boolean {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
}
