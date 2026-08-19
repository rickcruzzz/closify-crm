'use client'

import * as React from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardContent, CardFooter } from '@/components/ui/card'
import { AuthCabecalho } from '@/components/auth/auth-cabecalho'
import { AuthAlerta } from '@/components/auth/auth-alerta'
import { passo4, passo5 } from '@/components/auth/animacao'
import { reenviarConfirmacao } from '@/lib/supabase/actions'

/** Espera antes de liberar o próximo reenvio, para não virar botão de martelar. */
const SEGUNDOS_DE_ESPERA = 60

export function VerifiqueEmailClient({ email }: { email: string | null }) {
  const [enviando, setEnviando] = React.useState(false)
  const [espera, setEspera] = React.useState(0)
  const [aviso, setAviso] = React.useState<{ texto: string; erro: boolean } | null>(null)

  React.useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  async function reenviar() {
    setEnviando(true)
    setAviso(null)
    try {
      const resultado = await reenviarConfirmacao()
      if (resultado?.error) {
        setAviso({ texto: resultado.error, erro: true })
        return
      }
      setEspera(SEGUNDOS_DE_ESPERA)
      setAviso({ texto: 'E-mail reenviado. Confira a caixa de entrada e o spam.', erro: false })
    } catch {
      // Falha de rede entre o clique e a Server Action: sem este catch o
      // `finally` ainda rodaria, mas a pessoa ficaria sem explicação nenhuma.
      setAviso({
        texto: 'Não foi possível reenviar agora. Tente de novo em instantes.',
        erro: true,
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <AuthCabecalho
        variante="cartao"
        icone={<MailCheck className="size-5" />}
        titulo="Confirme seu e-mail"
        descricao={
          email ? (
            <>
              Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele
              para ativar sua conta.
            </>
          ) : (
            'Enviamos um link de confirmação para o e-mail cadastrado. Clique nele para ativar sua conta.'
          )
        }
      />

      <CardContent className={`${passo4} flex flex-col gap-3`}>
        <p className="text-muted-foreground text-center text-sm">
          Não chegou? Confira a caixa de spam antes de pedir outro.
        </p>

        {/* O aviso distingue falha de sucesso agora. Antes as duas usavam o
            mesmo parágrafo cinza, então "não foi possível reenviar" e "e-mail
            reenviado" apareciam idênticas, e quem não leu com atenção ficava
            esperando um e-mail que nunca saiu. */}
        {aviso && (
          <AuthAlerta tom={aviso.erro ? 'erro' : 'sucesso'} className="text-center">
            {aviso.texto}
          </AuthAlerta>
        )}

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

      <CardFooter className={`${passo5} justify-center`}>
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
