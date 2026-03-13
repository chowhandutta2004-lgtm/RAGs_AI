import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Upload as UploadIcon, FileText, CheckCircle, XCircle,
  Loader, Trash2, ArrowRight, BarChart2, MessageSquare, Link, AlignLeft
} from 'lucide-react'
import { useAuth } from '../AuthContext'

const API = import.meta.env.VITE_API_URL

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/markdown': ['.md'],
}

const EXT_COLORS = {
  PDF:  'text-red-400 bg-red-500/10 border-red-500/20',
  DOCX: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  TXT:  'text-green-400 bg-green-500/10 border-green-500/20',
  CSV:  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  XLSX: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  XLS:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  PPTX: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  MD:   'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
}

const ALL_EXTS = ['PDF', 'DOCX', 'TXT', 'CSV', 'XLSX', 'PPTX', 'MD']

export default function Upload() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('files') // 'files' | 'url' | 'text'

  // ── File tab state ─────────────────────────────────────────────────────────
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState({})
  const [uploadErrors, setUploadErrors] = useState({})

  // ── URL tab state ──────────────────────────────────────────────────────────
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlResult, setUrlResult] = useState(null) // { success, message }

  // ── Paste text tab state ───────────────────────────────────────────────────
  const [textTitle, setTextTitle] = useState('')
  const [textBody, setTextBody] = useState('')
  const [textLoading, setTextLoading] = useState(false)
  const [textResult, setTextResult] = useState(null) // { success, message }

  const MAX_FILE_SIZE = 20 * 1024 * 1024

  const getToken = async () => await user.getIdToken()

  // ── Dropzone ───────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted, rejected) => {
    const newAccepted = accepted.map(file => ({ file, id: Math.random().toString(36).substr(2, 9) }))
    const newRejected = rejected.map(({ file, errors }) => {
      const id = Math.random().toString(36).substr(2, 9)
      const msg = errors[0]?.code === 'file-too-large' ? 'File exceeds 20 MB limit' : errors[0]?.message || 'Rejected'
      return { file, id, _error: msg }
    })
    setFiles(prev => [...prev, ...newAccepted, ...newRejected.map(({ _error, ...f }) => f)])
    if (newRejected.length) {
      setUploadStatus(prev => ({ ...prev, ...Object.fromEntries(newRejected.map(f => [f.id, 'error'])) }))
      setUploadErrors(prev => ({ ...prev, ...Object.fromEntries(newRejected.map(f => [f.id, f._error])) }))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED_TYPES, multiple: true, maxSize: MAX_FILE_SIZE
  })

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id))

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)
    let anySuccess = false

    const uploadOne = async (fileObj) => {
      const formData = new FormData()
      formData.append('file', fileObj.file)
      setUploadStatus(prev => ({ ...prev, [fileObj.id]: 'uploading' }))
      try {
        const token = await getToken()
        const res = await fetch(`${API}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Upload failed')
        }
        setUploadStatus(prev => ({ ...prev, [fileObj.id]: 'success' }))
        return true
      } catch (err) {
        setUploadErrors(prev => ({ ...prev, [fileObj.id]: err.message || 'Upload failed' }))
        setUploadStatus(prev => ({ ...prev, [fileObj.id]: 'error' }))
        return false
      }
    }

    const BATCH = 3
    for (let i = 0; i < files.length; i += BATCH) {
      const results = await Promise.all(files.slice(i, i + BATCH).map(uploadOne))
      if (results.some(Boolean)) anySuccess = true
    }

    setUploading(false)
    if (anySuccess) setTimeout(() => navigate('/chat'), 1500)
  }

  const allDone = files.length > 0 && files.every(f => uploadStatus[f.id] === 'success')

  // ── URL ingestion ──────────────────────────────────────────────────────────
  const handleIngestUrl = async () => {
    if (!urlInput.trim()) return
    setUrlLoading(true)
    setUrlResult(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/ingest-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: urlInput.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Ingestion failed')
      setUrlResult({ success: true, message: `${data.message} (${data.chunks} chunks, ${data.words} words)` })
      setUrlInput('')
    } catch (err) {
      setUrlResult({ success: false, message: err.message || 'Failed to ingest URL' })
    }
    setUrlLoading(false)
  }

  // ── Text ingestion ─────────────────────────────────────────────────────────
  const handleIngestText = async () => {
    if (!textTitle.trim() || !textBody.trim()) return
    setTextLoading(true)
    setTextResult(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/ingest-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: textTitle.trim(), text: textBody.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Ingestion failed')
      setTextResult({ success: true, message: `${data.message} (${data.chunks} chunks, ${data.words} words)` })
      setTextTitle('')
      setTextBody('')
    } catch (err) {
      setTextResult({ success: false, message: err.message || 'Failed to ingest text' })
    }
    setTextLoading(false)
  }

  const tabs = [
    { id: 'files', label: 'Files', icon: <UploadIcon size={13} /> },
    { id: 'url',   label: 'URL',   icon: <Link size={13} /> },
    { id: 'text',  label: 'Paste Text', icon: <AlignLeft size={13} /> },
  ]

  return (
    <div className="min-h-screen bg-void text-white relative overflow-hidden">

      {/* Background */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[140px] orb-animate pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/8 rounded-full blur-[100px] orb-animate-slow pointer-events-none" />

      {/* Navbar */}
      <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-10 py-4 glass border-b border-white/[0.06] sticky top-0 z-50"
      >
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Brain size={15} className="text-violet-400" />
          </div>
          <span className="font-bold tracking-tight">RAGs_AI</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/chat')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm glass rounded-lg text-white/50 hover:text-white transition">
            <MessageSquare size={13} /> Chat
          </button>
          <button onClick={() => navigate('/analytics')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm glass rounded-lg text-white/50 hover:text-white transition">
            <BarChart2 size={13} /> Analytics
          </button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/chat')}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold transition"
          >
            Go to Chat <ArrowRight size={13} />
          </motion.button>
        </div>
      </motion.nav>

      <div className="max-w-3xl mx-auto px-6 py-16 relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-3 gradient-text">Upload Documents</h1>
          <p className="text-white/40">PDF · DOCX · TXT · CSV · XLSX · PPTX · MD · URLs · Plain text</p>
        </motion.div>

        {/* Tab bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex gap-1 glass rounded-2xl p-1.5 mb-8"
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* ── Files tab ───────────────────────────────────────────────────── */}
        {activeTab === 'files' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div {...getRootProps()}
              className={`relative rounded-3xl p-16 text-center cursor-pointer transition-all duration-300 border-2 border-dashed overflow-hidden
                ${isDragActive ? 'border-violet-500 bg-violet-500/10 scale-[1.02]' : 'border-white/[0.1] glass hover:border-violet-500/40 hover:bg-violet-500/[0.04]'}`}
            >
              <input {...getInputProps()} />
              {isDragActive && <div className="absolute inset-0 bg-violet-500/5 rounded-3xl" />}
              <motion.div animate={isDragActive ? { scale: 1.1 } : { scale: 1 }} transition={{ duration: 0.2 }}>
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
                  <UploadIcon size={28} className="text-violet-400" />
                </div>
              </motion.div>
              {isDragActive ? (
                <p className="text-violet-400 font-semibold text-lg">Drop your files here!</p>
              ) : (
                <>
                  <p className="text-white/70 text-lg font-medium mb-2">Drag & drop your files</p>
                  <p className="text-white/30 text-sm">or click to browse</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-5">
                    {ALL_EXTS.map(ext => (
                      <span key={ext} className={`text-xs px-2.5 py-1 rounded-lg border font-mono ${EXT_COLORS[ext] || 'text-white/40 bg-white/5 border-white/10'}`}>{ext}</span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* File list */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 space-y-3">
                  <p className="text-white/30 text-xs font-mono uppercase tracking-widest">Selected Files</p>
                  {files.map((fileObj) => {
                    const ext = fileObj.file.name.split('.').pop().toUpperCase()
                    const status = uploadStatus[fileObj.id]
                    return (
                      <motion.div key={fileObj.id} layout
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between glass rounded-2xl px-5 py-3.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-md border font-mono ${EXT_COLORS[ext] || 'text-white/40 bg-white/5 border-white/10'}`}>{ext}</span>
                          <div>
                            <p className="text-sm font-medium text-white">{fileObj.file.name}</p>
                            <p className="text-xs text-white/30">{(fileObj.file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {status === 'uploading' && <Loader size={17} className="animate-spin text-violet-400" />}
                          {status === 'success'   && <CheckCircle size={17} className="text-green-400" />}
                          {status === 'error'     && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-400/70 truncate max-w-[160px]">{uploadErrors[fileObj.id]}</span>
                              <XCircle size={17} className="text-red-400 shrink-0" />
                            </div>
                          )}
                          {!status && (
                            <button onClick={() => removeFile(fileObj.id)}>
                              <Trash2 size={15} className="text-white/20 hover:text-red-400 transition" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload button */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={handleUpload}
                    disabled={uploading || allDone}
                    className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-300
                      ${allDone
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-violet-600 hover:bg-violet-500 text-white violet-glow'}
                      disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2"><Loader size={16} className="animate-spin" /> Processing documents...</span>
                    ) : allDone ? (
                      '✓ All uploaded — redirecting to chat...'
                    ) : (
                      `Upload ${files.length} file${files.length > 1 ? 's' : ''}`
                    )}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── URL tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'url' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className="glass rounded-3xl p-8"
          >
            <div className="mb-6">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                <Link size={22} className="text-violet-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">Ingest a Webpage</h2>
              <p className="text-white/30 text-sm">Paste a URL and we'll extract its text content for you to query.</p>
            </div>

            <div className="space-y-4">
              <input
                type="url"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setUrlResult(null) }}
                placeholder="https://example.com/article"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/40 transition"
                onKeyDown={e => e.key === 'Enter' && handleIngestUrl()}
              />

              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={handleIngestUrl}
                disabled={!urlInput.trim() || urlLoading}
                className="w-full py-3.5 rounded-2xl font-semibold text-base bg-violet-600 hover:bg-violet-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {urlLoading ? (
                  <span className="flex items-center justify-center gap-2"><Loader size={16} className="animate-spin" /> Fetching & indexing...</span>
                ) : 'Ingest URL'}
              </motion.button>

              <AnimatePresence>
                {urlResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl ${
                      urlResult.success
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {urlResult.success ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <XCircle size={16} className="shrink-0 mt-0.5" />}
                    <span>{urlResult.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {urlResult?.success && (
                <motion.button
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => navigate('/chat')}
                  className="w-full py-3 rounded-2xl text-sm font-semibold glass hover:border-violet-500/30 transition flex items-center justify-center gap-2 text-white/60 hover:text-white"
                >
                  Go to Chat <ArrowRight size={14} />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Paste Text tab ───────────────────────────────────────────────── */}
        {activeTab === 'text' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className="glass rounded-3xl p-8"
          >
            <div className="mb-6">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                <AlignLeft size={22} className="text-violet-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">Paste Text Directly</h2>
              <p className="text-white/30 text-sm">Give your text a title and paste the content — it'll be indexed immediately.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 font-mono uppercase tracking-widest mb-1.5">Title</label>
                <input
                  type="text"
                  value={textTitle}
                  onChange={e => { setTextTitle(e.target.value); setTextResult(null) }}
                  placeholder="e.g. Meeting Notes — Q1 2026"
                  maxLength={80}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/40 transition"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 font-mono uppercase tracking-widest mb-1.5">Content</label>
                <textarea
                  value={textBody}
                  onChange={e => { setTextBody(e.target.value); setTextResult(null) }}
                  placeholder="Paste your text here..."
                  rows={10}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/40 transition resize-none leading-relaxed"
                />
                <p className="text-right text-xs text-white/20 mt-1">{textBody.split(/\s+/).filter(Boolean).length} words</p>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={handleIngestText}
                disabled={!textTitle.trim() || !textBody.trim() || textLoading}
                className="w-full py-3.5 rounded-2xl font-semibold text-base bg-violet-600 hover:bg-violet-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {textLoading ? (
                  <span className="flex items-center justify-center gap-2"><Loader size={16} className="animate-spin" /> Indexing text...</span>
                ) : 'Ingest Text'}
              </motion.button>

              <AnimatePresence>
                {textResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl ${
                      textResult.success
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {textResult.success ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <XCircle size={16} className="shrink-0 mt-0.5" />}
                    <span>{textResult.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {textResult?.success && (
                <motion.button
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => navigate('/chat')}
                  className="w-full py-3 rounded-2xl text-sm font-semibold glass hover:border-violet-500/30 transition flex items-center justify-center gap-2 text-white/60 hover:text-white"
                >
                  Go to Chat <ArrowRight size={14} />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
