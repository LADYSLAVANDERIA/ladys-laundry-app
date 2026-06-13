import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordenesApi } from '../services/api'
import { Plus, Search, ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADOS = ['TODOS','PRE_ORDEN','EN_PROCESO','LISTA','ENTREGADA','PAGADA','ANULADA']
const COLORES: Record<string,string> = {
  PRE_ORDEN: 'bg-gray-100 text-gray-600',
  EN_PROCESO: 'bg-yellow-100 text-yellow-700',
  LISTA: 'bg-green-100 text-green-700',
  ENTREGADA: 'bg-blue-100 text-blue-700',
  PAGADA: 'bg-purple-100 text-purple-700',
  ANULADA: 'bg-red-100 text-red-600',
}

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [estado, setEstado] = useState('TODOS')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    ordenesApi.getAll(estado !== 'TODOS' ? { estado } : {})
      .then(r => setOrdenes(r.data))
      .finally(() => setLoading(false))
  }, [estado])

  const filtradas = ordenes.filter(o =>
    !q || `${o.cliente_nombre} ${o.id}`.toLowerCase().includes(q.toLowerCase())
  )

  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Órdenes de Trabajo</h1>
          <p className="text-gray-500 text-sm">{filtradas.length} órdenes</p>
        </div>
        <button onClick={() => navigate('/ordenes/nueva')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium"
          style={{ background: 'linear-gradient(135deg, #E8177A, #A87BC8)' }}>
          <Plus size={16} /> Nueva OT
        </button>
      </div>

      {/* Filtro estados */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ESTADOS.map(e => (
          <button key={e} onClick={() => setEstado(e)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
              estado === e ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}>
            {e.replace('_',' ')}
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por cliente o # OT..."
          className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none bg-white" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(o => (
            <div key={o.id} onClick={() => navigate(`/ordenes/${o.id}`)}
              className="bg-white rounded-xl p-4 shadow-sm border hover:shadow-md cursor-pointer transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">#{String(o.id).padStart(5,'0')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLORES[o.estado]}`}>{o.estado.replace('_',' ')}</span>
                  </div>
                  <p className="font-semibold text-gray-800 mt-1 truncate">{o.cliente_nombre}</p>
                  <p className="text-xs text-gray-500">{o.cliente_telefono}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-sm font-bold text-pink-600">{fmt(o.monto_total)}</p>
                  {o.saldo_pendiente > 0 && <p className="text-xs text-red-500">Saldo: {fmt(o.saldo_pendiente)}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(o.creado_en), 'd MMM', { locale: es })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {filtradas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ClipboardList size={40} className="mx-auto mb-2 opacity-30" />
              <p>No hay órdenes</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
