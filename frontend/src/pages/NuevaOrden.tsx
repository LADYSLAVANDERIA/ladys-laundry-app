import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api, { clientesApi, serviciosApi, rutasApi, ordenesApi, formasPagoApi, configApi, retirosApi, fichaApi } from '../services/api'
import ItemsPicker, { buildItems } from '../components/ItemsPicker'
import type { Item } from '../components/ItemsPicker'
import toast from 'react-hot-toast'
import { ArrowLeft, Search, Save, UserPlus, MapPin, Truck, Store, Percent, AlertTriangle, CreditCard, Plus, X, Phone } from 'lucide-react'
import { fmt, hoy, addDiasHabiles, diaSemana, ot, hora } from '../utils'

const RUTA_RET = ['RETIROS_Y_ENTREGAS', 'SOLO_RETIROS'], RUTA_ENT = ['RETIROS_Y_ENTREGAS', 'SOLO_ENTREGAS']
const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300'

export default function NuevaOrden() {
  const navigate = useNavigate(); const [params] = useSearchParams()
  const [servicios, setServicios] = useState<any[]>([]); const [rutas, setRutas] = useState<any[]>([])
  const [formas, setFormas] = useState<any[]>([]); const [config, setConfig] = useState<any>({})
  const [q, setQ] = useState(''); const [resultados, setResultados] = useState<any[]>([]); const [cliente, setCliente] = useState<any>(null)
  const [nuevoCli, setNuevoCli] = useState<any>(null); const [nuevaDir, setNuevaDir] = useState<any>(null)
  const [kilos, setKilos] = useState(''); const [express, setExpress] = useState(false); const [prendas, setPrendas] = useState<Item[]>([])
  const [f, setF] = useState<any>({ retiro_domicilio: false, entrega_domicilio: false, ropa_en_local: true, fecha_recogida: hoy(), ruta_recogida_id: '', fecha_entrega: addDiasHabiles(hoy(), 2), ruta_entrega_id: '', dir_id: '', tipo_doc: 'BOLETA', bultos: 1, monto_delivery: 0, aplicar_descuento: false, observaciones: '' })
  const [pago, setPago] = useState<any>({ ahora: true, forma_pago_id: '', monto: '' })
  const [usarMemb, setUsarMemb] = useState(false); const [loading, setLoading] = useState(false)
  const [convenio, setConvenio] = useState<any[]>([])
  const [cupos, setCupos] = useState<Record<string, Record<number, number>>>({})

  useEffect(() => {
    Promise.all([serviciosApi.getAll(), rutasApi.getAll(), formasPagoApi.getAll(), configApi.get()]).then(([s, r, fp, c]) => {
      setServicios(s.data); setRutas(r.data.filter((x: any) => x.activo !== false)); setFormas(fp.data); setConfig(c.data)
      const ef = fp.data.find((x: any) => /efectivo/i.test(x.nombre)); if (ef) setPago((p: any) => ({ ...p, forma_pago_id: String(ef.id) }))
    }).catch(() => toast.error('No se pudo cargar el catálogo'))
    const cid = params.get('cliente'); if (cid) seleccionar(Number(cid))
  }, [])
  useEffect(() => { setF((p: any) => ({ ...p, fecha_entrega: express ? hoy() : addDiasHabiles(hoy(), 2) })) }, [express])

  const cargarCupos = async (fecha: string) => { try { const { data } = await retirosApi.disponibilidad(fecha); const m: Record<number, number> = {}; data.rutas.forEach((r: any) => { m[r.id] = r.cupos }); setCupos(p => ({ ...p, [fecha]: m })) } catch { /* sin cupos */ } }
  useEffect(() => { if (f.retiro_domicilio && f.fecha_recogida) cargarCupos(f.fecha_recogida) }, [f.fecha_recogida, f.retiro_domicilio])
  useEffect(() => { if (f.entrega_domicilio && f.fecha_entrega) cargarCupos(f.fecha_entrega) }, [f.fecha_entrega, f.entrega_domicilio])

  const buscar = async (v: string) => { setQ(v); if (v.trim().length < 2) return setResultados([]); const { data } = await clientesApi.getAll(v.trim()); setResultados(data.slice(0, 8)) }
  const seleccionar = async (id: number) => {
    try {
      const { data } = await clientesApi.getById(id); setCliente(data); setResultados([]); setQ('')
      const dp = data.direcciones?.find((d: any) => d.es_principal) || data.direcciones?.[0]
      setF((p: any) => ({ ...p, dir_id: dp ? String(dp.id) : '', aplicar_descuento: !!data.continuidad_info?.elegible, tipo_doc: data.tipo_doc || 'BOLETA' }))
      setUsarMemb(!!data.membresia)
      try {
        const { data: pr } = await fichaApi.precios(id)
        setConvenio(pr)
        if (pr.length) toast.success(`${pr.length} precios de convenio aplicados`, { icon: '🏷️' })
      } catch { setConvenio([]) }
      if (data.plazo_pago > 0) setPago((p: any) => ({ ...p, ahora: false }))
    } catch { toast.error('Cliente no encontrado') }
  }
  const crearCliente = async () => {
    if (!nuevoCli?.nombre || !nuevoCli?.telefono) return toast.error('Nombre y teléfono son obligatorios')
    try { const { data } = await clientesApi.create({ tipo: 'PARTICULAR', ...nuevoCli }); toast.success('Cliente creado'); setNuevoCli(null); seleccionar(data.id) }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error al crear cliente') }
  }
  const guardarDir = async () => {
    if (!nuevaDir?.calle) return toast.error('Ingresa la calle')
    const { data } = await clientesApi.addDireccion(cliente.id, { ciudad: 'Concón', ...nuevaDir, es_principal: !cliente.direcciones?.length })
    const { data: c } = await clientesApi.getById(cliente.id); setCliente(c); setF((p: any) => ({ ...p, dir_id: String(data.id) })); setNuevaDir(null)
  }

  const serviciosConPrecio = useMemo(() => {
    if (!convenio.length) return servicios
    const mapa = new Map(convenio.map((p: any) => [p.servicio_id, Number(p.precio)]))
    return servicios.map((s: any) => {
      const esp = mapa.get(s.id)
      if (esp === undefined) return s
      const campo = s.precio_lav_planch > 0 ? 'precio_lav_planch' : s.precio_lav_secado > 0 ? 'precio_lav_secado'
        : s.precio_solo_planch > 0 ? 'precio_solo_planch' : 'precio_productos'
      return { ...s, [campo]: esp, _convenio: true }
    })
  }, [servicios, convenio])

  const items = useMemo(() => buildItems(serviciosConPrecio, kilos, express, prendas), [serviciosConPrecio, kilos, express, prendas])
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0)
  const pct = Number(config.descuento_continuidad || 10)
  const descuento = f.aplicar_descuento ? Math.round(subtotal * pct / 100) : 0
  const total = subtotal - descuento + Number(f.monto_delivery || 0)
  const minimo = Number(config.minimo_retiro || 20000)
  const domicilio = f.retiro_domicilio || f.entrega_domicilio
  const rutasRet = rutas.filter(r => r.dia_semana === diaSemana(f.fecha_recogida) && RUTA_RET.includes(r.tipo))
  const rutasEnt = rutas.filter(r => r.dia_semana === diaSemana(f.fecha_entrega) && RUTA_ENT.includes(r.tipo))
  const memb = cliente?.membresia
  const cont = cliente?.continuidad_info
  const cupo = (fecha: string, id: number) => cupos[fecha]?.[id]
  const labelRuta = (r: any, fecha: string) => `${r.nombre} (${hora(r.hora_inicio)}–${hora(r.hora_fin)})${cupo(fecha, r.id) !== undefined ? ` · ${cupo(fecha, r.id)} cupos` : ''}`

  const crear = async (forzar = false) => {
    if (!cliente) return toast.error('Selecciona o crea el cliente')
    if (!items.length) return toast.error('Ingresa kilos o prendas')
    if (domicilio && !f.dir_id) return toast.error('Selecciona la dirección de domicilio')
    if (f.retiro_domicilio && !f.ruta_recogida_id) return toast.error('Elige la ruta de retiro')
    if (f.entrega_domicilio && !f.ruta_entrega_id) return toast.error('Elige la ruta de entrega')
    if (usarMemb && memb && total > Number(memb.saldo_actual)) return toast.error(`El total supera el saldo de la membresía (${fmt(memb.saldo_actual)})`)
    setLoading(true)
    try {
      const body: any = {
        cliente_id: cliente.id, items, kilos: Number(String(kilos).replace(',', '.') || 0), tipo_servicio: express ? 'EXPRESS' : 'NORMAL',
        tipo_doc: f.tipo_doc, bultos: Number(f.bultos || 1), observaciones: f.observaciones, monto_delivery: Number(f.monto_delivery || 0), aplicar_descuento: f.aplicar_descuento,
        retiro_domicilio: f.retiro_domicilio, entrega_domicilio: f.entrega_domicilio, ropa_en_local: !f.retiro_domicilio || f.ropa_en_local,
        dir_recogida_id: f.retiro_domicilio ? Number(f.dir_id) : null, dir_entrega_id: f.entrega_domicilio ? Number(f.dir_id) : null,
        fecha_recogida: f.retiro_domicilio ? f.fecha_recogida : null, ruta_recogida_id: f.retiro_domicilio ? Number(f.ruta_recogida_id) : null,
        fecha_entrega: f.fecha_entrega || null, ruta_entrega_id: f.entrega_domicilio ? Number(f.ruta_entrega_id) : null,
        origen: f.retiro_domicilio ? 'DOMICILIO' : 'LOCAL', es_membresia: usarMemb && !!memb, forzar,
        pago: (!usarMemb && pago.ahora && pago.forma_pago_id && total > 0) ? { forma_pago_id: Number(pago.forma_pago_id), monto: Number(pago.monto || total) } : null,
      }
      const { data: o } = await ordenesApi.create(body)
      if (usarMemb && memb) await api.post(`/prepagos/${memb.id}/consumir`, { monto: total, orden_id: o.id })
      toast.success(`OT ${ot(o.id)} creada`)
      navigate(`/ordenes/${o.id}?print=1`)
    } catch (e: any) {
      const d = e.response?.data
      if (d?.codigo === 'MINIMO' && confirm(`${d.error}\n\n¿Crear la orden de todas formas?`)) return crear(true)
      toast.error(d?.error || 'Error al crear la orden')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ordenes')} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft size={20} /></button>
        <div><h1 className="text-2xl font-bold text-gray-800">Nueva orden</h1><p className="text-gray-500 text-sm">Mostrador o domicilio · la OT nace pagada al ingreso</p></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* CLIENTE */}
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <p className="font-semibold text-gray-700 mb-2">1 · Cliente</p>
            {!cliente ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input value={q} onChange={e => buscar(e.target.value)} placeholder="Buscar por nombre o teléfono…" className={inp + ' pl-9'} autoFocus />
                  {resultados.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {resultados.map(c => (
                        <button key={c.id} onClick={() => seleccionar(c.id)} className="w-full text-left px-4 py-2.5 hover:bg-pink-50 border-b last:border-0">
                          <p className="text-sm font-medium">{c.nombre} {c.apellido} {c.tiene_membresia && <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">MEMBRESÍA</span>}{c.continuidad && <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">CONTINUIDAD</span>}</p>
                          <p className="text-xs text-gray-400">{c.telefono || 'sin teléfono'} · {c.tipo} · {c.total_ordenes} órdenes</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!nuevoCli
                  ? <button onClick={() => setNuevoCli({ nombre: '', apellido: '', telefono: q.replace(/\D/g, '').length >= 8 ? q : '' })} className="text-sm text-pink-600 font-medium flex items-center gap-1"><UserPlus size={14} /> Cliente nuevo</button>
                  : <div className="grid sm:grid-cols-4 gap-2 bg-pink-50 p-3 rounded-xl">
                      <input value={nuevoCli.nombre} onChange={e => setNuevoCli({ ...nuevoCli, nombre: e.target.value })} placeholder="Nombre *" className={inp} />
                      <input value={nuevoCli.apellido} onChange={e => setNuevoCli({ ...nuevoCli, apellido: e.target.value })} placeholder="Apellido" className={inp} />
                      <input value={nuevoCli.telefono} onChange={e => setNuevoCli({ ...nuevoCli, telefono: e.target.value })} placeholder="Teléfono *" className={inp} />
                      <div className="flex gap-1"><button onClick={crearCliente} className="flex-1 bg-pink-500 text-white rounded-xl text-sm font-medium">Crear</button><button onClick={() => setNuevoCli(null)} className="px-3 bg-gray-100 rounded-xl"><X size={14} /></button></div>
                    </div>}
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-800 text-lg">{cliente.nombre} {cliente.apellido}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} /> {cliente.telefono || 'sin teléfono'} · {cliente.tipo}{cliente.plazo_pago > 0 && <span className="ml-1 text-amber-600 font-medium">· crédito {cliente.plazo_pago} días</span>}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {memb && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Membresía · saldo {fmt(memb.saldo_actual)}</span>}
                    {cont?.activa && <span className={`text-xs px-2 py-0.5 rounded-full ${cont.elegible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>Continuidad {cont.elegible ? `activa · ${pct}% dcto` : `perdida (${cont.semanas_perdidas} sem.)`}</span>}
                    {convenio.length > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Convenio · {convenio.length} precios especiales</span>}
                    {cliente.plazo_pago > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Factura a {cliente.plazo_pago} días</span>}
                    {cliente.stats?.total_ordenes > 0 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{cliente.stats.total_ordenes} órdenes · {fmt(cliente.stats.total_gastado)}</span>}
                    {Number(cliente.stats?.saldo_total) > 0 && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Debe {fmt(cliente.stats.saldo_total)}</span>}
                  </div>
                </div>
                <button onClick={() => { setCliente(null); setUsarMemb(false) }} className="text-xs text-gray-400 hover:text-red-500">Cambiar</button>
              </div>
            )}
          </div>

          {/* ITEMS */}
          <div><p className="font-semibold text-gray-700 mb-2 px-1">2 · ¿Qué lava?</p>
            <ItemsPicker servicios={serviciosConPrecio} kilos={kilos} setKilos={setKilos} express={express} setExpress={setExpress} prendas={prendas} setPrendas={setPrendas} />
          </div>

          {/* LOGÍSTICA */}
          <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
            <p className="font-semibold text-gray-700">3 · Retiro y entrega</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <button onClick={() => setF({ ...f, retiro_domicilio: !f.retiro_domicilio })} className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium ${f.retiro_domicilio ? 'border-pink-400 bg-pink-50 text-pink-700' : 'text-gray-500'}`}><Truck size={16} /> Retiro a domicilio</button>
              <button onClick={() => setF({ ...f, entrega_domicilio: !f.entrega_domicilio })} className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium ${f.entrega_domicilio ? 'border-pink-400 bg-pink-50 text-pink-700' : 'text-gray-500'}`}><Truck size={16} className="scale-x-[-1]" /> Entrega a domicilio</button>
            </div>
            {!domicilio && <p className="text-xs text-gray-400 flex items-center gap-1"><Store size={12} /> La ropa se recibe y se retira en el local.</p>}
            {domicilio && cliente && (
              <div>
                <label className="text-xs text-gray-500 block mb-1 flex items-center gap-1"><MapPin size={11} /> Dirección</label>
                <div className="flex gap-2">
                  <select value={f.dir_id} onChange={e => setF({ ...f, dir_id: e.target.value })} className={inp}>
                    <option value="">Seleccionar…</option>
                    {(cliente.direcciones || []).map((d: any) => <option key={d.id} value={d.id}>{d.calle} {d.numero}{d.otro ? `, ${d.otro}` : ''}{d.sector ? ` — ${d.sector}` : ''}{d.ciudad ? `, ${d.ciudad}` : ''}</option>)}
                  </select>
                  <button onClick={() => setNuevaDir(nuevaDir ? null : { calle: '', numero: '', otro: '', sector: '', ciudad: 'Concón' })} className="px-3 bg-gray-100 rounded-xl text-sm whitespace-nowrap flex items-center gap-1"><Plus size={14} /> Nueva</button>
                </div>
                {nuevaDir && (
                  <div className="grid sm:grid-cols-5 gap-2 mt-2 bg-gray-50 p-3 rounded-xl">
                    <input value={nuevaDir.calle} onChange={e => setNuevaDir({ ...nuevaDir, calle: e.target.value })} placeholder="Calle *" className={inp + ' sm:col-span-2'} />
                    <input value={nuevaDir.numero} onChange={e => setNuevaDir({ ...nuevaDir, numero: e.target.value })} placeholder="N°" className={inp} />
                    <input value={nuevaDir.otro} onChange={e => setNuevaDir({ ...nuevaDir, otro: e.target.value })} placeholder="Depto / casa" className={inp} />
                    <select value={nuevaDir.ciudad} onChange={e => setNuevaDir({ ...nuevaDir, ciudad: e.target.value })} className={inp}>{['Concón', 'Reñaca', 'Viña del Mar', 'Valparaíso', 'Quintero'].map(c => <option key={c}>{c}</option>)}</select>
                    <input value={nuevaDir.sector} onChange={e => setNuevaDir({ ...nuevaDir, sector: e.target.value })} placeholder="Sector / referencia" className={inp + ' sm:col-span-4'} />
                    <button onClick={guardarDir} className="bg-pink-500 text-white rounded-xl text-sm font-medium">Guardar</button>
                  </div>
                )}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {f.retiro_domicilio && (
                <div className="space-y-2 p-3 bg-orange-50 rounded-xl">
                  <p className="text-xs font-semibold text-orange-700">RETIRO</p>
                  <input type="date" value={f.fecha_recogida} onChange={e => setF({ ...f, fecha_recogida: e.target.value, ruta_recogida_id: '' })} className={inp} />
                  <select value={f.ruta_recogida_id} onChange={e => setF({ ...f, ruta_recogida_id: e.target.value })} className={inp}>
                    <option value="">{rutasRet.length ? 'Ruta de retiro…' : 'Sin ruta ese día'}</option>
                    {rutasRet.map(r => <option key={r.id} value={r.id}>{labelRuta(r, f.fecha_recogida)}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={!f.ropa_en_local} onChange={e => setF({ ...f, ropa_en_local: !e.target.checked })} /> Aún no tenemos la ropa (queda "por retirar")</label>
                </div>
              )}
              <div className={`space-y-2 p-3 rounded-xl ${f.entrega_domicilio ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <p className={`text-xs font-semibold ${f.entrega_domicilio ? 'text-blue-700' : 'text-gray-500'}`}>{f.entrega_domicilio ? 'ENTREGA A DOMICILIO' : 'ENTREGA EN LOCAL (fecha estimada)'}</p>
                <input type="date" value={f.fecha_entrega} onChange={e => setF({ ...f, fecha_entrega: e.target.value, ruta_entrega_id: '' })} className={inp} />
                {f.entrega_domicilio && (
                  <select value={f.ruta_entrega_id} onChange={e => setF({ ...f, ruta_entrega_id: e.target.value })} className={inp}>
                    <option value="">{rutasEnt.length ? 'Ruta de entrega…' : 'Sin ruta ese día'}</option>
                    {rutasEnt.map(r => <option key={r.id} value={r.id}>{labelRuta(r, f.fecha_entrega)}</option>)}
                  </select>
                )}
              </div>
            </div>
            {domicilio && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Delivery:</span>
                {[[0, 'Gratis (Concón/Reñaca)'], [Number(config.delivery_vina || 2500), 'Viña centro / rural']].map(([v, l]) => (
                  <button key={String(v)} onClick={() => setF({ ...f, monto_delivery: v })} className={`px-2.5 py-1 rounded-lg border ${Number(f.monto_delivery) === Number(v) ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-600'}`}>{l}{Number(v) > 0 ? ` ${fmt(v)}` : ''}</button>
                ))}
              </div>
            )}
            <div className="grid sm:grid-cols-3 gap-2">
              <div><label className="text-xs text-gray-500">Bultos</label><input type="number" min="1" value={f.bultos} onChange={e => setF({ ...f, bultos: e.target.value })} className={inp} /></div>
              <div><label className="text-xs text-gray-500">Documento</label><select value={f.tipo_doc} onChange={e => setF({ ...f, tipo_doc: e.target.value })} className={inp}><option value="BOLETA">Boleta</option><option value="FACTURA">Factura</option><option value="SIN_DOCUMENTO">Sin documento</option></select></div>
              <div><label className="text-xs text-gray-500">Observaciones</label><input value={f.observaciones} onChange={e => setF({ ...f, observaciones: e.target.value })} placeholder="Manchas, sin suavizante, etc." className={inp} /></div>
            </div>
          </div>
        </div>

        {/* RESUMEN Y PAGO */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
            <p className="font-semibold text-gray-700">4 · Total y pago</p>
            <div className="space-y-1.5 text-sm">
              {items.map((i, n) => <div key={n} className="flex justify-between text-gray-600"><span className="truncate pr-2">{i.nombre} × {i.cantidad}</span><span>{fmt(i.subtotal)}</span></div>)}
              {!items.length && <p className="text-gray-400 text-xs">Agrega kilos o prendas…</p>}
              <div className="flex justify-between border-t pt-2"><span>Subtotal</span><span className="font-medium">{fmt(subtotal)}</span></div>
              <label className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 cursor-pointer ${f.aplicar_descuento ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}>
                <span className="flex items-center gap-1.5"><input type="checkbox" checked={f.aplicar_descuento} onChange={e => setF({ ...f, aplicar_descuento: e.target.checked })} /><Percent size={12} /> Continuidad {pct}%</span>
                <span>-{fmt(descuento)}</span>
              </label>
              {Number(f.monto_delivery) > 0 && <div className="flex justify-between"><span>Delivery</span><span>{fmt(f.monto_delivery)}</span></div>}
              <div className="flex justify-between text-xl font-bold border-t pt-2"><span>Total</span><span className="text-pink-600">{fmt(total)}</span></div>
            </div>
            {domicilio && total > 0 && total < minimo && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 flex items-center gap-1"><AlertTriangle size={12} /> Bajo el mínimo a domicilio ({fmt(minimo)})</p>}

            {memb ? (
              <label className={`flex items-center gap-2 p-3 rounded-xl border text-sm cursor-pointer ${usarMemb ? 'bg-purple-50 border-purple-300 text-purple-700' : 'text-gray-600'}`}>
                <input type="checkbox" checked={usarMemb} onChange={e => setUsarMemb(e.target.checked)} /><CreditCard size={14} /> Descontar de membresía (saldo {fmt(memb.saldo_actual)})
              </label>
            ) : null}
            {!usarMemb && (
              <div className="space-y-2">
                <div className="flex rounded-xl overflow-hidden border text-sm">
                  <button onClick={() => setPago({ ...pago, ahora: true })} className={`flex-1 py-2 ${pago.ahora ? 'bg-green-500 text-white' : 'text-gray-500'}`}>Paga ahora</button>
                  <button onClick={() => setPago({ ...pago, ahora: false })} className={`flex-1 py-2 ${!pago.ahora ? 'bg-amber-500 text-white' : 'text-gray-500'}`}>Paga después</button>
                </div>
                {pago.ahora && (
                  <div className="grid grid-cols-2 gap-2">
                    <select value={pago.forma_pago_id} onChange={e => setPago({ ...pago, forma_pago_id: e.target.value })} className={inp}>
                      <option value="">Forma de pago…</option>{formas.filter(x => !/membres/i.test(x.nombre)).map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                    <input type="number" value={pago.monto} onChange={e => setPago({ ...pago, monto: e.target.value })} placeholder={`Monto (${fmt(total)})`} className={inp} />
                  </div>
                )}
              </div>
            )}
            <button onClick={() => crear(false)} disabled={loading || !cliente || !items.length}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              <Save size={16} /> {loading ? 'Creando…' : 'Crear OT e imprimir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
