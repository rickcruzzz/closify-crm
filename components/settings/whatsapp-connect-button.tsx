'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plug } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { conectarWhatsapp } from '@/lib/integrations/whatsapp-actions'

// Tipagem mínima do SDK do Facebook — só o que este componente usa.
declare global {
  interface Window {
    FB?: {
      init: (opcoes: Record<string, unknown>) => void
      login: (
        callback: (resposta: { authResponse?: { code?: string } }) => void,
        opcoes: Record<string, unknown>,
      ) => void
    }
    fbAsyncInit?: () => void
  }
}

const SDK_SRC = 'https://connect.facebook.net/pt_BR/sdk.js'

function carregarSdkDoFacebook(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      resolve()
      return
    }

    window.fbAsyncInit = () => {
      window.FB!.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        autoLogAppEvents: true,
        xfbml: false,
        version: 'v21.0',
      })
      resolve()
    }

    const jaExiste = document.getElementById('facebook-jssdk')
    if (jaExiste) return

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.src = SDK_SRC
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('Falha ao carregar o SDK da Meta.'))
    document.body.appendChild(script)
  })
}

/**
 * Botão de conectar o WhatsApp, via Embedded Signup da Meta.
 *
 * Diferente do Google (redirect de página inteira), o Embedded Signup roda
 * num popup controlado pelo SDK e devolve o resultado por DOIS canais
 * independentes que precisam ser combinados aqui:
 *
 * 1. O `code` de troca de token vem no callback de `FB.login()`.
 * 2. `phone_number_id`/`waba_id` vêm de um evento `message` que a Meta posta
 *    na janela — não fazem parte do retorno de `FB.login()`.
 *
 * Só depois que os dois chegarem é que dá para chamar a Server Action:
 * o `code` sozinho não diz qual número foi escolhido no fluxo (a pessoa pode
 * ter mais de um WhatsApp Business Account), e o `phone_number_id` sozinho
 * não autentica nada.
 */
export function WhatsAppConnectButton() {
  const router = useRouter()
  const [carregando, setCarregando] = React.useState(false)

  async function conectar() {
    setCarregando(true)

    let code: string | null = null
    let sessionInfo: { phoneNumberId: string; wabaId: string } | null = null
    let finalizado = false

    function aoReceberMensagem(evento: MessageEvent) {
      // Hostname EXATO, não substring: `endsWith('facebook.com')` deixaria
      // passar `https://attacker-facebook.com`, que também termina com essa
      // string. `evento.origin` é sempre `https://<host>` sem path, então
      // comparar direto (sem `new URL`) já é seguro e mais barato.
      if (
        evento.origin !== 'https://www.facebook.com' &&
        evento.origin !== 'https://web.facebook.com' &&
        evento.origin !== 'https://facebook.com'
      ) {
        return
      }
      try {
        const dados = JSON.parse(evento.data)
        if (dados.type === 'WA_EMBEDDED_SIGNUP' && dados.event === 'FINISH') {
          sessionInfo = {
            phoneNumberId: dados.data?.phone_number_id ?? '',
            wabaId: dados.data?.waba_id ?? '',
          }
          void tentarFinalizar()
        }
      } catch {
        // Mensagem de outra origem/formato não é do Embedded Signup — ignora.
      }
    }

    async function tentarFinalizar() {
      if (finalizado || !code || !sessionInfo) return
      finalizado = true
      window.removeEventListener('message', aoReceberMensagem)

      const resultado = await conectarWhatsapp(code, sessionInfo.phoneNumberId, sessionInfo.wabaId)
      setCarregando(false)

      if ('error' in resultado) {
        toast.error(resultado.error)
        return
      }

      toast.success(`WhatsApp conectado: ${resultado.numero}`)
      router.refresh()
    }

    window.addEventListener('message', aoReceberMensagem)

    try {
      await carregarSdkDoFacebook()
    } catch (err) {
      console.error('WhatsAppConnectButton: SDK falhou', err)
      window.removeEventListener('message', aoReceberMensagem)
      setCarregando(false)
      toast.error('Não foi possível carregar o SDK da Meta. Tente novamente.')
      return
    }

    window.FB!.login(
      (resposta) => {
        if (!resposta.authResponse?.code) {
          // Popup fechado ou consentimento negado — ação da pessoa, sem toast de erro.
          window.removeEventListener('message', aoReceberMensagem)
          setCarregando(false)
          return
        }
        code = resposta.authResponse.code
        void tentarFinalizar()
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
      },
    )
  }

  return (
    <Button className="w-fit" size="sm" disabled={carregando} onClick={conectar}>
      {carregando ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
      Conectar WhatsApp
    </Button>
  )
}
