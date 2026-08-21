import { getUpcomingDeals } from '@/lib/dashboard/queries'
import { UpcomingDealsTable } from '@/components/dashboard/upcoming-deals-table'

/** Mesmo padrão de `metric-cards-async.tsx`: Suspense boundary própria. */
export async function UpcomingDealsTableAsync({ workspaceId }: { workspaceId: string }) {
  const deals = await getUpcomingDeals(workspaceId)
  return <UpcomingDealsTable deals={deals} />
}
