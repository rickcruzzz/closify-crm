'use client'

import {
  CHAVE_RECARGA_POR_CHUNK,
  deveRecarregar,
  ehErroDeChunk,
} from '@/lib/erros/chunk'

/**
 * Recarrega a página quando o erro é "a aba ficou velha", e só nesse caso.
 *
 * Chamada pelos três boundaries DEPOIS de `reportarErro`, e a ordem importa:
 * o relato precisa sair antes da navegação. Ele sobrevive porque o `fetch` de
 * `reportarErro` usa `keepalive`, que é exatamente a garantia de entrega
 * quando a página está indo embora.
 *
 * Devolve `true` quando disparou a recarga, para o boundary poder decidir se
 * mostra a tela de erro ou uma linha discreta enquanto a página troca.
 */
export function tentarRecuperarDeChunk(erro: unknown): boolean {
  if (typeof window === 'undefined') return false
  if (!ehErroDeChunk(erro)) return false

  // `sessionStorage` e não `localStorage`: a marca precisa morrer com a aba.
  // Guardá-la além disso faria a próxima sessão, dias depois, começar com a
  // trava armada e engolir a única recarga que resolveria.
  let ultima: number | null = null
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_RECARGA_POR_CHUNK)
    ultima = bruto === null ? null : Number(bruto)
  } catch {
    // Navegador com storage bloqueado (modo restrito, iframe de terceiro).
    // Segue com `null`: uma recarga é melhor que nenhuma, e sem storage não
    // há como haver uma tentativa anterior registrada de qualquer forma.
  }

  if (!deveRecarregar(Date.now(), ultima)) return false

  try {
    window.sessionStorage.setItem(CHAVE_RECARGA_POR_CHUNK, String(Date.now()))
  } catch {
    // Sem a marca, o pior caso é recarregar de novo na próxima ocorrência —
    // e é melhor que não recarregar nunca.
  }

  // `reload()` e não `location.href = location.href`: o segundo pode ser
  // servido do cache de memória com o MESMO mapa de chunks velho, que é
  // justamente o que se quer trocar.
  window.location.reload()
  return true
}
