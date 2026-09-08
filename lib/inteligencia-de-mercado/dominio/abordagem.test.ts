import { describe, expect, it } from 'vitest'

import { montarAbordagem, nomeCurto, TETO } from './abordagem'

const base = {
  dominio: 'quatrocor.com.br',
  nome: 'Gráfica Quatrocor',
  vertical: 'comunicacao-visual',
  motivos: ['WhatsApp direto', 'pede orçamento no site'],
  precoMensal: 49,
  limiteGratis: 50,
}

describe('montarAbordagem', () => {
  it('a linha de DESCARTE nunca e cortada, em nenhum nicho', () => {
    // O defeito que este teste tranca: a primeira versao cortava a mensagem
    // inteira no fim, e contra 90 prospects reais a saida terminava em
    // "Se nao fizer sentido, me avisa que…" — comendo exatamente a linha que
    // transforma "nao tenho interesse" em resposta em vez de denuncia de spam.
    // O teste antigo passava porque conferia TAMANHO, nao o que sobrou.
    //
    // O TEXTO da linha mudou em 08/09, de "me avisa" para "e so ignorar": o
    // dono passou a enviar sem responder, e promessa que exige acao do
    // remetente vira promessa quebrada. A funcao e a mesma, e este teste
    // continua travando o que importa — que ela seja a ULTIMA coisa.
    for (const vertical of ['dedetizacao', 'comunicacao-visual', 'marcenaria', 'nicho-novo']) {
      for (const motivos of [['tem equipe de vendas'], ['WhatsApp direto']]) {
        const m = montarAbordagem({ ...base, vertical, motivos })
        expect(m.endsWith('é só ignorar: não te procuro de novo.')).toBe(true)
        expect(m).not.toContain('…')
      }
    }
  })

  it('quando nao cabe, sai o OPCIONAL e nao o fim', () => {
    const comEquipe = montarAbordagem({
      ...base, vertical: 'marcenaria', motivos: ['tem equipe de vendas'],
    })
    // O gancho de marcenaria e o mais longo: a linha da equipe e sacrificada.
    expect(comEquipe).toMatch(/n[ãa]o te procuro de novo\.$/)
    expect(comEquipe.length).toBeLessThanOrEqual(TETO)
  })

  it('cabe na tela do WhatsApp', () => {
    // Acima de ~520 caracteres o WhatsApp mostra "Ler mais" e a mensagem morre
    // ali, sem leitura.
    for (const vertical of ['dedetizacao', 'marcenaria', 'locacao-equipamentos', 'nicho-novo']) {
      const m = montarAbordagem({ ...base, vertical, motivos: ['tem equipe de vendas'] })
      expect(m.length).toBeLessThanOrEqual(TETO)
    }
  })

  it('diz de ONDE veio o contato', () => {
    // Exigencia pratica da LGPD para interesse legitimo, e antes disso o que
    // separa abordagem de spam.
    expect(montarAbordagem(base)).toMatch(/Achei a .+ procurando/)
  })

  it('oferece a saida na PRIMEIRA mensagem', () => {
    // Uma linha de descarte custa nada e e a diferenca entre "nao tenho
    // interesse" e uma denuncia de spam — que no WhatsApp derruba o numero.
    expect(montarAbordagem(base)).toMatch(/n[ãa]o te procuro de novo/)
  })

  it('NUNCA afirma dor que ninguem mediu', () => {
    // Nos lemos o site, nao a carteira. "Vi que voce esta perdendo vendas" e
    // invencao — vira pergunta, que e honesta e obriga resposta.
    const m = montarAbordagem(base)
    expect(m).not.toMatch(/vi que (voc[êe]|a empresa)|percebi que|notei que|voc[êe] est[áa] perdendo/i)
    expect(m).toMatch(/\?/)
  })

  it('so cita equipe quando o SITE disse que ela existe', () => {
    const com = montarAbordagem({ ...base, motivos: ['tem equipe de vendas'] })
    const sem = montarAbordagem({ ...base, motivos: ['WhatsApp direto'] })
    expect(com).toMatch(/mais de um no atendimento/)
    expect(sem).not.toMatch(/mais de um no atendimento/)
  })

  it('preco e limite vem de fora, nunca escritos a mao', () => {
    // Se `lib/plans.ts` mudar e a mensagem nao, a abordagem passa a prometer um
    // preco que o checkout nao cobra.
    const m = montarAbordagem({ ...base, precoMensal: 59, limiteGratis: 30 })
    expect(m).toContain('R$ 59')
    expect(m).toContain('30 contatos')
    expect(m).not.toContain('R$ 49')
  })

  it('leva o argumento que a dor publica revelou: contrato, nao preco', () => {
    // Medido em 06/09 no Reclame Aqui: a objecao numero um contra RD Station e
    // Agendor e "nao consigo cancelar", nao "e caro".
    const m = montarAbordagem(base)
    expect(m).toMatch(/sem fidelidade/i)
    expect(m).toMatch(/CSV/)
  })

  it('nao usa travessao: no WhatsApp ele vira caractere estranho em teclado antigo', () => {
    // Pedido do dono em 07/09, junto com a mesma limpeza no sino e no card de
    // sinais. O travessao tambem inflava o `wa.me`, onde ele vira `%E2%80%94` —
    // tres bytes num link que ja carrega a mensagem inteira codificada.
    const m = montarAbordagem(base)
    expect(m).not.toMatch(/[—–]/)
  })

  it('NAO inventa prova social', () => {
    // Decisao travada do projeto: este produto nao tem cliente externo.
    const m = montarAbordagem(base)
    expect(m).not.toMatch(/\+?\d+ (empresas|clientes) (j[áa] )?us|mais de \d+ (empresas|clientes)|l[íi]der/i)
  })

  it('o gancho muda por nicho, e cai num padrao seguro no nicho desconhecido', () => {
    expect(montarAbordagem({ ...base, vertical: 'marcenaria' })).toMatch(/planejados/)
    expect(montarAbordagem({ ...base, vertical: 'inexistente' })).toMatch(/or[çc]amento/)
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

describe('o nome de quem decide', () => {
  it('chama pelo nome quando o decisor foi casado com ESTA empresa', () => {
    const m = montarAbordagem({ ...base, decisor: 'Daniel' })
    expect(m.startsWith('Oi, Daniel! Achei a Gráfica Quatrocor')).toBe(true)
  })

  it('volta a saudacao generica quando nao ha decisor, sem quebrar nada', () => {
    // `null` e o caso comum: `extrairDecisor` recusa casar quando o nome da
    // empresa nao aparece no titulo do perfil. Nome errado na primeira palavra
    // queima a abordagem inteira — generico e melhor que arriscado.
    for (const d of [null, undefined]) {
      const m = montarAbordagem({ ...base, decisor: d })
      expect(m.startsWith('Oi! Achei a')).toBe(true)
      expect(m.endsWith('é só ignorar: não te procuro de novo.')).toBe(true)
    }
  })

  it('com nome E equipe, o fim continua intocavel', () => {
    const m = montarAbordagem({
      ...base, vertical: 'marcenaria', decisor: 'Ana Beatriz', motivos: ['tem equipe de vendas'],
    })
    expect(m.length).toBeLessThanOrEqual(TETO)
    expect(m.endsWith('é só ignorar: não te procuro de novo.')).toBe(true)
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

describe('o link, e o que a operacao de SO ENVIO exige dele', () => {
  it('a mensagem diz ONDE fica: sem link nao ha para onde ir', () => {
    // Ate 08/09 ela dizia "Montei um CRM pra isso" e nunca dizia onde. Quem se
    // interessasse tinha que PERGUNTAR — e a operacao nao responde.
    expect(montarAbordagem(base)).toContain('velofunil.com.br')
  })

  it('o link e MARCADO: sem isso nao ha retorno nenhum', () => {
    // Enviar sem responder significa que o unico sinal de vida e quem visita o
    // site. `utm-capture.tsx` grava `utm_source` no workspace de quem se
    // cadastra, entao a marca faz a origem aparecer sem codigo novo.
    expect(montarAbordagem(base)).toContain('utm_source=whatsapp')
  })

  it('a saida NAO exige resposta do remetente', () => {
    // "me avisa que nao te procuro de novo" e promessa que exige acao de quem
    // mandou. Numa operacao de so envio ela seria quebrada — e promessa
    // quebrada e o que transforma desinteresse em denuncia.
    const m = montarAbordagem(base)
    expect(m).toContain('é só ignorar')
    expect(m).not.toContain('me avisa')
  })

  it('cabe no teto em TODOS os nichos, com e sem a linha de equipe', () => {
    // Medido em 08/09: com o link, o pior caso (marcenaria com equipe) fica em
    // 559 de 560. UM caractere de folga — por isso este caso existe.
    for (const vertical of ['dedetizacao', 'comunicacao-visual', 'marcenaria',
      'locacao-equipamentos', 'eventos-corporativos', 'nicho-novo']) {
      for (const motivos of [['tem equipe de vendas'], ['WhatsApp direto']]) {
        const m = montarAbordagem({ ...base, vertical, motivos })
        expect(m.length).toBeLessThanOrEqual(TETO)
        expect(m.endsWith('é só ignorar: não te procuro de novo.')).toBe(true)
      }
    }
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
