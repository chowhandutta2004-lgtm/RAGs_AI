import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Upload as UploadIcon, FileText, CheckCircle, XCircle, Loader, Trash2, ArrowRight, BarChart2, MessageSquare } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../AuthContext'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
}

const EXT_COLORS = { PDF: 'text-red-400 bg-red-500/10 border-red-500/20', DOCX: 'text-blue-400 bg-blue-500/10 border-blue-500/20', TXT: 'text-green-400 bg-green-500/10 border-green-500/20', CSV: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' }

export default function Upload() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState({})
  const [uploadErrors, setUploadErrors] = useState({})

  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPTED_TYPES, multiple: true, maxSize: MAX_FILE_SIZE })

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
        const token = await user.getIdToken()
        await axios.post(`${import.meta.env.VITE_API_URL}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
        })
        setUploadStatus(prev => ({ ...prev, [fileObj.id]: 'success' }))
        return true
      } catch (err) {
        const detail = err?.response?.data?.detail || 'Upload failed'
        setUploadErrors(prev => ({ ...prev, [fileObj.id]: detail }))
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
          <p className="text-white/40">PDF · DOCX · TXT · CSV — multiple files at once</p>
        </motion.div>

        {/* Dropzone */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.5 }}>
          <div {...getRootProps()}
            className={`relative rounded-3xl p-16 text-center cursor-pointer transition-all duration-300 border-2 border-dashed overflow-hidden
              ${isDragActive ? 'border-violet-500 bg-violet-500/10 scale-[1.02]' : 'border-white/[0.1] glass hover:border-violet-500/40 hover:bg-violet-500/[0.04]'}`}
          >
            <input {...getInputProps()} />
            {isDragActive && (
              <div className="absolute inset-0 bg-violet-500/5 rounded-3xl" />
            )}
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
                <div className="flex gap-2 justify-center mt-5">
                  {['PDF', 'DOCX', 'TXT', 'CSV'].map(ext => (
                    <span key={ext} className={`text-xs px-2.5 py-1 rounded-lg border font-mono ${EXT_COLORS[ext]}`}>{ext}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>

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
      </div>
    </div>
  )
}
