import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, FileText, Hash, BarChart2, RefreshCw, Upload, Trash2, MessageSquare } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../AuthContext'

const COLORS = ['#8B5CF6','#06B6D4','#A78BFA','#22D3EE','#7C3AED','#0EA5E9']

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

function TiltCard({ children, className }) {
  return (
    <div className={className}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width  - 0.5
        const y = (e.clientY - r.top)  / r.height - 0.5
        e.currentTarget.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.02)`
      }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
      style={{ transition: 'transform 0.15s ease' }}
    >
      {children}
    </div>
  )
}

export default function Analytics() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setStats(res.data)
    } catch {
      setError('Could not reach the backend.')
    }
    setLoading(false)
  }

  const deleteDocument = async (filename) => {
    setDeleting(filename)
    setConfirmDelete(null)
    try {
      const token = await user.getIdToken()
      await axios.delete(`${import.meta.env.VITE_API_URL}/document/${encodeURIComponent(filename)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      await fetchStats()
    } catch {
      setError('Failed to delete document.')
    }
    setDeleting(null)
  }

  const resetAll = async () => {
    setConfirmReset(false)
    try {
      const token = await user.getIdToken()
      await axios.delete(`${import.meta.env.VITE_API_URL}/reset`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      await fetchStats()
    } catch {
      setError('Failed to reset documents.')
    }
  }

  const maxKw = stats?.top_keywords?.[0]?.count || 1

  return (
    <div className="min-h-screen bg-void text-white relative overflow-hidden">

      {/* Background */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[140px] orb-animate pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-cyan-500/6 rounded-full blur-[100px] orb-animate-slow pointer-events-none" />

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
          <button onClick={() => navigate('/upload')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm glass rounded-lg text-white/40 hover:text-white transition">
            <Upload size={13} /> Upload
          </button>
          <button onClick={() => navigate('/chat')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm glass rounded-lg text-white/40 hover:text-white transition">
            <MessageSquare size={13} /> Chat
          </button>
          <button onClick={fetchStats} className="flex items-center gap-1.5 px-3 py-1.5 text-sm glass rounded-lg text-white/40 hover:text-white transition">
            <RefreshCw size={13} /> Refresh
          </button>
          {confirmReset ? (
            <div className="flex items-center gap-1.5">
              <button onClick={resetAll} className="px-3 py-1.5 text-sm rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition">Confirm Reset</button>
              <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 text-sm glass rounded-lg text-white/40 hover:text-white transition">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm glass rounded-lg text-red-400/60 hover:text-red-400 transition">
              <Trash2 size={13} /> Reset All
            </button>
          )}
        </div>
      </motion.nav>

      <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-5xl font-bold mb-2 gradient-text">Analytics</h1>
          <p className="text-white/30">Insights from your uploaded documents</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-2 h-2 bg-violet-500 rounded-full"
                  animate={{ y: [0, -10, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>
        ) : error ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-64 gap-4 text-white/30"
          >
            <BarChart2 size={40} className="opacity-40" />
            <p>{error}</p>
            <button onClick={fetchStats} className="px-4 py-2 text-sm glass rounded-lg hover:border-violet-500/30 transition">Try Again</button>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible">

            {/* Stat Cards */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              {[
                { icon: <FileText size={22} />, label: 'Documents', value: stats.total_documents, sub: 'files uploaded', color: 'violet' },
                { icon: <Hash size={22} />,     label: 'Chunks',    value: stats.total_chunks,    sub: 'indexed segments', color: 'cyan' },
                { icon: <BarChart2 size={22} />, label: 'Words',    value: stats.total_words?.toLocaleString(), sub: 'words processed', color: 'violet' },
              ].map((s, i) => (
                <TiltCard key={i} className="glass rounded-2xl p-6 cursor-default group hover:border-violet-500/20 transition-colors">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/20 transition">
                      {s.icon}
                    </div>
                    <span className="text-sm text-white/40 font-medium">{s.label}</span>
                  </div>
                  <p className="text-4xl font-bold text-white mb-1">{s.value}</p>
                  <p className="text-xs text-white/25 font-mono">{s.sub}</p>
                </TiltCard>
              ))}
            </motion.div>

            {/* Documents Table */}
            <motion.div variants={fadeUp} className="glass rounded-2xl p-6 mb-6">
              <h2 className="text-base font-semibold mb-5 text-white/60 font-mono uppercase tracking-widest text-xs">Uploaded Documents</h2>
              {stats.documents?.length === 0 ? (
                <p className="text-white/20 text-sm py-4 text-center">No documents yet.</p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {stats.documents?.map((doc, i) => (
                      <motion.div key={doc.name} layout
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between py-3.5 px-4 rounded-xl hover:bg-violet-500/[0.05] transition-colors group border border-transparent hover:border-violet-500/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                            <FileText size={14} className="text-violet-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{doc.name}</p>
                            <p className="text-xs text-white/25 font-mono">{doc.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <p className="text-sm font-semibold text-violet-400">{doc.chunks}</p>
                            <p className="text-xs text-white/25">chunks</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{doc.words?.toLocaleString()}</p>
                            <p className="text-xs text-white/25">words</p>
                          </div>
                          {deleting === doc.name ? (
                            <div className="p-2"><RefreshCw size={14} className="animate-spin text-white/30" /></div>
                          ) : confirmDelete === doc.name ? (
                            <div className="flex items-center gap-1.5 opacity-100">
                              <button onClick={() => deleteDocument(doc.name)} className="px-2 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition">Confirm</button>
                              <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs glass rounded-lg text-white/40 hover:text-white transition">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(doc.name)}
                              className="p-2 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                              title="Delete document"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

            {/* Keywords */}
            {stats.top_keywords?.length > 0 && (
              <motion.div variants={fadeUp} className="glass rounded-2xl p-6">
                <h2 className="text-xs font-semibold mb-6 text-white/40 font-mono uppercase tracking-widest">Top Keywords</h2>
                <div className="space-y-3.5">
                  {stats.top_keywords.map((kw, i) => (
                    <motion.div key={i} className="flex items-center gap-4"
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    >
                      <span className="text-sm text-white/50 w-32 shrink-0 font-mono">{kw.word}</span>
                      <div className="flex-1 bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(kw.count / maxKw) * 100}%` }}
                          transition={{ duration: 1, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                      <span className="text-sm font-mono text-white/30 w-8 text-right">{kw.count}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
