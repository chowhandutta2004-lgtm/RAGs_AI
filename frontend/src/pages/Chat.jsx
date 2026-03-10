import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, Send, Mic, MicOff, FileText, BarChart2, Download, Trash2, Loader } from 'lucide-react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'

export default function Chat() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('rags_ai_messages')
      return saved ? JSON.parse(saved) : [{
        role: 'assistant',
        content: "👋 Hey! I'm RAGs_AI. Upload your documents and ask me anything about them. I'll find the answers with sources!",
        sources: [],
        confidence: null
      }]
    } catch {
      return [{
        role: 'assistant',
        content: "👋 Hey! I'm RAGs_AI. Upload your documents and ask me anything about them. I'll find the answers with sources!",
        sources: [],
        confidence: null
      }]
    }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    try {
      sessionStorage.setItem('rags_ai_messages', JSON.stringify(messages))
    } catch {}
  }, [messages])

  // Voice Input Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'en-US'
      recognitionRef.current.onresult = (e) => {
        setInput(e.results[0][0].transcript)
        setIsListening(false)
      }
      recognitionRef.current.onerror = () => setIsListening(false)
      recognitionRef.current.onend = () => setIsListening(false)
    }
  }, [])

  const toggleVoice = () => {
    if (!recognitionRef.current) return alert('Voice not supported in this browser. Use Chrome!')
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/chat`, {
        question: input,
        history: messages.map(m => ({ role: m.role, content: m.content }))
      })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources || [],
        confidence: res.data.confidence || null
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Error connecting to backend. Make sure the FastAPI server is running!',
        sources: [],
        confidence: null
      }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const exportChat = () => {
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'RAGs_AI_chat.txt'
    a.click()
  }

  const clearChat = () => {
    sessionStorage.removeItem('rags_ai_messages')
    setMessages([{
      role: 'assistant',
      content: "👋 Chat cleared! Ask me anything about your documents.",
      sources: [],
      confidence: null
    }])
  }

  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'text-green-400'
    if (score >= 0.5) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-dark text-white flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-10 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <Brain className="text-primary" size={26} />
          <span className="text-lg font-bold tracking-tight">RAGs_AI</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/20 rounded-lg hover:border-primary/50 transition"
          >
            <FileText size={14} /> Upload Docs
          </button>
          <button
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/20 rounded-lg hover:border-primary/50 transition"
          >
            <BarChart2 size={14} /> Analytics
          </button>
          <button onClick={exportChat} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/20 rounded-lg hover:border-primary/50 transition">
            <Download size={14} /> Export
          </button>
          <button onClick={clearChat} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-500/30 text-red-400 rounded-lg hover:border-red-500/60 transition">
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </nav>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>

              {/* Bubble */}
              <div className={`rounded-2xl px-5 py-4 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-card border border-white/10 text-white/90 rounded-bl-sm'
                }`}
              >
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>

              {/* Confidence Score */}
              {msg.confidence !== null && msg.confidence !== undefined && (
                <div className={`mt-1.5 text-xs flex items-center gap-1 ${getConfidenceColor(msg.confidence)}`}>
                  ● Confidence: {(msg.confidence * 100).toFixed(0)}%
                </div>
              )}

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.sources.map((src, j) => (
                    <div key={j} className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/50">
                      📄 <span className="text-primary/80 font-medium">{src.file}</span> — p.{src.page}: "{src.snippet}"
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        ))}

        {/* Loading bubble */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-white/10 rounded-2xl rounded-bl-sm px-5 py-4">
              <Loader size={16} className="animate-spin text-primary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="shrink-0 px-6 py-5 border-t border-white/10 max-w-4xl mx-auto w-full">
        <div className="flex items-end gap-3 bg-card border border-white/10 rounded-2xl px-4 py-3 focus-within:border-primary/50 transition">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your documents..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-white/30 max-h-32"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleVoice}
              className={`p-2 rounded-lg transition ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-white/40 hover:text-primary'}`}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="p-2 bg-primary rounded-lg hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <p className="text-center text-white/20 text-xs mt-2">Press Enter to send · Shift+Enter for new line · 🎙️ for voice</p>
      </div>
    </div>
  )
}