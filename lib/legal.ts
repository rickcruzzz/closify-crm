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

/**
 * O endereço da sede, decomposto.
 *
 * Os nomes seguem o que a Receita usa no cadastro, não o que o `PostalAddress`
 * do schema.org chama — a fonte é o cartão do CNPJ, e traduzir na entrada
 * faria a conferência contra a Receita exigir um mapa mental a cada leitura.
 * A tradução acontece uma vez, em `dados-estruturados.ts`.
 */
export type Endereco = {
  logradouro: string
  numero: string
  /** Sala, andar, bloco. `null` quando o cadastro não tem complemento. */
  complemento: string | null
  /**
   * O nome do edifício, e ele NÃO vem da Receita.
   *
   * O cartão do CNPJ traz logradouro, número e complemento; "CEO Salvador
   * Shopping · Torre Londres" é como o lugar se identifica na fachada — é o
   * que está escrito na placa que a foto da landing mostra, e é o que alguém
   * procura ao chegar de carro.
   *
   * Fica fora de `enderecoEmLinha()` de propósito: a linha corrida serve a
   * documento legal e a prompt, onde o nome comercial do prédio é ruído. Ele
   * existe para a seção que mostra a foto, onde é justamente o que liga a
   * imagem ao texto.
   */
  edificio: string | null
  bairro: string
  cidade: string
  /** Sigla de duas letras, maiúscula. */
  uf: string
  /** Com a máscara, como a Receita imprime: `41.820-021`. */
  cep: string
}

/**
 * As partes de volta numa linha, que é o formato que documento legal usa.
 *
 * Existe para os quatro consumidores anteriores à decomposição de 12/09 —
 * rodapé, Privacidade, Termos e o prompt do SDR — continuarem lendo uma frase.
 * Sem ela, decompor o endereço teria obrigado quatro arquivos a montar a
 * mesma string à mão, e quatro cópias divergem.
 */
export function enderecoEmLinha(endereco: Endereco): string {
  const inicio = [
    `${endereco.logradouro}, ${endereco.numero}`,
    endereco.complemento,
  ]
    .filter(Boolean)
    .join(', ')
  return `${inicio}, ${endereco.bairro}, ${endereco.cidade}/${endereco.uf}, CEP ${endereco.cep}`
}

export type Controlador = {
  nomeFantasia: string
  razaoSocial: string
  /**
   * O nome que aparece no extrato de QUEM PAGA.
   *
   * Terceira pergunta, e não sinônimo das duas acima:
   *
   *     nomeFantasia      a marca. "Velo Funil"
   *     razaoSocial       o que a Receita registrou. Nome civil do socio
   *     nomeNoRecebedor   o que o Asaas manda para o banco do cliente
   *
   * Medido na API do Asaas em 12/09: `company`, `companyName` e `name` todos
   * em `VELO FUNIL`, com `status: APPROVED`. O `availableCompanyNames` traz as
   * duas opções e a escolhida é esta.
   *
   * **Ele existe porque a tela de pagamento estava afirmando o contrário.** O
   * diálogo avisava que o recebedor apareceria com o nome civil do sócio — o
   * que era verdade no MEI e deixou de ser quando a LTDA entrou em 28/08. O
   * comentário de lá ainda citava a regra do MEI de 15/11/2023.
   *
   * Avisar algo pior do que a realidade não é conservador: é perder venda
   * explicando um problema que não existe mais, na tela do CPF.
   */
  nomeNoRecebedor: string
  /** `null` enquanto não houver inscrição ativa. Ver a nota abaixo. */
  cnpj: string | null
  /**
   * Endereço da sede, em PARTES. `null` junto com o CNPJ.
   *
   * ## Por que partes, e não a linha pronta que existia antes
   *
   * Até 12/09 isto era uma string só. Ela servia aos quatro consumidores que
   * precisam de uma linha corrida — rodapé, Privacidade, Termos e o prompt do
   * SDR — e não servia a mais ninguém, porque não dá para extrair a cidade de
   * uma frase sem adivinhar onde ela começa.
   *
   * Dois lugares precisavam disso, e os dois estavam mal servidos:
   *
   *     dados-estruturados.ts   despejava a linha INTEIRA em `streetAddress` e
   *                             declarava so `addressCountry`. O Google le
   *                             `addressLocality`, `addressRegion` e
   *                             `postalCode` para busca local, e nenhum
   *                             existia
   *     onde-ficamos-section    quebrava a string num `split('—')` para ter
   *                             duas linhas. Hierarquia tipografica sobre
   *                             texto corrido e adivinhacao com outro nome
   *
   * `enderecoEmLinha()` monta a frase de volta, então nenhum dos quatro
   * consumidores antigos precisou mudar. **A linha passou a ser derivada, e
   * as partes passaram a ser a fonte** — que é a ordem certa: de partes se
   * monta a frase, de frase não se recuperam as partes.
   */
  endereco: Endereco | null
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
  // Exatamente como o Asaas tem — sem "LTDA", que ele não usa. Escrever aqui
  // algo diferente do que o gateway manda faria a tela prometer um extrato
  // que o cliente não vai ver, e a surpresa no banco é pior que o aviso.
  nomeNoRecebedor: 'VELO FUNIL',
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
  endereco: {
    logradouro: 'Av. Tancredo Neves',
    numero: '2539',
    complemento: 'Sala 2609',
    edificio: 'CEO Salvador Shopping · Torre Londres',
    bairro: 'Caminho das Árvores',
    cidade: 'Salvador',
    uf: 'BA',
    cep: '41.820-021',
  },
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
 * Como a empresa se identifica para QUEM COMPRA.
 *
 * ## Por que ela não é `identificacaoDoControlador()`
 *
 * Aquela devolve **razão social + CNPJ**, e razão social aqui é
 * `ORLANDO HENRIQUE BASTOS DA CRUZ LTDA` — o nome civil do sócio, que é o
 * padrão da Receita para empresa aberta a partir de firma individual.
 *
 * Ela é obrigatória onde a lei pede identificação do controlador: Termos,
 * Privacidade e o `legalName` do schema.org. Nesses lugares o nome civil é
 * exatamente o ponto.
 *
 * **Na tela de pagamento ela é o oposto do que a tela precisa.** Relato do
 * dono em 12/09: o cliente, ao digitar o CPF, lia o nome completo de uma
 * pessoa física logo acima do botão de continuar. Num B2B isso levanta a
 * pergunta *"em quem eu estou pagando?"* no pior segundo possível.
 *
 * ## "Velo Funil LTDA" não é a razão social, e isso é deliberado
 *
 * É descrição verdadeira — a empresa se chama Velo Funil e é uma sociedade
 * limitada —, e o **CNPJ ao lado é o que a torna conferível**. Quem quiser o
 * nome registrado o encontra nos Termos, na Privacidade e na Receita.
 *
 * O que ela NÃO faz é prometer o extrato: o nome que aparece no banco de quem
 * paga é `nomeNoRecebedor`, medido na API do Asaas, e é `VELO FUNIL` sem o
 * `LTDA`. São duas frases, em duas telas, e misturá-las faria uma delas
 * mentir.
 */
export function identificacaoComercial(
  controlador: Pick<Controlador, 'nomeFantasia' | 'cnpj'> = CONTROLADOR,
): string {
  if (!controlador.cnpj) return `${controlador.nomeFantasia} LTDA`
  return `${controlador.nomeFantasia} LTDA, CNPJ ${controlador.cnpj}`
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
// 03/09: a Meta entrou na lista de suboperadores e a secao 3 deixou de negar
// cookie de publicidade. Nao e carimbo de revisao — e um destinatario NOVO de
// dado pessoal aparecendo na declaracao, que e exatamente o que o Art. 9o, I
// da LGPD manda informar ao titular. Mesma regra que moveu esta data em 31/08,
// quando o controlador mudou de pessoa juridica.
//
// 04/09: o Google Ads, pelo mesmo motivo — outro destinatario, outra
// finalidade, e a secao 3 nomeava so a Meta enquanto duas ferramentas passam a
// carregar pelo mesmo aceite. A data anda porque a lista mudou, nunca porque
// alguem releu o texto.
//
// 17/09: a Z-API entrou, e ela e diferente de todas as anteriores. Os seis
// suboperadores da lista recebem dado CADASTRAL — nome, e-mail, telefone, CPF.
// Este recebe **conteudo de conversa de terceiro**: o que o cliente do nosso
// cliente escreveu, incluindo audio e imagem.
//
// Entra ANTES de existir a primeira conexao, e nao depois. Declarar depois de
// comecar a tratar e o erro que a Meta ja custou aqui, em 02 e 03/09: o
// consentimento foi construido num dia e a politica so acompanhou no seguinte,
// um dia inteiro afirmando o contrario do que o codigo fazia.
export const ATUALIZADO_EM = '17 de setembro de 2026'

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
  // ## A Meta faltava nesta lista, e recebe dado pessoal desde que a CAPI existe
  //
  // Achado em 03/09, ao preparar a campanha. O pixel grava `_fbp` (cookie de
  // publicidade de terceiro) e a Conversions API envia e-mail, telefone, nome,
  // cidade, estado, CEP e `external_id` — hasheados em SHA-256, mas enviados,
  // e hash não descaracteriza dado pessoal quando o destinatário consegue
  // casá-lo com a base dele, que é exatamente para o que serve.
  //
  // Omitir um suboperador que recebe dado pessoal contraria o Art. 9º, que dá
  // ao titular o direito de saber com quem os dados são compartilhados. E a
  // seção 3 desta mesma política afirmava "não usamos cookies de publicidade",
  // o que era falso desde a instalação do pixel.
  //
  // Entra AGORA porque o tráfego pago está para começar: é o momento em que um
  // risco de conformidade adormecido vira exposição real, com volume. O mesmo
  // raciocínio que `lib/analytics/consentimento.ts` usou para fechar o
  // consentimento — e que parou na metade, porque a política não foi junto.
  {
    nome: 'Meta (Facebook e Instagram)',
    finalidade:
      'Medição de anúncios: identificar de qual campanha veio cada visita e ' +
      'cadastro. Só ocorre para quem aceita os cookies no banner',
    dados:
      'Endereço IP, identificador do navegador e, no cadastro, e-mail, ' +
      'telefone, nome, cidade, estado e CEP, todos transmitidos com hash',
    paisDeProcessamento: 'Estados Unidos',
  },
  // ## A Z-API é a primeira que recebe CONTEÚDO, e não cadastro
  //
  // Os seis acima recebem dado cadastral: nome, e-mail, telefone, CPF, valor de
  // transação. A Z-API recebe **o que foi dito** — o texto, o áudio e a imagem
  // que o cliente do nosso cliente mandou pelo WhatsApp.
  //
  // A diferença importa para o titular. Um telefone num CRM é um dado de
  // contato; a conversa em que ele negocia um orçamento é conteúdo de
  // comunicação, e ele nunca concordou com nada conosco — ele escreveu para a
  // marcenaria, não para o Velo Funil.
  //
  // ## E a cadeia tem TRÊS elos, não dois
  //
  // Para essas conversas, quem é controlador é **a empresa cliente**: ela
  // decide conectar o número, ela fala com aquelas pessoas, ela responde por
  // elas. Nós somos operador, como já somos para os leads (seção 2), e a Z-API
  // é **suboperador** — subcontratada nossa para executar o transporte.
  //
  // ## O país não está publicado, e dizer "Brasil" seria afirmar o que não se
  // conferiu
  //
  // A Z-API é empresa brasileira, com contrato em português e preço em real.
  // Onde ficam os servidores **não é publicado**: os Termos de Uso citam
  // subcontratação e mandam para um PDF de contrato, e a página pública não
  // responde. Lido em 17/09.
  //
  // Escrever "Brasil" fecharia a tabela com um dado bonito e não conferido, que
  // é exatamente a classe do CNPJ baixado exibido 17 dias como prova de
  // confiança. A linha diz o que se sabe e admite o que não se sabe, e é o que
  // o Art. 33 exige quando a transferência internacional é possível.
  {
    nome: 'Z-API',
    finalidade:
      'Conexão do WhatsApp da sua empresa ao CRM, no plano Max: entrega e ' +
      'recebimento das mensagens trocadas com os seus clientes',
    dados:
      'Número de telefone e o conteúdo das mensagens, incluindo texto, áudio, ' +
      'imagem e documento',
    paisDeProcessamento: 'Brasil; a localização dos servidores não é publicada pelo fornecedor',
  },
  // ## Entrada SEPARADA do "Google" acima, e a separação é o que informa
  //
  // O Google já estava na lista, para login com conta Google. Ampliar aquela
  // entrada faria uma linha só cobrir duas coisas que a LGPD trata de forma
  // diferente: o login é execução do contrato (a pessoa pediu para entrar
  // assim), e a medição de anúncio depende de CONSENTIMENTO e só acontece para
  // quem aceita no banner.
  //
  // Uma linha misturada diria ao titular que ele não pode recusar o que ele
  // pode. Duas linhas dizem a verdade sobre cada uma.
  //
  // Entra JUNTO da tag, não depois: a política é onde o tratamento é declarado,
  // e declarar depois de começar a tratar é o erro que a Meta já custou aqui —
  // o consentimento foi construído em 02/09 e a política só foi corrigida em
  // 03/09, um dia inteiro afirmando o contrário do que o código fazia.
  {
    nome: 'Google Ads',
    finalidade:
      'Medição de anúncios de busca: identificar qual palavra-chave trouxe ' +
      'cada visita e cadastro. Só ocorre para quem aceita os cookies no banner',
    dados:
      'Endereço IP, identificador do clique no anúncio (gclid) e o registro ' +
      'de que uma conta foi criada, sem nome, e-mail ou telefone',
    paisDeProcessamento: 'Estados Unidos',
  },
  // ## O Exa SAIU daqui em 08/09, e a ausência é a informação
  //
  // A pesquisa de mercado do lado do cliente (0072/0073) mandava ao Exa o nome
  // e o domínio da empresa contato — transferência internacional de dado de
  // titular, declarada aqui desde 07/09.
  //
  // Ela foi removida inteira (0075). O motivo não foi custo: em 08/09,
  // `enriquecimento_de_lead` e `sinal_de_mercado` tinham ZERO linhas desde que
  // nasceram, e o recurso nunca havia sido usado uma vez. Manter um
  // suboperador fora do Brasil declarado para um caminho que ninguém percorre
  // é carregar obrigação de LGPD sem contrapartida nenhuma.
  //
  // **A prospecção do dono continua usando o Exa**, e não entra nesta lista de
  // propósito: ela roda por script, sobre empresas que ainda NÃO são contato de
  // ninguém, e não trata dado de titular deste produto. Suboperador aqui é
  // quem toca dado de cliente — misturar as duas coisas faria a política
  // declarar o que ela não governa.
]
