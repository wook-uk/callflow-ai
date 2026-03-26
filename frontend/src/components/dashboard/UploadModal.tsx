// components/dashboard/UploadModal.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, Loader2, CheckCircle2, AlertCircle, FileAudio } from 'lucide-react'
import { uploadCall } from '@/lib/api'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

type State = 'idle' | 'uploading' | 'success' | 'error'

export function UploadModal({ onClose, onSuccess }: Props) {
  const [state, setState] = useState<State>('idle')
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [metadata, setMetadata] = useState({
    title: '',
    customer_name: '',
    customer_company: '',
  })
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    const maxSize = 500 * 1024 * 1024
    if (f.size > maxSize) {
      setError('File too large (max 500 MB)')
      return
    }
    setFile(f)
    setError('')
    // Auto-fill title from filename
    if (!metadata.title) {
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      setMetadata(m => ({ ...m, title: name }))
    }
  }, [metadata.title])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [handleFile])

  const handleSubmit = async () => {
    if (!file) return
    setState('uploading')
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', metadata.title || file.name)
      formData.append('customer_name', metadata.customer_name)
      formData.append('customer_company', metadata.customer_company)

      await uploadCall(formData, (p) => setProgress(p))
      setState('success')
      setTimeout(onSuccess, 1000)
    } catch (e: any) {
      setState('error')
      setError(e.message || 'Upload failed')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#111113] border border-white/[0.08] rounded-2xl w-full max-w-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-[15px]">Upload Call Recording</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70">
            <X size={16} />
          </button>
        </div>

        {state === 'success' ? (
          <div className="text-center py-8">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-green-400" />
            <p className="font-medium mb-1">Upload successful!</p>
            <p className="text-[13px] text-white/40">Processing will take 2-5 minutes</p>
          </div>
        ) : (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center mb-5 transition-all cursor-pointer ${
                dragOver
                  ? 'border-[#5B5EF4] bg-[#5B5EF4]/5'
                  : file
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-white/[0.1] hover:border-white/20'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="audio/*,video/mp4,video/webm"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileAudio size={20} className="text-green-400 shrink-0" />
                  <div className="text-left">
                    <p className="text-[14px] font-medium text-white/80">{file.name}</p>
                    <p className="text-[12px] text-white/40">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    className="ml-auto text-white/30 hover:text-white/60"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={24} className="mx-auto mb-2 text-white/20" />
                  <p className="text-[14px] text-white/50 mb-1">
                    Drag & drop or <span className="text-[#8B8EF8]">choose file</span>
                  </p>
                  <p className="text-[12px] text-white/25">MP3, MP4, M4A, WAV, WebM · Max 500 MB</p>
                </>
              )}
            </div>

            {/* Metadata fields */}
            <div className="space-y-3 mb-5">
              {[
                { key: 'title', label: 'Call Title', placeholder: 'e.g. Acme Corp Demo – Q2' },
                { key: 'customer_name', label: 'Contact Name', placeholder: 'e.g. Jane Smith' },
                { key: 'customer_company', label: 'Company', placeholder: 'e.g. Acme Corp' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[12px] text-white/40 mb-1.5">{field.label}</label>
                  <input
                    type="text"
                    value={metadata[field.key as keyof typeof metadata]}
                    onChange={(e) => setMetadata(m => ({ ...m, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] placeholder:text-white/20 focus:outline-none focus:border-[#5B5EF4]/50 transition-colors"
                  />
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {state === 'uploading' && (
              <div className="mb-4">
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5B5EF4] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[12px] text-white/30 mt-1.5 text-right">{progress}%</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 mb-4 text-[13px] text-red-400">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!file || state === 'uploading'}
              className="w-full py-2.5 bg-[#5B5EF4] hover:bg-[#6B6EF8] disabled:opacity-40 rounded-lg text-[14px] font-medium transition-colors flex items-center justify-center gap-2"
            >
              {state === 'uploading' ? (
                <><Loader2 size={14} className="animate-spin" /> Uploading...</>
              ) : (
                <><Upload size={14} /> Upload & Process</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
