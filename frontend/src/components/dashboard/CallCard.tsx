// components/dashboard/CallCard.tsx
import { Building2, Clock, User, Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import { CallSummary } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  call: CallSummary
  onClick: () => void
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  uploading:    { label: 'Uploading',    icon: <Loader2 size={11} className="animate-spin" />, cls: 'text-blue-400 bg-blue-500/10' },
  transcribing: { label: 'Transcribing', icon: <Loader2 size={11} className="animate-spin" />, cls: 'text-purple-400 bg-purple-500/10' },
  analyzing:    { label: 'Analyzing',    icon: <Zap size={11} />,                               cls: 'text-amber-400 bg-amber-500/10' },
  crm_syncing:  { label: 'Syncing CRM',  icon: <Loader2 size={11} className="animate-spin" />, cls: 'text-teal-400 bg-teal-500/10' },
  completed:    { label: 'Completed',    icon: <CheckCircle2 size={11} />,                      cls: 'text-green-400 bg-green-500/10' },
  failed:       { label: 'Failed',       icon: <AlertCircle size={11} />,                       cls: 'text-red-400 bg-red-500/10' },
}

export function CallCard({ call, onClick }: Props) {
  const status = STATUS_CONFIG[call.status] ?? STATUS_CONFIG.failed
  const isProcessing = ['uploading', 'transcribing', 'analyzing', 'crm_syncing'].includes(call.status)

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-4 px-4 py-3.5 bg-white/[0.025] hover:bg-white/[0.045] border border-white/[0.06] rounded-xl transition-colors group"
    >
      {/* Left: icon */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        call.status === 'completed' ? 'bg-green-500/10' :
        isProcessing ? 'bg-[#5B5EF4]/10' :
        'bg-red-500/10'
      }`}>
        {isProcessing ? (
          <Loader2 size={16} className="text-[#5B5EF4] animate-spin" />
        ) : call.status === 'completed' ? (
          <CheckCircle2 size={16} className="text-green-400" />
        ) : (
          <AlertCircle size={16} className="text-red-400" />
        )}
      </div>

      {/* Middle: main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[14px] font-medium text-white/90 truncate">{call.title || 'Untitled Call'}</p>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 ${status.cls}`}>
            {status.icon}
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-white/35">
          {call.customer_company && (
            <span className="flex items-center gap-1">
              <Building2 size={10} /> {call.customer_company}
            </span>
          )}
          {call.customer_name && (
            <span className="flex items-center gap-1">
              <User size={10} /> {call.customer_name}
            </span>
          )}
          {call.duration_seconds && (
            <span className="flex items-center gap-1">
              <Clock size={10} /> {Math.round(call.duration_seconds / 60)} min
            </span>
          )}
        </div>
      </div>

      {/* Right: date */}
      <div className="text-[12px] text-white/25 shrink-0 group-hover:text-white/40 transition-colors">
        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
      </div>
    </button>
  )
}
