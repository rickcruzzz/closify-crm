import { getUpcomingDeals } from '@/lib/dashboard/queries'
import { UpcomingDealsTable } from '@/components/dashboard/upcoming-deals-table'

/** Mesmo padrão de `metric-cards-async.tsx`: Suspense boundary própria. */
export async function UpcomingDealsTableAsync({ workspaceId }: { workspaceId: string }) {
  // `abertosSemPrazo` é o que separa "não tem negócio" de "tem negócio sem
  // prazo" — dois estados que a tela tratava como um só.
  const { deals, abertosSemPrazo } = await getUpcomingDeals(workspaceId)
  return <UpcomingDealsTable deals={deals} abertosSemPrazo={abertosSemPrazo} />
}
