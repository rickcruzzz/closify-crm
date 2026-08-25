/**
 * A leitura da resposta de `/instance/all`, sem rede.
 *
 * Vive separada de `api.ts` para poder ser testada: é a parte que quebra em
 * SILÊNCIO. Se o formato mudar e esta função passar a devolver `null`, o
 * sintoma não é um erro — é a readoção de instância deixando de funcionar, e
 * a empresa presa em "instance already exists" de novo, que foi exatamente o
 * defeito medido em produção em 25/08.
 */

/**
 * O token de uma instância dentro da listagem, ou `null`.
 *
 * Aceita as duas formas que o Evolution GO já devolveu conforme a versão:
 * array cru e objeto com `data`. E as duas grafias de campo (`id`/`Id`,
 * `token`/`Token`) que a API mistura entre rotas — `/instance/status` usa
 * maiúscula em `Connected`/`LoggedIn` enquanto `/instance/all` usa minúscula,
 * então supor uma só é apostar em qual rota mudou por último.
 */
export function extrairTokenDaListagem(resposta: unknown, instanceId: string): string | null {
  const lista = normalizarListagem(resposta)

  for (const item of lista) {
    if (String(item.id ?? item.Id ?? '') !== instanceId) continue
    const token = item.token ?? item.Token
    return typeof token === 'string' && token.length > 0 ? token : null
  }

  return null
}

function normalizarListagem(resposta: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(resposta)) return resposta as Array<Record<string, unknown>>

  if (resposta && typeof resposta === 'object') {
    const dados = (resposta as { data?: unknown }).data
    if (Array.isArray(dados)) return dados as Array<Record<string, unknown>>
  }

  return []
}

/**
 * A listagem reduzida ao que decide conflito de número: id e jid.
 *
 * Separada de `extrairTokenDaListagem` porque o token é segredo e não deve
 * circular por caminho que não precise dele — quem compara número não tem o
 * que fazer com a credencial da instância.
 */
export function listarInstancias(resposta: unknown): Array<{ id: string; jid: string | null }> {
  return normalizarListagem(resposta)
    .map((item) => ({
      id: String(item.id ?? item.Id ?? ''),
      jid: typeof (item.jid ?? item.Jid) === 'string' ? String(item.jid ?? item.Jid) : null,
    }))
    .filter((i) => i.id.length > 0)
}
