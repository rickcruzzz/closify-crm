import 'server-only'

import { lerDinheiro, listarAssinaturasDoAsaas } from './dinheiro'
import { lerEmails } from './emails'
import { lerAnuncio } from './meta-ads'
import { montarPendencias } from './pendencias'
import { lerBanco } from './queries'
import { exigirAmbienteLocal } from './somente-local'
import type { DadosDaCentral } from './tipos'

/**
 * Junta as quatro fontes numa carga só.
 *
 * ## Por que tudo em paralelo, e por que cada fonte falha sozinha
 *
 * As quatro (banco, Asaas, Resend, Meta) são independentes: nenhuma precisa do
 * resultado da outra para começar. Encadear em série somaria quatro latências
 * de rede por abertura de tela — a mesma classe de desperdício que já foi
 * corrigida no layout do dashboard e em `/settings/billing`.
 *
 * E cada uma devolve `Resultado<T>` em vez de lançar: o Asaas fora do ar não
 * pode apagar a lista de clientes, que vem do banco e está perfeitamente
 * disponível. Uma exceção não tratada aqui derrubaria a página inteira e
 * esconderia os 90% que funcionam — que é exatamente o oposto do que uma tela
 * de monitoramento deve fazer quando algo quebra.
 */
export async function lerCentral(): Promise<DadosDaCentral> {
  await exigirAmbienteLocal()

  const [banco, dinheiro, assinaturasNoAsaas, emails, anuncio] = await Promise.all([
    lerBanco(),
    lerDinheiro(),
    listarAssinaturasDoAsaas(),
    lerEmails(),
    lerAnuncio(),
  ])

  return {
    numeros: banco.numeros,
    empresas: banco.empresas,
    podeEstarCortado: banco.podeEstarCortado,
    dinheiro,
    emails,
    anuncio,
    pendencias: montarPendencias({
      empresas: banco.empresas,
      assinaturasNoBanco: banco.assinaturas,
      assinaturasNoAsaas,
      emails,
      errosRecentes: banco.errosRecentes,
    }),
    errosRecentes: banco.errosRecentes,
    lidoEm: new Date().toISOString(),
  }
}
