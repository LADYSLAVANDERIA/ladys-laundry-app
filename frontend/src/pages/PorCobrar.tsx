import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ordenesApi, indicadoresApi, rutasApi } from '../services/api'
import toast from 'react-hot-toast'
import { MessageCircle, ChevronRight, AlertTriangle, Wallet, Search, Loader2 } from 'lucide-react'
import { fmt, ot, fechaCorta, telWa, linkOT, ESTADO_LABEL, ESTADO_COLOR, hoy } from '../utils'

const dias = (f: string) => Math.floor((Date.now() - new Date(f).getTime()) / 86400000)

export default function PorCobrar() {
  const navigate = useNavigate()
  // El tipo viene de los indicadores de arriba: el reloj manda particulares y
  // el museo empresas en mora. Sin tipo, se muestra todo lo que tenga saldo.
  const [params] = useSearchParams()
  const tipo = params.get('tipo') || ''
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [rutas, setRutas] = useState<any[]>([])
  const [reagendar, setReagendar] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      if (tipo) {
        // El listado general no trae el tipo de cliente ni el plazo de pago,
        // así que la clasificación la hace el servidor.
        const { data } = await indicadoresApi.pendientes(tipo)
        setOrdenes(data.ordenes)
      } else {
        const { data } = await ordenesApi.getAll({})
        setOrdenes(data.filter((o: any) => Number(o.saldo_pendiente) > 0 && o.estado !== 'ANULADA'))
      }
    } catch { toast.error('No se pudo cargar') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [tipo])
  useEffect(() => {
    if (tipo === 'despacho') rutasApi.getAll().then(r => setRutas(r.data.filter((x: any) => x.activo !== false))).catch(() => {})
  }, [tipo])

  const DIAS = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO']
  const rutasDelDia = (f: string) =>
    rutas.filter(r => r.dia_semana === DIAS[new Date(f + 'T12:00:00').getDay()] && r.tipo !== 'SOLO_RETIROS')

  // Recordatorio al cliente de que su pedido lleva días esperando.
  const recordar = (o: any) => {
    const tel = telWa(o.cliente_telefono)
    if (!tel) return toast.error('Ese cliente no tiene teléfono registrado')
    const nombre = String(o.cliente_nombre || '').split(' ')[0]
    const donde = o.entrega_domicilio
      ? `Te lo llevamos cuando nos digas: la ruta pasa de 13:30 a 14:30 y de 19:00 a 21:00.`
      : `Puedes pasar a retirarlo al local, de lunes a viernes de 10:00 a 13:30 y de 14:30 a 18:30, y el sábado hasta las 13:40.`
    const saldo = Number(o.saldo_pendiente) > 0 ? ` Queda un saldo de ${fmt(o.saldo_pendiente)}.` : ''
    const msg = `Hola ${nombre}, tu pedido ${ot(o.id)} de Ladys Lavandería está listo desde hace ${o.dias_atraso} ${o.dias_atraso === 1 ? 'día' : 'días'}. ${donde}${saldo}`
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const marcarEntregada = async (o: any) => {
    if (!confirm(`¿Confirmas que ${ot(o.id)} de ${o.cliente_nombre} ya fue entregada?`)) return
    try {
      await ordenesApi.cambiarEstado(o.id, { estado: 'ENTREGADA' })
      toast.success(`${ot(o.id)} marcada como entregada`)
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo marcar') }
  }

  const guardarReagenda = async () => {
    try {
      await ordenesApi.update(reagendar.id, {
        fecha_entrega: reagendar.fecha_entrega,
        ruta_entrega_id: reagendar.ruta_entrega_id || null,
      })
      toast.success(`Pedido ${ot(reagendar.id)} reagendado`)
      setReagendar(null); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo reagendar') }
  }

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
          <h1 className="text-2xl font-bold text-gray-800">
            {tipo === 'particular' ? 'Se lo llevaron sin pagar'
             : tipo === 'empresa'  ? 'Empresas en mora'
             : tipo === 'despacho' ? 'Despachos que quedaron pendientes'
             : tipo === 'listos'   ? 'Listos esperando entrega'
             : 'Por cobrar'}
          </h1>
          {tipo && (
            <p className="text-xs text-gray-400 mt-0.5">
              {tipo === 'particular'
                ? 'Particulares sin crédito que ya recibieron su pedido.'
                : tipo === 'despacho'
                ? 'Iban a domicilio, su fecha de entrega ya pasó y siguen sin salir. Hay que reprogramarlos.'
                : tipo === 'listos'
                ? 'Ropa terminada esperando que el cliente la retire o que salga en ruta. Los más antiguos primero.'
                : 'Con crédito vencido, o sin crédito y ya entregadas.'}
              {' '}
              <button onClick={() => navigate('/por-cobrar')} className="underline">ver todo</button>
            </p>
          )}
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

      {(tipo === 'despacho' || tipo === 'listos') ? (
        <div className="space-y-2">
          {ordenes.map((o: any) => (
            <div key={o.id} className="bg-white rounded-xl border p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button onClick={() => navigate(`/ordenes/${o.id}`)} className="font-semibold text-gray-800 hover:underline">
                    {ot(o.id)} · {o.cliente_nombre}
                  </button>
                  <p className="text-xs text-gray-500">{o.direccion_entrega || 'sin dirección'}</p>
                  <p className="text-xs text-gray-400">
                    Era para el {fechaCorta(o.fecha_entrega)}{o.ruta_entrega ? ` · ${o.ruta_entrega}` : ''}
                  </p>
                </div>
                <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-1 shrink-0">
                  {o.dias_atraso} {o.dias_atraso === 1 ? 'día' : 'días'}
                </span>
              </div>
              {o.detalle && <p className="text-xs text-gray-500">{o.detalle}</p>}
              {tipo === 'despacho' ? (
                <button
                  onClick={() => setReagendar({ id: o.id, fecha_entrega: hoy(), ruta_entrega_id: '' })}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  Reagendar entrega
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => recordar(o)}
                    className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-green-700 border-green-300 flex items-center justify-center gap-1.5">
                    <MessageCircle size={15} /> Recordar
                  </button>
                  <button onClick={() => marcarEntregada(o)}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                    Marcar entregada
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (<>
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
      </>)}

      {reagendar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
             onClick={() => setReagendar(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 space-y-3"
               onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800">Reagendar {ot(reagendar.id)}</h2>
            <div>
              <label className="text-xs text-gray-500">Nueva fecha de entrega</label>
              <input type="date" value={reagendar.fecha_entrega}
                     onChange={e => setReagendar({ ...reagendar, fecha_entrega: e.target.value, ruta_entrega_id: '' })}
                     className="w-full border rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Ruta</label>
              <select value={reagendar.ruta_entrega_id}
                      onChange={e => setReagendar({ ...reagendar, ruta_entrega_id: e.target.value })}
                      className="w-full border rounded-xl px-3 py-2 text-sm">
                <option value="">Sin ruta asignada</option>
                {rutasDelDia(reagendar.fecha_entrega).map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
              {rutasDelDia(reagendar.fecha_entrega).length === 0 && (
                <p className="text-[11px] text-amber-700 mt-1">Ese día no hay ruta. Elige otra fecha.</p>
              )}
            </div>
            <button onClick={guardarReagenda} className="w-full py-3 rounded-xl text-white font-medium"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  )
}
