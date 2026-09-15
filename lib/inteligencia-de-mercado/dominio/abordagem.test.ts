
import { describe, expect, it } from 'vitest'

import { montarAbordagem, nomeCurto, TETO } from './abordagem'

const base = {
  dominio: 'quatrocor.com.br',
  nome: 'Gráfica Quatrocor',
  vertical: 'comunicacao-visual',
  motivos: ['WhatsApp direto', 'pede orçamento no site'],
  precoMensal: 49,
  limiteGratis: 50,
  limiteDeEmpresas: 5,
}

describe('montarAbordagem', () => {
  // A mensagem antiga deu 0 contas em 98 envios. Ela terminava em LINK DE
  // CADASTRO, ou seja, pedia a um estranho que criasse conta, senha e empresa
  // na primeira mensagem. Cold outreach nao converte pedindo conversao,
  // converte pedindo RESPOSTA. Ver docs/mercado/abordagem-nova-2026-09-15.md.
  const base = {
    dominio: 'quatrocor.com.br',
    nome: 'Gráfica Quatrocor',
    vertical: 'comunicacao-visual',
    motivos: ['pede orçamento', 'telefone na página'],
    precoMensal: 97,
    limiteGratis: 50,
    limiteDeEmpresas: 5,
  }

  it('cabe no teto do WhatsApp em todos os nichos', () => {
    for (const vertical of ['dedetizacao', 'marcenaria', 'locacao-equipamentos', 'inexistente']) {
      expect(montarAbordagem({ ...base, vertical }).length).toBeLessThanOrEqual(TETO)
    }
  })

  it('NEGA o mal-entendido na primeira linha', () => {
    // O dono le "orcamento" e acha que e cliente comprando. Responde animado,
    // descobre que e venda, e vai em "Bloquear e denunciar". E no painel isso
    // contaria como REPLIED: a estatistica melhora enquanto o numero piora.
    expect(montarAbordagem(base)).toMatch(/nao (e pedido de|vim pedir) orcamento/i)
  })

  it('oferece a SAIDA, e ela e a ultima linha', () => {
    const texto = montarAbordagem(base)
    expect(texto).toMatch(/me diz que eu paro|so me dizer que eu paro/i)
    expect(texto.trimEnd().endsWith('por aqui.')).toBe(true)
  })

  it('a saida e pegavel por pediuParaSair', () => {
    // A promessa so vale se o opt-out reconhecer a palavra que a mensagem
    // convida a pessoa a usar.
    expect(montarAbordagem(base).includes('paro')).toBe(true)
  })

  it('NAO promete "nao volto a procurar", porque agora ha toque 2 e 3', () => {
    // A frase antiga virou mentira quando a sequencia nasceu.
    expect(montarAbordagem(base)).not.toMatch(/nao volto a procurar/i)
  })

  it('so cita o formulario quando o SITE disse que ele existe', () => {
    expect(montarAbordagem(base)).toMatch(/recebem pedido de orcamento pelo site/i)
    const sem = montarAbordagem({ ...base, motivos: ['telefone na página'] })
    expect(sem).not.toMatch(/pelo site/i)
  })

  it('NAO leva preco: ele responde objecao que ninguem fez', () => {
    const texto = montarAbordagem({ ...base, precoMensal: 97 })
    expect(texto).not.toMatch(/R\$/)
    expect(texto).not.toMatch(/97/)
  })

  it('NAO leva link: ele da um lugar para ir EM VEZ de responder', () => {
    expect(montarAbordagem(base)).not.toMatch(/https?:\/\/|velofunil|wa\.me/i)
  })

  it('NAO promete o que o produto nao faz', () => {
    const texto = montarAbordagem(base)
    // O produto CRIA a tarefa; quem liga e a pessoa. E "cobrar" no portugues
    // do cliente significa receber divida, medido no Exa em 09/09.
    for (const p of [/cobra/i, /envia sozinho/i, /automatic/i, /garant/i]) {
      expect(texto).not.toMatch(p)
    }
  })

  it('nao tem travessao', () => {
    // Banido dos criativos em 31/08 e estendido a tudo em 15/09: ninguem
    // digita travessao no WhatsApp, e ele denuncia texto de maquina no canal
    // onde a mensagem precisa parecer uma pessoa.
    expect(montarAbordagem(base)).not.toMatch(/[–—]/)
  })

  it('chama pelo nome quando o decisor foi casado com ESTA empresa', () => {
    expect(montarAbordagem({ ...base, decisor: 'Carla' })).toMatch(/^Oi, Carla\./)
  })

  it('volta ao nome da empresa quando nao ha decisor', () => {
    expect(montarAbordagem(base)).toMatch(/^Oi, Gráfica Quatrocor\./)
  })

  it('duas empresas diferentes nao recebem o MESMO texto', () => {
    // "texto identico" e o terceiro padrao que faz o WhatsApp banir um numero.
    const a = montarAbordagem({ ...base, dominio: 'a.com.br', nome: 'Alfa' })
    const b = montarAbordagem({ ...base, dominio: 'zzz.com.br', nome: 'Alfa' })
    expect(a).not.toBe(b)
  })

  it('a MESMA empresa recebe sempre o mesmo texto', () => {
    // A semente e o dominio: sem isso, reenviar mandaria outra mensagem e a
    // pessoa perceberia a maquina.
    expect(montarAbordagem(base)).toBe(montarAbordagem(base))
  })
})


describe('nomeCurto', () => {
  it('corta a cauda de SEO do titulo', () => {
    // Chamar a empresa pelo titulo inteiro denuncia que a mensagem foi montada
    // por maquina.
    expect(nomeCurto('Gráfica Quatrocor | Impressão em São Paulo', 'x.com.br')).toBe('Gráfica Quatrocor')
    expect(nomeCurto('Marcenaria Alfa - Móveis sob medida', 'x.com.br')).toBe('Marcenaria Alfa')
  })

  it('cai no dominio quando o titulo nao serve', () => {
    expect(nomeCurto(null, 'quatrocor.com.br')).toBe('quatrocor.com.br')
    expect(nomeCurto('', 'quatrocor.com.br')).toBe('quatrocor.com.br')
    expect(nomeCurto('A', 'quatrocor.com.br')).toBe('quatrocor.com.br')
    expect(nomeCurto('Um título longo demais para ser o nome de uma empresa de verdade', 'q.com.br')).toBe(
      'q.com.br',
    )
  })
})

describe('nomeCurto: o nome que a pessoa reconhece', () => {
  it('CAIXA ALTA vira Caixa de Titulo: 44 das 882 gritavam', () => {
    // Medido em 08/09 sobre a prateleira inteira. A saudacao virava
    // "Oi! Achei a SERRALHERIA EM PORTO ALEGRE procurando empresas do setor",
    // que le como grito e denuncia montagem por maquina — exatamente o que
    // esta funcao existe para evitar.
    expect(nomeCurto('SERRALHERIA EM PORTO ALEGRE', 'x.com.br')).toBe('Serralheria em Porto Alegre')
  })

  it('sigla curta CONTINUA gritando, porque sigla em caixa alta esta certa', () => {
    expect(nomeCurto('DGA SISTEMAS E SOLUÇÕES', 'x.com.br')).toBe('DGA Sistemas e Soluções')
  })

  it('nome ja MISTO nao e tocado: reescrever estragaria a marca', () => {
    // `iFood`, `AGGIO`, `SJColor` sao escolha de quem escreveu.
    expect(nomeCurto('AGGIO Soluções em Comunicação', 'x.com.br')).toBe('AGGIO Soluções em Comunicação')
    expect(nomeCurto('iFood Delivery', 'x.com.br')).toBe('iFood Delivery')
  })

  it('corta na trilha de navegacao, nao so no pipe', () => {
    // "i9 Acrilicos » Porta Folhetos" era o unico caso na base, e o corte
    // original nao previa `»`.
    expect(nomeCurto('i9 Acrílicos » Porta Folhetos', 'x.com.br')).toBe('i9 Acrílicos')
  })

  it('sem nome, ou nome absurdo, devolve o dominio', () => {
    expect(nomeCurto(null, 'x.com.br')).toBe('x.com.br')
    expect(nomeCurto('a'.repeat(60), 'x.com.br')).toBe('x.com.br')
  })
})

describe('titulo de pagina nao e nome de empresa', () => {
  it('recusa o rotulo de menu e cai para o dominio', () => {
    // Medido em 08/09: oito dos 589 contatos abriam com "Oi! Achei a Sobre a
    // Empresa procurando empresas do setor". O site nao pos o nome no <title>.
    for (const t of ['Home', 'Sobre a Empresa', 'Sobre NÓS', 'Empresa', 'Produtos s', 'Quem Somos'])
      expect(nomeCurto(t, 'exemplo.com.br')).toBe('exemplo.com.br')
  })

  it('MANTEM nome real que comeca com palavra generica', () => {
    // A primeira versao recusava "comeca com palavra generica" e derrubava tres
    // nomes legitimos. Trocar nome real pelo dominio e PIOR que o defeito
    // original: o dominio denuncia maquina, o nome nao.
    expect(nomeCurto('Empresa Comunicação Visual SP', 'x.com.br')).toBe('Empresa Comunicação Visual SP')
    expect(nomeCurto('Empresa Brasileira De Eventos', 'x.com.br')).toBe('Empresa Brasileira De Eventos')
    expect(nomeCurto('Contato Digital Marketing', 'x.com.br')).toBe('Contato Digital Marketing')
  })
})

describe('a variação que quebra o padrão de texto idêntico', () => {
  // `docs/mercado/limites-e-bloqueios.md` lista "texto idêntico" como o
  // terceiro padrão que faz o WhatsApp banir um número. Medido em 08/09 sobre
  // as 882 mensagens da prateleira: eram DEZ modelos, personalizados só pelo
  // nome. Com quatro pontos de variação, a mesma medição dá 251.

  it('a MESMA empresa recebe sempre a mesma mensagem', () => {
    // Determinismo não é capricho: a prévia que o dono lê antes de enviar tem
    // que ser o que sai, a mensagem gravada na timeline tem que bater com a
    // enviada, e retomar a fila depois de um Ctrl+C não pode trocar o texto de
    // quem ainda não recebeu. `Math.random` quebraria os três.
    const uma = montarAbordagem(base)
    for (let i = 0; i < 20; i++) expect(montarAbordagem(base)).toBe(uma)
  })

  it('empresas DIFERENTES do mesmo nicho recebem mensagens diferentes', () => {
    const textos = new Set(
      ['a.com.br', 'b.com.br', 'c.com.br', 'd.com.br', 'e.com.br', 'f.com.br'].map((dominio) =>
        // Sem o nome no começo: o que se prova aqui é que o CORPO varia, não
        // que o nome da empresa é diferente — isso já era verdade antes.
        montarAbordagem({ ...base, dominio }).split('\n\n').slice(1).join('|'),
      ),
    )
    expect(textos.size).toBeGreaterThan(1)
  })

  it('a semente é o DOMÍNIO, não o nome', () => {
    // Nome sai do título do site e muda quando alguém mexe no SEO. Se ele
    // fosse a semente, a mesma empresa receberia outro texto na rodada
    // seguinte — e uma segunda mensagem diferente lê como outra pessoa
    // insistindo.
    const a = montarAbordagem({ ...base, nome: 'Gráfica Quatrocor' })
    const b = montarAbordagem({ ...base, nome: 'Quatrocor Impressão Digital' })
    // Compara os trechos SORTEADOS, não a mensagem inteira: nome mais longo
    // deixa menos espaço, e a linha opcional de multi-empresa pode não caber
    // numa das duas. Isso é o teto de 560 funcionando, não a semente mudando.
    // A primeira versão deste caso comparava o corpo todo e reprovou quando a
    // linha de empresas nasceu.
    const gancho = (m: string) => m.split('\n\n')[1]
    const oferta = (m: string) => m.split('\n\n')[2]
    expect(gancho(a)).toBe(gancho(b))
    expect(oferta(a)).toBe(oferta(b))
  })

  it('NENHUMA combinação passa do teto do WhatsApp', () => {
    // O guard antigo tirava a linha da equipe quando estourava e devolvia o
    // resultado mesmo assim — sem conferir se agora cabia. Com as variantes
    // novas, sete mensagens do universo real saíram a 568 antes de encurtar os
    // textos. Este caso trava a regra para qualquer combinação futura.
    for (let i = 0; i < 200; i++) {
      const m = montarAbordagem({
        ...base,
        dominio: `empresa-${i}.com.br`,
        nome: 'Comunicação Visual e Serralheria do Litoral',
        motivos: ['tem equipe de vendas', 'pede orçamento no site'],
      })
      expect(m.length).toBeLessThanOrEqual(560)
      // A promessa mudou de FORMA em 15/09, nao de existencia: com os toques
      // 2 e 3 nascendo, "nao volto a procurar" viraria mentira. "Me diz que eu
      // paro" continua verdadeiro e e pegavel por `pediuParaSair`.
      expect(m.endsWith('por aqui.')).toBe(true)
    }
  })
})
