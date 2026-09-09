/**
 * Higieniza o ID do Meta Pixel antes de ele virar código executável.
 *
 * ## O incidente que motivou este arquivo (24/08/2026)
 *
 * O valor colado em `NEXT_PUBLIC_META_PIXEL_ID` na Vercel tinha uma **quebra
 * de linha no fim**. Como o ID é interpolado dentro de um script inline, o
 * que chegava ao navegador era:
 *
 *     fbq('init', '947005175128975
 *     ');
 *
 * String literal partida em duas linhas é `SyntaxError: Invalid or unexpected
 * token` — JavaScript não permite. E o erro não ficava contido: `next/script`
 * injeta com `appendChild` DURANTE o commit do React, então a exceção subia
 * pela árvore até `app/global-error.tsx`, cujo fundo é `#0a0a0a`.
 *
 * **O visitante via uma tela preta.** Sem mensagem, sem pista. Relatado por
 * alguém acessando de Aracaju, o que fez o problema parecer regional; não era
 * — atingia qualquer pessoa que **aceitasse os cookies**, porque é o aceite
 * que liga o pixel. Quem recusava ou ignorava o banner nunca via nada.
 *
 * ## Por que a correção mora no código, e não só na Vercel
 *
 * Corrigir o valor no painel resolve hoje e reabre amanhã: variável de
 * ambiente é digitada e colada por gente, e um `\n` invisível derruba o site
 * inteiro de novo. O código é o único lugar que pode garantir que isso nunca
 * mais vire tela preta.
 *
 * Por isso são duas defesas, não uma:
 *
 * 1. **Limpar** espaço, quebra de linha e aspas que costumam vir junto do
 *    copiar-e-colar.
 * 2. **Recusar** o que não for exclusivamente dígitos. O ID do Meta é
 *    numérico; qualquer outra coisa é valor errado, e um valor errado que
 *    entra num script inline é injeção de código, não configuração.
 *
 * Sem pixel, o site funciona e a campanha mede errado. Com pixel quebrado, o
 * site não abre. Entre as duas, a escolha não tem dúvida.
 */
export function pixelIdSeguro(bruto: string | undefined): string | null {
  if (!bruto) return null

  // `​` (zero-width space) entra em cópia de painel web com frequência e
  // é invisível em qualquer inspeção visual — inclusive na do próprio painel.
  const limpo = bruto.trim().replace(/["'\s​-‍﻿]/g, '')

  if (!/^\d+$/.test(limpo)) return null

  return limpo
}
