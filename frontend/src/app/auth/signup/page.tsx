// app/auth/signup/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { signup } from '@/lib/api'
import { useAuthStore } from '@/hooks/useAuthStore'

const PASSWORD_RULES = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
]

export default function SignupPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', workspace_name: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pwFocused, setPwFocused] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await signup(form.email, form.password, form.full_name)
      setAuth(data.user, data.workspace)
      // First-time user → onboarding
      router.push('/onboarding')
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const pwOk = PASSWORD_RULES.every(r => r.test(form.password))

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-8 h-8 rounded-xl bg-[#5B5EF4] flex items-center justify-center">
            <span className="text-[12px] font-bold text-white">CF</span>
          </div>
          <span className="font-semibold text-[16px] text-white tracking-tight">CallFlow AI</span>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-8">
          <h1 className="text-[20px] font-semibold text-white mb-1">Create your workspace</h1>
          <p className="text-[13px] text-white/40 mb-7">Start a 14-day free trial. No credit card required.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'full_name', label: 'Your name', placeholder: 'Jane Smith', type: 'text' },
              { key: 'email', label: 'Work email', placeholder: 'jane@company.com', type: 'email' },
              { key: 'workspace_name', label: 'Company / team name', placeholder: 'Acme Corp Sales', type: 'text' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-[12px] text-white/40 mb-1.5">{field.label}</label>
                <input
                  type={field.type}
                  required
                  value={form[field.key as keyof typeof form]}
                  onChange={set(field.key as keyof typeof form)}
                  placeholder={field.placeholder}
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#5B5EF4]/60 rounded-xl px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/20 outline-none transition-colors"
                />
              </div>
            ))}

            <div>
              <label className="block text-[12px] text-white/40 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={set('password')}
                onFocus={() => setPwFocused(true)}
                placeholder="••••••••"
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#5B5EF4]/60 rounded-xl px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/20 outline-none transition-colors"
              />
              {(pwFocused || form.password) && (
                <div className="mt-2 space-y-1">
                  {PASSWORD_RULES.map(rule => {
                    const ok = rule.test(form.password)
                    return (
                      <div key={rule.label} className="flex items-center gap-1.5">
                        <CheckCircle2
                          size={11}
                          className={ok ? 'text-green-400' : 'text-white/15'}
                        />
                        <span className={`text-[11px] ${ok ? 'text-green-400' : 'text-white/25'}`}>
                          {rule.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[13px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pwOk}
              className="w-full py-2.5 bg-[#5B5EF4] hover:bg-[#6B6EF8] disabled:opacity-40 rounded-xl text-[14px] font-semibold text-white transition-colors flex items-center justify-center gap-2 mt-1"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Create workspace
            </button>
          </form>

          <p className="text-[11px] text-white/20 text-center mt-5">
            By signing up you agree to our{' '}
            <a href="/terms" className="underline hover:text-white/40">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="underline hover:text-white/40">Privacy Policy</a>
          </p>
        </div>

        <p className="text-center text-[13px] text-white/30 mt-5">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#8B8EF8] hover:text-[#A5A7FA]">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
