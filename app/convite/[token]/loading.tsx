import { Skeleton } from '@/components/ui/skeleton'

export default function ConviteLoading() {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-56 w-full max-w-sm" />
    </div>
  )
}
