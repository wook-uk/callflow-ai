'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const s = {
  page: { minHeight: '100vh', background: '#0A0A0B', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#fff' },
  sidebar: { position: 'fixed' as const, left: 0, top: 0, bottom: 0, width: '220px', background: '#111113', borderRight: '1px solid #1E1E20', padding: '20px 0', display: 'flex', flexDirection: 'column' as const },
  logo: { display: 'flex', alignItems: 'center', gap: '10px', padding: '0 20px 24px', borderBottom: '1px solid #1E1E20', marginBottom: '16px' },
  logoBox: { width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '14px' },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', color: '#888', fontSize: '14px', cursor: 'pointer', borderRadius: '8px', margin: '2px 8px', transition: 'all 0.15s' },
  navActive: { background: '#1A1A1E', color: '#fff' },
  main: { marginLeft: '220px', padding: '32px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  uploadBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' },
  statCard: { background: '#111113', border: '1px solid #1E1E20', borderRadius: '12px', padding: '20px' },
  statNum: { fontSize: '28px', fontWeight: 700, color: '#fff', margin: '0 0 4px' },
  statLabel: { fontSize: '13px', color: '#666' },
  section: { background: '#111113', border: '1px solid #1E1E20', borderRadius: '12px', padding: '24px' },
  sectionTitle: { fontSize: '16px', fontWeight: 600, color: '#fff', margin: '0 0 20px' },
  emptyState: { textAlign: 'center' as const, padding: '60px 20px', color: '#555' },
  uploadArea: { border: '2px dashed #2A2A2E', borderRadius: '12px', padding: '48px', textAlign: 'center' as const, cursor: 'pointer', transition: 'all 0.2s' },
}

export default function DashboardPage() {
  const router = useRouter()
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('cf_token')
    if (!token) { router.push('/auth/login'); return }
    fetch(process.env.NEXT_PUBLIC_API_URL + '/api/v1/calls', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.json()).then(d => { setCalls(d.calls || []); setLoading(false) })
    .catch(() => setLoading(false))
  }, [router])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const token = localStorage.getItem('cf_token')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''))
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/v1/calls/upload', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData
      })
      const data = await res.json()
      if (res.ok) setCalls(prev => [data, ...prev])
    } finally { setUploading(false) }
  }

  const statusColors: Record<string, string> = {
    completed: '#10B981', processing: '#F59E0B', transcribing: '#6366F1',
    failed: '#EF4444', uploading: '#8B5CF6',
  }

  return (
    <div style={s.page}>
      <div style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoBox}>CF</div>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>CallFlow AI</span>
        </div>
        <div style={{ padding: '0 8px', flex: 1 }}>
          {[
            { icon: '⚡', label: 'Calls', active: true },
            { icon: '💡', label: 'Insights', active: false },
            { icon: '🔗', label: 'Integrations', active: false },
            { icon: '⚙️', label: 'Settings', active: false },
          ].map(item => (
            <div key={item.label} style={{ ...s.navItem, ...(item.active ? s.navActive : {}) }}>
              <span>{item.icon}</span> {item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1E1E20' }}>
          <button onClick={() => { localStorage.removeItem('cf_token'); router.push('/auth/login') }}
            style={{ background: 'none', border: 'none', color: '#666', fontSize: '14px', cursor: 'pointer' }}>
            → Sign out
          </button>
        </div>
      </div>

      <div style={s.main}>
        <div style={s.header}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px' }}>Sales Calls</h1>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Upload recordings to get AI-powered insights</p>
          </div>
          <label style={{ ...s.uploadBtn, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? '⏳ Processing...' : '⬆ Upload Recording'}
            <input type="file" accept="audio/*,video/*" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        <div style={s.statsGrid}>
          {[
            { num: calls.length, label: 'Total Calls' },
            { num: calls.filter(c => c.status === 'completed').length, label: 'Analyzed' },
            { num: calls.filter(c => c.crm_synced).length, label: 'CRM Synced' },
          ].map(stat => (
            <div key={stat.label} style={s.statCard}>
              <div style={s.statNum}>{stat.num}</div>
              <div style={s.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={s.section}>
          <div style={s.sectionTitle}>Recent Calls</div>
          {loading ? (
            <div style={s.emptyState}>Loading...</div>
          ) : calls.length === 0 ? (
            <div style={s.uploadArea}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎙️</div>
              <p style={{ color: '#aaa', fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>No calls yet</p>
              <p style={{ color: '#555', fontSize: '14px', margin: 0 }}>Upload your first sales recording to get started</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E1E20' }}>
                  {['Title', 'Status', 'Duration', 'Date', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left' as const, color: '#666', fontSize: '12px', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calls.map(call => (
                  <tr key={call.id} style={{ borderBottom: '1px solid #161618', cursor: 'pointer' }}
                    onClick={() => router.push('/dashboard/calls/' + call.id)}>
                    <td style={{ padding: '14px 12px', fontSize: '14px', color: '#fff' }}>{call.title || 'Untitled'}</td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                        background: (statusColors[call.status] || '#555') + '20',
                        color: statusColors[call.status] || '#888' }}>
                        {call.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 12px', color: '#666', fontSize: '14px' }}>
                      {call.duration ? Math.round(call.duration / 60) + 'm' : '—'}
                    </td>
                    <td style={{ padding: '14px 12px', color: '#666', fontSize: '14px' }}>
                      {call.created_at ? new Date(call.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '14px 12px', color: '#5B5EF4', fontSize: '14px' }}>View →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}