import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientesApi, serviciosApi, rutasApi, ordenesApi, formasPagoApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Search, Plus, Trash2, Save } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

export default function NuevaOrden() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<any[]>([])
  const [servicios, setServicios] = useState<any[]>([])
  const [rutas, setRutas] = useState<any[]>([])
  const [clienteQ, setClienteQ] = useState('')
  const [clienteSel, setClienteSel] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [form, setForm] = useState<any>({ tipo_doc: 'BOLETA', bultos: 1, monto_delivery: 0 })
  const [loading, setLoading] = useState(false)
  const [showClientes, setShowClientes] = useState(false)

  useEffect(() => {
    Promise.all([serviciosApi.getAll(), rutasApi.getAll()])
      .then(([s, r]) => { setServicios(s.data); setRutas(r.data) })
  }, [])

  const buscarClientes = async (q: string) => {
    setClienteQ(q)
    if (q.length < 2) { setClientes([]); return }
    const { data } = await clientesApi.getAll(q)
    setClientes(data)
    setShowClientes(true)
  }

  const addItem = (servicio: any) => {
    setItems(prev => {
      const ex = prev.find(i => i.servicio_id === servicio.id)
      if (ex) return prev.map(i => i.servicio_id === servicio.id ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad+1)*i.precio_unit } : i)
      return [...prev, { servicio_id: servicio.id, nombre: servicio.nombre, cantidad: 1, precio_unit: servicio.precio_lav_planch || 0, subtotal: servicio.precio_lav_planch || 0 }]
    })
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_,i) => i !== idx))
  const updateCantidad = (idx: number, v: number) => setItems(prev => prev.map((i,n) => n===idx ? {...i, cantidad:v, subtotal:v*i.precio_unit} : i))
  const updatePrecio = (idx: number, v: number) => setItems(prev => prev.map((i,n) => n===idx ? {...i, precio_unit:v, subtotal:i.cantidad*v} : i))

  const total = items.reduce((s,i) => s + i.subtotal, 0) + Number(form.monto_delivery||0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteSel) return toast.error('Selecciona un cliente')
    if (items.length === 0) return toast.error('Agrega al menos un servicio')
    setLoading(true)
    try {
      const { data } = await ordenesApi.create({ ...form, cliente_id: clienteSel.id, items })
      toast.success(`OT #${String(data.id).padStart(5,'0')} creada`)
      navigate(`/ordenes/${data.id}`)
    } catch { toast.error('Error al crear la orden') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ordenes')} className="p-2 rounded-xl hover:bg-gray-100"><ArrowLeft size={18}/></button>
        <h1 className="text-xl font-bold text-gray-800">Nueva Orden de Trabajo</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-sm font-semibold text-gray-700 mb-3">Cliente</p>
          {clienteSel ? (
            <div className="flex items-center justify-between bg-pink-50 rounded-xl p-3">
              <div>
                <p className="font-semibold text-gray-800">{clienteSel.nombre} {clienteSel.apellido}</p>
                <p className="text-xs text-gray-500">{clienteSel.telefono}</p>
              </div>
              <button type="button" onClick={() => setClienteSel(null)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={14}/>
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={clienteQ} onChange={e => buscarClientes(e.target.value)}
                placeholder="Buscar cliente..." autoComplete="off"
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none"/>
              {showClientes && clientes.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {clientes.map(c => (
                    <button type="button" key={c.id} onClick={() => { setClienteSel(c); setShowClientes(false); setClienteQ('') }}
                      className="w-full text-left px-4 py-2.5 hover:bg-pink-50 text-sm border-b last:border-0">
                      <p className="font-medium">{c.nombre} {c.apellido}</p>
                      <p className="text-xs text-gray-400">{c.telefono}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Servicios */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-sm font-semibold text-gray-700 mb-3">Servicios</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {servicios.map(s => (
              <button type="button" key={s.id} onClick={() => addItem(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-pink-100 hover:text-pink-700 rounded-lg text-xs transition-colors">
                <Plus size={12}/> {s.nombre} <span className="text-gray-400">{fmt(s.precio_lav_planch)}</span>
              </button>
            ))}
          </div>
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item,idx) => (
                <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <p className="flex-1 text-sm font-medium">{item.nombre}</p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updateCantidad(idx, Math.max(1, item.cantidad-1))}
                      className="w-7 h-7 rounded-lg bg-gray-200 text-sm font-bold hover:bg-gray-300 flex items-center justify-center">-</button>
                    <span className="w-8 text-center text-sm">{item.cantidad}</span>
                    <button type="button" onClick={() => updateCantidad(idx, item.cantidad+1)}
                      className="w-7 h-7 rounded-lg bg-gray-200 text-sm font-bold hover:bg-gray-300 flex items-center justify-center">+</button>
                  </div>
                  <input type="number" value={item.precio_unit} onChange={e => updatePrecio(idx, Number(e.target.value))}
                    className="w-28 border rounded-lg px-2 py-1 text-sm text-right"/>
                  <p className="w-24 text-sm font-bold text-right text-pink-600">{fmt(item.subtotal)}</p>
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detalles */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-sm font-semibold text-gray-700 mb-3">Detalles de la orden</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo documento</label>
              <select value={form.tipo_doc} onChange={e => setForm({...form, tipo_doc: e.target.value})}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300">
                <option>BOLETA</option><option>FACTURA</option><option>SIN_DOCUMENTO</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bultos</label>
              <input type="number" min="1" value={form.bultos} onChange={e => setForm({...form, bultos: Number(e.target.value)})}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha retiro</label>
              <input type="date" value={form.fecha_recogida||''} onChange={e => setForm({...form, fecha_recogida: e.target.value})}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha entrega</label>
              <input type="date" value={form.fecha_entrega||''} onChange={e => setForm({...form, fecha_entrega: e.target.value})}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Ruta retiro</label>
              <select value={form.ruta_recogida_id||''} onChange={e => setForm({...form, ruta_recogida_id: e.target.value||null})}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300">
                <option value="">-- Sin ruta --</option>
                {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre} ({r.dia_semana})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Delivery</label>
              <input type="number" value={form.monto_delivery||0} onChange={e => setForm({...form, monto_delivery: Number(e.target.value)})}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
              <textarea value={form.observaciones||''} onChange={e => setForm({...form, observaciones: e.target.value})} rows={2}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300 resize-none"/>
            </div>
          </div>
        </div>

        {/* Total y botón */}
        <div className="bg-white rounded-xl p-5 shadow-sm border flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total orden</p>
            <p className="text-3xl font-bold text-pink-600">{fmt(total)}</p>
          </div>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, #E8177A, #A87BC8)' }}>
            <Save size={16}/> {loading ? 'Guardando...' : 'Crear OT'}
          </button>
        </div>
      </form>
    </div>
  )
}
