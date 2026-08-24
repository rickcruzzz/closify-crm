/**
 * Os Stories dos destaques do Instagram, prontos para baixar e subir.
 *
 * Este arquivo é PURO de propósito — sem `server-only`, sem leitura de disco.
 * O componente da galeria é `'use client'` e precisa do tipo e do endereço de
 * download; puxar daqui um módulo marcado `server-only` quebra o build inteiro
 * com "You're importing a component that needs server-only". Mesma separação
 * que `ativacao.ts` / `ativacao-queries.ts` já usam. A leitura do arquivo mora
 * em `destaques-queries.ts`.
 *
 * ## Por que uma tela separada da galeria de criativos
 *
 * `/dono/criativos` existe para CONFERIR peça antes de virar anúncio:
 * proporção, resolução, em quais dos dez posicionamentos do Meta ela entra.
 * Os Stories de destaque já nascem certos — foram gerados na medida —, e a
 * pergunta aqui é outra: em qual destaque cada um entra e em que ordem subir.
 * Jogar 21 telas naquela grade plana enterraria as duas funções.
 *
 * ## Por que a ordem importa
 *
 * O Instagram exibe o destaque na sequência em que os Stories foram postados,
 * e não há como reordenar depois sem apagar e repostar. Subir a comparação de
 * preço antes de dizer qual é o preço quebra a leitura de quem abre.
 */

export type TelaDeDestaque = {
  ordem: number
  arquivo: string
  arquivo4k: string
  titulo: string
  layout: 'produto' | 'lista' | 'numero' | 'declaracao'
}

export type Destaque = {
  id: string
  nome: string
  resumo: string
  telas: TelaDeDestaque[]
}

/**
 * Valida o manifesto vindo do disco.
 *
 * ## Por que validar em vez de confiar
 *
 * O arquivo é escrito por `scripts/marketing/gerar-stories.py`, ou seja, por
 * fora do TypeScript: nenhum tipo daqui alcança aquele lado. Um `JSON.parse`
 * com `as Destaque[]` mentiria em silêncio no dia em que o script mudasse um
 * nome de campo, e o erro apareceria como tela em branco — que é o pior lugar
 * para descobrir. Manifesto malformado devolve lista vazia, e a tela explica
 * como regerar.
 */
export function lerManifesto(conteudo: string): Destaque[] {
  let lido: unknown
  try {
    lido = JSON.parse(conteudo)
  } catch {
    return []
  }

  if (typeof lido !== 'object' || lido === null) return []

  const { destaques } = lido as { destaques?: unknown }
  if (!Array.isArray(destaques)) return []

  return destaques.filter(ehDestaque)
}

function ehDestaque(valor: unknown): valor is Destaque {
  if (typeof valor !== 'object' || valor === null) return false

  const candidato = valor as Partial<Destaque>
  return (
    typeof candidato.id === 'string' &&
    typeof candidato.nome === 'string' &&
    typeof candidato.resumo === 'string' &&
    Array.isArray(candidato.telas) &&
    candidato.telas.every(ehTela)
  )
}

function ehTela(valor: unknown): valor is TelaDeDestaque {
  if (typeof valor !== 'object' || valor === null) return false

  const candidato = valor as Partial<TelaDeDestaque>
  return (
    typeof candidato.ordem === 'number' &&
    typeof candidato.arquivo === 'string' &&
    typeof candidato.arquivo4k === 'string' &&
    typeof candidato.titulo === 'string'
  )
}

/**
 * Endereço de download de uma tela.
 *
 * Reusa a rota que já serve as artes da galeria: ela tem o gate de ambiente e
 * a recusa de travessia de diretório já testados (`../.env.local` e variações
 * codificadas dão 404). Uma rota nova para o mesmo trabalho seria uma segunda
 * chance de errar a mesma coisa.
 */
export function enderecoDaTela(arquivo: string): string {
  return `/api/dono/criativo/organico/${encodeURIComponent(arquivo)}`
}
