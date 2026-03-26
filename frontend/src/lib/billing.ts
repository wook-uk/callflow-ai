// lib/billing.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cf_token') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function createCheckout(plan: 'starter' | 'pro') {
  const res = await fetch(`${API_BASE}/api/v1/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({
      plan,
      success_url: `${window.location.origin}/billing?success=1`,
      cancel_url: `${window.location.origin}/dashboard/billing`,
    }),
  })
  if (!res.ok) throw new Error('Checkout failed')
  return res.json()
}

export async function getBillingStatus() {
  const res = await fetch(`${API_BASE}/api/v1/billing/status`, {
    headers: authHeader(),
  })
  if (!res.ok) throw new Error('Failed to fetch billing status')
  return res.json()
}

export async function openCustomerPortal() {
  const res = await fetch(`${API_BASE}/api/v1/billing/portal`, {
    method: 'POST',
    headers: authHeader(),
  })
  if (!res.ok) throw new Error('Failed to open portal')
  const { portal_url } = await res.json()
  window.location.href = portal_url
}
