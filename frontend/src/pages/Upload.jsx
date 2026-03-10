import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { Brain, Upload as UploadIcon, FileText, CheckCircle, XCircle, Loader, Trash2 } from 'lucide-react'
import axios from 'axios'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
}

export default function Upload() {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState({})

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'ready'
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: true
  })

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)

    for (const fileObj of files) {
      const formData = new FormData()
      formData.append('file', fileObj.file)

      try {
        setUploadStatus(prev => ({ ...prev, [fileObj.id]: 'uploading' }))
        await axios.post(`${import.meta.env.VITE_API_URL}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        setUploadStatus(prev => ({ ...prev, [fileObj.id]: 'success' }))
      } catch (err) {
        setUploadStatus(prev => ({ ...prev, [fileObj.id]: 'error' }))
      }
    }

    setUploading(false)

    // If all succeeded, go to chat after 1.5s
    setTimeout(() => {
      const allSuccess = files.every(f => uploadStatus[f.id] === 'success')
      if (allSuccess) navigate('/chat')
    }, 1500)
  }

  const getStatusIcon = (id) => {
    const status = uploadStatus[id]
    if (status === 'uploading') return <Loader size={18} className="animate-spin text-primary" />
    if (status === 'success') return <CheckCircle size={18} className="text-green-400" />
    if (status === 'error') return <XCircle size={18} className="text-red-400" />
    return null
  }

  const allDone = files.length > 0 && files.every(f => uploadStatus[f.id] === 'success')

  return (
    <div className="min-h-screen bg-dark text-white">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-white/10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <Brain className="text-primary" size={28} />
          <span className="text-xl font-bold tracking-tight">RAGs_AI</span>
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="px-4 py-2 text-sm bg-primary rounded-lg hover:opacity-90 transition font-medium"
        >
          Go to Chat →
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold mb-3">Upload Your Documents</h1>
          <p className="text-white/50">Supports PDF, DOCX, TXT, and CSV files. Upload multiple at once.</p>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-300
            ${isDragActive
              ? 'border-primary bg-primary/10 scale-[1.02]'
              : 'border-white/20 hover:border-primary/50 hover:bg-white/5'
            }`}
        >
          <input {...getInputProps()} />
          <UploadIcon size={48} className="mx-auto mb-4 text-primary opacity-80" />
          {isDragActive ? (
            <p className="text-primary font-semibold text-lg">Drop your files here!</p>
          ) : (
            <>
              <p className="text-white/70 text-lg font-medium">Drag & drop files here</p>
              <p className="text-white/30 text-sm mt-2">or click to browse your computer</p>
              <p className="text-white/20 text-xs mt-4">PDF · DOCX · TXT · CSV</p>
            </>
          )}
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-8 space-y-3">
            <h3 className="text-white/60 text-sm font-medium uppercase tracking-wider">Selected Files</h3>
            {files.map((fileObj) => (
              <div
                key={fileObj.id}
                className="flex items-center justify-between bg-card border border-white/10 rounded-xl px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-primary" />
                  <div>
                    <p className="text-sm font-medium">{fileObj.file.name}</p>
                    <p className="text-xs text-white/30">{(fileObj.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusIcon(fileObj.id)}
                  {!uploadStatus[fileObj.id] && (
                    <button onClick={() => removeFile(fileObj.id)}>
                      <Trash2 size={16} className="text-white/30 hover:text-red-400 transition" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Button */}
        {files.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={uploading || allDone}
            className={`mt-8 w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300
              ${allDone
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-primary hover:opacity-90 shadow-lg shadow-primary/30'
              }
              disabled:cursor-not-allowed`}
          >
            {uploading ? '⏳ Processing documents...' : allDone ? '✅ All uploaded! Redirecting to chat...' : `🚀 Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  )
}