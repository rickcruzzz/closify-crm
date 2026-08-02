import { dealStageLabels, dealStages, type Deal, type DealStage } from '@/lib/deals/types'
import type { Lead } from '@/lib/leads/types'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function DealDetailSheet({
  deal,
  lead,
  open,
  onOpenChange,
  onStageChange,
}: {
  deal: Deal | undefined
  lead: Lead | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onStageChange: (dealId: string, stage: DealStage) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {deal && (
          <>
            <SheetHeader>
              <SheetTitle>{deal.title}</SheetTitle>
              {lead && <SheetDescription>{lead.company}</SheetDescription>}
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4">
              <div>
                <span className="text-muted-foreground text-xs">Valor do negócio</span>
                <p className="text-xl font-semibold">{formatBRL(deal.value)}</p>
              </div>

              <Separator />

              <div>
                <span className="text-muted-foreground text-xs">Etapa</span>
                <Select
                  value={deal.stage}
                  onValueChange={(value) => onStageChange(deal.id, value as DealStage)}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue>
                      {(value) => dealStageLabels[value as DealStage]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {dealStages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {dealStageLabels[stage]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {lead && (
                <div>
                  <span className="text-muted-foreground text-xs">Lead vinculado</span>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-muted-foreground text-xs">{lead.email}</p>
                  <p className="text-muted-foreground text-xs">{lead.phone}</p>
                </div>
              )}

              <div>
                <span className="text-muted-foreground text-xs">Responsável</span>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(deal.owner)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{deal.owner}</span>
                </div>
              </div>

              <div className="flex justify-between">
                <div>
                  <span className="text-muted-foreground text-xs">Prazo</span>
                  <p className="text-sm">{formatDate(deal.dueDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Criado em</span>
                  <p className="text-sm">{formatDate(deal.createdAt)}</p>
                </div>
              </div>
            </div>

            <SheetFooter>
              <SheetClose render={<Button variant="outline" />}>Fechar</SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
