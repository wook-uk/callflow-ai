// components/call/TagList.tsx
interface Props {
  tags: string[]
  className?: string
}

const TAG_COLORS: Record<string, string> = {
  pricing:     'bg-amber-500/10 text-amber-400',
  competitor:  'bg-orange-500/10 text-orange-400',
  technical:   'bg-blue-500/10 text-blue-400',
  executive:   'bg-purple-500/10 text-purple-400',
  champion:    'bg-green-500/10 text-green-400',
  at_risk:     'bg-red-500/10 text-red-400',
  onboarding:  'bg-teal-500/10 text-teal-400',
  objection:   'bg-red-500/10 text-red-400',
}

const DEFAULT_COLOR = 'bg-white/[0.06] text-white/50'

export function TagList({ tags, className = '' }: Props) {
  if (!tags?.length) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map(tag => (
        <span
          key={tag}
          className={`px-2 py-0.5 rounded text-[11px] font-medium ${TAG_COLORS[tag] ?? DEFAULT_COLOR}`}
        >
          {tag.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  )
}
