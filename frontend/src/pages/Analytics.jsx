import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, FileText, Hash, BarChart2, RefreshCw, Upload } from 'lucide-react'
import axios from 'axios'

const COLORS = ['#6C63FF', '#A78BFA', '#818CF8', '#C4B5FD', '#DDD6FE', '#EDE9FE']

export default function Analytics() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await axios.get('http://localhost:8000/analytics')
      setStats(res.data)
    } catch {
      // Use mock data if backend not ready
      setStats({
        total_documents: 3,
        total_chunks: 142,
        total_words: 28400,
        documents: [
          { name: 'research_paper.pdf', chunks: 54, words: 10800, type: 'PDF' },
          { name: 'report.docx', chunks: 48, words: 9600, type: 'DOCX' },
          { name: 'notes.txt', chunks: 40, words: 8000, type: 'TXT' },
        ],
        top_keywords: [
          { word: 'machine learning', count: 42 },
          { word: 'neural network', count: 38 },
          { word: 'data pipeline', count: 31 },
          { word: 'transformer', count: 27 },
          { word: 'embedding', count: 24 },
          { word: 'retrieval', count: 19 },
          { word: 'vector store', count: 16 },
          { word: 'fine tuning', count: 14 },
        ]
      })
    }
    setLoading(false)
  }

  const maxKeywordCount = stats?.top_keywords?.[0]?.count || 1

  return (
    <div className="min-h-screen bg-dark text-white">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-10 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <Brain className="text-primary" size={26} />
          <span className="text-lg font-bold tracking-tight">RAGs_AI</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/20 rounded-lg hover:border-primary/50 transition"
          >
            <Upload size={14} /> Upload
          </button>
          <button
            onClick={fetchStats}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/20 rounded-lg hover:border-primary/50 transition"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold mb-2">Document Analytics</h1>
          <p className="text-white/40">Insights and statistics from your uploaded documents</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
              <StatCard
                icon={<FileText size={22} />}
                label="Total Documents"
                value={stats.total_documents}
                sub="files uploaded"
              />
              <StatCard
                icon={<Hash size={22} />}
                label="Total Chunks"
                value={stats.total_chunks}
                sub="text segments indexed"
              />
              <StatCard
                icon={<BarChart2 size={22} />}
                label="Total Words"
                value={stats.total_words?.toLocaleString()}
                sub="words processed"
              />
            </div>

            {/* Documents Table */}
            <div className="bg-card border border-white/10 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-semibold mb-5 text-white/80">Uploaded Documents</h2>
              <div className="space-y-3">
                {stats.documents?.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-white/30">{doc.type}</p>
                      </div>
                    </div>
                    <div className="flex gap-6 text-right">
                      <div>
                        <p className="text-sm font-semibold text-primary">{doc.chunks}</p>
                        <p className="text-xs text-white/30">chunks</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{doc.words?.toLocaleString()}</p>
                        <p className="text-xs text-white/30">words</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Keywords */}
            <div className="bg-card border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-5 text-white/80">Top Keywords</h2>
              <div className="space-y-3">
                {stats.top_keywords?.map((kw, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-sm text-white/60 w-36 shrink-0">{kw.word}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(kw.count / maxKeywordCount) * 100}%`,
                          backgroundColor: COLORS[i % COLORS.length]
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-white/50 w-8 text-right">{kw.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-card border border-white/10 rounded-2xl p-6 hover:border-primary/30 transition">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-primary">{icon}</div>
        <span className="text-sm text-white/50 font-medium">{label}</span>
      </div>
      <p className="text-4xl font-extrabold text-white mb-1">{value}</p>
      <p className="text-xs text-white/30">{sub}</p>
    </div>
  )
}