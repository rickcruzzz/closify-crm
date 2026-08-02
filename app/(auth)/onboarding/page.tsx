'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Building2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { onboardingSchema, type OnboardingValues } from '@/lib/validations/auth'

export default function OnboardingPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { workspaceName: '' },
  })

  function onSubmit() {
    setIsSubmitting(true)
    setTimeout(() => {
      router.push('/dashboard')
    }, 800)
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="bg-primary text-primary-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
          <Building2 className="size-5" />
        </div>
        <CardTitle className="text-xl">Crie sua empresa</CardTitle>
        <CardDescription>
          Vamos configurar seu workspace. Você poderá convidar colaboradores depois.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workspaceName">Nome da empresa</Label>
            <Input
              id="workspaceName"
              autoComplete="organization"
              placeholder="Ex: Agência Nova Era"
              aria-invalid={!!errors.workspaceName}
              disabled={isSubmitting}
              {...register('workspaceName')}
            />
            {errors.workspaceName && (
              <p className="text-destructive text-xs">{errors.workspaceName.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Continuar
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
