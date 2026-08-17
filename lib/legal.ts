/**
 * Dados do controlador e dos operadores, num lugar só.
 *
 * Documento jurídico que contradiz o sistema é pior do que documento nenhum:
 * vira prova contra o controlador num processo administrativo da ANPD. Por
 * isso estes valores ficam centralizados e são referenciados pelas páginas,
 * em vez de repetidos em texto solto, quando um operador entra ou sai do
 * stack, muda aqui e as duas políticas acompanham.
 *
 * A lista de SUBOPERADORES abaixo foi levantada do código, não presumida:
 * cada item corresponde a uma integração que de fato recebe dado pessoal.
 */

export const CONTROLADOR = {
  nomeFantasia: 'Velo Funil',
  /**
   * Razão social conforme o cadastro da Receita, confirmada no cadastro
   * comercial da conta Asaas. Formato típico de MEI: o número do CNPJ seguido
   * do nome civil do titular.
   *
   * Citada junto do nome fantasia nas páginas legais, o art. 9º, I pede
   * identificação clara do controlador, e é isto que consta no CNPJ.
   */
  razaoSocial: '64.543.748 ORLANDO HENRIQUE BASTOS DA CRUZ',
  /** Dígitos verificadores conferidos. */
  cnpj: '64.543.748/0001-13',
  /** Canal do titular e do encarregado (LGPD, Art. 41, §2º, I e Art. 18). */
  email: 'suporte@velofunil.com.br',
  site: 'https://www.velofunil.com.br',
  /**
   * Suporte por WhatsApp. Guardado em duas formas de propósito: o link
   * `wa.me` exige o número cru com DDI e sem pontuação, e a exibição precisa
   * do formato brasileiro legível.
   */
  whatsapp: {
    numero: '5571993309404',
    exibicao: '(71) 99330-9404',
  },
} as const

/** Prazo de resposta ao titular. Art. 19, II, 15 dias para pedido completo. */
export const PRAZO_RESPOSTA_TITULAR_DIAS = 15

export const ATUALIZADO_EM = '9 de agosto de 2026'

export type Suboperador = {
  nome: string
  finalidade: string
  dados: string
  /** Transferência internacional exige menção expressa (Art. 33). */
  paisDeProcessamento: string
}

export const SUBOPERADORES: Suboperador[] = [
  {
    nome: 'Supabase',
    finalidade: 'Banco de dados, autenticação e hospedagem dos registros',
    dados: 'Todos os dados de conta, leads, negócios e atividades',
    paisDeProcessamento: 'Estados Unidos',
  },
  {
    nome: 'Vercel',
    finalidade: 'Hospedagem da aplicação e métricas agregadas de uso',
    dados: 'Endereço IP, dados de navegação e desempenho das páginas',
    paisDeProcessamento: 'Estados Unidos',
  },
  {
    nome: 'Resend',
    finalidade: 'Envio de e-mails transacionais (convites de colaborador)',
    dados: 'Nome e endereço de e-mail do destinatário',
    paisDeProcessamento: 'Estados Unidos',
  },
  {
    nome: 'Asaas',
    finalidade: 'Processamento de pagamentos e emissão de cobranças',
    dados: 'Nome, e-mail, CPF ou CNPJ e dados da transação',
    paisDeProcessamento: 'Brasil',
  },
  {
    nome: 'Google',
    finalidade: 'Login com conta Google, quando o usuário opta por esse método',
    dados: 'Nome, endereço de e-mail e identificador da conta Google',
    paisDeProcessamento: 'Estados Unidos',
  },
]
