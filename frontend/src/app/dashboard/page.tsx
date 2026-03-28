'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import React from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('cf_token')
    if (!token) { router.push('/auth/login'); return }
    fetch(process.env.NEXT_PUBLIC_API_URL + '/api/v1/calls', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.ok ? r.json() : Promise.reject())
    .then(d => { setCalls(d.calls || []); setLoading(false) })
    .catch(() => setLoading(false))
  }, [router])

  const uploadFile = async (file: File) => {
    const token = localStorage.getItem('cf_token')
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', file.name.replace(/\.[^/.]+$/, ''))
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/v1/calls/upload', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd
      })
      if (res.ok) { const d = await res.json(); setCalls(p => [d, ...p]) }
    } finally { setUploading(false) }
  }

  const statusColor: Record<string, string> = { completed: '#10B981', transcribing: '#6366F1', analyzing: '#F59E0B', failed: '#EF4444', uploading: '#8B5CF6', pending: '#666' }
  const nav = [{ icon: '⚡', label: 'Calls', active: true }, { icon: '📊', label: 'Analytics', active: false }, { icon: '🔗', label: 'Integrations', active: false }, { icon: '⚙️', label: 'Settings', active: false }]

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0B', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#fff', display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: '220px', background: '#111113', borderRight: '1px solid #1E1E20', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #1E1E20', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>CF</div>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>CallFlow AI</span>
        </div>
        <div style={{ flex: 1, padding: '12px 8px' }}>
          {nav.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', marginBottom: '2px', background: item.active ? '#1A1A1E' : 'transparent', color: item.active ? '#fff' : '#666', fontSize: '14px', cursor: 'pointer' }}>
              <span>{item.icon}</span>{item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1E1E20' }}>
          <button onClick={() => { localStorage.removeItem('cf_token'); router.push('/auth/login') }}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
            ← Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ marginLeft: '220px', flex: 1, padding: '32px 40px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px' }}>Sales Calls</h1>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Upload recordings · Get AI insights · Sync to CRM</p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, #5B5EF4, #8B5CF6)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
            {uploading ? '⏳ Processing...' : '⬆ Upload Recording'}
            <input type="file" accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} disabled={uploading} />
          </label>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {[
            { num: calls.length, label: 'Total Calls', icon: '🎙️' },
            { num: calls.filter(c => c.status === 'completed').length, label: 'Analyzed', icon: '✅' },
            { num: calls.filter(c => c.crm_synced).length, label: 'CRM Synced', icon: '🔗' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111113', border: '1px solid #1E1E20', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '28px' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Call List */}
        <div style={{ background: '#111113', border: '1px solid #1E1E20', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1E1E20', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Recent Calls</span>
            <span style={{ color: '#555', fontSize: '13px' }}>{calls.length} total</span>
          </div>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#555' }}>Loading...</div>
          ) : calls.length === 0 ? (
            <div onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }}
              style={{ padding: '64px', textAlign: 'center', border: drag ? '2px dashed #5B5EF4' : '2px dashed transparent', margin: '16px', borderRadius: '12px', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎙️</div>
              <p style={{ color: '#fff', fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>No calls yet</p>
              <p style={{ color: '#555', fontSize: '14px', margin: '0 0 24px' }}>Upload your first recording or drag & drop here</p>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '10px', color: '#aaa', fontSize: '14px', cursor: 'pointer' }}>
                Browse files
                <input type="file" accept="audio/*,video/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
              </label>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Title', 'Status', 'Duration', 'Date', ''].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#555', fontSize: '12px', fontWeight: 500, borderBottom: '1px solid #1E1E20' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calls.map((call, i) => (
                  <tr key={call.id} style={{ borderBottom: i < calls.length - 1 ? '1px solid #161618' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => router.push('/dashboard/calls/' + call.id)}>
                    <td style={{ padding: '14px 20px', fontSize: '14px', color: '#fff', fontWeight: 500 }}>{call.title || 'Untitled Call'}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, background: (statusColor[call.status] || '#555') + '22', color: statusColor[call.status] || '#888' }}>
                        {call.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#666', fontSize: '14px' }}>{call.duration ? Math.round(call.duration / 60) + 'm' : '—'}</td>
                    <td style={{ padding: '14px 20px', color: '#666', fontSize: '14px' }}>{call.created_at ? new Date(call.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '14px 20px', color: '#5B5EF4', fontSize: '14px' }}>View →</td>
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