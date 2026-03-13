import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Landing from './pages/Landing'
import Upload from './pages/Upload'
import Chat from './pages/Chat'
import Analytics from './pages/Analytics'
import Login from './pages/Login'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <div className="min-h-screen bg-dark text-white font-sans">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      </Routes>
    </div>
  )
}

export default App
