import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Send, Mic, MicOff, FileText, BarChart2, Download, Trash2, Loader, LogOut } from 'lucide-react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../AuthContext'
import { auth, logOut } from '../firebase'

export default function Chat() {
  const { user } = useAuth()
  const storageKey = `rags_ai_messages_${user.uid}`
  const navigate = useNavigate()

  const [voiceNotSupported, setVoiceNotSupported] = useState(false)
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : [{ role: 'assistant', content: "Hey! I'm RAGs_AI. Upload your documents and ask me anything — I'll find the answers with sources.", sources: [], confidence: null }]
    } catch {
      return [{ role: 'assistant', content: "Hey! I'm RAGs_AI. Upload your documents and ask me anything.", sources: [], confidence: null }]
    }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(messages)) } catch {}
  }, [messages, storageKey])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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

  const toggleVoice = () => {
    if (!recognitionRef.current) return setVoiceNotSupported(true)
    if (isListening) { recognitionRef.current.stop(); setIsListening(false) }
    else { recognitionRef.current.start(); setIsListening(true) }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/chat`, {
        question,
        history: messages.map(m => ({ role: m.role, content: m.content }))
      }, { headers: { 'Authorization': `Bearer ${token}` } })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.used_context ? (res.data.sources || []) : [],
        confidence: res.data.used_context ? res.data.confidence : null,
        used_context: res.data.used_context
      }])
    } catch (err) {
      const status = err?.response?.status
      const errMsg = status === 401
        ? '🔒 Session expired. Please sign out and sign back in.'
        : status >= 500
        ? '🔴 Server error. The backend ran into a problem — try again.'
        : '❌ Could not reach the backend. Check your connection.'
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, sources: [], confidence: null }])
      if (status === 401) setTimeout(() => navigate('/login'), 2000)
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const exportChat = () => {
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: 'RAGs_AI_chat.txt' })
    a.click()
  }

  const clearChat = () => {
    sessionStorage.removeItem(storageKey)
    setMessages([{ role: 'assistant', content: 'Chat cleared! Ask me anything about your documents.', sources: [], confidence: null }])
  }

  const confColor = (s) => s >= 0.8 ? 'text-emerald-400' : s >= 0.5 ? 'text-yellow-400' : 'text-orange-400'

  return (
    <div className="min-h-screen bg-void text-white flex flex-col relative">

      {/* Background */}
      <div className="fixed top-1/4 right-0 w-96 h-96 bg-violet-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 left-0 w-80 h-80 bg-cyan-500/6 rounded-full blur-[100px] pointer-events-none" />

      {/* Navbar */}
      <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-8 py-3.5 glass border-b border-white/[0.06] shrink-0 sticky top-0 z-50"
      >
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Brain size={13} className="text-violet-400" />
          </div>
          <span className="font-bold tracking-tight text-sm">RAGs_AI</span>
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-8 space-y-5 max-w-3xl mx-auto w-full relative z-10">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[82%]">
                <div className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'glass text-white/85 rounded-bl-sm'}`}
                >
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
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

        {loading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="glass rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-2">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <motion.div key={i} className="w-1.5 h-1.5 bg-violet-400 rounded-full"
                    animate={{ y: [0, -6, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-4 max-w-3xl mx-auto w-full relative z-10">
        {voiceNotSupported && (
          <div className="text-xs text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-2 flex justify-between items-center">
            <span>Voice input requires Chrome.</span>
            <button onClick={() => setVoiceNotSupported(false)} className="ml-3 text-white/30 hover:text-white">✕</button>
          </div>
        )}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex items-end gap-2 glass rounded-2xl px-4 py-3 focus-within:border-violet-500/40 transition-all duration-300 focus-within:glow-border"
        >
          <textarea
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px'
            }}
            placeholder="Ask anything about your documents..."
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
              onClick={sendMessage} disabled={!input.trim() || loading}
              className="p-2 bg-violet-600 hover:bg-violet-500 rounded-xl transition disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <Send size={17} />
            </motion.button>
          </div>
        </motion.div>
        <p className="text-center text-white/15 text-[11px] mt-2 font-mono">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
