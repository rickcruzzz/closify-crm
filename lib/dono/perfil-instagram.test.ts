import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

import {
  BIO_DO_PERFIL,
  BIO_SEM_PRECO,
  LINK_DA_BIO,
  NOME_DO_PERFIL,
  TETO_DA_BIO,
  TETO_DO_NOME,
  camposDoPerfil,
} from './perfil-instagram'

/**
 * O defeito que estes testes existem para impedir, medido em 25/08: a bio do
 * @velofunil dizia "Grátis até 300 contatos, sem cartão" — a oferta anterior à
 * migration 0051 — para 3.555 seguidores, meses depois de a landing ter sido
 * corrigida. Texto de marca fora do repositório não acompanha o produto.
 */
describe('bio do Instagram', () => {
  it('cabe no teto de 150 do Instagram', () => {
    // Passar do teto o Instagram corta em SILÊNCIO, sem avisar — e o que some
    // é o fim, que é justamente onde mora o "sem cartão 👇".
    expect(BIO_DO_PERFIL.length).toBeLessThanOrEqual(TETO_DA_BIO)
    expect(BIO_SEM_PRECO.length).toBeLessThanOrEqual(TETO_DA_BIO)
  })

  /**
   * Este teste dizia `toContain(`${DIAS_DE_TRIAL} dias`)` e **passava verde**
   * enquanto a bio prometia um trial que a migration 0057 tinha removido.
   *
   * É a lição mais cara deste arquivo: um teste escrito para travar a oferta
   * VIGENTE congela a oferta do dia em que foi escrito. Ele não sabe que o
   * produto mudou — só sabe que o texto continua igual ao que ele exigiu.
   *
   * A versão nova trava o que a landing diz HOJE, lendo a mesma constante que
   * ela lê. Se a oferta mudar de novo, o teste quebra em vez de proteger o
   * passado.
   */
  it('anuncia a oferta vigente, lida das mesmas constantes da landing', () => {
    expect(BIO_DO_PERFIL).toContain(`${FREE_LEAD_LIMIT} contatos`)
    expect(BIO_DO_PERFIL).toContain(`R$ ${PRO_PLAN_PRICE}`)
  })

  it('não vende ofertas que já foram aposentadas', () => {
    for (const texto of [BIO_DO_PERFIL, BIO_SEM_PRECO]) {
      // 300 contatos: o freemium anterior, que a bio publicada ainda mostrava
      // em 31/08. "dias com tudo liberado": o reverse trial, removido pela
      // 0057 em 29/08.
      expect(texto).not.toMatch(/300 contatos|grátis para sempre|ilimitado/i)
      expect(texto).not.toMatch(/dias com tudo liberado|trial/i)
    }
  })

  it('não ataca a planilha — o inimigo mudou por medição', () => {
    // 82% da PME brasileira vende pelo WhatsApp (Pesquisa Pulso do Sebrae,
    // 2026). Quem não tem planilha lê "sem planilha" e conclui que o produto é
    // para outra pessoa. A landing foi repositionada em 24/08; a bio ficou.
    for (const texto of [BIO_DO_PERFIL, BIO_SEM_PRECO]) {
      expect(texto).not.toMatch(/planilha/i)
    }
  })
})

describe('nome do perfil', () => {
  it('cabe no teto de 30', () => {
    expect(NOME_DO_PERFIL.length).toBeLessThanOrEqual(TETO_DO_NOME)
  })

  it('carrega o termo que a busca do Instagram indexa', () => {
    // O campo Nome e o @ são indexados; a bio não. "Velo Funil | CRM" sozinho
    // só é achado por quem já sabe o nome — que é quem menos precisa achar.
    expect(NOME_DO_PERFIL.toLowerCase()).toContain('crm')
    expect(NOME_DO_PERFIL.toLowerCase()).toContain('vendas')
  })
})

describe('link da bio', () => {
  it('usa www, para não pagar um redirecionamento', () => {
    // Medido: velofunil.com.br → www custa 980ms contra 255ms indo direto.
    expect(LINK_DA_BIO).toContain('https://www.velofunil.com.br/')
  })

  /**
   * ## As UTMs saíram do link e foram para o redirect
   *
   * Até 31/08 o link era a URL completa com os três parâmetros. Ele media
   * certo e **parecia link de rastreamento** — o que as pessoas aprenderam a
   * desconfiar, e numa bio o link é a única porta.
   *
   * Agora é `/ig`, e o `next.config.mjs` acrescenta as UTMs no redirect. A
   * captura funciona igual, porque `utm-capture.tsx` lê a URL final.
   *
   * O teste passou a travar as DUAS pontas. Só verificar o link deixaria de
   * pegar o caso pior: alguém remove o redirect, a bio continua apontando
   * para `/ig`, e a atribuição morre em silêncio — a página carrega normal,
   * nada falha, e só o painel de origem fica vazio.
   */
  it('é um atalho curto, não a URL com query string', () => {
    expect(LINK_DA_BIO).not.toContain('utm_')
    expect(LINK_DA_BIO.length).toBeLessThan(40)
  })

  it('o redirect que sustenta o atalho existe e leva os três parâmetros', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.mjs'), 'utf-8')

    // O caminho da bio precisa estar entre os atalhos declarados.
    const slug = LINK_DA_BIO.split('/').pop()
    expect(config).toContain(`paraCanal('${slug}'`)

    // E o destino precisa carregar os nomes que `utm-capture.tsx` lê. Um
    // parâmetro escrito diferente vira visita sem atribuição, e o painel de
    // custo por cliente passa a contar Instagram como tráfego direto.
    for (const p of ['utm_source=', 'utm_medium=', 'utm_campaign=']) {
      expect(config).toContain(p)
    }
  })
})

describe('camposDoPerfil', () => {
  it('nenhum campo com teto declarado passa dele', () => {
    for (const campo of camposDoPerfil()) {
      if (campo.teto) expect(campo.valor.length, campo.rotulo).toBeLessThanOrEqual(campo.teto)
    }
  })

  it('todo campo explica o porquê, para a tela não virar lista sem contexto', () => {
    for (const campo of camposDoPerfil()) {
      expect(campo.porque.length, campo.rotulo).toBeGreaterThan(30)
    }
  })
})

