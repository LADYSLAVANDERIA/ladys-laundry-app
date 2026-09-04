import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { programacionApi, ordenesApi, formasPagoApi, ordenRutaApi, dirApi } from '../services/api'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, MapPin, Phone, Truck, Store, Zap, Printer, CalendarOff, Package, CheckCircle2, MessageCircle, Navigation, DollarSign, X, Route, Send, ArrowUp, ArrowDown, ListOrdered, Check } from 'lucide-react'
import { fmt, ot, hoy, addDias, fechaLarga, hora, telWa, linkOT, mensajeAviso, mapsLink, ordenarParadas, rutaCompletaMaps, pesoSector } from '../utils'

export default function Programacion() {
  const navigate = useNavigate()
  const [fecha, setFecha] = useState(hoy())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [formas, setFormas] = useState<any[]>([])
  const [cobro, setCobro] = useState<any>(null)
  const [lote, setLote] = useState<any>(null)
  const [ordenManual, setOrdenManual] = useState<Record<string, number>>({})
  const [editandoRuta, setEditandoRuta] = useState<number | null>(null)
  const [secuencia, setSecuencia] = useState<any[]>([])
  const [enviados, setEnviados] = useState<number[]>([])

  const load = async (f = fecha) => {
    setLoading(true)
    try {
      const [{ data }, om, co] = await Promise.all([
        programacionApi.get(f),
        ordenRutaApi.get(f).catch(() => ({ data: {} })),
        dirApi.coordenadas(f).catch(() => ({ data: {} })),
      ])
      const coords: any = co.data || {}
      const pegar = (o: any) => Object.assign(o, coords[String(o.id)] || {})
      data.rutas?.forEach((r: any) => { r.retiros.forEach(pegar); r.entregas.forEach(pegar) })
      data.sin_ruta?.forEach(pegar); data.en_local?.forEach(pegar)
      setData(data); setOrdenManual(om.data || {})
    }
    catch { toast.error('No se pudo cargar la programación') } finally { setLoading(false) }
  }
  useEffect(() => { load(fecha) }, [fecha])
  useEffect(() => { formasPagoApi.getAll().then(r => setFormas(r.data)).catch(() => {}) }, [])

  const cobrar = async () => {
    if (!cobro.forma_pago_id || !Number(cobro.monto)) return toast.error('Elige forma de pago y monto')
    try {
      await ordenesApi.pagar(cobro.id, { forma_pago_id: Number(cobro.forma_pago_id), monto: Number(cobro.monto) })
      toast.success(`Cobrado ${fmt(cobro.monto)} en ${ot(cobro.id)}`)
      setCobro(null); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error al registrar el pago') }
  }
  const avisar = async (o: any, tipo: string) => {
    const link = linkOT(o.id, o.token_publico)
    const msg = mensajeAviso(tipo, o, link)
    const tel = telWa(o.telefono)
    if (!tel) return toast.error('El cliente no tiene teléfono')
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
    ordenesApi.aviso(o.id, { tipo, mensaje: msg }).catch(() => {})
  }

  const marcar = async (id: number, estado: string) => {
    try {
      await ordenesApi.cambiarEstado(id, { estado })
      toast.success(`${ot(id)} ${estado === 'EN_PROCESO' ? 'marcada como retirada' : 'entregada'} · avisa al cliente con el botón de WhatsApp`, { duration: 4000 })
      load()
    }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  const ordenar = (lista: any[], campo: 'dir_retiro' | 'dir_entrega') => {
    const conManual = lista.filter(o => ordenManual[String(o.id)])
    const sinManual = ordenarParadas(lista.filter(o => !ordenManual[String(o.id)]), campo)
    conManual.sort((a, b) => ordenManual[String(a.id)] - ordenManual[String(b.id)])
    return [...conManual, ...sinManual]
  }

  const abrirOrden = (r: any) => {
    const paradas = [...ordenar(r.retiros, 'dir_retiro').map((o: any) => ({ ...o, _t: 'Retiro', _dir: o.dir_retiro })),
                     ...ordenar(r.entregas, 'dir_entrega').map((o: any) => ({ ...o, _t: 'Entrega', _dir: o.dir_entrega }))]
    setSecuencia(paradas); setEditandoRuta(r.id)
  }
  const mover = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= secuencia.length) return
    const s2 = [...secuencia]; const tmp = s2[i]; s2[i] = s2[j]; s2[j] = tmp; setSecuencia(s2)
  }
  const guardarOrden = async () => {
    try {
      await ordenRutaApi.set(secuencia.map(o => o.id))
      toast.success('Orden de la ruta guardado')
      setEditandoRuta(null); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo guardar') }
  }

  const Parada = ({ o, tipo, n }: { o: any; tipo: 'retiro' | 'entrega'; n?: number }) => {
    const dir = tipo === 'retiro' ? o.dir_retiro : o.dir_entrega
    const listoRetiro = tipo === 'retiro' && o.estado === 'PRE_ORDEN'
    const listoEntrega = tipo === 'entrega' && ['EN_PROCESO', 'LISTA'].includes(o.estado)
    return (
      <div className="border rounded-xl p-3 hover:bg-gray-50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/ordenes/${o.id}`)}>
            <div className="flex items-center gap-2 flex-wrap">
              {n !== undefined && <span className="w-5 h-5 rounded-full bg-gray-800 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{n}</span>}
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
            {listoRetiro && <button onClick={() => marcar(o.id, 'EN_PROCESO')} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-orange-100 text-orange-700 font-medium whitespace-nowrap">Retirado</button>}
            {listoEntrega && <button onClick={() => marcar(o.id, 'ENTREGADA')} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium whitespace-nowrap">Entregada</button>}
            {o.estado === 'ENTREGADA' && <CheckCircle2 size={16} className="text-green-500" />}
          </div>
        </div>

        {/* Botonera del conductor */}
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          <a href={o.telefono ? `tel:+${telWa(o.telefono)}` : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium ${o.telefono ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-300 pointer-events-none'}`}>
            <Phone size={16} /> Llamar
          </a>
          <button onClick={() => avisar(o, o.estado === 'ENTREGADA' ? 'ENTREGADA' : (tipo === 'retiro' && o.estado !== 'PRE_ORDEN') ? 'RETIRADO' : 'EN_RUTA')} disabled={!o.telefono}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium ${o.telefono ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`}>
            <MessageCircle size={16} /> WhatsApp
          </button>
          <a href={mapsLink(dir, tipo === 'retiro' ? o.lat_retiro : o.lat_entrega, tipo === 'retiro' ? o.lng_retiro : o.lng_entrega)} target="_blank" rel="noreferrer"
            className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium ${dir ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-300 pointer-events-none'}`}>
            <Navigation size={16} /> Navegar
          </a>
          <button onClick={() => setCobro({ id: o.id, cliente: o.cliente, monto: String(Math.round(Number(o.saldo_pendiente))), forma_pago_id: String(formas.find((f: any) => /efectivo/i.test(f.nombre))?.id || '') })}
            disabled={!(Number(o.saldo_pendiente) > 0)}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium ${Number(o.saldo_pendiente) > 0 ? 'bg-pink-50 text-pink-600' : 'bg-gray-50 text-gray-300'}`}>
            <DollarSign size={16} /> {Number(o.saldo_pendiente) > 0 ? 'Cobrar' : 'Pagada'}
          </button>
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
              {(r.retiros.length + r.entregas.length) > 0 && (
                <div className="px-4 py-2 border-b bg-gray-50 flex gap-2">
                  <a href={rutaCompletaMaps([...ordenar(r.retiros, 'dir_retiro').map((o: any) => o.lat_retiro ? `${o.lat_retiro},${o.lng_retiro}` : o.dir_retiro), ...ordenar(r.entregas, 'dir_entrega').map((o: any) => o.lat_entrega ? `${o.lat_entrega},${o.lng_entrega}` : o.dir_entrega)])}
                    target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-100 text-purple-700 text-xs font-medium">
                    <Route size={13} /> Ruta completa en Maps
                  </a>
                  <button onClick={() => setLote({ ruta: r.nombre, paradas: [...ordenar(r.retiros, 'dir_retiro').map((o: any) => ({ ...o, _tipo: 'retiro' })), ...ordenar(r.entregas, 'dir_entrega').map((o: any) => ({ ...o, _tipo: 'entrega' }))].filter((o: any) => o.telefono) })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-medium">
                    <Send size={13} /> Avisar a todos
                  </button>
                  <button onClick={() => abrirOrden(r)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium">
                    <ListOrdered size={13} /> Orden
                  </button>
                </div>
              )}
              <div className="p-4 space-y-3">
                {r.retiros.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-2 flex items-center gap-1"><Truck size={12} /> RETIROS ({r.retiros.length})</p>
                    <div className="space-y-2">{ordenar(r.retiros, 'dir_retiro').map((o: any, i: number) => <Parada key={o.id} o={o} tipo="retiro" n={i + 1} />)}</div>
                  </div>
                )}
                {r.entregas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-600 mb-2 flex items-center gap-1"><Package size={12} /> ENTREGAS ({r.entregas.length})</p>
                    <div className="space-y-2">{ordenar(r.entregas, 'dir_entrega').map((o: any, i: number) => <Parada key={o.id} o={o} tipo="entrega" n={r.retiros.length + i + 1} />)}</div>
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

      {editandoRuta !== null && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white flex items-center justify-between">
              <div><h2 className="font-bold">Orden de las paradas</h2><p className="text-xs text-gray-500">Mueve con las flechas y guarda</p></div>
              <button onClick={() => setEditandoRuta(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-2">
              {secuencia.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2 border rounded-xl px-3 py-2">
                  <span className="w-6 h-6 rounded-full bg-gray-800 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ot(o.id)} · {o.cliente}</p>
                    <p className="text-xs text-gray-400 truncate">{o._t} · {o._dir || 'sin dirección'}</p>
                  </div>
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button onClick={() => mover(i, -1)} disabled={i === 0} className="p-1 rounded bg-gray-100 disabled:opacity-30"><ArrowUp size={13} /></button>
                    <button onClick={() => mover(i, 1)} disabled={i === secuencia.length - 1} className="p-1 rounded bg-gray-100 disabled:opacity-30"><ArrowDown size={13} /></button>
                  </div>
                </div>
              ))}
              {!secuencia.length && <p className="text-sm text-gray-400 text-center py-6">Esta ruta no tiene paradas</p>}
            </div>
            <div className="p-4 border-t sticky bottom-0 bg-white flex gap-2">
              <button onClick={guardarOrden} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                <Check size={15} /> Guardar orden
              </button>
              <button onClick={() => setEditandoRuta(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {lote && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white flex items-center justify-between">
              <div><h2 className="font-bold">Avisar a los clientes</h2><p className="text-xs text-gray-500">{lote.ruta} · {lote.paradas.length} con teléfono</p></div>
              <button onClick={() => { setLote(null); setEnviados([]) }}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-2">
                WhatsApp no permite enviar varios de una vez. Toca cada uno; el que ya enviaste queda marcado.
              </p>
              {lote.paradas.map((o: any) => {
                const ya = enviados.includes(o.id)
                return (
                  <button key={o.id} onClick={() => { avisar(o, o._tipo === 'retiro' ? 'EN_RUTA' : 'EN_RUTA'); setEnviados(e => [...e, o.id]) }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left ${ya ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'}`}>
                    <div>
                      <p className="text-sm font-medium">{ot(o.id)} · {o.cliente}</p>
                      <p className="text-xs text-gray-400">{o._tipo === 'retiro' ? 'retiro' : 'entrega'}{Number(o.saldo_pendiente) > 0 ? ` · cobrar ${fmt(o.saldo_pendiente)}` : ''}</p>
                    </div>
                    {ya ? <CheckCircle2 size={17} className="text-green-500" /> : <MessageCircle size={17} className="text-green-600" />}
                  </button>
                )
              })}
              {!lote.paradas.length && <p className="text-sm text-gray-400 text-center py-6">Ninguna parada tiene teléfono registrado</p>}
            </div>
          </div>
        </div>
      )}

      {cobro && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div><h2 className="font-bold">Cobrar {ot(cobro.id)}</h2><p className="text-xs text-gray-500">{cobro.cliente}</p></div>
              <button onClick={() => setCobro(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <input type="number" inputMode="numeric" value={cobro.monto} onChange={e => setCobro({ ...cobro, monto: e.target.value })}
              className="w-full border rounded-xl px-3 py-3 text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-pink-300" />
            <div className="grid grid-cols-2 gap-2">
              {formas.filter((f: any) => !/membres/i.test(f.nombre)).map((f: any) => (
                <button key={f.id} onClick={() => setCobro({ ...cobro, forma_pago_id: String(f.id) })}
                  className={`py-2.5 rounded-xl text-sm font-medium border ${String(cobro.forma_pago_id) === String(f.id) ? 'bg-pink-500 text-white border-pink-500' : 'text-gray-600'}`}>
                  {f.nombre}
                </button>
              ))}
            </div>
            <button onClick={cobrar} className="w-full py-3.5 rounded-xl text-white font-semibold" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              Registrar pago
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
