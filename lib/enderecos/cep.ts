import { somenteDigitos } from '@/lib/validations/empresa'

export type EnderecoDoCep = {
  endereco: string
  bairro: string
  cidade: string
  estado: string
}

/**
 * Busca o endereço pelo CEP na ViaCEP.
 *
 * Pública, sem chave, sem cadastro. Roda no NAVEGADOR e não no servidor: é
 * conveniência de digitação, e passar pelo nosso servidor só acrescentaria uma
 * viagem e um ponto de falha.
 *
 * **Falha em silêncio, sempre.** Devolve `null` em qualquer problema, rede
 * caída, CEP inexistente, resposta estranha, tempo esgotado. Os campos de
 * endereço continuam editáveis à mão, e ninguém fica travado esperando um
 * serviço de terceiro que não controlamos. Busca é conveniência; se ela fosse
 * requisito, um dia fora do ar da ViaCEP impediria de salvar a empresa.
 *
 * `signal` vem de fora para o chamador poder cancelar: quem continua digitando
 * dispara uma busca nova, e a antiga não pode voltar depois e sobrescrever.
 */
export async function buscarEnderecoPorCep(
  cep: string,
  signal?: AbortSignal,
): Promise<EnderecoDoCep | null> {
  const digitos = somenteDigitos(cep)
  if (digitos.length !== 8) return null

  try {
    // Oito segundos: acima disso a pessoa já digitou o endereço à mão, e a
    // resposta chegaria só para atrapalhar.
    const tempoEsgotado = AbortSignal.timeout(8000)
    const parada = signal ? AbortSignal.any([signal, tempoEsgotado]) : tempoEsgotado

    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: parada,
    })

    if (!resposta.ok) return null

    const dados = (await resposta.json()) as Record<string, unknown>

    // CEP inexistente devolve HTTP 200 com `{ "erro": true }`, checar só o
    // status deixaria passar.
    if (dados.erro) return null

    const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

    const endereco: EnderecoDoCep = {
      endereco: texto(dados.logradouro),
      bairro: texto(dados.bairro),
      cidade: texto(dados.localidade),
      estado: texto(dados.uf).toUpperCase(),
    }

    // CEP de cidade inteira vem sem logradouro e sem bairro. Ainda serve:
    // cidade e UF poupam duas digitações.
    return endereco.cidade ? endereco : null
  } catch {
    // Inclui o abort, que é o caso NORMAL de quem continua digitando. Tratar
    // como erro visível encheria a tela de aviso a cada tecla.
    return null
  }
}
