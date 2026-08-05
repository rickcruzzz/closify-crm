'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateWorkspaceName } from '@/lib/workspace/actions'

export function WorkspaceNameCard({
  initialName,
  isAdmin,
}: {
  initialName: string
  isAdmin: boolean
}) {
  const [name, setName] = React.useState(initialName)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function handleSave() {
    setIsSubmitting(true)
    try {
      const result = await updateWorkspaceName({ name })
      if (result?.error) toast.error(result.error)
      else toast.success('Workspace atualizado.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Label htmlFor="workspace-name">Nome da empresa</Label>
        <div className="flex max-w-sm gap-2">
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin || isSubmitting}
          />
          {isAdmin && (
            <Button onClick={handleSave} disabled={isSubmitting || name === initialName}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
