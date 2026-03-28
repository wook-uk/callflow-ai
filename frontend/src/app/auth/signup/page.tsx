'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import React from 'react'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const s = {
    page: { minHeight: '100vh', background: '#0A0A0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    card: { width: '100%', maxWidth: '420px', padding: '40px', background: '#111113', border: '1px solid #222224', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' },
    logoBox: { width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '16px' },
    h1: { color: '#fff', fontSize: '26px', fontWeight: 700, margin: '0 0 8px 0' },
    sub: { color: '#888', fontSize: '14px', margin: '0 0 28px 0' },
    label: { display: 'block', color: '#aaa', fontSize: '13px', fontWeight: 500, marginBottom: '7px' },
    input: { width: '100%', padding: '11px 14px', background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, marginBottom: '16px' },
    btn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' },
    errBox: { background: '#2A1515', border: '1px solid #5A1515', borderRadius: '8px', padding: '11px 14px', color: '#ff6b6b', fontSize: '14px', marginBottom: '16px' },
    badge: { display: 'inline-block', background: '#1A1A2E', border: '1px solid #2A2A4E', borderRadius: '20px', padding: '4px 12px', color: '#8B8BF8', fontSize: '12px', fontWeight: 500, marginBottom: '20px' },
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/v1/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Signup failed')
      localStorage.setItem('cf_token', data.access_token)
      router.push('/onboarding')
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
          <div style={s.logoBox}>CF</div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>CallFlow AI</span>
        </div>
        <div style={s.badge}>✨ Free 14-day trial · No credit card</div>
        <h1 style={s.h1}>Create your account</h1>
        <p style={s.sub}>AI-powered insights for every sales call</p>
        {error && <div style={s.errBox}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Full name</label>
          <input style={s.input} type="text" placeholder="John Smith" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
          <label style={s.label}>Work email</label>
          <input style={s.input} type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <label style={s.label}>Password</label>
          <input style={s.input} type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={8} />
          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create free account →'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '24px', color: '#666', fontSize: '14px' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: '#5B5EF4', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}