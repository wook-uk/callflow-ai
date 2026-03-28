'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import React from 'react'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [workspace, setWorkspace] = useState('')
  const [loading, setLoading] = useState(false)

  const s = {
    page: { minHeight: '100vh', background: '#0A0A0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    card: { width: '100%', maxWidth: '480px', padding: '48px', background: '#111113', border: '1px solid #222224', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' },
    logoBox: { width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '16px' },
    h1: { color: '#fff', fontSize: '24px', fontWeight: 700, margin: '0 0 8px' },
    sub: { color: '#888', fontSize: '14px', margin: '0 0 28px' },
    input: { width: '100%', padding: '12px 14px', background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '10px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const },
    btn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '20px' },
    skip: { background: 'none', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center' as const, marginTop: '14px' },
    crmCard: { padding: '16px 18px', background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '10px', cursor: 'pointer', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '14px', transition: 'border-color 0.15s' },
    checkItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', color: '#ccc', fontSize: '14px' },
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
    } catch {} finally { setLoading(false); setStep(1) }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }}>
          <div style={s.logoBox}>CF</div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>CallFlow AI</span>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '36px' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= step ? '#5B5EF4' : '#222', transition: 'background 0.3s' }} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏢</div>
            <h1 style={s.h1}>Name your workspace</h1>
            <p style={s.sub}>This is how your team will identify your account</p>
            <input style={s.input} type="text" placeholder="e.g. Acme Corp Sales" value={workspace}
              onChange={e => setWorkspace(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && workspace.trim() && handleWorkspace()} />
            <button style={{ ...s.btn, opacity: !workspace.trim() || loading ? 0.6 : 1 }}
              onClick={handleWorkspace} disabled={!workspace.trim() || loading}>
              {loading ? 'Saving...' : 'Continue →'}
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔗</div>
            <h1 style={s.h1}>Connect your CRM</h1>
            <p style={s.sub}>Auto-sync insights after every call</p>
            {[
              { icon: '🟠', name: 'HubSpot', desc: 'Most popular for sales teams' },
              { icon: '☁️', name: 'Salesforce', desc: 'Enterprise CRM' },
              { icon: '📊', name: 'Pipedrive', desc: 'Pipeline management' },
            ].map(crm => (
              <div key={crm.name} style={s.crmCard}
                onClick={() => alert('Configure ' + crm.name + ' in Settings after setup')}>
                <span style={{ fontSize: '26px' }}>{crm.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{crm.name}</div>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>{crm.desc}</div>
                </div>
                <span style={{ color: '#5B5EF4', fontSize: '13px' }}>Connect →</span>
              </div>
            ))}
            <button style={s.btn} onClick={() => setStep(2)}>Continue →</button>
            <button style={s.skip} onClick={() => setStep(2)}>Skip for now</button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
              <h1 style={{ ...s.h1, textAlign: 'center' }}>You&apos;re all set!</h1>
              <p style={{ ...s.sub, textAlign: 'center' }}>Here&apos;s what you can do with CallFlow AI</p>
            </div>
            <div style={{ background: '#1A1A1E', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
              {['Upload any sales recording (audio/video)', 'Get full AI transcript in minutes', 'Receive deal insights & action items', 'Auto-sync notes to your CRM'].map((item, i) => (
                <div key={i} style={s.checkItem}>
                  <span style={{ color: '#5B5EF4', fontWeight: 700, fontSize: '16px' }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <button style={s.btn} onClick={() => router.push('/dashboard')}>Go to Dashboard →</button>
          </>
        )}
      </div>
    </div>
  )
}