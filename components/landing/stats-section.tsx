const stats = [
  { value: '+47%', label: 'taxa de conversão' },
  { value: '3.2x', label: 'leads qualificados' },
  { value: '-62%', label: 'ciclo de venda' },
  { value: '1200+', label: 'times usando' },
]

export function StatsSection() {
  return (
    <section className="border-border/50 border-y px-4 py-12 md:px-6">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
            <span className="text-3xl font-semibold tracking-tight md:text-4xl">
              {stat.value}
            </span>
            <span className="text-muted-foreground text-sm">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
