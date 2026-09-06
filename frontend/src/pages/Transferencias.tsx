import { useEffect, useState } from 'react'
import { transferenciasApi } from '../services/api'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { Check, X, RefreshCw, Landmark, FileText, Link2 } from 'lucide-react'

const plata = (n: any) => `$${Number(n || 0).toLocaleString('es-CL')}`
const dia = (f: any) => f ? new Date(String(f) + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'

export default function Transferencias() {
  const [datos, setDatos] = useState<any>({ por_confirmar: [], sin_asignar: [], candidatos: [] })
  const [cargando, setCargando] = useState(true)
  const [asignando, setAsignando] = useState<number | null>(null)
  const [destino, setDestino] = useState<Record<number, string>>({})

  const cargar = () => {
    setCargando(true)
    transferenciasApi.pendientes()
      .then(({ data }) => setDatos(data))
      .catch(() => toast.error('No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, [])

  const marcar = async (id: number, estado: string) => {
    try {
      await transferenciasApi.marcar(id, estado)
      toast.success(estado === 'CONFIRMADA' ? 'Confirmada' : 'Marcada como no llegó')
      cargar()
    } catch { toast.error('No se pudo actualizar') }
  }

  const asignar = async (id: number) => {
    const orden = Number(destino[id])
    if (!orden) { toast.error('Elige a qué pedido va'); return }
    setAsignando(id)
    try {
      await transferenciasApi.asignar(id, orden)
      toast.success('Abono asignado al pedido')
      cargar()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo asignar') }
    finally { setAsignando(null) }
  }

  if (cargando) return <div className="py-20 text-center text-gray-400">Cargando…</div>

  const { por_confirmar = [], sin_asignar = [], candidatos = [] } = datos

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Transferencias</h1>
        <button onClick={cargar} className="flex items-center gap-1.5 text-sm" style={{ color: '#E8177A' }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={17} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Comprobantes por confirmar</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{por_confirmar.length}</span>
        </div>
        <p className="text-sm text-gray-600">
          El cliente mandó el comprobante y se le entregó la ropa, pero todavía nadie verificó
          que la plata llegó a la cuenta. Revisa la cartola y confirma o descarta.
        </p>

        {por_confirmar.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Nada pendiente. Todo cuadrado.</p>
        ) : (
          <div className="divide-y">
            {por_confirmar.map((t: any) => (
              <div key={t.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-gray-800">{plata(t.monto)}</div>
                  <div className="text-sm text-gray-500">
                    {t.cliente || t.nombre_origen || 'Sin nombre'}
                    {t.orden_id && <> · <Link to={`/ordenes/${t.orden_id}`} className="underline" style={{ color: '#E8177A' }}>Pedido {t.orden_id}</Link></>}
                  </div>
                  <div className="text-xs text-gray-400">
                    {dia(t.fecha_mov)}{t.registro ? ` · registró ${t.registro}` : ''}
                  </div>
                </div>
                {t.comprobante_url && (
                  <a href={t.comprobante_url} target="_blank" rel="noreferrer"
                     className="text-sm underline text-gray-500">ver comprobante</a>
                )}
                <div className="flex gap-2">
                  <button onClick={() => marcar(t.id, 'CONFIRMADA')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white">
                    <Check size={15} /> Llegó
                  </button>
                  <button onClick={() => marcar(t.id, 'NO_LLEGO')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border text-gray-600">
                    <X size={15} /> No llegó
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center gap-2">
          <Landmark size={17} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Abonos del banco sin asignar</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{sin_asignar.length}</span>
        </div>
        <p className="text-sm text-gray-600">
          Plata que entró a la cuenta y no calzó con ningún comprobante. Dile a qué pedido corresponde.
        </p>

        {sin_asignar.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No hay abonos sueltos.</p>
        ) : (
          <div className="divide-y">
            {sin_asignar.map((t: any) => (
              <div key={t.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-gray-800">{plata(t.monto)}</div>
                  <div className="text-sm text-gray-500">{t.nombre_origen || 'Sin nombre'}</div>
                  <div className="text-xs text-gray-400">{dia(t.fecha_mov)}{t.rut_origen ? ` · RUT ${t.rut_origen}` : ''}</div>
                </div>
                <select className="border rounded-lg px-3 py-2 text-sm max-w-[240px]"
                        value={destino[t.id] || ''}
                        onChange={e => setDestino({ ...destino, [t.id]: e.target.value })}>
                  <option value="">¿A qué pedido va?</option>
                  {candidatos.map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.id} · {o.cliente} · debe {plata(o.saldo_pendiente)}
                    </option>
                  ))}
                </select>
                <button onClick={() => asignar(t.id)} disabled={asignando === t.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  <Link2 size={15} /> {asignando === t.id ? 'Asignando…' : 'Asignar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
