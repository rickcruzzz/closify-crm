import 'server-only'

import { lerDinheiro, listarAssinaturasDoAsaas } from './dinheiro'
import { lerEmails } from './emails'
import { montarPendencias } from './pendencias'
import { lerBanco } from './queries'
import { lerSilenciados } from './silenciados'
import { exigirAmbienteLocal } from './somente-local'
import type { DadosDaCentral } from './tipos'

/**
 * Junta as fontes numa carga só.
 *
 * ## Por que tudo em paralelo, e por que cada fonte falha sozinha
 *
 * As quatro (banco, Asaas, Resend, Meta) são independentes: nenhuma precisa do
 * resultado da outra para começar. Encadear em série somaria quatro latências
 * de rede por abertura de tela — a mesma classe de desperdício já corrigida no
 * layout do dashboard e em `/settings/billing`.
 *
 * E cada uma devolve `Resultado<T>` em vez de lançar: o Asaas fora do ar não
 * pode apagar a lista de clientes, que vem do banco e está disponível. Uma
 * exceção não tratada aqui derrubaria a página inteira e esconderia os 90% que
 * funcionam — o oposto do que uma tela de monitoramento deve fazer quando algo
 * quebra.
 */
export async function lerCentral(): Promise<DadosDaCentral> {
  await exigirAmbienteLocal()

  // O anúncio NÃO entra aqui: ele tem página própria (`/dono/anuncio`), e a
  // leitura dele custa quatro chamadas à Meta. Fazer a Visão geral pagar isso
  // a cada abertura, para mostrar um bloco que o dono vai olhar uma vez por
  // dia, é o tipo de peso que só aparece quando a tela já está lenta.
  const [banco, dinheiro, assinaturasNoAsaas, emails, silenciados] = await Promise.all([
    lerBanco(),
    lerDinheiro(),
    listarAssinaturasDoAsaas(),
    lerEmails(),
    lerSilenciados(),
  ])

  const pendencias = montarPendencias({
    empresas: banco.empresas,
    assinaturasNoBanco: banco.assinaturas,
    assinaturasNoAsaas,
    emails,
    errosRecentes: banco.errosRecentes,
    // É este conjunto que separa cliente travado de lixo de script. Ver o
    // comentário do filtro em `pendencias.ts`: sem ele, 8 dos 11 alertas da
    // primeira execução eram endereços inventados por testes meus.
    emailsDeContasReais: banco.emailsDeContasReais,
  })

  return {
    numeros: banco.numeros,
    empresas: banco.empresas,
    podeEstarCortado: banco.podeEstarCortado,
    dinheiro,
    emails,
    // O silenciamento acontece DEPOIS de montar, não durante: assim
    // `montarPendencias` continua sendo uma função pura sobre "o que está
    // errado", sem saber nada sobre preferência de quem olha. E dá para contar
    // quantos foram escondidos, que é o que permite desfazer.
    pendencias: pendencias.filter((p) => !silenciados.has(p.id)),
    silenciadas: pendencias.filter((p) => silenciados.has(p.id)),
    errosRecentes: banco.errosRecentes,
    lidoEm: new Date().toISOString(),
  }
}
