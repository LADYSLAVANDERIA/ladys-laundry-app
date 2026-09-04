import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientesApi, dashboardApi } from '../services/api'
import { Search, Plus, Phone, Mail, Building2, User, Loader2 } from 'lucide-react'

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const [total, setTotal] = useState(0)
  useEffect(() => { dashboardApi.get().then(r => setTotal(Number(r.data?.kpis?.total_clientes || 0))).catch(() => {}) }, [])

  // La búsqueda va al servidor: son más de 2.000 clientes y no caben todos en pantalla
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      clientesApi.getAll(q.trim() || undefined)
        .then(r => setClientes(r.data))
        .finally(() => setLoading(false))
    }, q ? 350 : 0)
    return () => clearTimeout(t)
  }, [q])

  const filtrados = clientes

  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-gray-500 text-sm">
            {q.trim()
              ? `${clientes.length} ${clientes.length === 1 ? 'resultado' : 'resultados'} para "${q.trim()}"`
              : `${total.toLocaleString('es-CL')} clientes · mostrando los primeros ${clientes.length}, escribe para buscar entre todos`}
          </p>
        </div>
        <button onClick={() => navigate('/clientes/nuevo')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-sm"
          style={{ background: 'linear-gradient(135deg, #E8177A, #A87BC8)' }}>
          <Plus size={16} /> Nuevo
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre, apellido, teléfono, correo o razón social..."
          className="w-full pl-10 pr-10 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none bg-white" />
        {loading && q && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 animate-spin" />}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div>
      ) : (
        <div className="grid gap-3">
          {!filtrados.length && (
            <div className="text-center py-16 text-gray-400">
              <User size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">{q ? `Sin resultados para "${q}"` : 'Sin clientes'}</p>
              {q && <p className="text-xs mt-1">Prueba con el apellido o los últimos dígitos del teléfono</p>}
            </div>
          )}
          {filtrados.map(c => (
            <div key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
              className="bg-white rounded-xl p-4 shadow-sm border hover:shadow-md cursor-pointer transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: c.tipo === 'EMPRESA' ? 'linear-gradient(135deg,#4AAEE0,#A87BC8)' : 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                    {c.tipo === 'EMPRESA' ? <Building2 size={18} /> : <User size={18} />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{c.nombre} {c.apellido}</p>
                    {c.razon_social && <p className="text-xs text-gray-500">{c.razon_social}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      {c.telefono && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11}/>{c.telefono}</span>}
                      {c.email && <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11}/>{c.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-pink-600">{fmt(c.total_gastado || 0)}</p>
                  <p className="text-xs text-gray-400">{c.total_ordenes || 0} órdenes</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${c.tipo === 'EMPRESA' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                    {c.tipo}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-400">
              <User size={40} className="mx-auto mb-2 opacity-30" />
              <p>No se encontraron clientes</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
