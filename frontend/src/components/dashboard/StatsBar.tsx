// components/dashboard/StatsBar.tsx
interface Props {
  total: number
  completed: number
  pending: number
}

export function StatsBar({ total, completed, pending }: Props) {
  const stats = [
    { label: 'Total calls', value: total },
    { label: 'Completed',   value: completed, highlight: true },
    { label: 'Processing',  value: pending },
    { label: 'Hours saved', value: `~${(completed * 1.5).toFixed(0)}h`, sub: true },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map(s => (
        <div
          key={s.label}
          className={`rounded-xl p-4 ${
            s.highlight
              ? 'bg-[#5B5EF4]/10 border border-[#5B5EF4]/20'
              : 'bg-white/[0.03] border border-white/[0.06]'
          }`}
        >
          <p className="text-[12px] text-white/40 mb-1">{s.label}</p>
          <p className={`text-[24px] font-semibold tracking-tight ${s.highlight ? 'text-[#8B8EF8]' : 'text-white'}`}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  )
}
