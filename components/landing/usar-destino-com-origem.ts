'use client'

import * as React from 'react'

import { parametrosDeOrigem } from '@/lib/marketing/utm'

/**
 * Acrescenta a um destino interno os parâmetros que dizem de onde a visita veio.
 *
 * ## O vazamento que isto fecha, e por que ele tem DOIS caminhos
 *
 * O anúncio de busca do Google leva a `/quanto-custa-um-crm`, não direto ao
 * formulário: o título da página casa com o que a pessoa digitou, o Índice de
 * Qualidade sobe e o CPC cai — a única alavanca que faz R$ 25/dia caber num
 * leilão onde RD Station e Pipedrive pagam R$ 12 por clique.
 *
 * O preço é um salto a mais até o cadastro, e `ecoDaPeca` lê `utm_content` da
 * URL. Sem carregar a origem adiante, o eco cai no texto padrão e o "grátis,
 * sem cartão" some exatamente diante dos quatro campos.
 *
 * **Corrigir só o CTA do corpo da página não bastava**, e isso foi medido no
 * navegador em 04/09, não suposto: a mesma página tem DOIS botões "Começar
 * grátis" — o do texto e o da `PublicNavbar`, que aparece em toda página
 * pública. Com um só corrigido, qual promessa a pessoa veria dependia de qual
 * dos dois botões idênticos ela clicasse.
 *
 * ## Por que `window.location` num efeito, e não `useSearchParams`
 *
 * `useSearchParams` marca a rota como dinâmica. As duas páginas de conteúdo são
 * estáticas de propósito — é o que as faz responder rápido e ranquear, e elas
 * existem para ser encontradas. Trocar isso por um parâmetro de URL seria pagar
 * o objetivo da página pelo detalhe dela.
 *
 * O efeito também evita descasamento de hidratação: o primeiro render devolve o
 * mesmo destino que o servidor escreveu, e o parâmetro entra depois. Quem está
 * sem JS continua com um link que funciona, só sem o eco.
 */
export function useDestinoComOrigem(href: string): string {
  const [destino, setDestino] = React.useState(href)

  React.useEffect(() => {
    const origem = parametrosDeOrigem(window.location.search)
    setDestino(origem ? `${href}${origem}` : href)
  }, [href])

  return destino
}
