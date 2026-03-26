// components/call/SentimentBadge.tsx
interface Props {
  sentiment: string | null
}

const CONFIG: Record<string, { label: string; cls: string; emoji: string }> = {
  very_positive: { label: 'Very Positive', cls: 'text-green-400 bg-green-500/10',   emoji: '🟢' },
  positive:      { label: 'Positive',      cls: 'text-green-400 bg-green-500/10',   emoji: '🟢' },
  neutral:       { label: 'Neutral',       cls: 'text-yellow-400 bg-yellow-500/10', emoji: '🟡' },
  negative:      { label: 'Negative',      cls: 'text-red-400 bg-red-500/10',       emoji: '🔴' },
  very_negative: { label: 'Very Negative', cls: 'text-red-400 bg-red-500/10',       emoji: '🔴' },
}

export function SentimentBadge({ sentiment }: Props) {
  if (!sentiment) return null
  const cfg = CONFIG[sentiment] ?? CONFIG.neutral
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium ${cfg.cls}`}>
      <span className="text-[10px]">{cfg.emoji}</span>
      {cfg.label}
    </span>
  )
}
