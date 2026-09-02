import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { programacionApi, ordenesApi } from '../services/api'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, MapPin, Phone, Truck, Store, Zap, Printer, CalendarOff, Package, CheckCircle2 } from 'lucide-react'
import { fmt, ot, hoy, addDias, fechaLarga, hora, telWa, waLink } from '../utils'

export default function Programacion() {
  const navigate = useNavigate()
  const [fecha, setFecha] = useState(hoy())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async (f = fecha) => {
    setLoading(true)
    try { const { data } = await programacionApi.get(f); setData(data) }
    catch { toast.error('No se pudo cargar la programación') } finally { setLoading(false) }
  }
  useEffect(() => { load(fecha) }, [fecha])

  const marcar = async (id: number, estado: string) => {
    try { await ordenesApi.cambiarEstado(id, { estado }); toast.success(`${ot(id)} actualizada`); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  const Parada = ({ o, tipo }: { o: any; tipo: 'retiro' | 'entrega' }) => {
    const dir = tipo === 'retiro' ? o.dir_retiro : o.dir_entrega
    const listoRetiro = tipo === 'retiro' && o.estado === 'PRE_ORDEN'
    const listoEntrega = tipo === 'entrega' && ['EN_PROCESO', 'LISTA'].includes(o.estado)
    return (
      <div className="border rounded-xl p-3 hover:bg-gray-50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/ordenes/${o.id}`)}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">{ot(o.id)}</span>
              <span className="text-sm text-gray-700">{o.cliente}</span>
              {o.tipo_servicio === 'EXPRESS' && <Zap size={11} className="text-amber-500" />}
              {o.origen === 'SOFIA' && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">SofIA</span>}
            </div>
            {dir && <p className="text-xs text-gray-500 flex items-start gap-1 mt-1"><MapPin size={11} className="mt-0.5 flex-shrink-0" />{dir}</p>}
            {o.observaciones && <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 mt-1">{o.observaciones}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              {Number(o.bultos) > 0 && <span>{o.bultos} bulto{Number(o.bultos) > 1 ? 's' : ''}</span>}
              {Number(o.saldo_pendiente) > 0 && <span className="text-red-500 font-medium">Cobrar {fmt(o.saldo_pendiente)}</span>}
              {Number(o.saldo_pendiente) === 0 && Number(o.monto_total) > 0 && <span className="text-green-600">Pagada</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
            {o.telefono && <a href={waLink(o.telefono, `Hola ${String(o.cliente).split(' ')[0]}, vamos en camino con tu pedido ${ot(o.id)} de Ladys Lavandería.`)} target="_blank" rel="noreferrer" className="p-1.5 border rounded-lg text-green-600"><Phone size={13} /></a>}
            {listoRetiro && <button onClick={() => marcar(o.id, 'EN_PROCESO')} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-orange-100 text-orange-700 font-medium whitespace-nowrap">Retirado</button>}
            {listoEntrega && <button onClick={() => marcar(o.id, 'ENTREGADA')} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium whitespace-nowrap">Entregada</button>}
            {o.estado === 'ENTREGADA' && <CheckCircle2 size={16} className="text-green-500" />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Programación</h1>
          <p className="text-gray-500 text-sm capitalize">{fechaLarga(fecha)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setFecha(addDias(fecha, -1))} className="p-2.5 border rounded-xl"><ChevronLeft size={16} /></button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="border rounded-xl px-3 py-2 text-sm outline-none" />
          <button onClick={() => setFecha(addDias(fecha, 1))} className="p-2.5 border rounded-xl"><ChevronRight size={16} /></button>
          <button onClick={() => setFecha(hoy())} className="px-3 py-2.5 border rounded-xl text-sm">Hoy</button>
          <button onClick={() => window.print()} className="p-2.5 border rounded-xl text-gray-500"><Printer size={16} /></button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div> : data && (
        <div className="space-y-4">
          {data.feriado && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2"><CalendarOff size={15} /> {data.feriado} — sin ruta este día</div>}

          {data.rutas.map((r: any) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#E8177A11,#A87BC811)' }}>
                <div>
                  <p className="font-bold text-gray-800">{r.nombre}</p>
                  <p className="text-xs text-gray-500">{hora(r.hora_inicio)}–{hora(r.hora_fin)} · {r.tipo === 'SOLO_ENTREGAS' ? 'solo entregas' : 'retiros y entregas'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-pink-600">{r.usados}<span className="text-sm text-gray-400">/{r.puntos_disp}</span></p>
                  <p className="text-xs text-gray-400">{r.cupos} cupos libres</p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {r.retiros.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-2 flex items-center gap-1"><Truck size={12} /> RETIROS ({r.retiros.length})</p>
                    <div className="space-y-2">{r.retiros.map((o: any) => <Parada key={o.id} o={o} tipo="retiro" />)}</div>
                  </div>
                )}
                {r.entregas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-600 mb-2 flex items-center gap-1"><Package size={12} /> ENTREGAS ({r.entregas.length})</p>
                    <div className="space-y-2">{r.entregas.map((o: any) => <Parada key={o.id} o={o} tipo="entrega" />)}</div>
                  </div>
                )}
                {!r.retiros.length && !r.entregas.length && <p className="text-sm text-gray-400 text-center py-3">Sin paradas asignadas</p>}
              </div>
            </div>
          ))}

          {!data.rutas.length && !data.feriado && (
            <div className="text-center py-12 text-gray-400"><Truck size={40} className="mx-auto mb-2 opacity-20" /><p>No hay rutas configuradas para este día</p></div>
          )}

          {data.sin_ruta.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">SIN RUTA ASIGNADA ({data.sin_ruta.length})</p>
              <div className="space-y-2">{data.sin_ruta.map((o: any) => <Parada key={o.id} o={o} tipo={o.fecha_recogida === fecha ? 'retiro' : 'entrega'} />)}</div>
            </div>
          )}

          {data.en_local.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><Store size={12} /> RETIRAN EN LOCAL ({data.en_local.length})</p>
              <div className="space-y-2">{data.en_local.map((o: any) => (
                <div key={o.id} onClick={() => navigate(`/ordenes/${o.id}`)} className="flex items-center justify-between border rounded-xl p-3 cursor-pointer hover:bg-gray-50">
                  <div><p className="text-sm"><strong>{ot(o.id)}</strong> {o.cliente}</p><p className="text-xs text-gray-400">{o.telefono || 'sin teléfono'}</p></div>
                  <div className="text-right"><p className="text-sm font-bold">{fmt(o.monto_total)}</p>{Number(o.saldo_pendiente) > 0 && <p className="text-xs text-red-500">debe {fmt(o.saldo_pendiente)}</p>}</div>
                </div>
              ))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
