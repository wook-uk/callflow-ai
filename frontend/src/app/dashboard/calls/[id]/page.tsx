// app/dashboard/calls/[id]/page.tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Copy, Send, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, AlertTriangle, Clock,
  Building2, User, DollarSign, Target, Zap,
  RefreshCw, ExternalLink
} from 'lucide-react'
import { useCall } from '@/hooks/useCall'
import { applyToCRM } from '@/lib/api'
import { SentimentBadge } from '@/components/call/SentimentBadge'
import { TagList } from '@/components/call/TagList'

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { call, isLoading, mutate } = useCall(id)
  const [applyingCRM, setApplyingCRM] = useState(false)
  const [crmApplied, setCRMApplied] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-white/30" />
      </div>
    )
  }

  if (!call) return null

  const insights = call.insights
  const isProcessing = ['uploading', 'transcribing', 'analyzing'].includes(call.status)

  const handleApplyCRM = async () => {
    setApplyingCRM(true)
    try {
      await applyToCRM(id)
      setCRMApplied(true)
      setTimeout(() => mutate(), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setApplyingCRM(false)
    }
  }

  const handleCopyEmail = () => {
    if (insights?.email_followup_body) {
      navigator.clipboard.writeText(
        `Subject: ${insights.email_followup_subject}\n\n${insights.email_followup_body}`
      )
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/40 hover:text-white text-[13px] transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="flex items-center gap-2">
          {insights && !crmApplied && (
            <button
              onClick={handleApplyCRM}
              disabled={applyingCRM}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#5B5EF4] hover:bg-[#6B6EF8] disabled:opacity-50 rounded-lg text-[13px] font-medium transition-colors"
            >
              {applyingCRM ? (
                <><Loader2 size={13} className="animate-spin" /> Syncing...</>
              ) : (
                <><ExternalLink size={13} /> Apply to HubSpot</>
              )}
            </button>
          )}
          {crmApplied && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-[13px]">
              <CheckCircle2 size={13} />
              Synced to HubSpot
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight mb-1">{call.title}</h1>
              <div className="flex items-center gap-3 text-[13px] text-white/40">
                {call.customer_company && (
                  <span className="flex items-center gap-1">
                    <Building2 size={12} /> {call.customer_company}
                  </span>
                )}
                {call.customer_name && (
                  <span className="flex items-center gap-1">
                    <User size={12} /> {call.customer_name}
                  </span>
                )}
                {call.duration_seconds && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {Math.round(call.duration_seconds / 60)} min
                  </span>
                )}
              </div>
            </div>
            {insights && <SentimentBadge sentiment={insights.sentiment} />}
          </div>
        </div>

        {/* Processing state */}
        {isProcessing && <ProcessingCard status={call.status} onRefresh={mutate} />}

        {/* Insights */}
        {insights && (
          <div className="space-y-4">
            {/* Summary */}
            <Section title="Meeting Summary">
              <p className="text-[14px] text-white/70 leading-relaxed">{insights.meeting_summary}</p>
              {insights.tags?.length > 0 && <TagList tags={insights.tags} className="mt-3" />}
            </Section>

            {/* BANT grid */}
            <div className="grid grid-cols-2 gap-3">
              <BANTCard icon={<DollarSign size={14} />} label="Budget" value={insights.budget} />
              <BANTCard icon={<Clock size={14} />} label="Timeline" value={insights.timeline} />
              <BANTCard
                icon={<Target size={14} />}
                label="Need"
                value={insights.need?.slice(0, 2).join(' · ')}
              />
              <BANTCard
                icon={<User size={14} />}
                label="Authority"
                value={insights.authority?.map((a: any) => a.name).join(', ')}
              />
            </div>

            {/* Two-column: objections + competitors */}
            <div className="grid grid-cols-2 gap-3">
              <Section title={`Objections (${insights.objections?.length ?? 0})`} compact>
                {insights.objections?.length > 0 ? (
                  <ul className="space-y-2">
                    {insights.objections.map((obj: any, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[11px] rounded font-medium">
                          {obj.category}
                        </span>
                        <span className="text-[13px] text-white/60">{obj.description}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-white/30">No objections detected</p>
                )}
              </Section>

              <Section title="Competitors Mentioned" compact>
                {insights.competitors_mentioned?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {insights.competitors_mentioned.map((c: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-orange-500/10 text-orange-400 text-[12px] rounded-md">
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-white/30">None mentioned</p>
                )}
              </Section>
            </div>

            {/* Next actions */}
            <div className="grid grid-cols-2 gap-3">
              <Section title="Internal Actions" compact>
                <ActionList items={insights.next_actions_internal} color="blue" />
              </Section>
              <Section title="External Follow-ups" compact>
                <ActionList items={insights.next_actions_external} color="purple" />
              </Section>
            </div>

            {/* Follow-up email */}
            {insights.email_followup_body && (
              <Section title="Follow-up Email Draft">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] text-white/40">
                    Subject: <span className="text-white/70">{insights.email_followup_subject}</span>
                  </p>
                  <button
                    onClick={handleCopyEmail}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.08] rounded-md text-[12px] text-white/50 hover:text-white/80 transition-colors"
                  >
                    {emailCopied ? <><CheckCircle2 size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
                <pre className="text-[13px] text-white/60 whitespace-pre-wrap font-sans leading-relaxed bg-white/[0.02] rounded-lg p-4">
                  {insights.email_followup_body}
                </pre>
              </Section>
            )}

            {/* Transcript */}
            {call.transcript && (
              <Section
                title="Transcript"
                action={
                  <button
                    onClick={() => setTranscriptExpanded(e => !e)}
                    className="flex items-center gap-1 text-[12px] text-white/40 hover:text-white/70"
                  >
                    {transcriptExpanded ? <><ChevronUp size={12} /> Collapse</> : <><ChevronDown size={12} /> Expand</>}
                  </button>
                }
              >
                {transcriptExpanded ? (
                  <div className="text-[13px] text-white/60 leading-relaxed max-h-[500px] overflow-y-auto space-y-2">
                    {call.transcript.segments?.length > 0 ? (
                      call.transcript.segments.map((seg: any, i: number) => (
                        <div key={i} className="flex gap-3">
                          <span className="text-white/20 shrink-0 w-12 text-right text-[11px] mt-0.5">
                            {formatTime(seg.start)}
                          </span>
                          <p>{seg.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-white/60">{call.transcript.full_text}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-white/40">
                    {call.transcript.word_count?.toLocaleString()} words · Click to expand
                  </p>
                )}
              </Section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ──────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────

function Section({ title, children, compact, action }: any) {
  return (
    <div className={`bg-white/[0.03] border border-white/[0.06] rounded-xl ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-medium text-white/50 uppercase tracking-wider">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function BANTCard({ icon, label, value }: any) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2 text-white/30">
        {icon}
        <span className="text-[12px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[14px] text-white/70">
        {value || <span className="text-white/20 italic">Unknown</span>}
      </p>
    </div>
  )
}

function ActionList({ items, color }: { items: any[]; color: string }) {
  if (!items?.length) return <p className="text-[13px] text-white/30">No actions</p>
  const cls = color === 'blue'
    ? 'bg-blue-500/10 text-blue-400'
    : 'bg-purple-500/10 text-purple-400'

  return (
    <ul className="space-y-1.5">
      {items.slice(0, 5).map((item: any, i: number) => (
        <li key={i} className="flex items-start gap-2">
          <span className={`mt-0.5 shrink-0 text-[11px] px-1.5 py-0.5 rounded font-medium ${cls}`}>
            {item.due_days ?? '—'}d
          </span>
          <span className="text-[13px] text-white/60">{item.action}</span>
        </li>
      ))}
    </ul>
  )
}

function ProcessingCard({ status, onRefresh }: { status: string; onRefresh: () => void }) {
  const steps = ['uploading', 'transcribing', 'analyzing', 'crm_syncing']
  const currentIdx = steps.indexOf(status)

  const labels: Record<string, string> = {
    uploading: 'Uploading audio...',
    transcribing: 'Transcribing with Whisper...',
    analyzing: 'Analyzing with GPT-4o...',
    crm_syncing: 'Syncing to CRM...',
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-[#5B5EF4]" />
          <span className="text-[14px] font-medium">{labels[status] || 'Processing...'}</span>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/60"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div className="flex gap-2">
        {steps.map((step, i) => (
          <div
            key={step}
            className={`flex-1 h-1 rounded-full transition-colors ${
              i < currentIdx ? 'bg-[#5B5EF4]' :
              i === currentIdx ? 'bg-[#5B5EF4]/50 animate-pulse' :
              'bg-white/[0.06]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
