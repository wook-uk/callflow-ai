'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      localStorage.setItem('cf_token', data.access_token)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const s = {
    page: { minHeight: '100vh', background: '#0A0A0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    card: { width: '100%', maxWidth: '400px', padding: '40px', background: '#111113', border: '1px solid #222224', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' },
    logo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' },
    logoBox: { width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '16px' },
    logoText: { color: '#fff', fontWeight: 700, fontSize: '18px' },
    h1: { color: '#fff', fontSize: '28px', fontWeight: 700, margin: '0 0 8px' },
    sub: { color: '#888', fontSize: '14px', margin: '0 0 32px' },
    googleBtn: { width: '100%', padding: '12px', background: '#1A1A1E', border: '1px solid #333', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '24px' },
    divider: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' },
    dividerLine: { flex: 1, height: '1px', background: '#222' },
    dividerText: { color: '#555', fontSize: '13px' },
    label: { display: 'block', color: '#aaa', fontSize: '13px', fontWeight: 500, marginBottom: '8px' },
    input: { width: '100%', padding: '12px 14px', background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const },
    inputWrap: { position: 'relative' as const, marginBottom: '16px' },
    eyeBtn: { position: 'absolute' as const, right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '18px', padding: '4px' },
    submitBtn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' },
    error: { background: '#2A1515', border: '1px solid #5A1515', borderRadius: '8px', padding: '12px', color: '#ff6b6b', fontSize: '14px', marginBottom: '16px' },
    footer: { textAlign: 'center' as const, marginTop: '24px', color: '#666', fontSize: '14px' },
    link: { color: '#5B5EF4', textDecoration: 'none', fontWeight: 500 },
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.logoBox}>CF</div>
          <span style={s.logoText}>CallFlow AI</span>
        </div>
        <h1 style={s.h1}>Welcome back</h1>
        <p style={s.sub}>Sign in to your workspace</p>

        <button style={s.googleBtn} onClick={() => alert('Google OAuth: Add your Google Client ID in Railway Variables')}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>

        <div style={s.divider}>
          <div style={s.dividerLine}/>
          <span style={s.dividerText}>or</span>
          <div style={s.dividerLine}/>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{marginBottom: '16px'}}>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{marginBottom: '8px'}}>
            <label style={s.label}>Password</label>
            <div style={s.inputWrap}>
              <input style={{...s.input, paddingRight: '44px'}} type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" style={s.eyeBtn} onClick={() => setShowPassword(!showPassword)}>{showPassword ? '🙈' : '👁'}</button>
            </div>
          </div>
          <button style={{...s.submitBtn, opacity: loading ? 0.7 : 1}} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={s.footer}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" style={s.link}>Sign up free</Link>
        </div>
      </div>
    </div>
  )
}
