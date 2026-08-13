'use client'

import * as React from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardContent, CardDescription, CardFooter, CardTitle } from '@/components/ui/card'
import { reenviarConfirmacao } from '@/lib/supabase/actions'

/** Espera antes de liberar o próximo reenvio, para não virar botão de martelar. */
const SEGUNDOS_DE_ESPERA = 60

export function VerifiqueEmailClient({ email }: { email: string | null }) {
  const [enviando, setEnviando] = React.useState(false)
  const [espera, setEspera] = React.useState(0)
  const [aviso, setAviso] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  async function reenviar() {
    setEnviando(true)
    setAviso(null)
    const resultado = await reenviarConfirmacao()
    setEnviando(false)

    if (resultado?.error) {
      setAviso(resultado.error)
      return
    }
    setEspera(SEGUNDOS_DE_ESPERA)
    setAviso('E-mail reenviado. Confira a caixa de entrada e o spam.')
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
          <MailCheck className="size-5" />
        </div>
        <CardTitle className="text-xl">Confirme seu e-mail</CardTitle>
        <CardDescription>
          {email ? (
            <>
              Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele para
              ativar sua conta.
            </>
          ) : (
            'Enviamos um link de confirmação para o e-mail cadastrado. Clique nele para ativar sua conta.'
          )}
        </CardDescription>
      </div>

      <CardContent className="flex flex-col gap-3 pt-6">
        <p className="text-muted-foreground text-center text-sm">
          Não chegou? Confira a caixa de spam antes de pedir outro.
        </p>

        {aviso && <p className="text-muted-foreground text-center text-sm">{aviso}</p>}

        {/* Só aparece para quem acabou de se cadastrar nesta sessão: sem o
            cookie, não há para quem reenviar, e um campo pedindo o endereço
            transformaria isto em máquina de disparar e-mail para terceiros. */}
        {email && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void reenviar()}
            disabled={enviando || espera > 0}
          >
            {enviando && <Loader2 className="size-4 animate-spin" />}
            {espera > 0 ? `Reenviar em ${espera}s` : 'Reenviar e-mail'}
          </Button>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Já tem conta?{' '}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </CardFooter>
    </>
  )
}
