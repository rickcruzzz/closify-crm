/**
 * A ÚNICA superfície pública do módulo.
 *
 * Nada fora de `lib/inteligencia-de-mercado/` deve importar de um caminho
 * interno. O que não está aqui é detalhe de implementação e pode mudar sem
 * aviso — inclusive o formato da resposta do Exa, que é contrato de terceiro.
 */

export { dominioDoEmail, montarConsulta, normalizarDominio } from './dominio/consulta'
export type { AlvoDeBusca, ConsultaMontada } from './dominio/consulta'

export { classificarSinal } from './dominio/sinais'
export type { Confianca, TipoDeSinal } from './dominio/sinais'

export { extrairSinais } from './dominio/dor'
export type { SinalParaGravar, TrechoDoExa } from './dominio/dor'

export {
  centavosDe,
  deveReenriquecer,
  podeConsultar,
  CUSTO_POR_BUSCA_USD,
  DIAS_ATE_REENRIQUECER,
  TETO_MENSAL_CENTAVOS,
} from './dominio/orcamento'

export { ehTransitorio, ExaIndisponivel, ExaRecusou, ExaSemCredito } from './exa/erros'

export type { LeadParaEnriquecer, PortaDeLeads } from './ports/leads'
export type { AvisoDeSinal, PortaDeNotificacoes } from './ports/notificacoes'
export { relogioDoSistema, type Relogio } from './ports/relogio'
