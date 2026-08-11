import { CONTROLADOR } from '@/lib/legal'

/**
 * Layout base de todos os e-mails do Velo Funil.
 *
 * Serve aos dois caminhos de envio: os e-mails disparados pelo código (convite
 * de colaborador, via Resend) e os templates do Supabase Auth (confirmação de
 * cadastro, recuperação de senha, magic link), que são gerados a partir daqui e
 * colados no painel — ver `supabase/email-templates/README.md`.
 *
 * **Sem `server-only` de propósito.** É geração de string pura, sem rede e sem
 * `next/*`, então cabe no critério que `vitest.config.mts` declara para
 * `lib/**`. Marcar `server-only` quebraria a importação no Vitest e a regra de
 * escape abaixo perderia seus testes — que é justamente o que não pode
 * acontecer.
 *
 * ## HTML de e-mail não é HTML de web
 *
 * O Outlook para Windows renderiza com o motor do Word: sem flexbox, sem grid,
 * sem a maior parte do CSS moderno. Daí as escolhas que parecem antiquadas e
 * não são: tables aninhadas, CSS inline em cada elemento, atributos de
 * apresentação (`bgcolor`, `width`) ao lado do `style`, e um bloco VML para o
 * botão. `<style>` no `<head>` é descartado por vários clientes, então só
 * carrega a media query — o layout precisa ficar legível sem ela.
 */

/** Cor da marca. É `--primary` (`oklch(0.5 0.13 195)`) convertido para sRGB. */
const MARCA = '#00787A'
/** Tom escuro da marca, para a borda do botão — dá volume sem sombra. */
const MARCA_ESCURA = '#006669'
const TEXTO = '#171717'
const TEXTO_SECUNDARIO = '#525252'
const TEXTO_TERCIARIO = '#737373'
const BORDA = '#E5E5E5'
const FUNDO_EXTERNO = '#FAFAFA'
const FUNDO_CARD = '#FFFFFF'

/**
 * Sem webfont. O app usa Geist, mas webfont em e-mail só funciona no Apple
 * Mail — e um fallback inconsistente entre clientes fica pior do que uma
 * stack de sistema consistente. O Outlook cai em Segoe UI, próxima do Geist
 * em largura.
 */
const FONTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/**
 * Escapa texto para interpolação segura em conteúdo HTML.
 *
 * Nome de workspace é texto livre digitado pelo admin e vai dentro de um
 * e-mail entregue a quem ainda nem tem conta. Sem escape, um admin consegue
 * injetar link e markup e usar o remetente legítimo do Velo Funil para
 * phishing — o destinatário vê um domínio verificado, com SPF e DKIM válidos.
 *
 * Esta função vivia em `lib/workspace/actions.ts`; migrou para cá porque a
 * regra pertence ao módulo de e-mail, não a uma action específica.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escapa valores destinados a atributos HTML — e **só** o necessário para
 * fechar injeção de atributo.
 *
 * Diferente de `escapeHtml`, não toca em `&`, `{` nem `}`. Isso é deliberado e
 * crítico: os templates do Supabase usam `href="{{ .ConfirmationURL }}"`, em
 * sintaxe Go template. Codificar as chaves impediria a substituição da
 * variável, e codificar `&` para `&amp;` corromperia a query string dos tokens
 * de autenticação. Nos dois casos o resultado é o mesmo — link morto em todos
 * os e-mails de autenticação, o defeito mais caro que este arquivo pode ter.
 *
 * Fechar `"`, `<` e `>` já basta para impedir que um valor escape do atributo.
 */
export function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const ESTILO_PARAGRAFO = `margin:0 0 16px;font-family:${FONTE};font-size:15px;line-height:24px;color:${TEXTO_SECUNDARIO};`

/** Parágrafo do corpo a partir de texto puro. Escapa o conteúdo. */
export function paragraph(text: string): string {
  return `<p style="${ESTILO_PARAGRAFO}">${escapeHtml(text)}</p>`
}

/**
 * Parágrafo a partir de HTML já confiável, para quando se quer `<strong>`
 * intencional no meio da frase. **Não escapa** — quem chama é responsável por
 * passar dados de usuário já tratados com `escapeHtml`.
 */
export function rawParagraph(html: string): string {
  return `<p style="${ESTILO_PARAGRAFO}">${html}</p>`
}

export type EmailAction = {
  /** Texto do botão. */
  label: string
  /**
   * URL absoluta, ou uma variável de template do Supabase como
   * `{{ .ConfirmationURL }}`. Passa por `escapeAttr`, que preserva ambos.
   */
  url: string
}

export type EmailLayoutOptions = {
  /** Prévia mostrada na lista da caixa de entrada, antes de abrir. */
  preheader: string
  /** Título principal, dentro do card. */
  title: string
  /**
   * Corpo em HTML já confiável — monte com `paragraph()` (que escapa) ou
   * `rawParagraph()` (que não escapa).
   */
  bodyHtml: string
  action?: EmailAction
  /** Linha discreta abaixo do botão, para avisos de expiração e afins. */
  footnote?: string
  /**
   * Gera HTML simplificado, para colar no editor do painel do Supabase.
   *
   * O editor do painel é um CodeMirror que engasga com linhas muito longas e
   * rejeita o comentário condicional aninhado (`<!--[if !mso]><!-- -->`), o
   * truque usado para esconder do Outlook a versão não-VML do botão. O
   * sintoma é o botão "Save" não responder — sem mensagem de erro.
   *
   * Com esta opção o botão perde só o VML, ou seja, os cantos arredondados no
   * Outlook desktop: o `bgcolor` da célula continua valendo, então ele segue
   * colorido e legível, apenas retangular. Troca barata por um template que
   * de fato salva.
   *
   * Os e-mails enviados pelo Resend (convite) não passam por editor nenhum e
   * continuam com o VML.
   */
  paraPainelDoSupabase?: boolean
}

/**
 * Lockup da marca em HTML puro, sem imagem.
 *
 * Gmail e Outlook bloqueiam imagens externas por padrão: um cabeçalho que
 * dependa de `<img>` aparece vazio para boa parte de quem recebe, justamente
 * na primeira impressão. A marca em tipografia sempre aparece.
 *
 * O quadrado colorido com a letra `V` é a leitura secundária do `LogoMark` de
 * `components/branding/logo.tsx` (as três camadas convergentes formam um funil
 * e um V). SVG inline não é opção — Gmail, Outlook e Yahoo removem.
 *
 * O `border-radius` do quadrado é ignorado pelo Outlook, onde ele fica reto.
 * Aceitável: um VML por 36px de canto não compensa. No botão, sim — ver
 * abaixo.
 */
function lockup(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="36" height="36" bgcolor="${MARCA}" align="center" valign="middle" style="width:36px;height:36px;background-color:${MARCA};border-radius:8px;font-family:${FONTE};font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">V</td>
<td style="padding-left:12px;font-family:${FONTE};font-size:17px;letter-spacing:-0.3px;white-space:nowrap;"><span style="color:${TEXTO};font-weight:600;">Velo</span> <span style="color:${TEXTO_SECUNDARIO};font-weight:400;">Funil</span></td>
</tr></table>`
}

/**
 * Botão principal.
 *
 * A cor de fundo vai no `<td>`, não no `<a>`: alguns clientes descartam
 * `background-color` em âncoras. O `color:#ffffff` fica no `<a>` e é
 * obrigatório — texto sem cor declarada herda do cliente e some no modo
 * escuro.
 *
 * O bloco `<!--[if mso]>` existe porque, sem ele, o Outlook desktop ignora
 * `border-radius` e frequentemente o próprio fundo, transformando o elemento
 * mais visível da marca num retângulo cinza. O `href` aparece duas vezes de
 * propósito: dentro do VML e no `<a>`; esquecer um deles deixa o botão morto
 * em metade dos clientes.
 */
function botao(action: EmailAction, simplificado: boolean): string {
  const href = escapeAttr(action.url)
  const label = escapeHtml(action.label)

  const simples = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${MARCA}" align="center" style="background-color:${MARCA};border:1px solid ${MARCA_ESCURA};border-radius:8px;">
<a href="${href}" style="display:inline-block;padding:12px 24px;font-family:${FONTE};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
</td></tr></table>`

  if (simplificado) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;"><tr><td>
${simples}
</td></tr></table>`
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;"><tr><td>
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="16%" strokecolor="${MARCA_ESCURA}" fillcolor="${MARCA}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:${FONTE};font-size:15px;font-weight:600;">${label}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
${simples}
<!--<![endif]-->
</td></tr></table>`
}

/**
 * Rodapé montado a partir de `CONTROLADOR` (`lib/legal.ts`).
 *
 * Sem literal duplicada: aqueles dados já são centralizados por motivo
 * jurídico — documento que contradiz o sistema vira prova contra o controlador
 * — e o rodapé passa a acompanhar automaticamente qualquer mudança de razão
 * social ou CNPJ.
 */
function rodape(): string {
  const estilo = `font-family:${FONTE};font-size:12px;line-height:20px;color:${TEXTO_TERCIARIO};`
  const link = `color:${TEXTO_SECUNDARIO};text-decoration:underline;`

  return `<tr><td style="padding:0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="${BORDA}" style="height:1px;line-height:1px;font-size:0;background-color:${BORDA};">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding:20px 40px 32px;${estilo}">
<div style="${estilo}">${escapeHtml(CONTROLADOR.nomeFantasia)} · CNPJ ${escapeHtml(CONTROLADOR.cnpj)}</div>
<div style="${estilo}">Precisa de ajuda? Escreva para <a href="mailto:${escapeAttr(CONTROLADOR.email)}" style="${link}">${escapeHtml(CONTROLADOR.email)}</a></div>
<div style="${estilo}"><a href="${escapeAttr(CONTROLADOR.site)}" style="${link}">${escapeHtml(CONTROLADOR.site.replace(/^https?:\/\//, ''))}</a></div>
</td></tr>`
}

/**
 * Monta o e-mail completo.
 *
 * O preheader é o texto que aparece na lista da caixa de entrada, ao lado do
 * assunto. Fica escondido no corpo e é seguido de uma sequência de caracteres
 * invisíveis: sem esse enchimento, o Gmail completa a prévia com o começo do
 * HTML visível, e o que se lê na inbox vira "Velo Funil V Confirme seu...".
 */
export function renderEmail(options: EmailLayoutOptions): string {
  const { preheader, title, bodyHtml, action, footnote } = options
  const simplificado = options.paraPainelDoSupabase ?? false

  /**
   * Enchimento invisível depois do preheader. Sem ele, o Gmail completa a
   * prévia da caixa de entrada com o começo do conteúdo visível, e o que se lê
   * na lista vira "Velo Funil V Confirme seu...".
   *
   * Eram 60 repetições, o que produzia uma única linha de 1.200 caracteres —
   * o bastante para travar o editor do painel do Supabase. 12 já empurram a
   * prévia para além do limite que o Gmail exibe.
   */
  const enchimentoDoPreheader = '&#847;&zwnj;&nbsp;'.repeat(12)

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(title)}</title>
<style type="text/css">
@media only screen and (max-width:600px){
.velo-card{padding-left:24px !important;padding-right:24px !important;}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${FUNDO_EXTERNO};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${enchimentoDoPreheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FUNDO_EXTERNO}" style="background-color:${FUNDO_EXTERNO};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:${FUNDO_CARD};border:1px solid ${BORDA};border-radius:12px;">
<tr><td class="velo-card" style="padding:36px 40px 8px;">${lockup()}</td></tr>
<tr><td class="velo-card" style="padding:0 40px;">
<h1 style="margin:24px 0 12px;font-family:${FONTE};font-size:22px;font-weight:600;line-height:30px;letter-spacing:-0.4px;color:${TEXTO};">${escapeHtml(title)}</h1>
${bodyHtml}
${action ? botao(action, simplificado) : ''}
${footnote ? `<p style="margin:${action ? '16px' : '0'} 0 0;font-family:${FONTE};font-size:13px;line-height:20px;color:${TEXTO_TERCIARIO};">${escapeHtml(footnote)}</p>` : ''}
</td></tr>
<tr><td style="height:32px;line-height:32px;font-size:0;">&nbsp;</td></tr>
${rodape()}
</table>
</td></tr>
</table>
</body>
</html>`
}
