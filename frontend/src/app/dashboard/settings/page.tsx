// app/dashboard/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, ExternalLink, Save, Loader2 } from 'lucide-react'
import { getIntegrations, updateWorkspaceSettings, getWorkspace } from '@/lib/api'

const SECTIONS = ['Integrations', 'Call Detection', 'Data & Privacy']

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('Integrations')
  const [integrations, setIntegrations] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getIntegrations().then(setIntegrations)
    getWorkspace().then(ws => {
      setWorkspace(ws)
    })
  }, [])

  const isConnected = (provider: string) =>
    integrations.some(i => i.provider === provider && i.is_active)

  const getEmail = (provider: string) =>
    integrations.find(i => i.provider === provider)?.external_account_email

  const saveSettings = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await updateWorkspaceSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <nav className="border-b border-white/[0.06] px-6 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-[#5B5EF4] flex items-center justify-center">
          <span className="text-[11px] font-bold">CF</span>
        </div>
        <span className="font-semibold text-[15px]">Settings</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-44 shrink-0">
          <nav className="space-y-0.5">
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  activeSection === s
                    ? 'bg-white/[0.07] text-white font-medium'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {s}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {activeSection === 'Integrations' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-[16px] font-semibold mb-0.5">Integrations</h2>
                <p className="text-[13px] text-white/40">Connect your CRM and productivity tools</p>
              </div>

              {[
                {
                  provider: 'hubspot',
                  name: 'HubSpot',
                  desc: 'Sync notes, tasks, and deal stages automatically',
                  icon: '🟠',
                  color: 'text-[#FF9A7A] bg-[#FF7A59]/10 border-[#FF7A59]/20',
                },
                {
                  provider: 'google',
                  name: 'Google Calendar',
                  desc: 'Detect sales calls from your calendar events',
                  icon: '📅',
                  color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                },
                {
                  provider: 'pipedrive',
                  name: 'Pipedrive',
                  desc: 'Coming soon — Pipedrive CRM integration',
                  icon: '🟢',
                  color: 'text-green-400 bg-green-500/10 border-green-500/20',
                  disabled: true,
                },
              ].map(item => (
                <div
                  key={item.provider}
                  className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center text-xl">
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-medium">{item.name}</p>
                        {isConnected(item.provider) && (
                          <span className="text-[11px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded font-medium">
                            Connected
                          </span>
                        )}
                        {item.disabled && (
                          <span className="text-[11px] text-white/25 bg-white/[0.05] px-1.5 py-0.5 rounded">
                            Soon
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-white/35">
                        {isConnected(item.provider) ? getEmail(item.provider) : item.desc}
                      </p>
                    </div>
                  </div>

                  {!item.disabled && (
                    <button
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[13px] font-medium transition-colors ${
                        isConnected(item.provider)
                          ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15'
                          : item.color + ' hover:opacity-80'
                      }`}
                    >
                      {isConnected(item.provider) ? (
                        <><XCircle size={13} /> Disconnect</>
                      ) : (
                        <><ExternalLink size={13} /> Connect</>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeSection === 'Call Detection' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold mb-0.5">Call Detection</h2>
                <p className="text-[13px] text-white/40">Configure what counts as a sales call</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium mb-2">
                    Sales Framework
                    <span className="text-white/30 font-normal ml-2">Used for AI analysis</span>
                  </label>
                  <div className="flex gap-2">
                    {['BANT', 'MEDDIC'].map(fw => (
                      <button
                        key={fw}
                        className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                          fw === 'BANT'
                            ? 'bg-[#5B5EF4]/15 border-[#5B5EF4]/40 text-[#8B8EF8]'
                            : 'bg-white/[0.03] border-white/[0.08] text-white/40'
                        }`}
                      >
                        {fw}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-2">
                    Calendar keyword triggers
                    <span className="text-white/30 font-normal ml-2">Events with these words are treated as sales calls</span>
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl min-h-[52px]">
                    {['demo', 'call', 'meeting', 'discovery', 'intro', 'follow-up'].map(kw => (
                      <span
                        key={kw}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white/[0.06] text-white/60 text-[12px] rounded-lg"
                      >
                        {kw}
                        <XCircle size={11} className="text-white/25 hover:text-white/50 cursor-pointer" />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                  <div>
                    <p className="text-[14px] font-medium">Auto-sync to CRM</p>
                    <p className="text-[12px] text-white/35">Apply insights to HubSpot automatically (no review)</p>
                  </div>
                  <button className="w-11 h-6 bg-white/[0.1] rounded-full relative transition-colors">
                    <span className="absolute left-1 top-1 w-4 h-4 bg-white/40 rounded-full transition-transform" />
                  </button>
                </div>
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#5B5EF4] hover:bg-[#6B6EF8] disabled:opacity-50 rounded-lg text-[13px] font-medium transition-colors"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> :
                 saved ? <CheckCircle2 size={13} /> :
                 <Save size={13} />}
                {saved ? 'Saved' : 'Save changes'}
              </button>
            </div>
          )}

          {activeSection === 'Data & Privacy' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold mb-0.5">Data & Privacy</h2>
                <p className="text-[13px] text-white/40">Control how your call data is stored</p>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Recording retention', desc: 'Audio files are deleted after this period', value: '90 days' },
                  { label: 'Transcript retention', desc: 'Text transcripts and insights are kept for', value: '1 year' },
                  { label: 'Data region', desc: 'Your data is processed and stored in', value: 'US (us-east-1)' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                    <div>
                      <p className="text-[14px] font-medium">{item.label}</p>
                      <p className="text-[12px] text-white/35">{item.desc}</p>
                    </div>
                    <span className="text-[13px] text-white/50 bg-white/[0.05] px-2.5 py-1 rounded-lg">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-red-500/5 border border-red-500/15 rounded-xl">
                <p className="text-[13px] font-medium text-red-400 mb-1">Delete all data</p>
                <p className="text-[12px] text-white/30 mb-3">
                  Permanently delete all call recordings, transcripts, and insights. This cannot be undone.
                </p>
                <button className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[13px] text-red-400 transition-colors">
                  Request data deletion
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
