import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clubApi, clientesApi, prepagosApi, serviciosApi, ordenesApi } from '../services/api'
import api from '../services/api'
import toast from 'react-hot-toast'
import { CreditCard, Plus, X, Save, Package, AlertCircle, Gift, BarChart2, RefreshCw, Scale, TrendingUp, Ban, Link2 } from 'lucide-react'
import { fmt, fechaCorta, fechaHora, ot } from '../utils'

const hoy = () => new Date().toLocaleDateString('en-CA')
const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300'

export default function Membresias() {
  const navigate = useNavigate()
  const [lista, setLista] = useState<any[]>([])
  const [planes, setPlanes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [servicios, setServicios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<string | null>(null)
  const [sel, setSel] = useState<any>(null)
  const [movs, setMovs] = useState<any[]>([])
  const [form, setForm] = useState<any>({})

  const load = async () => {
    setLoading(true)
    try {
      const [e, p, c, sv] = await Promise.all([clubApi.estado(), prepagosApi.planes(), clientesApi.getAll(), serviciosApi.getAll()])
      setLista(e.data); setPlanes(p.data); setClientes(c.data); setServicios(sv.data)
    } catch { toast.error('No se pudo cargar') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const verMovs = async (m: any) => {
    setSel(m)
    const { data } = await clubApi.movimientos(m.id)
    setMovs(data); setModal('movs')
  }

  const activar = async (reemplazar = false) => {
    if (!form.cliente_id || !form.plan_id) return toast.error('Elige cliente y plan')
    try {
      await clubApi.activar({ cliente_id: Number(form.cliente_id), plan_id: Number(form.plan_id), fecha_inicio: form.fecha_inicio || hoy(), monto_pagado: Number(form.monto_pagado || 0), reemplazar })
      toast.success('Membresía activada'); setModal(null); setForm({}); load()
    } catch (e: any) {
      const d = e.response?.data
      if (d?.codigo === 'YA_TIENE' && confirm(`${d.error}\n\n¿Reemplazarla por la nueva?`)) return activar(true)
      toast.error(d?.error || 'Error')
    }
  }

  const renovar = async (m: any) => {
    if (!confirm(`Renovar ${m.plan} de ${m.cliente} por ${fmt(m.precio_plan)}?\n\nEl cupo vuelve a ${m.plan_kilos > 0 ? m.plan_kilos + ' kilos' : 'sin tope'} y arranca un nuevo mes.`)) return
    try { await clubApi.renovar(m.id, { fecha_inicio: hoy() }); toast.success('Ciclo renovado'); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  const cancelar = async (m: any) => {
    if (!confirm(`Dar de baja la membresía de ${m.cliente}?`)) return
    try { await clubApi.cancelar(m.id); toast.success('Membresía dada de baja'); load() }
    catch { toast.error('Error') }
  }

  // Nueva OT descontando kilos del plan
  const crearOTKilos = async () => {
    const kilos = Number(String(form.kilos).replace(',', '.') || 0)
    if (!(kilos > 0)) return toast.error('Ingresa los kilos')
    try {
      const sv = servicios.find((x: any) => /^CARGA 1 KILO$/i.test(x.nombre))
      const pu = Number(sv?.precio_lav_secado || 2900)
      const { data: orden } = await ordenesApi.create({
        cliente_id: sel.cliente_id, kilos, es_membresia: true,
        items: [{ servicio_id: sv?.id || null, nombre: 'Lavado por kilo (plan)', cantidad: kilos, precio_unit: pu }],
        observaciones: form.observaciones || `${sel.plan}`,
      })
      const { data: r } = await clubApi.consumir(sel.id, { kilos, orden_id: orden.id })
      toast.success(r.monto_extra > 0
        ? `OT ${ot(orden.id)} · ${r.kilos_cubiertos} kg del plan + ${r.kilos_extra} kg extra (${fmt(r.monto_extra)} por cobrar)`
        : `OT ${ot(orden.id)} · ${r.kilos_cubiertos} kg del plan, sin costo`)
      setModal(null); setForm({}); load()
      navigate(`/ordenes/${orden.id}`)
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  // Nueva OT descontando saldo (modalidad antigua)
  const crearOTSaldo = async () => {
    const items = form.items || []
    if (!items.length) return toast.error('Agrega servicios')
    const total = items.reduce((s: number, i: any) => s + i.subtotal, 0)
    if (total > Number(sel.saldo_actual)) return toast.error('Saldo insuficiente')
    try {
      const { data: orden } = await ordenesApi.create({ cliente_id: sel.cliente_id, items, es_membresia: true })
      await api.post(`/prepagos/${sel.id}/consumir`, { monto: total, orden_id: orden.id })
      toast.success(`OT ${ot(orden.id)} creada · ${fmt(total)} descontado`)
      setModal(null); setForm({}); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  const addItem = (s: any) => {
    const items = form.items || []
    const p = Number(s.precio_lav_planch || s.precio_lav_secado || 0)
    const ex = items.find((i: any) => i.servicio_id === s.id)
    setForm({ ...form, items: ex
      ? items.map((i: any) => i.servicio_id === s.id ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unit } : i)
      : [...items, { servicio_id: s.id, nombre: s.nombre, cantidad: 1, precio_unit: p, subtotal: p }] })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Membresías · El Club</h1>
          <p className="text-gray-500 text-sm">{lista.length} activas</p>
        </div>
        <button onClick={() => { setForm({ fecha_inicio: hoy() }); setModal('nueva') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
          <Plus size={16} /> Activar plan
        </button>
      </div>

      {loading ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div>
        : lista.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <CreditCard size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No hay membresías activas</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {lista.map(m => {
              const kilos = m.modalidad === 'KILOS'
              const restantes = Number(m.kilos_restantes ?? 0)
              const pct = kilos ? (m.sin_tope ? 100 : m.pct) : (Number(m.saldo_inicial) > 0 ? Math.round(Number(m.saldo_actual) / Number(m.saldo_inicial) * 100) : 0)
              return (
                <div key={m.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                          {String(m.cliente)[0]?.toUpperCase()}
                        </div>
                        <div>
                          <button onClick={() => navigate(`/clientes/${m.cliente_id}`)} className="font-bold text-gray-800 text-lg hover:text-pink-600">{m.cliente}</button>
                          <p className="text-xs text-gray-500">{m.plan} · {fmt(m.precio_plan)}/mes</p>
                          <div className="flex gap-1.5 mt-1">
                            {m.vencida && <span className="text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Ciclo vencido</span>}
                            {Number(m.extra_ciclo) > 0 && <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{fmt(m.extra_ciclo)} en excedentes</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {kilos ? (
                          m.sin_tope
                            ? <><p className="text-2xl font-bold text-pink-600">Sin tope</p><p className="text-xs text-gray-400">{Number(m.kilos_usados)} kg este ciclo</p></>
                            : <><p className="text-3xl font-bold text-pink-600">{restantes}<span className="text-lg text-gray-400"> kg</span></p><p className="text-xs text-gray-400">de {Number(m.kilos_incluidos)} kg disponibles</p></>
                        ) : (
                          <><p className="text-3xl font-bold text-pink-600">{fmt(m.saldo_actual)}</p><p className="text-xs text-gray-400">de {fmt(m.saldo_inicial)}</p></>
                        )}
                      </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full mb-1">
                      <div className="h-3 rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: pct > 40 ? 'linear-gradient(90deg,#E8177A,#A87BC8)' : pct > 15 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{m.ordenes_ciclo || 0} órdenes este ciclo</span>
                      <span>Ciclo hasta {fechaCorta(m.ciclo_fin)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 border-t divide-x">
                    <button onClick={() => { setSel(m); setForm({ kilos: '' }); setModal(kilos ? 'ot-kilos' : 'ot-saldo') }}
                      className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-pink-600 hover:bg-pink-50"><Package size={14} /> Nueva OT</button>
                    <button onClick={() => verMovs(m)} className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50"><BarChart2 size={14} /> Historial</button>
                    <button onClick={() => renovar(m)} className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-green-600 hover:bg-green-50"><RefreshCw size={14} /> Renovar</button>
                    <button onClick={() => cancelar(m)} className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-red-500 hover:bg-red-50"><Ban size={14} /> Baja</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {/* Nueva OT por kilos */}
      {modal === 'ot-kilos' && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div><h2 className="font-bold">Nueva OT · {sel.cliente}</h2><p className="text-xs text-gray-500">{sel.plan}{sel.sin_tope ? ' · sin tope' : ` · ${Number(sel.kilos_restantes)} kg disponibles`}</p></div>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="flex items-center gap-2">
              <Scale size={18} className="text-pink-500" />
              <input type="number" step="0.1" inputMode="decimal" value={form.kilos || ''} onChange={e => setForm({ ...form, kilos: e.target.value })}
                placeholder="0.0" className="flex-1 border rounded-xl px-3 py-3 text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-pink-300" />
              <span className="text-gray-500">kg</span>
            </div>
            {!sel.sin_tope && Number(form.kilos) > Number(sel.kilos_restantes) && (
              <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-700 flex items-start gap-1.5">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                Se pasa por {(Number(form.kilos) - Number(sel.kilos_restantes)).toFixed(1)} kg. Se cobrarán {fmt((Number(form.kilos) - Number(sel.kilos_restantes)) * Number(sel.kilo_adicional))} de excedente.
              </p>
            )}
            <input value={form.observaciones || ''} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" className={inp} />
            <button onClick={crearOTKilos} className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              <Save size={15} className="inline mr-1.5" /> Crear OT y descontar kilos
            </button>
          </div>
        </div>
      )}

      {/* Nueva OT por saldo */}
      {modal === 'ot-saldo' && sel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="font-bold">Nueva OT · {sel.cliente}</h2><p className="text-xs text-green-600 font-semibold">Saldo {fmt(sel.saldo_actual)}</p></div>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            {['CARGAS', 'DORMITORIO', 'VESTIR', 'TINTORERIA', 'ESPECIALES'].map(cat => {
              const items = servicios.filter((s: any) => s.categoria === cat)
              if (!items.length) return null
              return (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-400 mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((s: any) => (
                      <button key={s.id} onClick={() => addItem(s)} className="px-2.5 py-1 bg-gray-100 hover:bg-pink-100 rounded-lg text-xs">
                        + {s.nombre} <span className="text-gray-400">{fmt(s.precio_lav_planch || s.precio_lav_secado)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {(form.items || []).length > 0 && (
              <div className="border rounded-xl divide-y">
                {form.items.map((i: any, n: number) => (
                  <div key={n} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{i.nombre} × {i.cantidad}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-pink-600">{fmt(i.subtotal)}</span>
                      <button onClick={() => setForm({ ...form, items: form.items.filter((_: any, x: number) => x !== n) })} className="text-red-300"><X size={13} /></button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 bg-gray-50 font-bold">
                  <span>Total</span><span className="text-pink-600">{fmt(form.items.reduce((s: number, i: any) => s + i.subtotal, 0))}</span>
                </div>
              </div>
            )}
            <button onClick={crearOTSaldo} className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              <Save size={15} className="inline mr-1.5" /> Crear OT y descontar saldo
            </button>
          </div>
        </div>
      )}

      {/* Historial */}
      {modal === 'movs' && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white flex items-center justify-between">
              <div><h2 className="font-bold">{sel.cliente}</h2><p className="text-xs text-gray-500">{sel.plan} · ciclo {sel.ciclos}</p></div>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-2">
              {movs.map(mv => (
                <div key={mv.id} className="flex items-start justify-between gap-2 py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {mv.tipo === 'CONSUMO_KILOS' ? `OT ${ot(mv.ot_numero || 0)}` : mv.tipo === 'EXTRA' ? 'Excedente' : mv.tipo === 'RENOVACION' ? 'Renovación' : mv.tipo === 'CARGA' ? 'Activación' : mv.tipo}
                    </p>
                    <p className="text-xs text-gray-400">{mv.detalle}</p>
                    <p className="text-[11px] text-gray-300">{fechaHora(mv.creado_en)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {Number(mv.kilos) > 0 && <p className="text-sm font-bold text-purple-600">{Number(mv.kilos)} kg</p>}
                    {Number(mv.monto) > 0 && <p className="text-xs font-medium text-gray-600">{fmt(mv.monto)}</p>}
                  </div>
                </div>
              ))}
              {!movs.length && <p className="text-sm text-gray-400 text-center py-8">Sin movimientos</p>}
            </div>
          </div>
        </div>
      )}

      {/* Activar plan */}
      {modal === 'nueva' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Activar plan del Club</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cliente</label>
              <select value={form.cliente_id || ''} onChange={e => setForm({ ...form, cliente_id: e.target.value })} className={inp}>
                <option value="">Seleccionar cliente</option>
                {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Plan</label>
              <div className="space-y-1.5">
                {planes.map((p: any) => (
                  <button key={p.id} onClick={() => setForm({ ...form, plan_id: p.id, monto_pagado: p.precio })}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border ${String(form.plan_id) === String(p.id) ? 'border-pink-400 bg-pink-50' : ''}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{p.nombre}</span>
                      <span className="font-bold text-pink-600 text-sm">{fmt(p.precio)}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {p.modalidad === 'KILOS'
                        ? (Number(p.kilos_incluidos) > 0 ? `${Number(p.kilos_incluidos)} kilos · adicional ${fmt(p.kilo_adicional)}/kg` : 'Sin tope de kilos')
                        : 'Saldo consumible a precio de lista'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">Monto pagado</label><input type="number" value={form.monto_pagado || ''} onChange={e => setForm({ ...form, monto_pagado: e.target.value })} className={inp} /></div>
              <div><label className="text-xs text-gray-500">Inicio del ciclo</label><input type="date" value={form.fecha_inicio || hoy()} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} className={inp} /></div>
            </div>
            <button onClick={() => activar(false)} className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              <Save size={15} className="inline mr-1.5" /> Activar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
