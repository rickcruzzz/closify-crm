'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Check, Loader2, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordField } from '@/components/auth/password-field'
import { definirSenhaInicial, updateProfile } from '@/lib/supabase/actions'
import {
  definirSenhaSchema,
  perfilSchema,
  type DefinirSenhaValues,
  type PerfilValues,
} from '@/lib/validations/auth'

export function ProfileClient({
  nomeAtual,
  email,
  temSenha,
  provedores,
}: {
  nomeAtual: string
  email: string
  temSenha: boolean
  provedores: string[]
}) {
  const router = useRouter()
  const [salvandoNome, setSalvandoNome] = React.useState(false)
  const [salvandoSenha, setSalvandoSenha] = React.useState(false)

  const formNome = useForm<PerfilValues>({
    resolver: zodResolver(perfilSchema),
    defaultValues: { name: nomeAtual },
  })

  const formSenha = useForm<DefinirSenhaValues>({
    resolver: zodResolver(definirSenhaSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function salvarNome(values: PerfilValues) {
    setSalvandoNome(true)
    const r = await updateProfile(values)
    setSalvandoNome(false)
    if (r?.error) {
      toast.error(r.error)
      return
    }
    toast.success('Nome atualizado.')
    // A lista de colaboradores e a autoria das atividades leem esse nome no
    // servidor — sem refresh a tela seguiria mostrando o valor antigo.
    router.refresh()
  }

  async function salvarSenha(values: DefinirSenhaValues) {
    setSalvandoSenha(true)
    const r = await definirSenhaInicial(values)
    setSalvandoSenha(false)
    if (r?.error) {
      toast.error(r.error)
      return
    }
    toast.success(temSenha ? 'Senha alterada.' : 'Senha criada.')
    formSenha.reset({ password: '', confirmPassword: '' })
    router.refresh()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
          <CardDescription>
            Seu nome aparece para os colaboradores do workspace e nas atividades que
            você registra.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            onSubmit={formNome.handleSubmit(salvarNome)}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome de exibição</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="name"
                  className="sm:max-w-sm"
                  placeholder="Seu nome"
                  aria-invalid={!!formNome.formState.errors.name}
                  disabled={salvandoNome}
                  {...formNome.register('name')}
                />
                <Button type="submit" disabled={salvandoNome} className="sm:w-fit">
                  {salvandoNome && <Loader2 className="size-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
              {formNome.formState.errors.name && (
                <p role="alert" className="text-destructive text-xs">
                  {formNome.formState.errors.name.message}
                </p>
              )}
            </div>
          </form>

          <div className="flex flex-col gap-1.5">
            <Label>E-mail</Label>
            {/* Somente leitura: trocar o e-mail de login exige confirmação nos
                dois endereços e mexe na identidade da conta — é fluxo próprio,
                não um campo editável solto. */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <Mail aria-hidden className="size-4" />
              <span className="text-foreground">{email}</span>
              {provedores.map((p) => (
                <Badge key={p} variant="secondary" className="capitalize">
                  {p === 'email' ? 'E-mail e senha' : p}
                </Badge>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Para alterar o e-mail de acesso, fale com o suporte.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{temSenha ? 'Alterar senha' : 'Criar senha'}</CardTitle>
          <CardDescription>
            {temSenha
              ? 'Escolha uma nova senha para entrar com e-mail.'
              : 'Você entra pelo Google. Criar uma senha permite acessar também por e-mail, sem depender dessa conta.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={formSenha.handleSubmit(salvarSenha)}
            noValidate
            className="flex max-w-sm flex-col gap-4"
          >
            <Controller
              name="password"
              control={formSenha.control}
              render={({ field }) => (
                <PasswordField
                  id="password"
                  label={temSenha ? 'Nova senha' : 'Senha'}
                  valor={field.value ?? ''}
                  onChange={field.onChange}
                  onSugerir={(senha) =>
                    formSenha.setValue('confirmPassword', senha, { shouldValidate: true })
                  }
                  erro={formSenha.formState.errors.password?.message}
                  desabilitado={salvandoSenha}
                  mostrarForca
                  permitirSugestao
                />
              )}
            />

            <Controller
              name="confirmPassword"
              control={formSenha.control}
              render={({ field }) => (
                <PasswordField
                  id="confirmPassword"
                  label="Confirmar senha"
                  valor={field.value ?? ''}
                  onChange={field.onChange}
                  erro={formSenha.formState.errors.confirmPassword?.message}
                  desabilitado={salvandoSenha}
                />
              )}
            />

            <Button type="submit" disabled={salvandoSenha} className="w-fit">
              {salvandoSenha ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {temSenha ? 'Alterar senha' : 'Criar senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
