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

export type Controlador = {
  nomeFantasia: string
  razaoSocial: string
  /** `null` enquanto não houver inscrição ativa. Ver a nota abaixo. */
  cnpj: string | null
  /** Endereço da sede, como consta na Receita. `null` junto com o CNPJ. */
  endereco: string | null
  email: string
  site: string
  whatsapp: { numero: string; exibicao: string }
}

export const CONTROLADOR: Controlador = {
  nomeFantasia: 'Velo Funil',
  /**
   * Razão social conforme o cadastro da Receita, confirmada no cadastro
   * comercial da conta Asaas. Formato típico de MEI: o número do CNPJ seguido
   * do nome civil do titular.
   *
   * Citada junto do nome fantasia nas páginas legais, o art. 9º, I pede
   * identificação clara do controlador, e é isto que consta no CNPJ.
   *
   * Continua aqui mesmo sem CNPJ ativo porque é o nome que o Asaas emite na
   * fatura e que aparece no extrato de quem paga. Trocar isto antes de trocar
   * o cadastro no Asaas faria a tela mentir sobre a cobrança.
   */
  razaoSocial: '64.543.748 ORLANDO HENRIQUE BASTOS DA CRUZ',
  /**
   * **Sem CNPJ ativo desde 08/08/2026.**
   *
   * O `64.543.748/0001-13` foi BAIXADO a pedido do titular (motivo 1 na
   * Receita, "extinção por encerramento — liquidação voluntária"). Conferido
   * em duas fontes independentes em 25/08/2026.
   *
   * Baixa de MEI é irreversível: o número não volta, e uma inscrição nova sai
   * com CNPJ diferente. Por isso o campo é anulável em vez de guardar o número
   * morto — CNPJ baixado exibido numa página que vende é pior que CNPJ
   * nenhum, porque a seção de confiança convida justamente a conferir.
   *
   * Quem for preencher de novo: o enquadramento certo para SaaS é **ME** com
   * CNAE 6202-3/00. MEI não comporta desenvolvimento e licenciamento de
   * software, então um MEI novo reprovaria pelo mesmo motivo mais adiante.
   *
   * Preencher este campo e o `endereco` reacende sozinho o rodapé, a seção de
   * confiança, o rodapé dos e-mails e as duas páginas legais.
   */
  cnpj: null,
  /**
   * Exigido pela verificação de negócio da Meta, que compara o endereço do
   * formulário com o que está publicado no site. Fica junto do CNPJ porque só
   * faz sentido com ele: endereço sem inscrição não identifica ninguém.
   */
  endereco: null,
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
}

/**
 * Como o controlador se identifica num texto que a lei exige.
 *
 * Usada nas páginas legais, onde o art. 9º, I da LGPD pede identificação clara
 * de quem responde pelo dado. Sem CNPJ, a pessoa continua identificada pelo
 * nome — some a inscrição, não o responsável.
 *
 * Recebe o controlador por parâmetro para que os dois estados sejam testáveis
 * sem depender de qual deles está vigente hoje.
 */
export function identificacaoDoControlador(
  controlador: Pick<Controlador, 'razaoSocial' | 'cnpj'> = CONTROLADOR,
): string {
  if (!controlador.cnpj) return controlador.razaoSocial
  return `${controlador.razaoSocial}, CNPJ ${controlador.cnpj}`
}

/**
 * A assinatura que aparece na vitrine: rodapé da landing, seção de confiança e
 * rodapé dos e-mails.
 *
 * Usa o nome fantasia, não a razão social — a decisão de 24/08 tirou o nome
 * civil do titular de tudo que é reforço de marca, e ela continua valendo.
 */
export function assinaturaPublica(
  controlador: Pick<Controlador, 'nomeFantasia' | 'cnpj'> = CONTROLADOR,
  /** `·` em rodapé, `, ` quando a assinatura é lida como frase. */
  separador = ' · ',
): string {
  if (!controlador.cnpj) return controlador.nomeFantasia
  return `${controlador.nomeFantasia}${separador}CNPJ ${controlador.cnpj}`
}

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
