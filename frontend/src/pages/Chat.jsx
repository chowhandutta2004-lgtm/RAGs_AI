import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Send, Mic, MicOff, FileText, BarChart2, Download, Trash2,
  Loader, LogOut, Plus, MessageSquare, ChevronLeft, ChevronRight,
  Copy, Check, X
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../AuthContext'
import { auth, logOut } from '../firebase'

const API = import.meta.env.VITE_API_URL

export default function Chat() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // ── Session state ──────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // ── Message state ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [docCount, setDocCount] = useState(null)
  const [availableDocs, setAvailableDocs] = useState([])

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false)
  const [voiceNotSupported, setVoiceNotSupported] = useState(false)
  const [atMention, setAtMention] = useState(null) // { query, filteredDocs }
  const [rateLimitMsg, setRateLimitMsg] = useState(null)
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0)
  const [copiedIdx, setCopiedIdx] = useState(null)

  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const abortRef = useRef(null)
  const countdownRef = useRef(null)
  const inputRef = useRef(null)

  const WELCOME = {
    role: 'assistant',
    content: "Hey! I'm RAGs_AI. Upload your documents and ask me anything — I'll find the answers with sources.",
    sources: [],
    confidence: null
  }

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  // ── Voice recognition setup ────────────────────────────────────────────────
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SR()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'en-US'
      recognitionRef.current.onresult = (e) => { setInput(e.results[0][0].transcript); setIsListening(false) }
      recognitionRef.current.onerror = () => setIsListening(false)
      recognitionRef.current.onend = () => setIsListening(false)
    }
  }, [])

  // ── On mount: load sessions and analytics ──────────────────────────────────
  useEffect(() => {
    loadSessions()
    loadAnalytics()
  }, [])

  const getToken = useCallback(async () => {
    return await user.getIdToken()
  }, [user])

  const loadAnalytics = async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setDocCount(data.total_documents ?? 0)
        setAvailableDocs((data.documents || []).map(d => d.name))
      }
    } catch {
      setDocCount(0)
    }
  }

  const loadSessions = async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
        if (data.length > 0) {
          // auto-select most recent
          await switchSession(data[0].id)
        } else {
          setMessages([WELCOME])
        }
      } else {
        fallbackToStorage()
      }
    } catch {
      fallbackToStorage()
    }
  }

  const fallbackToStorage = () => {
    const key = `rags_ai_messages_${user.uid}`
    try {
      const saved = sessionStorage.getItem(key)
      setMessages(saved ? JSON.parse(saved) : [WELCOME])
    } catch {
      setMessages([WELCOME])
    }
  }

  const switchSession = async (sessionId) => {
    setActiveSessionId(sessionId)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/sessions/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const msgs = data.messages || []
        setMessages(msgs.length > 0 ? msgs : [WELCOME])
      } else {
        setMessages([WELCOME])
      }
    } catch {
      setMessages([WELCOME])
    }
  }

  const createSession = async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API}/sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const session = await res.json()
        setSessions(prev => [session, ...prev])
        setActiveSessionId(session.id)
        setMessages([WELCOME])
      }
    } catch {
      setActiveSessionId(null)
      setMessages([WELCOME])
    }
  }

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation()
    try {
      const token = await getToken()
      await fetch(`${API}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId)
        if (remaining.length > 0) {
          await switchSession(remaining[0].id)
        } else {
          setActiveSessionId(null)
          setMessages([WELCOME])
        }
      }
    } catch {}
  }

  // ── Rate limit countdown ───────────────────────────────────────────────────
  const startRateLimitCountdown = (seconds) => {
    setRateLimitCountdown(seconds)
    setRateLimitMsg(`Rate limit hit. Try again in ${seconds} second${seconds !== 1 ? 's' : ''}.`)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setRateLimitCountdown(prev => {
        const next = prev - 1
        if (next <= 0) {
          clearInterval(countdownRef.current)
          setRateLimitMsg(null)
          return 0
        }
        setRateLimitMsg(`Rate limit hit. Try again in ${next} second${next !== 1 ? 's' : ''}.`)
        return next
      })
    }, 1000)
  }

  // ── @mention handling ──────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)
    const atIdx = val.lastIndexOf('@')
    if (atIdx !== -1) {
      const query = val.slice(atIdx + 1).toLowerCase()
      const filtered = availableDocs.filter(d => d.toLowerCase().includes(query))
      if (filtered.length > 0) {
        setAtMention({ query, filteredDocs: filtered })
        return
      }
    }
    setAtMention(null)
  }

  const selectMention = (docName) => {
    const atIdx = input.lastIndexOf('@')
    const newInput = input.slice(0, atIdx) + `@${docName} `
    setInput(newInput)
    setAtMention(null)
    inputRef.current?.focus()
  }

  // ── Extract @mention filter from message text ──────────────────────────────
  const extractFilter = (text) => {
    const match = text.match(/@([\w\-. ]+\.\w+)/)
    if (match) {
      const filterName = match[1].trim()
      const cleanQuestion = text.replace(match[0], '').trim()
      return { filterName, cleanQuestion }
    }
    return { filterName: null, cleanQuestion: text }
  }

  // ── Send message with streaming ────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    const rawQuestion = input.trim()
    const { filterName, cleanQuestion } = extractFilter(rawQuestion)

    setMessages(prev => [...prev, { role: 'user', content: rawQuestion }])
    setInput('')
    setAtMention(null)
    setStreaming(true)

    // Ensure there's an active session
    let sessionId = activeSessionId
    if (!sessionId) {
      try {
        const token = await getToken()
        const res = await fetch(`${API}/sessions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const session = await res.json()
          sessionId = session.id
          setActiveSessionId(session.id)
          setSessions(prev => [session, ...prev])
        }
      } catch {}
    }

    // Add placeholder assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '', sources: [], confidence: null, streaming: true }])

    try {
      const token = await getToken()
      const controller = new AbortController()
      abortRef.current = controller

      const historySnap = messages
        .filter(m => !m.streaming)
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          question: cleanQuestion,
          history: historySnap,
          session_id: sessionId,
          filter_filename: filterName || undefined
        }),
        signal: controller.signal
      })

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
        startRateLimitCountdown(retryAfter)
        setMessages(prev => prev.filter(m => !m.streaming))
        setStreaming(false)
        return
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          try {
            const event = JSON.parse(jsonStr)
            if (event.type === 'token') {
              fullContent += event.content
              setMessages(prev => {
                const updated = [...prev]
                const lastIdx = updated.length - 1
                if (updated[lastIdx]?.streaming) {
                  updated[lastIdx] = { ...updated[lastIdx], content: fullContent }
                }
                return updated
              })
            } else if (event.type === 'done') {
              setMessages(prev => {
                const updated = [...prev]
                const lastIdx = updated.length - 1
                if (updated[lastIdx]?.streaming) {
                  updated[lastIdx] = {
                    role: 'assistant',
                    content: fullContent,
                    sources: event.used_context ? (event.sources || []) : [],
                    confidence: event.used_context ? event.confidence : null,
                    used_context: event.used_context,
                    streaming: false
                  }
                }
                return updated
              })
              // Refresh session list to update names
              const tk2 = await getToken()
              fetch(`${API}/sessions`, { headers: { Authorization: `Bearer ${tk2}` } })
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data) setSessions(data) })
                .catch(() => {})
            } else if (event.type === 'error') {
              setMessages(prev => {
                const updated = [...prev]
                const lastIdx = updated.length - 1
                if (updated[lastIdx]?.streaming) {
                  updated[lastIdx] = {
                    role: 'assistant',
                    content: 'Server error. Please try again.',
                    sources: [],
                    confidence: null,
                    streaming: false
                  }
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled; strip streaming placeholder
        setMessages(prev => prev.filter(m => !m.streaming))
      } else {
        const errMsg = err.message?.includes('401')
          ? 'Session expired. Please sign out and sign back in.'
          : 'Could not reach the backend. Check your connection.'
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (updated[lastIdx]?.streaming) {
            updated[lastIdx] = { role: 'assistant', content: errMsg, sources: [], confidence: null, streaming: false }
          }
          return updated
        })
      }
    }

    setStreaming(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    if (e.key === 'Escape') setAtMention(null)
  }

  // ── Copy to clipboard ──────────────────────────────────────────────────────
  const copyMessage = async (content, idx) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    } catch {}
  }

  // ── Voice input ────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    if (!recognitionRef.current) return setVoiceNotSupported(true)
    if (isListening) { recognitionRef.current.stop(); setIsListening(false) }
    else { recognitionRef.current.start(); setIsListening(true) }
  }

  // ── Export chat ────────────────────────────────────────────────────────────
  const exportChat = () => {
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })),
      download: 'RAGs_AI_chat.txt'
    })
    a.click()
  }

  // ── Clear active session messages ──────────────────────────────────────────
  const clearChat = () => {
    setMessages([{ role: 'assistant', content: 'Chat cleared! Ask me anything about your documents.', sources: [], confidence: null }])
  }

  const confColor = (s) => s >= 0.8 ? 'text-emerald-400' : s >= 0.5 ? 'text-yellow-400' : 'text-orange-400'

  const formatSessionDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-void text-white flex flex-col relative overflow-hidden">

      {/* Background orbs */}
      <div className="fixed top-1/4 right-0 w-96 h-96 bg-violet-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 left-0 w-80 h-80 bg-cyan-500/6 rounded-full blur-[100px] pointer-events-none" />

      {/* Navbar */}
      <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 py-3.5 glass border-b border-white/[0.06] shrink-0 sticky top-0 z-50"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 text-white/30 hover:text-white transition rounded-lg hover:bg-white/5"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Brain size={13} className="text-violet-400" />
            </div>
            <span className="font-bold tracking-tight text-sm">RAGs_AI</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/upload')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs glass rounded-lg text-white/40 hover:text-white transition">
            <FileText size={12} /> Upload
          </button>
          <button onClick={() => navigate('/analytics')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs glass rounded-lg text-white/40 hover:text-white transition">
            <BarChart2 size={12} /> Analytics
          </button>
          <button onClick={exportChat} className="flex items-center gap-1.5 px-3 py-1.5 text-xs glass rounded-lg text-white/40 hover:text-white transition">
            <Download size={12} /> Export
          </button>
          <button onClick={clearChat} className="flex items-center gap-1.5 px-3 py-1.5 text-xs glass rounded-lg text-red-400/60 hover:text-red-400 transition">
            <Trash2 size={12} /> Clear
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-white/[0.06] ml-1">
            {user.photoURL && <img src={user.photoURL} alt="av" className="w-6 h-6 rounded-full ring-1 ring-violet-500/30" />}
            <span className="text-[11px] text-white/30 max-w-[100px] truncate hidden md:block">{user.email}</span>
            <button onClick={() => logOut().then(() => navigate('/login'))} className="p-1.5 text-white/20 hover:text-red-400 transition" title="Sign out">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="shrink-0 border-r border-white/[0.06] glass flex flex-col overflow-hidden z-40"
              style={{ minWidth: 0 }}
            >
              <div className="p-3 border-b border-white/[0.06]">
                <button
                  onClick={createSession}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition"
                >
                  <Plus size={13} /> New Chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
                {sessions.length === 0 && (
                  <p className="text-white/20 text-xs text-center py-6">No sessions yet</p>
                )}
                {sessions.map(session => (
                  <motion.div
                    key={session.id}
                    onClick={() => switchSession(session.id)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      activeSessionId === session.id
                        ? 'bg-violet-600/20 border border-violet-500/30'
                        : 'hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare size={11} className="text-white/30 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-white/70 truncate max-w-[130px] leading-tight">{session.name || 'New Chat'}</p>
                        <p className="text-[10px] text-white/25 font-mono">{formatSessionDate(session.created_at)}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-red-400 transition shrink-0 ml-1"
                    >
                      <X size={11} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-8 space-y-5 relative z-10">
            <div className="max-w-3xl mx-auto w-full">
              {/* Empty state */}
              {docCount === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16 px-6"
                >
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
                    <FileText size={28} className="text-violet-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white/70 mb-2">You haven't uploaded anything yet</h3>
                  <p className="text-white/30 text-sm mb-6">Upload documents to start chatting with your data.</p>
                  <button
                    onClick={() => navigate('/upload')}
                    className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition"
                  >
                    Upload Now
                  </button>
                </motion.div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex mb-5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[82%] ${msg.role === 'assistant' ? 'group relative' : ''}`}>
                      <div className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-violet-600 text-white rounded-br-sm'
                          : 'glass text-white/85 rounded-bl-sm'}`}
                      >
                        <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
                        {msg.streaming && (
                          <span className="inline-block w-1.5 h-4 bg-violet-400 ml-0.5 animate-pulse rounded-sm align-middle" />
                        )}
                      </div>

                      {/* Copy button (assistant only) */}
                      {msg.role === 'assistant' && !msg.streaming && msg.content && (
                        <button
                          onClick={() => copyMessage(msg.content, i)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition text-white/30 hover:text-white hover:bg-white/10"
                          title="Copy"
                        >
                          {copiedIdx === i ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                      )}

                      {msg.used_context && msg.sources?.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                          className="mt-2 flex flex-wrap gap-1.5"
                        >
                          {msg.sources.map((src, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-[11px] bg-violet-500/[0.08] border border-violet-500/20 rounded-lg px-2.5 py-1 text-white/40">
                              <FileText size={10} className="text-violet-400" />
                              <span className="text-violet-400 font-medium">{src.file}</span>
                              {msg.confidence != null && (
                                <span className={`ml-1 font-mono ${confColor(msg.confidence)}`}>
                                  {(msg.confidence * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Rate limit banner */}
          <AnimatePresence>
            {rateLimitMsg && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mx-4 mb-2 max-w-3xl mx-auto"
              >
                <div className="flex items-center justify-between text-xs text-yellow-400/90 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5">
                  <span>{rateLimitMsg}</span>
                  <button onClick={() => { setRateLimitMsg(null); clearInterval(countdownRef.current) }} className="ml-3 text-white/30 hover:text-white">
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input area */}
          <div className="shrink-0 px-4 py-4 max-w-3xl mx-auto w-full relative z-10">
            {voiceNotSupported && (
              <div className="text-xs text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-2 flex justify-between items-center">
                <span>Voice input requires Chrome.</span>
                <button onClick={() => setVoiceNotSupported(false)} className="ml-3 text-white/30 hover:text-white"><X size={12} /></button>
              </div>
            )}

            {/* @mention dropdown */}
            <AnimatePresence>
              {atMention && atMention.filteredDocs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="mb-2 glass rounded-xl border border-violet-500/20 overflow-hidden"
                >
                  {atMention.filteredDocs.slice(0, 6).map((doc, i) => (
                    <button
                      key={i}
                      onMouseDown={(e) => { e.preventDefault(); selectMention(doc) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-white/70 hover:bg-violet-500/10 hover:text-white transition text-left"
                    >
                      <FileText size={11} className="text-violet-400 shrink-0" />
                      <span className="truncate">{doc}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="flex items-end gap-2 glass rounded-2xl px-4 py-3 focus-within:border-violet-500/40 transition-all duration-300 focus-within:glow-border"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px'
                }}
                placeholder={docCount === 0 ? "Upload documents first..." : "Ask anything about your documents... (use @filename to filter)"}
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-white/20 max-h-36 leading-relaxed"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <motion.button whileTap={{ scale: 0.9 }} onClick={toggleVoice}
                  className={`p-2 rounded-xl transition ${isListening ? 'bg-red-500/15 text-red-400 animate-pulse' : 'text-white/25 hover:text-violet-400 hover:bg-violet-500/10'}`}
                >
                  {isListening ? <MicOff size={17} /> : <Mic size={17} />}
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                  onClick={sendMessage} disabled={!input.trim() || streaming}
                  className="p-2 bg-violet-600 hover:bg-violet-500 rounded-xl transition disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  {streaming ? <Loader size={17} className="animate-spin" /> : <Send size={17} />}
                </motion.button>
              </div>
            </motion.div>
            <p className="text-center text-white/15 text-[11px] mt-2 font-mono">Enter to send · Shift+Enter for new line · @filename to filter</p>
          </div>
        </div>
      </div>
    </div>
  )
}
