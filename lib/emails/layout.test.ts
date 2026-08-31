import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { assinaturaPublica, CONTROLADOR } from '@/lib/legal'
import {
  escapeAttr,
  escapeHtml,
  paragraph,
  rawParagraph,
  renderEmail,
} from '@/lib/emails/layout'

describe('escapeHtml', () => {
  it('neutraliza markup injetado', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    )
  })

  it('escapa aspas dos dois tipos', () => {
    expect(escapeHtml(`Time "A" do 'Sul'`)).toBe('Time &quot;A&quot; do &#39;Sul&#39;')
  })

  it('escapa o & antes dos demais, sem duplicar entidade', () => {
    expect(escapeHtml('Silva & Cia <b>')).toBe('Silva &amp; Cia &lt;b&gt;')
  })
})

/**
 * `escapeAttr` é deliberadamente mais frouxo que `escapeHtml`, e estes testes
 * são o que impede alguém de "corrigir" isso depois: os templates do Supabase
 * usam sintaxe Go template no href, e codificar `&`, `{` ou `}` mataria o link
 * de todos os e-mails de autenticação.
 */
describe('escapeAttr', () => {
  it('fecha injeção de atributo', () => {
    expect(escapeAttr('" onmouseover="alert(1)')).toBe(
      '&quot; onmouseover=&quot;alert(1)',
    )
  })

  it('preserva as chaves da variável do Supabase', () => {
    expect(escapeAttr('{{ .ConfirmationURL }}')).toBe('{{ .ConfirmationURL }}')
  })

  it('preserva o & da query string, que carrega os tokens', () => {
    const url = 'https://velofunil.com.br/auth?token=abc&type=signup'
    expect(escapeAttr(url)).toBe(url)
  })
})

describe('paragraph e rawParagraph', () => {
  it('paragraph escapa o conteúdo', () => {
    expect(paragraph('<script>alert(1)</script>')).toContain('&lt;script&gt;')
    expect(paragraph('<script>alert(1)</script>')).not.toContain('<script>')
  })

  it('rawParagraph confia no HTML recebido', () => {
    expect(rawParagraph('Olá <strong>Ana</strong>')).toContain('<strong>Ana</strong>')
  })
})

describe('renderEmail', () => {
  const base = {
    preheader: 'Prévia da mensagem',
    title: 'Confirme seu e-mail',
    bodyHtml: paragraph('Falta um passo para ativar sua conta.'),
  }

  /**
   * Regressão do defeito mais caro possível neste arquivo: um href codificado
   * deixa o botão sem destino em TODOS os e-mails de autenticação, e a falha
   * só aparece quando um cliente real clica.
   */
  it('mantém {{ .ConfirmationURL }} intacto no href', () => {
    const html = renderEmail({
      ...base,
      action: { label: 'Confirmar e-mail', url: '{{ .ConfirmationURL }}' },
    })

    expect(html).toContain('href="{{ .ConfirmationURL }}"')
    expect(html).not.toContain('%7B%7B')
    expect(html).not.toContain('&amp;#123;')
  })

  it('repete o href no bloco VML, senão o botão morre no Outlook', () => {
    const html = renderEmail({
      ...base,
      action: { label: 'Confirmar', url: 'https://velofunil.com.br/x' },
    })

    const ocorrencias = html.match(/href="https:\/\/velofunil\.com\.br\/x"/g)
    expect(ocorrencias).toHaveLength(2)
  })

  /**
   * O editor do painel do Supabase engasga com linhas muito longas e rejeita o
   * comentário condicional aninhado, o sintoma é o botão "Save" simplesmente
   * não responder, sem mensagem de erro. Estes testes fixam o formato que
   * comprovadamente cola e salva.
   */
  describe('variante para o painel do Supabase', () => {
    const paraPainel = renderEmail({
      ...base,
      action: { label: 'Confirmar e-mail', url: '{{ .ConfirmationURL }}' },
      paraPainelDoSupabase: true,
    })

    it('não usa comentário condicional aninhado', () => {
      expect(paraPainel).not.toContain('<!--[if !mso]>')
      expect(paraPainel).not.toContain('<!--<![endif]-->')
    })

    it('mantém nenhuma linha acima de 500 caracteres', () => {
      const maior = Math.max(...paraPainel.split('\n').map((l) => l.length))
      expect(maior).toBeLessThan(500)
    })

    // Sem o VML o botão perde só os cantos arredondados no Outlook: o bgcolor
    // da célula continua valendo, então ele segue colorido e clicável.
    it('mantém o botão colorido e com o link certo', () => {
      expect(paraPainel).toContain(`bgcolor="#00787A"`)
      expect(paraPainel).toContain('href="{{ .ConfirmationURL }}"')
    })
  })

  it('escapa o título, que vai para o <title> e para o <h1>', () => {
    const html = renderEmail({ ...base, title: 'Bem-vindo <b>você</b>' })
    expect(html).not.toContain('<b>você</b>')
    expect(html).toContain('&lt;b&gt;')
  })

  it('monta o rodapé a partir do CONTROLADOR, sem literal duplicada', () => {
    const html = renderEmail(base)
    // `assinaturaPublica` no lugar de `CONTROLADOR.cnpj` direto (25/08): sem
    // inscrição ativa o campo é nulo, e afirmar aqui que o número aparece
    // travaria o teste num estado que o projeto não tem.
    expect(html).toContain(assinaturaPublica())
    expect(html).toContain(CONTROLADOR.email)
    expect(html).toContain(CONTROLADOR.nomeFantasia)
  })

  it('não escreve CNPJ no rodapé enquanto não houver inscrição ativa', () => {
    // O e-mail transacional é o lugar mais fácil de esquecer: ninguém abre um
    // para conferir depois de mexer na landing.
    if (CONTROLADOR.cnpj) return
    expect(renderEmail(base)).not.toContain('CNPJ')
  })

  // Os links do rodapé (mailto e site) existem sempre, o que precisa sumir
  // sem `action` é o bloco do botão, identificável pelo VML do Outlook.
  it('omite o botão quando não há ação', () => {
    expect(renderEmail(base)).not.toContain('v:roundrect')
  })

  it('declara color-scheme para o e-mail sobreviver ao modo escuro', () => {
    expect(renderEmail(base)).toContain('name="color-scheme"')
  })

  /**
   * Alarme de sincronização: os arquivos em `supabase/email-templates/` são
   * cópias estáticas deste layout, coladas à mão no painel do Supabase. Quando
   * este snapshot quebrar, os `.html` de lá precisam ser regerados e colados de
   * novo, senão o que está em produção diverge em silêncio do que está no
   * repositório.
   */
  it('mantém a estrutura estável (regenerar supabase/email-templates se falhar)', () => {
    const html = renderEmail({
      preheader: 'Prévia fixa',
      title: 'Título fixo',
      bodyHtml: paragraph('Corpo fixo.'),
      action: { label: 'Ação fixa', url: '{{ .ConfirmationURL }}' },
      footnote: 'Observação fixa.',
    })

    expect(html).toMatchSnapshot()
  })
})

/**
 * ## Os `.html` do painel do Supabase, travados contra `lib/legal.ts`
 *
 * Esta suíte existe por causa de um defeito que passou 23 dias em produção.
 *
 * Os arquivos de `supabase/email-templates/` são cópias ESTÁTICAS, coladas à
 * mão no painel — a API de Auth do Supabase não expõe template, então não há
 * como aplicá-los por código. São os e-mails de confirmação de cadastro,
 * recuperação de senha, convite, magic link e reautenticação: justamente os
 * que TODA pessoa nova recebe.
 *
 * Em 08/08 o CNPJ do rodapé foi baixado na Receita. Em 25/08 o projeto tornou
 * `CONTROLADOR.cnpj` anulável e corrigiu as seis superfícies dinâmicas; o
 * snapshot acima quebrou, foi atualizado, **e os `.html` não foram regerados**.
 * O alarme tocou e só metade dele foi atendida — a mesma classe do commit que
 * verificou que o script de prints rodou, sem conferir se a imagem ficou certa.
 *
 * Resultado: por 23 dias todo e-mail de autenticação saiu com um CNPJ que
 * qualquer consulta à Receita desmentia, enquanto a landing — protegida —
 * não exibia número nenhum. As duas superfícies do mesmo dado, discordando.
 *
 * **Por que um teste e não um lembrete no README.** O README já pedia para
 * regerar, e foi ignorado. Um comentário não roda em `npm test`; este roda.
 * Ele lê os arquivos de verdade e compara com a função que a aplicação usa,
 * então a divergência para de depender de alguém lembrar.
 */
describe('templates estáticos do painel do Supabase', () => {
  const PASTA = join(process.cwd(), 'supabase', 'email-templates')
  const arquivos = readdirSync(PASTA).filter((n) => n.endsWith('.html'))

  it('existem, e a lista não encolheu sem ninguém notar', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(5)
  })

  it.each(arquivos)('%s assina igual ao que o código gera hoje', (nome) => {
    const html = readFileSync(join(PASTA, nome), 'utf-8')
    expect(html).toContain(assinaturaPublica())
  })

  /**
   * O irmão negativo, e ele é o que de fato pegaria o defeito original.
   *
   * O teste acima passaria mesmo com o CNPJ velho ainda no arquivo, porque
   * `toContain` não se importa com o que mais existe no HTML. Só a proibição
   * explícita do número morto reprova a cópia esquecida — mesma razão pela
   * qual a bio do Instagram ganhou um teste que PROÍBE a palavra da oferta
   * aposentada em vez de conferir o número da vigente.
   */
  it.each(arquivos)('%s não carrega o CNPJ baixado em 08/08', (nome) => {
    const html = readFileSync(join(PASTA, nome), 'utf-8')
    expect(html).not.toContain('64.543.748')
  })
})
