import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../services/api'
import toast from 'react-hot-toast'
import { Shirt, Lock, Mail } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('admin@ladys.cl')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login({ email, password })
      setAuth(data.user, data.token)
      navigate('/dashboard')
    } catch {
      toast.error('Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #E8177A 0%, #A87BC8 60%, #4AAEE0 100%)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #E8177A, #A87BC8)' }}>
            <Shirt size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Ladys Lavandería</h1>
          <p className="text-gray-500 text-sm mt-1">Sistema de Gestión</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" required
              className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-pink-400 outline-none" />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña" required
              className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-pink-400 outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, #E8177A, #A87BC8)' }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-6">Ladys Lavandería © 2026</p>
      </div>
    </div>
  )
}
