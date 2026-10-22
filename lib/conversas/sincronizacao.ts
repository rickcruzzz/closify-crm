type Eventos = {
  addEventListener(tipo: string, callback: () => void): void
  removeEventListener(tipo: string, callback: () => void): void
}

/** Atualiza também envios pelo celular, sem depender de Realtime habilitado. */
export function observarConversas(
  atualizar: () => void,
  pagina: Eventos & { hidden: boolean } = document,
  janela: Eventos = window,
) {
  let encerrado = false
  let ultima = -Infinity
  const conferir = () => {
    if (encerrado || pagina.hidden || Date.now() - ultima < 500) return
    ultima = Date.now()
    atualizar()
  }
  const timer = setInterval(conferir, 5_000)
  pagina.addEventListener('visibilitychange', conferir)
  janela.addEventListener('focus', conferir)
  janela.addEventListener('online', conferir)
  return () => {
    encerrado = true
    clearInterval(timer)
    pagina.removeEventListener('visibilitychange', conferir)
    janela.removeEventListener('focus', conferir)
    janela.removeEventListener('online', conferir)
  }
}
