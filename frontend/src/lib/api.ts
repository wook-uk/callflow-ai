// lib/api.ts
// Typed API client for all backend calls

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const token = getToken()
  const url = new URL(`${API_BASE}${path}`)

  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data.detail ?? `HTTP ${res.status}`)
  }

  return res.json()
}

// ──────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────

export async function login(email: string, password: string) {
  const data = await request<{ access_token: string; user: User }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.access_token)
  return data
}

export async function signup(email: string, password: string, full_name: string) {
  const data = await request<{ access_token: string; user: User }>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name }),
  })
  setToken(data.access_token)
  return data
}

export function logout() {
  removeToken()
  window.location.href = '/auth/login'
}

// ──────────────────────────────────────────────
// CALLS
// ──────────────────────────────────────────────

export async function uploadCall(
  formData: FormData,
  onProgress?: (pct: number) => void
): Promise<CallCreateResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const token = getToken()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        const data = JSON.parse(xhr.responseText || '{}')
        reject(new ApiError(xhr.status, data.detail ?? 'Upload failed'))
      }
    })

    xhr.addEventListener('error', () => reject(new ApiError(0, 'Network error')))

    xhr.open('POST', `${API_BASE}/api/v1/calls/upload`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(formData)
  })
}

export async function listCalls(params?: { status_filter?: string; limit?: number; offset?: number }) {
  return request<CallListResponse>('/api/v1/calls', {
    params: Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
    ),
  })
}

export async function getCall(id: string) {
  return request<CallDetail>(`/api/v1/calls/${id}`)
}

export async function getCallStatus(id: string) {
  return request<{ id: string; status: string; error?: string }>(`/api/v1/calls/${id}/status`)
}

export async function applyToCRM(callId: string) {
  return request<{ message: string }>(`/api/v1/calls/${callId}/apply-to-crm`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ──────────────────────────────────────────────
// WORKSPACE
// ──────────────────────────────────────────────

export async function getWorkspace() {
  return request<Workspace>('/api/v1/workspace')
}

export async function updateWorkspaceSettings(data: Partial<WorkspaceSettings>) {
  return request<WorkspaceSettings>('/api/v1/workspace/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ──────────────────────────────────────────────
// INTEGRATIONS
// ──────────────────────────────────────────────

export async function getIntegrations() {
  return request<Integration[]>('/api/v1/integrations')
}

export async function connectHubSpot(code: string) {
  return request('/api/v1/integrations/hubspot/connect', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function connectGoogle(code: string) {
  return request('/api/v1/integrations/google/connect', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

// ──────────────────────────────────────────────
// TOKEN MANAGEMENT
// ──────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('cf_token')
}

function setToken(token: string): void {
  localStorage.setItem('cf_token', token)
}

function removeToken(): void {
  localStorage.removeItem('cf_token')
}

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

export interface Workspace {
  id: string
  name: string
  slug: string
  plan_tier: 'starter' | 'pro'
  monthly_minutes_limit: number
  monthly_minutes_used: number
}

export interface WorkspaceSettings {
  call_detection_keywords: string[]
  auto_crm_sync: boolean
  crm_provider: string | null
  sales_framework: 'BANT' | 'MEDDIC'
  followup_email_enabled: boolean
  data_retention_days: number
}

export interface Integration {
  id: string
  provider: string
  external_account_email: string | null
  is_active: boolean
  created_at: string
}

export interface CallSummary {
  id: string
  title: string
  customer_name: string | null
  customer_company: string | null
  status: string
  duration_seconds: number | null
  created_at: string
}

export interface CallInsights {
  meeting_summary: string | null
  sentiment: string | null
  sentiment_reasoning: string | null
  budget: string | null
  authority: any[] | null
  need: string[] | null
  timeline: string | null
  customer_goals: string[] | null
  competitors_mentioned: string[] | null
  objections: any[] | null
  decision_makers: any[] | null
  next_actions_internal: any[] | null
  next_actions_external: any[] | null
  email_followup_subject: string | null
  email_followup_body: string | null
  tags: string[]
}

export interface CallDetail extends CallSummary {
  transcript: {
    full_text: string
    segments: Array<{ start: number; end: number; text: string; speaker?: string }>
    word_count: number
    language: string
  } | null
  insights: CallInsights | null
  crm_sync: {
    provider: string
    contact_id: string | null
    deal_id: string | null
    is_applied: boolean
    synced_at: string | null
  } | null
}

export interface CallCreateResponse {
  id: string
  status: string
  title: string
  created_at: string
}

export interface CallListResponse {
  calls: CallSummary[]
  total: number
  offset: number
  limit: number
}
