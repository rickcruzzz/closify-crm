import { Skeleton } from '@/components/ui/skeleton'

/**
 * O esqueleto dos alertas.
 *
 * ## Por que este arquivo é obrigatório aqui
 *
 * Medido em 20/08: esta rota leva **1,7 segundo** para responder — ela fala com
 * o banco, o Asaas e o Resend antes de renderizar. Sem um `loading.tsx`, o Next
 * segura a navegação inteira até o servidor terminar, e a tela fica **exatamente
 * igual** durante todo esse tempo. O clique parece não ter funcionado, e a
 * pessoa clica de novo.
 *
 * É a mesma queixa que este projeto já pagou nas abas de Configurações
 * ("parecia travado e a pessoa clicava de novo") e no seletor de empresa. A
 * diferença é que lá o conteúdo trocava no lugar; aqui é navegação de rota, e o
 * remédio é o esqueleto.
 *
 * O desenho espelha o real (cabeçalho, navegação, três blocos de alerta) para
 * que a troca não empurre nada de lugar quando o conteúdo chegar.
 */
export default function CarregandoAlertas() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>


      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-56" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  )
}
