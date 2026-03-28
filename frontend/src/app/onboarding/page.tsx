'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  { id: 'workspace', title: 'Name your workspace', desc: 'This is how your team will know you' },
  { id: 'crm', title: 'Connect your CRM', desc: 'Sync insights automatically after each call' },
  { id: 'ready', title: "You're all set!", desc: 'Start uploading your sales recordings' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [workspace, setWorkspace] = useState('')
  const [loading, setLoading] = useState(false)

  const s = {
    page: { minHeight: '100vh', background: '#0A0A0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    card: { width: '100%', maxWidth: '480px', padding: '48px', background: '#111113', border: '1px solid #222224', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' },
    stepBar: { display: 'flex', gap: '8px', marginBottom: '40px' },
    stepDot: (active: boolean, done: boolean) => ({
      flex: 1, height: '4px', borderRadius: '2px',
      background: done ? '#5B5EF4' : active ? '#5B5EF4' : '#222',
      opacity: done ? 1 : active ? 1 : 0.4,
      transition: 'all 0.3s',
    }),
    h1: { color: '#fff', fontSize: '24px', fontWeight: 700, margin: '0 0 8px' },
    sub: { color: '#888', fontSize: '14px', margin: '0 0 32px' },
    label: { display: 'block', color: '#aaa', fontSize: '13px', fontWeight: 500, marginBottom: '8px' },
    input: { width: '100%', padding: '12px 14px', background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '10px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const },
    btn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '24px' },
    skipBtn: { background: 'none', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer', marginTop: '16px', display: 'block', width: '100%', textAlign: 'center' as const },
    crmOption: (selected: boolean) => ({
      padding: '16px 20px', background: selected ? '#1A1A2E' : '#1A1A1E',
      border: selected ? '1px solid #5B5EF4' : '1px solid #2A2A2E',
      borderRadius: '10px', cursor: 'pointer', marginBottom: '10px',
      display: 'flex', alignItems: 'center', gap: '14px', transition: 'all 0.15s',
    }),
    successIcon: { fontSize: '64px', textAlign: 'center' as const, marginBottom: '24px' },
  }

  const handleWorkspace = async () => {
    if (!workspace.trim()) return
    setLoading(true)
    try {
      const token = localStorage.getItem('cf_token')
      await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/v1/workspace', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ name: workspace })
      })
    } catch {}
    setLoading(false)
    setStep(1)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.stepBar}>
          {STEPS.map((_, i) => (
            <div key={i} style={s.stepDot(i === step, i < step)} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🏢</div>
            <h1 style={s.h1}>{STEPS[0].title}</h1>
            <p style={s.sub}>{STEPS[0].desc}</p>
            <label style={s.label}>Workspace name</label>
            <input style={s.input} type="text" placeholder="Acme Corp Sales" value={workspace}
              onChange={e => setWorkspace(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleWorkspace()} autoFocus />
            <button style={{ ...s.btn, opacity: loading || !workspace.trim() ? 0.6 : 1 }}
              onClick={handleWorkspace} disabled={loading || !workspace.trim()}>
              {loading ? 'Saving...' : 'Continue →'}
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔗</div>
            <h1 style={s.h1}>{STEPS[1].title}</h1>
            <p style={s.sub}>{STEPS[1].desc}</p>
            {[
              { icon: '🟠', name: 'HubSpot', desc: 'Most popular CRM for sales teams' },
              { icon: '☁️', name: 'Salesforce', desc: 'Enterprise CRM platform' },
              { icon: '📊', name: 'Pipedrive', desc: 'Sales pipeline management' },
            ].map(crm => (
              <div key={crm.name} style={s.crmOption(false)} onClick={() => alert('Configure ' + crm.name + ' in Settings → Integrations after setup')}>
                <span style={{ fontSize: '24px' }}>{crm.icon}</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{crm.name}</div>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>{crm.desc}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: '#555', fontSize: '12px' }}>Connect →</div>
              </div>
            ))}
            <button style={s.btn} onClick={() => setStep(2)}>Continue →</button>
            <button style={s.skipBtn} onClick={() => setStep(2)}>Skip for now</button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={s.successIcon}>🎉</div>
            <h1 style={{ ...s.h1, textAlign: 'center', fontSize: '26px' }}>{STEPS[2].title}</h1>
            <p style={{ ...s.sub, textAlign: 'center', marginBottom: '16px' }}>{STEPS[2].desc}</p>
            <div style={{ background: '#1A1A1E', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              {['Upload a call recording', 'Get AI-powered transcript', 'Receive sales insights', 'Auto-sync to your CRM'].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', color: '#ccc', fontSize: '14px' }}>
                  <span style={{ color: '#5B5EF4', fontWeight: 700 }}>✓</span> {item}
                </div>
              ))}
            </div>
            <button style={s.btn} onClick={() => router.push('/dashboard')}>
              Go to Dashboard →
            </button>
          </>
        )}
      </div>
    </div>
  )
}