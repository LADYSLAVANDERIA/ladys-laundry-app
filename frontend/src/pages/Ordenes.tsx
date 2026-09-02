import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordenesApi } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Search, Truck, Store, Zap, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'
import { fmt, ot, fechaCorta, fechaHora, ESTADO_COLOR, ESTADO_LABEL, PAGO_COLOR, hoy } from '../utils'

const TABS = [
  { k: 'PRE_ORDEN',  label: 'Por retirar', campo: 'pre_orden' },
  { k: 'EN_PROCESO', label: 'En proceso',  campo: 'en_proceso' },
  { k: 'LISTA',      label: 'Listas',      campo: 'lista' },
  { k: 'ENTREGADA',  label: 'Entregadas',  campo: 'entregadas' },
  { k: '',           label: 'Todas',       campo: '' },
]
const SIGUIENTE: Record<string, { estado: string; label: string }> = {
  PRE_ORDEN:  { estado: 'EN_PROCESO', label: 'Recibida' },
  EN_PROCESO: { estado: 'LISTA',      label: 'Marcar lista' },
  LISTA:      { estado: 'ENTREGADA',  label: 'Entregar' },
}

export default function Ordenes() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('EN_PROCESO')
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [res, setRes] = useState<any>({})
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (t = tab, busca = q) => {
    setLoading(true)
    try {
      const [o, r] = await Promise.all([
        ordenesApi.getAll({ estado: t || undefined, q: busca || undefined }),
        ordenesApi.resumen(),
      ])
      setOrdenes(o.data); setRes(r.data)
    } catch { toast.error('No se pudieron cargar los pedidos') } finally { setLoading(false) }
  }
  useEffect(() => { load(tab, q) }, [tab])
  useEffect(() => { const t = setTimeout(() => load(tab, q), 350); return () => clearTimeout(t) }, [q])

  const avanzar = async (o: any, e: React.MouseEvent) => {
    e.stopPropagation()
    const sig = SIGUIENTE[o.estado]; if (!sig) return
    try { await ordenesApi.cambiarEstado(o.id, { estado: sig.estado }); toast.success(`${ot(o.id)} → ${ESTADO_LABEL[sig.estado]}`); load() }
    catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const hoyStr = hoy()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pedidos</h1>
          <p className="text-gray-500 text-sm">
            {res.retiros_hoy > 0 && <span className="text-orange-600 font-medium">{res.retiros_hoy} retiros hoy · </span>}
            {res.entregas_hoy > 0 && <span className="text-blue-600 font-medium">{res.entregas_hoy} entregas hoy · </span>}
            Por cobrar {fmt(res.por_cobrar)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className="p-2.5 border rounded-xl text-gray-500 hover:bg-gray-50"><RefreshCw size={16} /></button>
          <button onClick={() => navigate('/ordenes/nueva')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            <Plus size={16} /> Nueva orden
          </button>
        </div>
      </div>

      {Number(res.atrasadas) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle size={15} /> {res.atrasadas} {Number(res.atrasadas) === 1 ? 'orden atrasada' : 'órdenes atrasadas'} (fecha de entrega vencida)
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.k ? 'text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
            style={tab === t.k ? { background: 'linear-gradient(135deg,#E8177A,#A87BC8)' } : {}}>
            {t.label}
            {t.campo && res[t.campo] > 0 && <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${tab === t.k ? 'bg-white/25' : 'bg-gray-100'}`}>{res[t.campo]}</span>}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por OT, cliente o teléfono…"
          className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div>
      ) : ordenes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Store size={44} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No hay pedidos en esta vista</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordenes.map(o => {
            const sig = SIGUIENTE[o.estado]
            const atrasada = o.fecha_entrega && o.fecha_entrega < hoyStr && ['EN_PROCESO', 'LISTA'].includes(o.estado)
            return (
              <div key={o.id} onClick={() => navigate(`/ordenes/${o.id}`)}
                className="bg-white rounded-2xl shadow-sm border p-4 hover:shadow-md cursor-pointer transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-gray-800">{ot(o.id)}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[o.estado]}`}>{ESTADO_LABEL[o.estado]}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PAGO_COLOR[o.estado_pago] || ''}`}>
                        {o.estado_pago === 'PAGADA' ? 'Pagada' : o.estado_pago === 'PARCIAL' ? `Debe ${fmt(o.saldo_pendiente)}` : 'Sin pagar'}
                      </span>
                      {o.tipo_servicio === 'EXPRESS' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-0.5"><Zap size={9} /> Express</span>}
                      {o.es_membresia && <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Membresía</span>}
                      {atrasada && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Atrasada</span>}
                    </div>
                    <p className="font-medium text-gray-700 truncate">{o.cliente_nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{o.resumen_items || 'Sin ítems'}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1">{o.retiro_domicilio || o.entrega_domicilio ? <Truck size={11} /> : <Store size={11} />}{o.retiro_domicilio || o.entrega_domicilio ? 'Domicilio' : 'Local'}</span>
                      {o.fecha_recogida && o.estado === 'PRE_ORDEN' && <span className="text-orange-500">Retiro {fechaCorta(o.fecha_recogida)}{o.ruta_retiro ? ` · ${o.ruta_retiro}` : ''}</span>}
                      {o.fecha_entrega && o.estado !== 'PRE_ORDEN' && <span className={atrasada ? 'text-red-500 font-medium' : ''}>Entrega {fechaCorta(o.fecha_entrega)}</span>}
                      <span>Ingreso {fechaHora(o.creado_en)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-800">{fmt(o.monto_total)}</p>
                    {sig && (
                      <button onClick={e => avanzar(o, e)} className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-pink-100 hover:text-pink-700 font-medium transition-colors">
                        {sig.label}
                      </button>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 self-center flex-shrink-0" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
