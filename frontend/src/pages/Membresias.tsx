import { useEffect, useState } from 'react'
import { clientesApi, prepagosApi, ordenesApi, serviciosApi } from '../services/api'
import toast from 'react-hot-toast'
import { CreditCard, Plus, TrendingDown, TrendingUp, X, Save, Package, ChevronRight, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '../services/api'

const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0)

export default function Membresias() {
  const [saldos, setSaldos] = useState<any[]>([])
  const [planes, setPlanes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [servicios, setServicios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<string | null>(null)
  const [selMemb, setSelMemb] = useState<any>(null)
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [form, setForm] = useState<any>({})

  const load = async () => {
    setLoading(true)
    try {
      const [s, p, c, sv] = await Promise.all([
        prepagosApi.saldos(), prepagosApi.planes(),
        clientesApi.getAll(), serviciosApi.getAll()
      ])
      setSaldos(s.data); setPlanes(p.data)
      setClientes(c.data); setServicios(sv.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const abrirDetalle = async (m: any) => {
    setSelMemb(m)
    const { data } = await api.get(`/prepagos/${m.id}/movimientos`)
    setMovimientos(data)
    setModal('detalle')
  }

  const activarMembresia = async () => {
    if (!form.cliente_id || !form.plan_id || !form.monto_pagado)
      return toast.error('Completa cliente, plan y monto')
    try {
      await api.post('/prepagos/activar', {
        cliente_id: Number(form.cliente_id),
        plan_id: Number(form.plan_id),
        fecha_inicio: form.fecha_inicio || new Date().toISOString().split('T')[0],
        monto_pagado: Number(form.monto_pagado)
      })
      toast.success('Membresía activada')
      setModal(null); setForm({}); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  const recargar = async () => {
    if (!form.monto) return toast.error('Ingresa el monto')
    try {
      await api.post(`/prepagos/${selMemb.id}/recargar`, { monto: Number(form.monto) })
      toast.success('Saldo recargado')
      setModal(null); setForm({}); load(); abrirDetalle(selMemb)
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  const crearOrdenMembresia = async () => {
    if (!form.items?.length) return toast.error('Agrega al menos un servicio')
    try {
      const total = form.items.reduce((s: number, i: any) => s + i.subtotal, 0)
      // Crear orden
      const { data: orden } = await ordenesApi.create({
        cliente_id: selMemb.cliente_id,
        items: form.items,
        tipo_doc: 'BOLETA',
        observaciones: 'Orden membresía',
        monto_delivery: 0
      })
      // Consumir saldo
      await api.post(`/prepagos/${selMemb.id}/consumir`, { monto: total, orden_id: orden.id })
      toast.success(`OT #${String(orden.id).padStart(5,'0')} creada y descontada de membresía`)
      setModal(null); setForm({}); load(); abrirDetalle(selMemb)
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  const addItem = (serv: any) => {
    const items = form.items || []
    const ex = items.find((i: any) => i.servicio_id === serv.id)
    if (ex) {
      setForm({ ...form, items: items.map((i: any) => i.servicio_id === serv.id
        ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unit } : i) })
    } else {
      setForm({ ...form, items: [...items, { servicio_id: serv.id, nombre: serv.nombre, cantidad: 1, precio_unit: serv.precio_lav_planch || 0, subtotal: serv.precio_lav_planch || 0 }] })
    }
  }

  const pctSaldo = (m: any) => m.saldo_inicial > 0 ? Math.round(m.saldo_actual / m.saldo_inicial * 100) : 0
  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Membresías</h1>
          <p className="text-gray-500 text-sm">{saldos.length} activas</p>
        </div>
        <button onClick={() => { setForm({ fecha_inicio: hoy }); setModal('nueva') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-sm"
          style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
          <Plus size={16} /> Nueva membresía
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div>
      ) : saldos.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CreditCard size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No hay membresías activas</p>
          <p className="text-sm">Crea la primera membresía con el botón de arriba</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {saldos.map(m => {
            const pct = pctSaldo(m)
            const vencida = m.fecha_venc < hoy
            const proxVencer = !vencida && Math.ceil((new Date(m.fecha_venc).getTime() - Date.now()) / 86400000) <= 5
            return (
              <div key={m.id} onClick={() => abrirDetalle(m)}
                className="bg-white rounded-2xl p-5 shadow-sm border hover:shadow-md cursor-pointer transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                      {m.cliente?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{m.cliente}</p>
                      <p className="text-xs text-gray-500">{m.plan}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-pink-600">{fmt(m.saldo_actual)}</p>
                    <p className="text-xs text-gray-400">de {fmt(m.saldo_inicial)}</p>
                  </div>
                </div>

                <div className="h-3 bg-gray-100 rounded-full mb-2">
                  <div className="h-3 rounded-full transition-all"
                    style={{ width: `${Math.max(pct, 2)}%`, background: pct > 30 ? 'linear-gradient(90deg,#E8177A,#A87BC8)' : pct > 10 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium ${pct > 30 ? 'text-pink-600' : pct > 10 ? 'text-yellow-600' : 'text-red-500'}`}>{pct}% disponible</span>
                  <div className="flex items-center gap-2">
                    {vencida && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Vencida</span>}
                    {proxVencer && !vencida && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><AlertCircle size={10}/>Vence pronto</span>}
                    <span className="text-gray-400">Vence {format(new Date(m.fecha_venc + 'T12:00:00'), 'd MMM yyyy', { locale: es })}</span>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL DETALLE */}
      {modal === 'detalle' && selMemb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800">{selMemb.cliente}</h2>
                <p className="text-sm text-gray-500">{selMemb.plan}</p>
              </div>
              <button onClick={() => setModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Saldo */}
            <div className="p-5 border-b">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-xs text-gray-500">Saldo disponible</p>
                  <p className="text-3xl font-bold text-pink-600">{fmt(selMemb.saldo_actual)}</p>
                  <p className="text-xs text-gray-400">de {fmt(selMemb.saldo_inicial)} inicial</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>Inicio: {format(new Date(selMemb.fecha_inicio + 'T12:00:00'), 'd MMM yyyy', { locale: es })}</p>
                  <p>Vence: {format(new Date(selMemb.fecha_venc + 'T12:00:00'), 'd MMM yyyy', { locale: es })}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setForm({}); setModal('nueva-orden') }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  <Package size={15} /> Nueva OT
                </button>
                <button onClick={() => { setForm({}); setModal('recargar') }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium">
                  <TrendingUp size={15} /> Recargar
                </button>
              </div>
            </div>

            {/* Movimientos */}
            <div className="p-5">
              <p className="text-xs font-semibold text-gray-500 mb-3">HISTORIAL DE MOVIMIENTOS</p>
              {movimientos.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">Sin movimientos aún</p>
              ) : (
                <div className="space-y-2">
                  {movimientos.map(mv => (
                    <div key={mv.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${mv.tipo === 'CONSUMO' ? 'bg-red-50' : 'bg-green-50'}`}>
                          {mv.tipo === 'CONSUMO'
                            ? <TrendingDown size={14} className="text-red-500" />
                            : <TrendingUp size={14} className="text-green-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{mv.tipo === 'CONSUMO' ? `OT #${String(mv.ot_numero || '').padStart(5,'0')}` : mv.tipo}</p>
                          <p className="text-xs text-gray-400">{format(new Date(mv.creado_en), 'd MMM yyyy HH:mm', { locale: es })}</p>
                        </div>
                      </div>
                      <p className={`font-bold text-sm ${mv.tipo === 'CONSUMO' ? 'text-red-500' : 'text-green-600'}`}>
                        {mv.tipo === 'CONSUMO' ? '-' : '+'}{fmt(mv.monto)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA OT MEMBRESÍA */}
      {modal === 'nueva-orden' && selMemb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="font-bold">Nueva OT — {selMemb.cliente}</h2>
                <p className="text-xs text-green-600 font-medium">Saldo: {fmt(selMemb.saldo_actual)}</p>
              </div>
              <button onClick={() => { setModal('detalle') }}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Servicios</p>
                <div className="flex flex-wrap gap-2">
                  {servicios.map(s => (
                    <button key={s.id} type="button" onClick={() => addItem(s)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-pink-100 hover:text-pink-700 rounded-lg text-xs transition-colors">
                      <Plus size={11} /> {s.nombre} <span className="text-gray-400">{fmt(s.precio_lav_planch)}</span>
                    </button>
                  ))}
                </div>
              </div>
              {(form.items || []).length > 0 && (
                <div className="space-y-2">
                  {(form.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                      <p className="text-sm font-medium flex-1">{item.nombre}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">x{item.cantidad}</span>
                        <p className="text-sm font-bold text-pink-600">{fmt(item.subtotal)}</p>
                        <button onClick={() => setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) })}
                          className="text-red-300 hover:text-red-500"><X size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total a descontar</span>
                    <span className="text-pink-600">{fmt((form.items || []).reduce((s: number, i: any) => s + i.subtotal, 0))}</span>
                  </div>
                  {(form.items || []).reduce((s: number, i: any) => s + i.subtotal, 0) > selMemb.saldo_actual && (
                    <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12}/> Saldo insuficiente</p>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
                <input value={form.observaciones || ''} onChange={e => setForm({ ...form, observaciones: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={crearOrdenMembresia}
                  disabled={(form.items || []).reduce((s: number, i: any) => s + i.subtotal, 0) > selMemb.saldo_actual || !(form.items || []).length}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  <Save size={14} /> Crear OT y descontar
                </button>
                <button onClick={() => setModal('detalle')} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECARGAR */}
      {modal === 'recargar' && selMemb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Recargar membresía</h2>
              <button onClick={() => setModal('detalle')}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{selMemb.cliente} — Saldo actual: <strong className="text-pink-600">{fmt(selMemb.saldo_actual)}</strong></p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Monto a recargar</label>
                <input type="number" value={form.monto || ''} onChange={e => setForm({ ...form, monto: e.target.value })}
                  placeholder="$0" className="w-full border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-300 text-lg font-bold" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[20000, 30000, 50000, 100000].map(v => (
                  <button key={v} onClick={() => setForm({ ...form, monto: v })}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-pink-100 hover:text-pink-700 rounded-lg text-xs transition-colors">
                    {fmt(v)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={recargar} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
                  <TrendingUp size={14} className="inline mr-1" /> Confirmar recarga
                </button>
                <button onClick={() => setModal('detalle')} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA MEMBRESÍA */}
      {modal === 'nueva' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">Activar membresía</h2>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cliente</label>
                <select value={form.cliente_id || ''} onChange={e => setForm({ ...form, cliente_id: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none">
                  <option value="">Seleccionar cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Plan</label>
                <select value={form.plan_id || ''} onChange={e => {
                  const p = planes.find(x => x.id === Number(e.target.value))
                  setForm({ ...form, plan_id: e.target.value, monto_pagado: p?.precio || '' })
                }} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none">
                  <option value="">Seleccionar plan</option>
                  {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} — {fmt(p.precio)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Monto pagado</label>
                  <input type="number" value={form.monto_pagado || ''} onChange={e => setForm({ ...form, monto_pagado: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fecha inicio</label>
                  <input type="date" value={form.fecha_inicio || hoy} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={activarMembresia}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  <Save size={14} /> Activar
                </button>
                <button onClick={() => setModal(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
