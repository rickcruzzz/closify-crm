import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <ThemeToggle />
      <Badge variant="secondary">Closify CRM</Badge>
      <h1 className="text-3xl font-semibold tracking-tight">
        Simples como planilha, premium como software líder.
      </h1>
      <p className="text-muted-foreground max-w-md">
        Setup inicial do projeto concluído. As próximas milestones vão construir o design
        system, a landing page e o pipeline Kanban.
      </p>
    </div>
  )
}
