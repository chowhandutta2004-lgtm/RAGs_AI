import { useRef, useState, useCallback, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Float } from '@react-three/drei'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, FileText, Zap, MessageSquare, BarChart2, Mic, Shield, Brain, LogIn, LogOut, Upload } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { logOut } from '../firebase'

/* ── 3D Scene ── */
function Orb({ position, color, size, speed }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed
    ref.current.position.y = position[1] + Math.sin(t) * 0.5
    ref.current.rotation.x = t * 0.1
    ref.current.rotation.z = t * 0.08
  })
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[size, 64, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.9}
        roughness={0.1}
        metalness={0.8}
        transparent
        opacity={0.85}
      />
    </mesh>
  )
}

function Ring({ position, color, speed }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed
    ref.current.rotation.x = t * 0.3
    ref.current.rotation.z = t * 0.2
    ref.current.position.y = position[1] + Math.sin(t * 0.7) * 0.3
  })
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[1.2, 0.04, 16, 100]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
    </mesh>
  )
}

function MouseScene({ mouseX, mouseY }) {
  const groupRef = useRef()
  useFrame(() => {
    groupRef.current.rotation.y += (mouseX.current * 0.4 - groupRef.current.rotation.y) * 0.04
    groupRef.current.rotation.x += (-mouseY.current * 0.25 - groupRef.current.rotation.x) * 0.04
  })
  return (
    <group ref={groupRef}>
      <Stars radius={120} depth={60} count={4000} factor={4} saturation={0} fade speed={0.4} />
      <ambientLight intensity={0.06} />
      <pointLight position={[8, 6, 4]} intensity={3} color="#8B5CF6" />
      <pointLight position={[-6, -4, -6]} intensity={2} color="#06B6D4" />
      <pointLight position={[0, 10, 0]} intensity={1} color="#A78BFA" />
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.5}>
        <Orb position={[-5, 0, -10]} color="#7C3AED" size={2.2} speed={0.35} />
      </Float>
      <Float speed={0.8} rotationIntensity={0.2} floatIntensity={0.8}>
        <Orb position={[6, -1, -12]} color="#06B6D4" size={1.6} speed={0.5} />
      </Float>
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.4}>
        <Orb position={[2, 4, -14]} color="#8B5CF6" size={1.0} speed={0.25} />
      </Float>
      <Float speed={1.0} rotationIntensity={0.4} floatIntensity={0.6}>
        <Orb position={[-2, -4, -7]} color="#A78BFA" size={0.7} speed={0.7} />
      </Float>
      <Ring position={[-5, 0, -10]} color="#8B5CF6" speed={0.4} />
      <Ring position={[6, -1, -12]} color="#06B6D4" speed={0.3} />
    </group>
  )
}

/* ── Tilt Card ── */
function TiltCard({ children, className }) {
  const ref = useRef(null)
  const onMove = useCallback((e) => {
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width  - 0.5
    const y = (e.clientY - r.top)  / r.height - 0.5
    ref.current.style.transform = `perspective(800px) rotateY(${x * 18}deg) rotateX(${-y * 18}deg) scale(1.03)`
    ref.current.style.boxShadow = `${-x * 20}px ${-y * 20}px 60px rgba(139,92,246,0.15)`
  }, [])
  const onLeave = useCallback(() => {
    ref.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)'
    ref.current.style.boxShadow = ''
  }, [])
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={`transition-shadow duration-300 ${className}`} style={{ transition: 'transform 0.15s ease, box-shadow 0.3s ease' }}>
      {children}
    </div>
  )
}

const features = [
  { icon: <FileText size={20} />, title: 'Multi-Format', desc: 'PDF, DOCX, TXT, CSV — all supported' },
  { icon: <Brain size={20} />, title: 'GPT-4o Powered', desc: 'State-of-the-art reasoning' },
  { icon: <MessageSquare size={20} />, title: 'Context Memory', desc: 'Remembers conversation history' },
  { icon: <Zap size={20} />, title: 'Instant Answers', desc: 'Sub-second vector retrieval' },
  { icon: <BarChart2 size={20} />, title: 'Analytics', desc: 'Deep document insights' },
  { icon: <Mic size={20} />, title: 'Voice Input', desc: 'Hands-free Chrome support' },
  { icon: <Shield size={20} />, title: 'Per-User Private', desc: 'Your data stays yours' },
  { icon: <Upload size={20} />, title: 'Source Citations', desc: 'Every answer referenced' },
]

const fadeUp = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } } }
const stagger = { visible: { transition: { staggerChildren: 0.1 } } }

export default function Landing() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const mouseX = useRef(0)
  const mouseY = useRef(0)
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  const heroY      = useTransform(scrollY, [0, 400], [0, -80])

  const handleMouse = useCallback((e) => {
    mouseX.current = (e.clientX / window.innerWidth  - 0.5) * 2
    mouseY.current = (e.clientY / window.innerHeight - 0.5) * 2
  }, [])

  return (
    <div className="min-h-screen bg-void text-white font-sans" onMouseMove={handleMouse}>

      {/* ── WebGL Background ── */}
      <div className="fixed inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }} gl={{ antialias: true, alpha: true }}>
          <Suspense fallback={null}>
            <MouseScene mouseX={mouseX} mouseY={mouseY} />
          </Suspense>
        </Canvas>
      </div>

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 glass border-b border-white/[0.06]"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Brain size={16} className="text-violet-400" />
          </div>
          <span className="font-bold tracking-tight text-white">RAGs_AI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
          <button onClick={() => navigate('/upload')} className="hover:text-white transition">Upload</button>
          <button onClick={() => navigate('/analytics')} className="hover:text-white transition">Analytics</button>
          <button onClick={() => navigate('/chat')} className="hover:text-white transition">Chat</button>
        </div>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30 hidden md:block">{user.email}</span>
            <button onClick={() => logOut()} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition px-3 py-1.5 glass rounded-lg">
              <LogOut size={13} /> Sign out
            </button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/upload')}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition violet-glow"
            >
              Upload <ArrowRight size={14} />
            </motion.button>
          </div>
        ) : (
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition violet-glow"
          >
            <LogIn size={14} /> Get Started
          </motion.button>
        )}
      </motion.nav>

      {/* ── Hero ── */}
      <motion.section style={{ opacity: heroOpacity, y: heroY }}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20"
      >
        <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col items-center">
          <motion.div variants={fadeUp}
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-8 text-xs font-mono text-white/50"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            GPT-4o · LangChain · ChromaDB · Firebase Auth
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-6xl md:text-8xl lg:text-9xl font-bold leading-[0.9] tracking-tighter max-w-5xl mb-6">
            <span className="text-white">Chat with</span><br />
            <span className="gradient-text">any document.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-white/40 text-lg max-w-lg mb-10 leading-relaxed font-light">
            Upload PDFs, Word docs, or spreadsheets. Ask in plain English.
            Get precise answers with exact sources — instantly.
          </motion.p>

          <motion.div variants={fadeUp} className="flex gap-3 flex-wrap justify-center">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate(user ? '/upload' : '/login')}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-4 rounded-xl transition violet-glow text-sm"
            >
              Start Uploading <ArrowRight size={16} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 glass text-white/70 hover:text-white font-semibold px-8 py-4 rounded-xl transition text-sm"
            >
              Go to Chat
            </motion.button>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} className="flex gap-12 mt-20 pt-10 border-t border-white/[0.06] flex-wrap justify-center">
            {[
              { n: '4+',    l: 'File formats' },
              { n: 'GPT-4o', l: 'AI Model' },
              { n: '<2s',   l: 'Response time' },
              { n: '100%',  l: 'Private' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-bold violet-text font-mono">{s.n}</p>
                <p className="text-xs text-white/30 mt-1 font-mono">{s.l}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ── Features ── */}
      <motion.section
        className="relative z-10 px-8 py-32 max-w-6xl mx-auto"
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
      >
        <motion.div variants={fadeUp} className="flex items-center gap-4 mb-12">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-violet-500/30" />
          <span className="text-xs font-mono text-violet-400 uppercase tracking-widest">Features</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-violet-500/30" />
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div key={i} variants={fadeUp}>
              <TiltCard className="glass rounded-2xl p-6 h-full cursor-default group hover:border-violet-500/30 hover:bg-violet-500/[0.06] transition-colors duration-300">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 text-violet-400 group-hover:bg-violet-500/20 transition">
                  {f.icon}
                </div>
                <p className="font-semibold text-sm mb-1 text-white">{f.title}</p>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── How it works ── */}
      <motion.section
        className="relative z-10 px-8 py-20 max-w-6xl mx-auto"
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
      >
        <motion.div variants={fadeUp} className="flex items-center gap-4 mb-12">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-500/30" />
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">How it works</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-cyan-500/30" />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Upload', desc: 'Drop any PDF, DOCX, TXT or CSV. Chunked and embedded into your private vector store instantly.', color: 'violet' },
            { step: '02', title: 'Ask', desc: 'Type in plain English or use voice input. The AI searches only your documents.', color: 'purple' },
            { step: '03', title: 'Get Answers', desc: 'Receive precise answers with exact source citations and confidence scores.', color: 'cyan' },
          ].map((s, i) => (
            <motion.div key={i} variants={fadeUp}>
              <TiltCard className="glass rounded-2xl p-8 h-full cursor-default group">
                <p className="text-5xl font-bold font-mono text-white/[0.06] mb-6 group-hover:text-violet-500/20 transition">{s.step}</p>
                <div className="h-px shimmer-line mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <p className="font-semibold text-white mb-3 text-lg">{s.title}</p>
                <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── CTA ── */}
      <motion.section
        className="relative z-10 px-8 py-20 max-w-6xl mx-auto"
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
      >
        <div className="glass rounded-3xl p-16 text-center overflow-hidden relative">
          <div className="absolute inset-0 bg-violet-radial opacity-60 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Ready to get started?</h2>
            <p className="text-white/40 mb-8">Upload your first document and start asking questions.</p>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate(user ? '/upload' : '/login')}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-10 py-4 rounded-xl transition violet-glow"
            >
              Start Uploading <ArrowRight size={16} />
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* ── Footer ── */}
      <footer className="relative z-10 px-8 py-6 border-t border-white/[0.05] flex items-center justify-between text-white/20 text-xs font-mono">
        <span>RAGs_AI © 2026</span>
        <span>React · FastAPI · LangChain · ChromaDB</span>
      </footer>
    </div>
  )
}
