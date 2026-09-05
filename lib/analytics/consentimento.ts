/**
 * A decisão de consentimento, isolada do React.
 *
 * Vive separada do componente por dois motivos. O primeiro é o de sempre neste
 * projeto: regra que dá para testar sem montar árvore de componente é regra que
 * fica testada. O segundo é específico daqui — o pixel precisa consultar essa
 * decisão antes de existir, e um hook não serve para isso.
 *
 * ## Por que isto passou a existir
 *
 * O Meta Pixel grava cookie de terceiro (`_fbp`) e é rastreamento de marketing
 * sob a LGPD. A ANPD, no guia orientativo de cookies, trata cookie não
 * estritamente necessário como dependente de consentimento — e recomenda
 * explicitamente que recusar seja tão fácil quanto aceitar, com o disparo
 * bloqueado até a escolha. O produto rodava sem nada disso, registrado como
 * risco em aberto no próprio `meta-pixel.tsx` e em `docs/estado-atual.md`.
 *
 * Fechar isso deixou de ser opcional no momento em que o tráfego pago entrou no
 * plano: anunciar é justamente o que transforma um risco de conformidade
 * adormecido em exposição real, com volume.
 */

export type Consentimento = 'aceito' | 'recusado'

/**
 * Chave versionada de propósito.
 *
 * Se um dia a finalidade do rastreamento mudar (outro provedor, outro escopo),
 * o consentimento antigo deixa de valer para a finalidade nova — a LGPD pede
 * consentimento específico. Subir o número aqui refaz a pergunta a todo mundo,
 * em vez de herdar um "sim" que foi dado para outra coisa.
 */
export const CHAVE_CONSENTIMENTO = 'vf_consentimento_v1'

/**
 * Interpreta o que está guardado.
 *
 * Devolve `null` para "ainda não decidiu", que é diferente de "recusou": só o
 * primeiro faz o banner aparecer. Qualquer valor estranho (lixo, chave de outra
 * versão, alguém editando o storage à mão) também vira `null` — na dúvida,
 * perguntar de novo é o comportamento seguro, e nunca assumir aceite.
 */
export function interpretarConsentimento(valor: string | null): Consentimento | null {
  if (valor === 'aceito' || valor === 'recusado') return valor
  return null
}

/** Só carrega o pixel quem disse sim explicitamente. */
export function podeRastrear(valor: string | null): boolean {
  return interpretarConsentimento(valor) === 'aceito'
}

/**
 * O mesmo consentimento, num cookie que o SERVIDOR consegue ler.
 *
 * ## O buraco que isto fecha
 *
 * A decisão vive em `localStorage`, e o servidor não lê `localStorage`. O
 * resultado, medido no código: **os seis eventos da Conversions API disparavam
 * independentemente do banner**. Quem clicava "Recusar" e se cadastrava tinha
 * e-mail, telefone, nome, cidade, estado, CEP e `external_id` enviados à Meta
 * do mesmo jeito — hasheados, mas enviados.
 *
 * O pixel do navegador sempre respeitou, com duas cercas. A CAPI nunca
 * consultou nada, e é ela que manda o dado pessoal.
 *
 * ## Por que um cookie espelho, e não trocar o `localStorage`
 *
 * Trocar significaria reescrever as duas cercas do pixel, que funcionam e
 * foram provadas com controle negativo em 30/08. O cookie ANDA JUNTO: mesma
 * chave versionada, mesmo valor, escrito no mesmo instante.
 *
 * `httpOnly: false` de propósito — não é segredo, é a escolha da pessoa, e o
 * cliente precisa lê-lo para manter as duas fontes em sincronia.
 */
export const COOKIE_CONSENTIMENTO = CHAVE_CONSENTIMENTO

/** Um ano: o mesmo prazo que a LGPD considera razoável para renovar a pergunta. */
export const MAX_AGE_CONSENTIMENTO = 365 * 24 * 60 * 60

/**
 * Lê o consentimento de uma string de cookies (`document.cookie` ou o header).
 *
 * Recebe a string em vez de ir buscá-la para continuar sendo função pura:
 * roda igual no servidor, no cliente e no teste, sem mock.
 */
export function lerConsentimentoDoCookie(cookies: string | null | undefined): Consentimento | null {
  if (!cookies) return null
  for (const parte of cookies.split(';')) {
    const [nome, ...resto] = parte.trim().split('=')
    if (nome === COOKIE_CONSENTIMENTO) {
      return interpretarConsentimento(decodeURIComponent(resto.join('=')))
    }
  }
  return null
}

/**
 * Os cookies que só existem por causa de rastreamento de anúncio.
 *
 * ## O buraco que isto fecha, achado medindo em produção (05/09)
 *
 * Recusar o banner impedia rastreamento NOVO — a tag não carrega, provado nos
 * dois sentidos —, mas **não apagava o que já estava gravado**. Quem aceitou e
 * depois mudou de ideia ficava com `_fbp`, `_gcl_au` e `_gcl_aw` no navegador.
 *
 * Não era regressão da tag do Google: o `_fbp` da Meta se comportava assim
 * desde que o banner nasceu, em 23/08. É a mesma família do defeito de 02/09 —
 * o consentimento respeitado num lugar e ignorado em outro.
 *
 * O alcance é estreito e vale dizer com honestidade: quem nunca aceitou nunca
 * teve cookie nenhum, e o cookie parado não é enviado a lugar algum depois que
 * o script deixa de carregar. Mas é um identificador que a pessoa **pediu para
 * não ter**, e a ANPD trata a retirada do consentimento como devendo ser tão
 * fácil quanto tê-lo dado.
 *
 * ## Por prefixo, e não por lista fechada
 *
 * `_gcl_au`, `_gcl_aw`, `_gcl_dc`, `_gcl_gb`… o Google acrescenta variantes
 * conforme o produto, e uma lista escrita à mão envelheceria em silêncio — o
 * cookie novo ficaria para trás sem nada falhar. O prefixo cobre o que existe
 * e o que vier.
 *
 * `_fbp` e `_fbc` são exatos porque a Meta não gera variantes.
 */
const PREFIXOS_DE_RASTREAMENTO = ['_gcl', '_fbp', '_fbc']

/** Este cookie existe só por causa de rastreamento de anúncio? */
export function ehCookieDeRastreamento(nome: string): boolean {
  return PREFIXOS_DE_RASTREAMENTO.some((prefixo) => nome.startsWith(prefixo))
}

/**
 * Os domínios a tentar ao apagar, do mais específico ao mais amplo.
 *
 * ## Por que uma lista, e não só o host atual
 *
 * Cookie só é apagado por uma escrita que case com o **domínio e o caminho**
 * com que foi criado. E os dois lados escrevem em escopos diferentes: o `_fbp`
 * nasce no host, o `_gcl_au` nasce no domínio registrável (`.velofunil.com.br`),
 * para valer em qualquer subdomínio.
 *
 * Foi exatamente isso que falhou na primeira tentativa de prova: apagar com
 * `path=/` e sem domínio não tocou nos `_gcl_*`, e eu quase registrei que "não
 * dá para apagar" quando o que faltava era o escopo.
 *
 * Tentar um domínio que não serve é inofensivo — o navegador recusa a escrita
 * quando o valor não é sufixo do host atual ou é um sufixo público
 * (`com.br`). Por isso a função não tenta adivinhar onde o domínio público
 * começa: gerar demais custa uma linha ignorada, e adivinhar de menos deixa o
 * cookie vivo.
 */
export function dominiosParaApagar(hostname: string): (string | null)[] {
  // `null` = sem atributo `domain`, que é como o cookie criado no próprio host
  // (sem `domain` explícito) precisa ser apagado.
  const escopos: (string | null)[] = [null]

  const partes = hostname.split('.')
  for (let i = 0; i <= partes.length - 2; i += 1) {
    const dominio = partes.slice(i).join('.')
    escopos.push(dominio, `.${dominio}`)
  }

  return escopos
}

/**
 * Monta as linhas de `document.cookie` que apagam um cookie em todos os escopos.
 *
 * Separada da escrita para ser testável sem DOM — a suíte deste projeto roda em
 * `environment: 'node'` de propósito, e o que quebrou de verdade aqui foi
 * regra, não renderização.
 */
export function linhasQueApagam(nome: string, hostname: string): string[] {
  const passado = 'Thu, 01 Jan 1970 00:00:00 GMT'

  return dominiosParaApagar(hostname).map(
    (dominio) =>
      `${nome}=; Path=/; Expires=${passado}` + (dominio ? `; Domain=${dominio}` : ''),
  )
}
