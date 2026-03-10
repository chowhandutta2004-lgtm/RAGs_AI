import { useNavigate } from 'react-router-dom'
import { Brain, FileText, Zap, MessageSquare, BarChart2, Mic } from 'lucide-react'

const features = [
  { icon: <FileText size={28} />, title: 'Multi-Format Support', desc: 'Upload PDFs, DOCX, TXT, and CSV files effortlessly.' },
  { icon: <Brain size={28} />, title: 'AI-Powered RAG', desc: 'GPT-4o reads and understands your documents deeply.' },
  { icon: <MessageSquare size={28} />, title: 'Conversational Memory', desc: 'Ask follow-up questions — it remembers the context.' },
  { icon: <Zap size={28} />, title: 'Instant Answers', desc: 'Get precise answers with source highlights in seconds.' },
  { icon: <BarChart2 size={28} />, title: 'Document Analytics', desc: 'Visualize topics, keywords, and document insights.' },
  { icon: <Mic size={28} />, title: 'Voice Input', desc: 'Ask questions with your voice — hands-free experience.' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-dark text-white overflow-hidden">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Brain className="text-primary" size={28} />
          <span className="text-xl font-bold tracking-tight">RAGs_AI</span>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition"
          >
            Upload Docs
          </button>
          <button
            onClick={() => navigate('/chat')}
            className="px-4 py-2 text-sm bg-primary rounded-lg hover:opacity-90 transition font-medium"
          >
            Start Chatting
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">

        {/* Glow effect */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-sm px-4 py-1.5 rounded-full mb-6">
          <Zap size={14} />
          Powered by GPT-4o + LangChain + ChromaDB
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight max-w-4xl bg-gradient-to-r from-white via-purple-200 to-primary bg-clip-text text-transparent">
          Ask Anything.<br />From Any Document.
        </h1>

        <p className="mt-6 text-lg text-white/60 max-w-xl">
          Upload your PDFs, Word docs, or CSVs and instantly chat with them using AI.
          Get precise answers with source highlights, voice input, and analytics.
        </p>

        <div className="mt-10 flex gap-4 flex-wrap justify-center">
          <button
            onClick={() => navigate('/upload')}
            className="px-8 py-3.5 bg-primary hover:opacity-90 transition rounded-xl font-semibold text-lg shadow-lg shadow-primary/30"
          >
            🚀 Get Started Free
          </button>
          <button
            onClick={() => navigate('/chat')}
            className="px-8 py-3.5 border border-white/20 hover:border-white/40 transition rounded-xl font-semibold text-lg"
          >
            💬 Try the Chat
          </button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="px-10 py-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-white/90">
          Everything you need to talk to your docs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-card border border-white/10 rounded-2xl p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300"
            >
              <div className="text-primary mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-8 text-white/30 text-sm border-t border-white/10">
        Built with ❤️ using React + FastAPI + LangChain · RAGs_AI © 2026
      </footer>

    </div>
  )
}