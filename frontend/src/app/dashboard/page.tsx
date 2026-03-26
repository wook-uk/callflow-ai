// app/dashboard/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Clock, TrendingUp, CheckCircle, AlertCircle, Loader2, Plus } from 'lucide-react'
import { useCalls } from '@/hooks/useCalls'
import { CallCard } from '@/components/dashboard/CallCard'
import { UploadModal } from '@/components/dashboard/UploadModal'
import { StatsBar } from '@/components/dashboard/StatsBar'

export default function DashboardPage() {
  const router = useRouter()
  const [showUpload, setShowUpload] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const { calls, isLoading, mutate } = useCalls(statusFilter)

  const completedCalls = calls?.filter(c => c.status === 'completed').length ?? 0
  const pendingCalls = calls?.filter(c =>
    ['uploading', 'transcribing', 'analyzing'].includes(c.status)
  ).length ?? 0

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Top nav */}
      <nav className="border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#5B5EF4] flex items-center justify-center">
            <span className="text-[11px] font-bold">CF</span>
          </div>
          <span className="font-semibold text-[15px] tracking-tight">CallFlow AI</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#5B5EF4] hover:bg-[#6B6EF8] rounded-lg text-[13px] font-medium transition-colors"
          >
            <Plus size={14} />
            Upload Call
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Sales Calls</h1>
          <p className="text-white/40 text-[14px]">
            Upload recordings to get AI-powered insights and CRM updates
          </p>
        </div>

        {/* Stats */}
        <StatsBar
          total={calls?.length ?? 0}
          completed={completedCalls}
          pending={pendingCalls}
        />

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 mt-8">
          {[
            { label: 'All', value: null },
            { label: 'Processing', value: 'analyzing' },
            { label: 'Completed', value: 'completed' },
            { label: 'Failed', value: 'failed' },
          ].map(tab => (
            <button
              key={tab.label}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Call list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-white/30" />
          </div>
        ) : calls?.length === 0 ? (
          <EmptyState onUpload={() => setShowUpload(true)} />
        ) : (
          <div className="space-y-2">
            {calls?.map(call => (
              <CallCard
                key={call.id}
                call={call}
                onClick={() => router.push(`/dashboard/calls/${call.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            mutate()
          }}
        />
      )}
    </div>
  )
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="text-center py-20 border border-dashed border-white/[0.08] rounded-xl">
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
        <Upload size={20} className="text-white/30" />
      </div>
      <h3 className="font-medium text-white/60 mb-1">No calls yet</h3>
      <p className="text-white/30 text-[13px] mb-6">
        Upload your first sales call recording to get started
      </p>
      <button
        onClick={onUpload}
        className="px-4 py-2 bg-[#5B5EF4] hover:bg-[#6B6EF8] rounded-lg text-[13px] font-medium transition-colors"
      >
        Upload Recording
      </button>
    </div>
  )
}
