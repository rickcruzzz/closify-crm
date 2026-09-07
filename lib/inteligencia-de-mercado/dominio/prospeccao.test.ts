import { describe, expect, it } from 'vitest'

import {
  deduplicarPorDominio,
  ehDominioExcluido,
  extrairContato,
  ordenarProspects,
  pontuarProspect,
  VERTICAIS,
  MINIMO_PARA_LEAD,
  type ProspectBruto,
} from './prospeccao'

const base: ProspectBruto = {
  url: 'https://graficaexemplo.com.br',
  titulo: 'Gráfica Exemplo',
  vertical: 'comunicacao-visual',
  contato: { whatsapp: null, telefone: null, email: null, instagram: null },
  texto: '',
}

describe('ehDominioExcluido', () => {
  it('barra agregador de vaga', () => {
    // Medido em 06/09: o ângulo de "vaga de vendedor" devolveu QUATRO sites de
    // emprego em quatro posições. Prospectar site de vagas é gastar a busca
    // para achar quem já é intermediário.
    for (const u of [
      'https://betavagas.com/x', 'https://vagas.sc/y', 'https://remotar.com.br/z',
      'https://www.catho.com.br/vaga/1',
    ]) {
      expect(ehDominioExcluido(u)).toBe(true)
    }
  })

  it('barra CONCORRENTE, que domina toda busca sobre a dor', () => {
    // O blog deles é conteúdo de marketing feito para ranquear exatamente
    // nesses termos. Medido: "reclama de planilha" devolveu agendor, deepcrm e
    // nexarhub nas primeiras posições.
    for (const u of [
      'https://www.agendor.com.br/blog/crm-planilha', 'https://deepcrm.app/guia',
      'https://rdstation.com/crm', 'https://nexarhub.com.br/artigo',
    ]) {
      expect(ehDominioExcluido(u)).toBe(true)
    }
  })

  it('barra subdominio do excluido', () => {
    expect(ehDominioExcluido('https://blog.agendor.com.br/x')).toBe(true)
  })

  it('DEIXA PASSAR o site de empresa de verdade', () => {
    for (const u of [
      'https://agenciapmedigital.com.br', 'https://clinicalys.com.br',
      'https://vanzelaclinic.com.br', 'https://www.aprimoraweb.com.br/servicos',
    ]) {
      expect(ehDominioExcluido(u)).toBe(false)
    }
  })

  it('trata url quebrada como excluida', () => {
    // Na dúvida, fora: um prospect a menos é barato, uma URL inválida virando
    // lead no CRM é lixo que alguém vai trabalhar.
    expect(ehDominioExcluido('nao-e-url')).toBe(true)
  })
})

describe('extrairContato', () => {
  it('tira o WhatsApp do LINK, que e onde ele existe', () => {
    // O texto extraído do Exa remove `href`, então `wa.me` só aparece em
    // `extras.links`. Medido: `agenciapmedigital.com.br` tinha zero telefone no
    // texto e o WhatsApp completo no link.
    const c = extrairContato({
      links: ['https://wa.me/5511941289701?text=Ol%C3%A1%2C%20quero'],
    })
    expect(c.whatsapp).toBe('5511941289701')
  })

  it('tira o telefone do TEXTO, que e onde ele existe', () => {
    // A outra metade: `clinicalys.com.br` não tinha link de WhatsApp e tinha o
    // telefone escrito no rodapé. As duas fontes são complementares.
    expect(extrairContato({ texto: 'Ligue (11) 94068-4935 e agende' }).telefone).toBe(
      '(11) 94068-4935',
    )
  })

  it('nao confunde CNPJ nem CEP com telefone', () => {
    expect(extrairContato({ texto: 'CNPJ 68.877.105/0001-67' }).telefone).toBeNull()
    expect(extrairContato({ texto: 'CEP 01310100' }).telefone).toBeNull()
  })

  it('prefere mailto ao e-mail solto no texto', () => {
    const c = extrairContato({
      texto: 'contato@errado.com',
      links: ['mailto:CERTO@empresa.com.br'],
    })
    expect(c.email).toBe('certo@empresa.com.br')
  })

  it('descarta e-mail do FORNECEDOR do site', () => {
    // Rodapé de tema e política de cookies trazem o e-mail de quem fez o site.
    // Mandar proposta para o desenvolvedor do prospect e queimar o contato.
    expect(extrairContato({ texto: 'suporte@wixpress.com' }).email).toBeNull()
    expect(extrairContato({ texto: 'x@sentry.io fale com contato@empresa.com.br' }).email).toBe(
      'contato@empresa.com.br',
    )
  })

  it('devolve tudo nulo sem explodir quando nao ha nada', () => {
    const c = extrairContato({})
    expect(c).toEqual({ whatsapp: null, telefone: null, email: null, instagram: null })
  })
})

describe('pontuarProspect', () => {
  it('desqualifica de vez quem esta na lista de exclusao', () => {
    const p = pontuarProspect({ ...base, url: 'https://www.agendor.com.br/blog' })
    expect(p.qualificado).toBe(false)
    expect(p.pontos).toBe(0)
  })

  it('PENALIZA quem ja usa CRM concorrente, sem descartar', () => {
    // Não é prospect frio, é troca: argumento diferente e conversão menor.
    // Sumir da lista seria perder um cliente possível; ficar em primeiro seria
    // gastar a melhor hora do dia no mais difícil.
    const com = pontuarProspect({ ...base, texto: 'Somos parceiros RD Station' })
    const sem = pontuarProspect({ ...base, texto: 'Atendemos PMEs' })
    expect(com.pontos).toBeLessThan(sem.pontos)
    expect(com.qualificado).toBe(true)
    expect(com.motivos).toContain('já menciona um CRM concorrente')
  })

  it('WhatsApp vale mais que Instagram', () => {
    const wpp = pontuarProspect({ ...base, contato: { ...base.contato, whatsapp: '5511999998888' } })
    const insta = pontuarProspect({ ...base, contato: { ...base.contato, instagram: 'https://instagram.com/x' } })
    expect(wpp.pontos).toBeGreaterThan(insta.pontos)
  })

  it('todo motivo aparece em texto, para a regua ser conferivel', () => {
    // Nota sem justificativa é número plausível sem como conferir. Com os
    // motivos, o dono discorda da régua olhando a linha.
    const p = pontuarProspect({
      ...base,
      contato: { whatsapp: '5511999998888', telefone: null, email: null, instagram: null },
      texto: 'nossa equipe de vendas atende',
    })
    expect(p.motivos).toContain('WhatsApp direto')
    expect(p.motivos).toContain('domínio .com.br')
    expect(p.motivos).toContain('tem equipe de vendas')
  })

  it('sem contato continua qualificado, com aviso', () => {
    // O valor já está em ter o site certo na frente: a pessoa abre e acha o
    // contato. Descartar aqui jogaria fora prospect bom por limitação de
    // extração — PME põe contato em botão de WhatsApp renderizado por JS.
    const p = pontuarProspect(base)
    expect(p.qualificado).toBe(true)
    expect(p.motivos).toContain('sem contato extraído (abrir o site à mão)')
  })
})

describe('ordenarProspects e deduplicarPorDominio', () => {
  it('empate desempata por WhatsApp', () => {
    const a = pontuarProspect({ ...base, url: 'https://a.com.br', contato: { ...base.contato, email: 'a@a.com.br' } })
    const b = pontuarProspect({ ...base, url: 'https://b.com.br', contato: { ...base.contato, whatsapp: '5511999998888' } })
    // Mesmo com pontos diferentes, o teste que importa é que WhatsApp lidera.
    expect(ordenarProspects([a, b])[0].contato.whatsapp).toBeTruthy()
  })

  it('um dominio, um prospect', () => {
    // `findSimilar` devolve o mesmo site vindo de sementes diferentes.
    const p1 = pontuarProspect({ ...base, url: 'https://mesma.com.br/a' })
    const p2 = pontuarProspect({ ...base, url: 'https://mesma.com.br/b' })
    expect(deduplicarPorDominio([p1, p2])).toHaveLength(1)
  })
})

describe('VERTICAIS', () => {
  it('toda consulta descreve o SITE, nunca a dor', () => {
    // A inversão medida: "quem reclama de planilha" devolve blog de
    // concorrente; "site de clínica pequena" devolve cliente.
    //
    // A fronteira de palavra (``) não é detalhe: sem ela, `/dor/` casa
    // dentro de "desenvolve<dor>a" e este teste reprovava o vertical de
    // software house. É a mesma armadilha que o estado-atual já registra —
    // `pro` é substring de `produção`, e casar por pedaço de palavra atribui
    // coisa à coisa errada.
    for (const v of VERTICAIS) {
      expect(v.consulta.toLowerCase()).toContain('site de')
      expect(v.consulta.toLowerCase()).not.toMatch(/reclama\w*|dor(es)?|problema\w*|planilha\w*/)
    }
  })
})

describe('as duas defesas contra diretorio de empresa', () => {
  it('penaliza titulo que anuncia dado cadastral', () => {
    // O `findSimilar` de uma clinica devolve paginas SOBRE aquela clinica —
    // CNPJ, horario, avaliacao — em vez de outras clinicas. Medido em 06/09:
    // seis das dez expansoes eram diretorio falando da mesma empresa. E eles
    // TEM telefone, entao pontuariam bem sem esta trava.
    const diretorio = pontuarProspect({
      ...base,
      url: 'https://umdiretorioqualquer.com.br/empresa/1',
      titulo: 'Empresa Kondo Odontologia Ltda » Maua / SP » CNPJ 12342019000103',
      contato: { ...base.contato, telefone: '(11) 4513-5929' },
    })
    expect(diretorio.motivos).toContain('parece diretório de empresa, não a empresa')
    expect(diretorio.pontos).toBeLessThan(MINIMO_PARA_LEAD)
  })

  it('o piso separa VER de TRABALHAR', () => {
    // A lista de exclusao e jogo de gato e rato; o piso e a defesa estrutural.
    // Medido: diretorios pontuaram de 0 a 2, clinicas de verdade de 9 a 11.
    const real = pontuarProspect({
      ...base,
      url: 'https://clinicaviotto.com.br',
      contato: { whatsapp: '5511952687760', telefone: '(81) 3333-3333', email: 'a@b.com.br', instagram: null },
      texto: 'nossa equipe de especialistas',
    })
    expect(real.pontos).toBeGreaterThanOrEqual(MINIMO_PARA_LEAD)
  })
})

describe('o proprio buscador nao e prospect', () => {
  it('barra exa.ai', () => {
    // Apareceu como "prospect de agencia" na rodada de 06/09: o Exa indexa as
    // proprias paginas. Pontuou 0 e nao viraria lead pelo piso, mas ocupava
    // uma linha da lista.
    expect(ehDominioExcluido('https://exa.ai/search?q=marketing')).toBe(true)
  })
})

describe('propensao a PAGAR, separada de alcancabilidade', () => {
  const so = (texto: string) => pontuarProspect({ ...base, texto })

  it('equipe vale mais que qualquer outro sinal isolado', () => {
    // CRM sem time e planilha com outro nome. Quem vende sozinho anota no papel
    // e nao sente a dor — e o sinal mais forte de que ha razao para pagar.
    expect(so('conheça nossa equipe comercial').pontos).toBeGreaterThan(
      so('agende sua avaliação').pontos,
    )
    expect(so('fale com um corretor').motivos).toContain('tem equipe de vendas')
  })

  it('pedido de ORCAMENTO e o sinal forte: vira negocio com valor e prazo', () => {
    expect(so('Solicite um orçamento sem compromisso').motivos).toContain('pede orçamento no site')
    expect(so('Faça sua cotação agora').motivos).toContain('pede orçamento no site')
  })

  it('AGENDAMENTO nao e orcamento, e vale menos — defeito medido em 10 nichos', () => {
    // `clinica` liderou o sinal de captura porque todo site de clinica diz
    // "agende sua avaliacao". Agendamento e a dor de uma AGENDA, que este
    // produto nao tem e que o software vertical do setor ja resolve: a regua
    // lia "precisa de um concorrente meu" como "precisa de mim".
    const agenda = so('Agende sua avaliação gratuita')
    const orcamento = so('Solicite um orçamento sem compromisso')
    expect(agenda.motivos).toContain('agendamento no site')
    expect(agenda.motivos).not.toContain('pede orçamento no site')
    expect(orcamento.pontos).toBeGreaterThan(agenda.pontos)
  })

  it('quem JA paga outro SaaS ja atravessou a barreira da mensalidade', () => {
    // Metade da venda de um SaaS e convencer que software se paga por mes.
    // Quem ja assina Conta Azul ou Trello nao precisa dessa conversa.
    expect(so('Integramos com Conta Azul e Bling').motivos).toContain('já paga por software')
  })

  it('alcancavel NAO e o mesmo que propenso, e a nota separa os dois', () => {
    // O ponto da mudanca: um consultorio com WhatsApp e facil de contatar e
    // pode nao ter razao nenhuma para pagar; uma imobiliaria com oito corretores
    // tem a razao inteira mesmo com contato escondido.
    const facilSemRazao = pontuarProspect({
      ...base,
      contato: { whatsapp: '5511999998888', telefone: '(11) 3333-3333', email: 'a@b.com.br', instagram: 'x' },
      texto: 'Atendimento personalizado',
    })
    const dificilComRazao = pontuarProspect({
      ...base,
      contato: { whatsapp: null, telefone: null, email: null, instagram: null },
      texto: 'Fale com um de nossos corretores. Solicite uma proposta. Usamos Conta Azul. Nossas 3 unidades.',
    })
    expect(dificilComRazao.pontos).toBeGreaterThan(facilSemRazao.pontos)
  })

  it('NAO usa faturamento nem numero de funcionarios', () => {
    // Sao chute de diretorio vendido como dado. "6 de 9 clientes abandonaram"
    // nasceu de numero plausivel com origem fraca e foi repetido em quatro
    // documentos.
    const p = so('Faturamento estimado: R$ 2 milhões. 45 funcionários.')
    expect(p.motivos.join(' ')).not.toMatch(/faturamento|funcion[áa]rio/i)
  })
})

describe('o lixo que passou na PRIMEIRA gravacao real', () => {
  it('sindicato e associacao ficam de fora, por SUFIXO e nao por lista', () => {
    // Medido em 06/09: entre 243 leads escritos entraram sindeturh.org.br,
    // setpesp.org.br, gobsp.org.br e aerosp.org.br. Elas aparecem na busca
    // porque falam do setor o dia inteiro, e nao compram CRM de funil porque
    // nao vendem por orcamento.
    for (const u of [
      'https://sindeturh.org.br/',
      'https://www.setpesp.org.br/',
      'https://aerosp.org.br/contato',
      'https://www.gov.br/algo',
      'https://usp.edu.br/',
    ]) {
      expect(ehDominioExcluido(u)).toBe(true)
    }
  })

  it('sufixo e nao lista, porque sindicato novo nasce toda semana', () => {
    // Um dominio institucional que ninguem nunca viu tambem e barrado.
    expect(ehDominioExcluido('https://sindicato-inventado-2026.org.br/')).toBe(true)
  })

  it('agregador e rede social que passaram entraram na lista', () => {
    expect(ehDominioExcluido('https://misterwhat.com.br/empresa')).toBe(true)
    expect(ehDominioExcluido('https://br.pinterest.com/pin/123')).toBe(true)
  })

  it('empresa .com.br de verdade continua passando', () => {
    // O controle que separa "cortei o lixo" de "cortei tudo".
    expect(ehDominioExcluido('https://quatrocor.com.br/')).toBe(false)
    expect(ehDominioExcluido('https://www.biodoca.com.br/orcamento')).toBe(false)
  })
})
