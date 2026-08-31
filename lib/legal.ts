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
  /**
   * O telefone que consta no cadastro da Receita, quando ele for diferente do
   * canal de suporte.
   *
   * Existe porque a verificação de negócio da Meta compara o telefone
   * publicado no site com o do CNPJ, e os dois divergem aqui: o cadastro saiu
   * com o número da contabilidade que abriu a empresa. Enquanto a alteração
   * cadastral não for feita, o site publica os dois — um para bater com a
   * Receita, outro para quem precisa de ajuda.
   *
   * `null` quando o cadastral for o mesmo do suporte, que é o estado desejado.
   */
  telefoneCadastral: string | null
}

export const CONTROLADOR: Controlador = {
  nomeFantasia: 'Velo Funil',
  /**
   * Razão social conforme o cadastro da Receita.
   *
   * **Mudou de FORMA em 31/08/2026, não só de número.** Era
   * `64.543.748 ORLANDO HENRIQUE BASTOS DA CRUZ` — o padrão do MEI, que é o
   * CNPJ seguido do nome civil do titular. A LTDA tem razão social de verdade,
   * com o sufixo societário.
   *
   * Citada junto do nome fantasia nas páginas legais: o art. 9º, I pede
   * identificação clara do controlador, e é isto que consta no CNPJ.
   *
   * É também o nome que o Asaas emite na fatura e que aparece no extrato de
   * quem paga. O cadastro comercial da conta Asaas precisa acompanhar — até
   * lá, a fatura sai com o nome antigo enquanto a tela mostra o novo.
   */
  razaoSocial: 'ORLANDO HENRIQUE BASTOS DA CRUZ LTDA',
  /**
   * **CNPJ ativo desde 28/08/2026.**
   *
   * O anterior, `64.543.748/0001-13`, era MEI e foi BAIXADO a pedido do
   * titular em 08/08/2026. Baixa de MEI é irreversível — o número não volta —,
   * e o campo passou a ser anulável justamente para o projeto poder viver sem
   * inscrição por vinte dias sem exibir um número morto.
   *
   * O novo saiu como **Sociedade Empresária Limitada**, porte MICRO EMPRESA,
   * com Simples Nacional deferido a partir de 31/08. O CNAE principal é
   * **6311-9/00** (tratamento de dados, provedores de serviço de aplicação e
   * hospedagem), com **6202-3/00** entre os secundários — o comentário antigo
   * previa o 6202 como principal, e o que a Receita registrou é mais preciso
   * para SaaS.
   *
   * Conferido antes de ser escrito aqui, pela regra de `fatos-publicados`:
   * dígito verificador fecha (67), e ReceitaWS devolve situação ATIVA.
   * BrasilAPI e CNPJa ainda respondiam 404/402 — atraso de propagação das
   * bases espelho, não problema do registro.
   */
  cnpj: '68.877.105/0001-67',
  /**
   * Exigido pela verificação de negócio da Meta, que compara o endereço do
   * formulário com o que está publicado no site. Fica junto do CNPJ porque só
   * faz sentido com ele: endereço sem inscrição não identifica ninguém.
   *
   * **É sala comercial, não residência.** A preocupação registrada quando este
   * campo era nulo — expor a casa do titular — não se aplica: o cadastro saiu
   * em escritório no Salvador Shopping.
   */
  endereco:
    'Av. Tancredo Neves, 2539, sala 2609 — Caminho das Árvores, Salvador/BA, CEP 41.820-021',
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
  /**
   * O cadastro da Receita saiu com o telefone da contabilidade que abriu a
   * empresa, em outro estado. Publicado ao lado do de suporte, e rotulado,
   * porque a verificação da Meta compara ESTE com o do CNPJ — e quem procura
   * ajuda precisa cair no outro.
   *
   * Vira `null` quando a alteração cadastral for feita na Receita.
   */
  telefoneCadastral: '(41) 9788-0145',
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

/**
 * Data da última mudança material nas políticas.
 *
 * Passou de 9 para 31 de agosto porque **o controlador mudou de pessoa
 * jurídica**: era um MEI, extinto em 08/08, e agora é uma LTDA com CNPJ
 * próprio. Sob a LGPD (Art. 9º, I) o titular tem direito de saber quem
 * responde pelo dado dele, e a resposta mudou.
 *
 * Não é carimbo de revisão: finalidades, suboperadores, prazos de retenção e
 * direitos do titular continuam idênticos. Mudou quem responde, não o que é
 * feito com o dado.
 */
export const ATUALIZADO_EM = '31 de agosto de 2026'

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
