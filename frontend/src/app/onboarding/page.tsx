// app/onboarding/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, ArrowRight, Loader2 } from 'lucide-react'

const STEPS = [
  { id: 'welcome', title: 'Welcome to CallFlow AI' },
  { id: 'hubspot', title: 'Connect your CRM' },
  { id: 'calendar', title: 'Connect your calendar' },
  { id: 'done', title: "You're all set" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [hubspotConnected, setHubspotConnected] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-all ${
                i < step ? 'bg-[#5B5EF4]' :
                i === step ? 'bg-[#5B5EF4] scale-125' :
                'bg-white/15'
              }`} />
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px transition-colors ${i < step ? 'bg-[#5B5EF4]/50' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-8">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#5B5EF4]/15 flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🎯</span>
              </div>
              <h1 className="text-[22px] font-semibold text-white mb-3">Welcome to CallFlow AI</h1>
              <p className="text-[14px] text-white/50 leading-relaxed mb-8">
                We&apos;ll help you connect your CRM and calendar so CallFlow can automatically
                log your sales calls and update deals — saving you 1-2 hours every day.
              </p>
              <div className="space-y-3 text-left mb-8">
                {[
                  ['🎙️', 'Upload call recordings', 'MP3, MP4, M4A, WAV — up to 500MB'],
                  ['📝', 'AI-powered summaries', 'BANT/MEDDIC extraction, objections, sentiment'],
                  ['🔗', 'Auto-sync to HubSpot', 'Notes, tasks, and deal stage updates'],
                ].map(([emoji, title, desc]) => (
                  <div key={title} className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-xl">
                    <span className="text-xl shrink-0">{emoji}</span>
                    <div>
                      <p className="text-[14px] font-medium text-white/80">{title}</p>
                      <p className="text-[12px] text-white/35">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={next} className="w-full py-2.5 bg-[#5B5EF4] hover:bg-[#6B6EF8] rounded-xl text-[14px] font-semibold text-white transition-colors flex items-center justify-center gap-2">
                Get started <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Step 1: HubSpot */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#FF7A59]/15 flex items-center justify-center">
                  <span className="text-xl">🟠</span>
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-white">Connect HubSpot</h2>
                  <p className="text-[13px] text-white/40">CallFlow will create notes, tasks and update deals</p>
                </div>
              </div>

              {hubspotConnected ? (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl mb-6">
                  <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-[14px] font-medium text-green-400">HubSpot connected</p>
                    <p className="text-[12px] text-white/40">Contacts, deals, notes and tasks are ready to sync</p>
                  </div>
                </div>
              ) : (
                <HubSpotConnectButton onConnected={() => setHubspotConnected(true)} />
              )}

              <div className="mt-6 p-4 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                <p className="text-[12px] text-white/30 leading-relaxed">
                  <strong className="text-white/50">Required permissions:</strong>{' '}
                  Read and write access to contacts, companies, deals, notes, and tasks.
                  We never delete or overwrite existing data.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={next}
                  className="flex-1 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-[14px] text-white/50 transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={next}
                  disabled={!hubspotConnected}
                  className="flex-1 py-2.5 bg-[#5B5EF4] hover:bg-[#6B6EF8] disabled:opacity-40 rounded-xl text-[14px] font-semibold text-white transition-colors flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Google Calendar */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <span className="text-xl">📅</span>
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-white">Connect Google Calendar</h2>
                  <p className="text-[13px] text-white/40">Auto-detect sales calls from your calendar</p>
                </div>
              </div>

              {googleConnected ? (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl mb-6">
                  <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-[14px] font-medium text-green-400">Google Calendar connected</p>
                    <p className="text-[12px] text-white/40">We&apos;ll detect calls with &quot;demo&quot;, &quot;meeting&quot; keywords</p>
                  </div>
                </div>
              ) : (
                <GoogleCalendarButton onConnected={() => setGoogleConnected(true)} />
              )}

              <p className="text-[12px] text-white/25 mt-4 text-center">
                Read-only access. We never modify your calendar.
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={next}
                  className="flex-1 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-[14px] text-white/50 transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={next}
                  className="flex-1 py-2.5 bg-[#5B5EF4] hover:bg-[#6B6EF8] rounded-xl text-[14px] font-semibold text-white transition-colors flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={32} className="text-green-400" />
              </div>
              <h2 className="text-[22px] font-semibold text-white mb-3">You&apos;re all set!</h2>
              <p className="text-[14px] text-white/50 mb-8">
                Upload your first sales call recording to get AI-powered insights in minutes.
              </p>
              <button
                onClick={next}
                className="w-full py-2.5 bg-[#5B5EF4] hover:bg-[#6B6EF8] rounded-xl text-[14px] font-semibold text-white transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HubSpotConnectButton({ onConnected }: { onConnected: () => void }) {
  const [loading, setLoading] = useState(false)

  const connect = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/integrations/hubspot/oauth-url', {
        headers: { Authorization: `Bearer ${localStorage.getItem('cf_token')}` },
      })
      const { oauth_url } = await res.json()
      // Open in popup
      const popup = window.open(oauth_url, 'hubspot_oauth', 'width=600,height=700')
      // Listen for completion message
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'HUBSPOT_CONNECTED') {
          window.removeEventListener('message', handler)
          popup?.close()
          onConnected()
          setLoading(false)
        }
      }
      window.addEventListener('message', handler)
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={connect}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-3 bg-[#FF7A59]/10 hover:bg-[#FF7A59]/15 border border-[#FF7A59]/20 rounded-xl text-[14px] font-medium text-[#FF9A7A] transition-colors"
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
      Connect HubSpot
    </button>
  )
}

function GoogleCalendarButton({ onConnected }: { onConnected: () => void }) {
  const [loading, setLoading] = useState(false)

  const connect = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/integrations/google/oauth-url', {
        headers: { Authorization: `Bearer ${localStorage.getItem('cf_token')}` },
      })
      const { oauth_url } = await res.json()
      const popup = window.open(oauth_url, 'google_oauth', 'width=600,height=700')
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'GOOGLE_CONNECTED') {
          window.removeEventListener('message', handler)
          popup?.close()
          onConnected()
          setLoading(false)
        }
      }
      window.addEventListener('message', handler)
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={connect}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-3 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-xl text-[14px] font-medium text-blue-400 transition-colors"
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
      Connect Google Calendar
    </button>
  )
}
