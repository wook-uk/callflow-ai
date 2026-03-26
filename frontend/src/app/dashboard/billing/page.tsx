// app/dashboard/billing/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Zap } from 'lucide-react'
import { createCheckout, getBillingStatus } from '@/lib/billing'

const PLANS = [
  {
    id: 'starter',
    name: 'Team Starter',
    price: 199,
    period: 'month',
    desc: 'For small sales teams just getting started',
    features: [
      '100 hours of call processing / month',
      'HubSpot + Pipedrive sync',
      'AI summaries (BANT framework)',
      'Follow-up email drafts',
      'Up to 10 team members',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Team Pro',
    price: 499,
    period: 'month',
    desc: 'For scaling sales teams with advanced needs',
    popular: true,
    features: [
      '400 hours of call processing / month',
      'Everything in Starter',
      'MEDDIC framework support',
      'Sentiment analysis reports',
      'Competitor mention tracking',
      'Priority support + Slack',
      'SSO (coming soon)',
    ],
  },
]

export default function BillingPage() {
  const [status, setStatus] = useState<any>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  useEffect(() => {
    getBillingStatus().then(setStatus).catch(() => {})
  }, [])

  const handleCheckout = async (planId: string) => {
    setCheckingOut(planId)
    try {
      const { checkout_url } = await createCheckout(planId)
      window.location.href = checkout_url
    } catch (e) {
      console.error(e)
    } finally {
      setCheckingOut(null)
    }
  }

  const usagePct = status?.usage_pct ?? 0

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <nav className="border-b border-white/[0.06] px-6 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-[#5B5EF4] flex items-center justify-center">
          <span className="text-[11px] font-bold">CF</span>
        </div>
        <span className="font-semibold text-[15px]">Billing & Plans</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Current usage */}
        {status && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] text-white/40 mb-0.5">Current plan</p>
                <p className="text-[16px] font-semibold capitalize">{status.plan}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] text-white/40 mb-0.5">Monthly usage</p>
                <p className="text-[16px] font-semibold">
                  {Math.round(status.monthly_minutes_used / 60)}h
                  <span className="text-white/30 font-normal text-[14px]">
                    {' '}/ {Math.round(status.monthly_minutes_limit / 60)}h
                  </span>
                </p>
              </div>
            </div>
            <div className="h-2 bg-white/[0.07] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePct > 80 ? 'bg-red-400' : usagePct > 60 ? 'bg-amber-400' : 'bg-[#5B5EF4]'
                }`}
                style={{ width: `${Math.min(usagePct, 100)}%` }}
              />
            </div>
            <p className="text-[12px] text-white/25 mt-1.5">{usagePct.toFixed(1)}% used this month</p>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-2 gap-5 mb-10">
          {PLANS.map(plan => {
            const isCurrent = status?.plan === plan.id
            return (
              <div
                key={plan.id}
                className={`relative bg-white/[0.03] border rounded-2xl p-6 flex flex-col ${
                  plan.popular
                    ? 'border-[#5B5EF4]/50 shadow-[0_0_40px_rgba(91,94,244,0.1)]'
                    : 'border-white/[0.07]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 px-3 py-1 bg-[#5B5EF4] rounded-full text-[11px] font-semibold">
                      <Zap size={10} /> Most popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-[16px] font-semibold mb-1">{plan.name}</h3>
                  <p className="text-[12px] text-white/35 mb-4">{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[32px] font-bold">${plan.price}</span>
                    <span className="text-white/35 text-[14px]">/ {plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#5B5EF4] shrink-0 mt-0.5" />
                      <span className="text-[13px] text-white/60">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !isCurrent && handleCheckout(plan.id)}
                  disabled={isCurrent || checkingOut === plan.id}
                  className={`w-full py-2.5 rounded-xl text-[14px] font-semibold transition-colors flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-white/[0.05] text-white/30 cursor-default'
                      : plan.popular
                      ? 'bg-[#5B5EF4] hover:bg-[#6B6EF8] text-white'
                      : 'bg-white/[0.08] hover:bg-white/[0.12] text-white'
                  }`}
                >
                  {checkingOut === plan.id ? (
                    <><Loader2 size={14} className="animate-spin" /> Processing...</>
                  ) : isCurrent ? (
                    'Current plan'
                  ) : (
                    'Get started'
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Manage subscription */}
        {status?.subscription_status && (
          <div className="text-center">
            <button
              onClick={async () => {
                const { portal_url } = await fetch('/api/v1/billing/portal', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${localStorage.getItem('cf_token')}` },
                }).then(r => r.json())
                window.location.href = portal_url
              }}
              className="inline-flex items-center gap-2 text-[13px] text-white/40 hover:text-white/70 transition-colors"
            >
              <ExternalLink size={13} />
              Manage subscription, invoices & payment method
            </button>
          </div>
        )}

        {/* Promo */}
        <div className="mt-8 p-5 bg-[#5B5EF4]/8 border border-[#5B5EF4]/20 rounded-xl text-center">
          <p className="text-[14px] font-medium mb-1">🎉 Beta launch offer</p>
          <p className="text-[13px] text-white/50">
            First 10 teams get <strong className="text-white/80">50% off forever</strong>.
            Use code <code className="bg-white/[0.07] px-1.5 py-0.5 rounded text-[#8B8EF8]">BETA50</code> at checkout.
          </p>
        </div>
      </main>
    </div>
  )
}
