import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordenesApi } from '../services/api'
import toast from 'react-hot-toast'
import { MessageCircle, ChevronRight, AlertTriangle, Wallet, Search, Loader2 } from 'lucide-react'
import { fmt, ot, fechaCorta, telWa, linkOT, ESTADO_LABEL, ESTADO_COLOR, hoy } from '../utils'

const dias = (f: string) => Math.floor((Date.now() - new Date(f).getTime()) / 86400000)

export default function PorCobrar() {
  const navigate = useNavigate()
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await ordenesApi.getAll({})
      setOrdenes(data.filter((o: any) => Number(o.saldo_pendiente) > 0 && o.estado !== 'ANULADA'))
    } catch { toast.error('No se pudo cargar') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const clientes = useMemo(() => {
    const filtradas = q ? ordenes.filter(o => (o.cliente_nombre || '').toLowerCase().includes(q.toLowerCase()) || String(o.id).includes(q)) : ordenes
    const map = new Map<number, any>()
    filtradas.forEach(o => {
      const k = o.cliente_id
      if (!map.has(k)) map.set(k, { cliente_id: k, nombre: o.cliente_nombre, telefono: o.cliente_telefono, total: 0, ordenes: [], antiguedad: 0 })
      const c = map.get(k)
      c.total += Number(o.saldo_pendiente); c.ordenes.push(o)
      c.antiguedad = Math.max(c.antiguedad, dias(o.creado_en))
    })
    return [...map.values()].sort((a, b) => b.antiguedad - a.antiguedad || b.total - a.total)
  }, [ordenes, q])

  const totalGeneral = clientes.reduce((s, c) => s + c.total, 0)
  const vencidas = clientes.filter(c => c.antiguedad > 30)

  const cobrarWa = (c: any) => {
    const tel = telWa(c.telefono)
    if (!tel) return toast.error('Sin teléfono registrado')
    const lista = c.ordenes.map((o: any) => `• ${ot(o.id)} del ${fechaCorta(o.creado_en)}: ${fmt(o.saldo_pendiente)}`).join('\n')
    const links = c.ordenes.length === 1 ? `\n\nDetalle: ${linkOT(c.ordenes[0].id, c.ordenes[0].token_publico)}` : ''
    const msg = `Hola ${String(c.nombre).split(' ')[0]}, te escribimos de Ladys Lavandería. Tienes ${c.ordenes.length === 1 ? 'un saldo pendiente' : `${c.ordenes.length} saldos pendientes`} por un total de ${fmt(c.total)}:\n\n${lista}${links}\n\nPuedes pagar por transferencia o al momento de la entrega. ¡Gracias!`
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Por cobrar</h1>
          <p className="text-gray-500 text-sm">{clientes.length} clientes · {ordenes.length} órdenes con saldo</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-red-600">{fmt(totalGeneral)}</p>
          <p className="text-xs text-gray-400">total pendiente</p>
        </div>
      </div>

      {vencidas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle size={15} /> {vencidas.length} cliente{vencidas.length > 1 ? 's' : ''} con deuda de más de 30 días ({fmt(vencidas.reduce((s, c) => s + c.total, 0))})
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente u OT…"
          className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300" />
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-pink-500" size={32} /></div>
        : clientes.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Wallet size={44} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No hay saldos pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientes.map(c => (
              <div key={c.cliente_id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(`/clientes/${c.cliente_id}`)} className="font-bold text-gray-800 hover:text-pink-600 text-left">{c.nombre}</button>
                    <p className="text-xs text-gray-400">{c.telefono || 'sin teléfono'} · {c.ordenes.length} orden{c.ordenes.length > 1 ? 'es' : ''}</p>
                    <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${c.antiguedad > 30 ? 'bg-red-100 text-red-600' : c.antiguedad > 14 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.antiguedad === 0 ? 'de hoy' : `${c.antiguedad} días de antigüedad`}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-red-600">{fmt(c.total)}</p>
                    <button onClick={() => cobrarWa(c)} disabled={!c.telefono}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium disabled:opacity-40">
                      <MessageCircle size={12} /> Cobrar
                    </button>
                  </div>
                </div>
                <div className="border-t divide-y">
                  {c.ordenes.map((o: any) => (
                    <div key={o.id} onClick={() => navigate(`/ordenes/${o.id}`)} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{ot(o.id)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ESTADO_COLOR[o.estado]}`}>{ESTADO_LABEL[o.estado]}</span>
                        <span className="text-xs text-gray-400">{fechaCorta(o.creado_en)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-red-600">{fmt(o.saldo_pendiente)}</span>
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      <p className="text-xs text-gray-400 text-center pb-4">Actualizado {fechaCorta(hoy())}</p>
    </div>
  )
}
