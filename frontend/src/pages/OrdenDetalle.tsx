import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ordenesApi, formasPagoApi, serviciosApi, localApi, rutasApi } from '../services/api'
import ItemsPicker from '../components/ItemsPicker'
import type { Item } from '../components/ItemsPicker'
import toast from 'react-hot-toast'
import { ArrowLeft, Printer, MessageCircle, Save, X, Truck, Store, Zap, Clock, DollarSign, Ban, Edit3, MapPin, Package, Camera, Trash2, Send, Link2, Loader2 } from 'lucide-react'
import { fmt, ot, fechaCorta, fechaHora, hora, waLink, ESTADO_COLOR, ESTADO_LABEL, PAGO_COLOR, diaSemana, mensajeAviso, linkOT } from '../utils'

const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300'
const FLUJO = ['PRE_ORDEN', 'EN_PROCESO', 'LISTA', 'ENTREGADA']

export default function OrdenDetalle() {
  const { id } = useParams(); const navigate = useNavigate(); const [params] = useSearchParams()
  const [o, setO] = useState<any>(null); const [local, setLocal] = useState<any>({})
  const [formas, setFormas] = useState<any[]>([]); const [servicios, setServicios] = useState<any[]>([]); const [rutas, setRutas] = useState<any[]>([])
  const [pago, setPago] = useState<any>({ forma_pago_id: '', monto: '' })
  const [modal, setModal] = useState<string | null>(null)
  const [edit, setEdit] = useState<any>(null)
  const [kilos, setKilos] = useState(''); const [express, setExpress] = useState(false); const [prendas, setPrendas] = useState<Item[]>([])
  const [subiendo, setSubiendo] = useState(false); const [aviso, setAviso] = useState<any>(null); const [momento, setMomento] = useState('RECEPCION')

  const load = async () => {
    try {
      const { data } = await ordenesApi.getById(id!)
      setO(data)
      setPago((p: any) => ({ ...p, monto: String(Math.round(Number(data.saldo_pendiente || 0))) }))
    } catch { toast.error('Orden no encontrada'); navigate('/ordenes') }
  }
  useEffect(() => {
    load()
    Promise.all([formasPagoApi.getAll(), serviciosApi.getAll(), localApi.get(), rutasApi.getAll()])
      .then(([f, s, l, r]) => { setFormas(f.data); setServicios(s.data); setLocal(l.data || {}); setRutas(r.data.filter((x: any) => x.activo !== false)) }).catch(() => {})
  }, [id])
  // El QR del ticket: lo lee la pistola y tambien la camara del celular en Produccion
  const [qr, setQr] = useState('')
  useEffect(() => {
    if (!o) return
    QRCode.toDataURL(String(o.id), { margin: 0, width: 150 })
      .then(setQr).catch(() => setQr(''))
  }, [o])
  useEffect(() => { if (o && params.get('print') === '1' && qr) setTimeout(() => window.print(), 600) }, [o, qr])

  if (!o) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div>

  const cambiar = async (estado: string, extra: object = {}) => {
    try { await ordenesApi.cambiarEstado(o.id, { estado, ...extra }); toast.success(`Orden ${ESTADO_LABEL[estado].toLowerCase()}`); setModal(null); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  const pagar = async () => {
    if (!pago.forma_pago_id || !Number(pago.monto)) return toast.error('Elige forma de pago y monto')
    try { await ordenesApi.pagar(o.id, { forma_pago_id: Number(pago.forma_pago_id), monto: Number(pago.monto), referencia: pago.referencia }); toast.success('Pago registrado'); setModal(null); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  const abrirEdicionItems = () => {
    const k = o.items.find((i: any) => /por kilo/i.test(i.nombre))
    setKilos(k ? String(Number(k.cantidad)) : ''); setExpress(o.tipo_servicio === 'EXPRESS')
    setPrendas(o.items.filter((i: any) => !/por kilo/i.test(i.nombre)).map((i: any) => ({ servicio_id: i.servicio_id, nombre: i.nombre, cantidad: Number(i.cantidad), precio_unit: Number(i.precio_unit), subtotal: Number(i.subtotal) })))
    setModal('items')
  }
  const guardarItems = async () => {
    const { buildItems } = await import('../components/ItemsPicker')
    const items = buildItems(servicios, kilos, express, prendas)
    if (!items.length) return toast.error('La orden debe tener al menos un ítem')
    try { await ordenesApi.update(o.id, { items, kilos: Number(String(kilos).replace(',', '.') || 0), tipo_servicio: express ? 'EXPRESS' : 'NORMAL' }); toast.success('Ítems actualizados'); setModal(null); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  const guardarLogistica = async () => {
    try {
      await ordenesApi.update(o.id, { fecha_recogida: edit.fecha_recogida || null, ruta_recogida_id: edit.ruta_recogida_id || null, fecha_entrega: edit.fecha_entrega || null, ruta_entrega_id: edit.ruta_entrega_id || null, observaciones: edit.observaciones, bultos: Number(edit.bultos || 1) })
      toast.success('Orden actualizada'); setModal(null); setEdit(null); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  const comprimir = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 1400, esc = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        res(c.toDataURL('image/jpeg', 0.78))
      }
      img.onerror = rej; img.src = r.result as string
    }
    r.onerror = rej; r.readAsDataURL(file)
  })

  const tomarFotos = async (files: FileList | null) => {
    if (!files?.length) return
    setSubiendo(true)
    try {
      const imagenes = []
      for (const f of Array.from(files).slice(0, 6)) imagenes.push(await comprimir(f))
      await ordenesApi.subirFotos(o.id, { imagenes, momento })
      toast.success(`${imagenes.length} foto${imagenes.length > 1 ? 's' : ''} guardada${imagenes.length > 1 ? 's' : ''}`)
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo subir la foto') } finally { setSubiendo(false) }
  }
  const borrarFoto = async (fid: number) => {
    try { await ordenesApi.borrarFoto(fid); toast.success('Foto eliminada'); load() } catch { toast.error('Error') }
  }
  const prepararAviso = (tipo: string) => {
    const link = linkOT(o.id, o.token_publico)
    setAviso({ tipo, link, telefono: o.cliente_telefono, mensaje: mensajeAviso(tipo, o, link) })
    setModal('aviso')
  }
  const enviarAviso = async () => {
    try {
      const { data } = await ordenesApi.aviso(o.id, { tipo: aviso.tipo, mensaje: aviso.mensaje })
      if (data.wa) window.open(data.wa, '_blank')
      toast.success('Aviso registrado'); setModal(null); setAviso(null); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  const idx = FLUJO.indexOf(o.estado)
  const sig = idx >= 0 && idx < 3 ? FLUJO[idx + 1] : null
  const msgWa = `Hola ${o.cliente_nombre?.split(' ')[0]}, tu pedido ${ot(o.id)} de Ladys Lavandería ya está listo. ${o.entrega_domicilio ? `Te lo llevamos el ${fechaCorta(o.fecha_entrega)}${o.ruta_entrega ? ` entre las ${hora(o.ruta_entrega_hora)}` : ''}.` : 'Puedes pasar a retirarlo al local.'}${Number(o.saldo_pendiente) > 0 ? ` Saldo pendiente: ${fmt(o.saldo_pendiente)}.` : ''}`

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* ── PANTALLA ── */}
      <div className="no-print space-y-4">
        {qr && (
          <div className="bg-white rounded-2xl border p-4 flex items-center gap-4">
            <img src={qr} alt="" style={{ width: 96, height: 96 }} />
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Código del pedido</p>
              <p className="font-semibold text-gray-800">Escanéalo en Producción</p>
              <p className="text-xs text-gray-500 mt-1">
                Etapa actual: <b>{(o.etapa || 'RECEPCIONADO').replace(/_/g, ' ')}</b>
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ordenes')} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-800">{ot(o.id)}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ESTADO_COLOR[o.estado]}`}>{ESTADO_LABEL[o.estado]}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAGO_COLOR[o.estado_pago] || ''}`}>{o.estado_pago === 'PAGADA' ? 'Pagada' : o.estado_pago === 'PARCIAL' ? 'Pago parcial' : 'Sin pagar'}</span>
              {o.tipo_servicio === 'EXPRESS' && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1"><Zap size={10} /> Express</span>}
            </div>
            <p className="text-sm text-gray-500">{o.cliente_nombre} · {o.cliente_telefono || 'sin teléfono'} · ingreso {fechaHora(o.creado_en)}</p>
          </div>
          <button onClick={() => window.print()} className="p-2.5 border rounded-xl text-gray-500 hover:bg-gray-50"><Printer size={16} /></button>
          {o.cliente_telefono && <a href={waLink(o.cliente_telefono, msgWa)} target="_blank" rel="noreferrer" className="p-2.5 border rounded-xl text-green-600 hover:bg-green-50"><MessageCircle size={16} /></a>}
        </div>

        {/* Acciones de estado */}
        {o.estado !== 'ANULADA' && (
          <div className="flex gap-2 flex-wrap">
            {sig && <button onClick={() => cambiar(sig)} className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>Marcar como {ESTADO_LABEL[sig].toLowerCase()}</button>}
            {Number(o.saldo_pendiente) > 0 && <button onClick={() => setModal('pago')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold"><DollarSign size={14} /> Registrar pago {fmt(o.saldo_pendiente)}</button>}
            {o.estado !== 'ENTREGADA' && <button onClick={abrirEdicionItems} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-gray-600 text-sm"><Package size={14} /> Editar ítems</button>}
            <button onClick={() => { setEdit({ fecha_recogida: o.fecha_recogida || '', ruta_recogida_id: o.ruta_recogida_id || '', fecha_entrega: o.fecha_entrega || '', ruta_entrega_id: o.ruta_entrega_id || '', observaciones: o.observaciones || '', bultos: o.bultos }); setModal('logistica') }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-gray-600 text-sm"><Edit3 size={14} /> Editar entrega</button>
            <button onClick={() => prepararAviso(o.estado === 'LISTA' ? 'LISTA' : o.estado === 'PRE_ORDEN' ? 'INGRESO' : o.estado === 'ENTREGADA' ? 'ENTREGADA' : 'INGRESO')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium"><Send size={14} /> Avisar al cliente</button>
            <button onClick={() => setModal('anular')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm"><Ban size={14} /> Anular</button>
          </div>
        )}
        {o.estado === 'ANULADA' && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">Orden anulada{o.motivo_anulacion ? `: ${o.motivo_anulacion}` : ''}</div>}

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            {/* Ítems */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 text-xs font-semibold text-gray-500">DETALLE</div>
              {o.items.map((i: any) => (
                <div key={i.id} className="flex justify-between px-4 py-2.5 border-b last:border-0 text-sm">
                  <span className="text-gray-700">{i.nombre} <span className="text-gray-400">× {Number(i.cantidad)}</span></span>
                  <span className="font-medium">{fmt(i.subtotal)}</span>
                </div>
              ))}
              <div className="px-4 py-3 bg-gray-50 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(o.subtotal)}</span></div>
                {Number(o.descuento_monto) > 0 && <div className="flex justify-between text-green-600"><span>Descuento continuidad {Number(o.descuento_pct)}%</span><span>-{fmt(o.descuento_monto)}</span></div>}
                {Number(o.monto_delivery) > 0 && <div className="flex justify-between text-gray-500"><span>Delivery</span><span>{fmt(o.monto_delivery)}</span></div>}
                <div className="flex justify-between text-lg font-bold border-t pt-1.5"><span>Total</span><span className="text-pink-600">{fmt(o.monto_total)}</span></div>
                {Number(o.monto_abonado) > 0 && <div className="flex justify-between text-green-600"><span>Abonado</span><span>{fmt(o.monto_abonado)}</span></div>}
                {Number(o.saldo_pendiente) > 0 && <div className="flex justify-between text-red-600 font-semibold"><span>Saldo</span><span>{fmt(o.saldo_pendiente)}</span></div>}
              </div>
            </div>

            {/* Fotos */}
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5"><Camera size={13} /> FOTOS DEL PEDIDO</p>
                <select value={momento} onChange={e => setMomento(e.target.value)} className="text-xs border rounded-lg px-2 py-1 outline-none">
                  <option value="RECEPCION">Al recibir</option><option value="PROCESO">En proceso</option><option value="ENTREGA">Al entregar</option>
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(o.fotos || []).map((f: any) => (
                  <div key={f.id} className="relative group">
                    <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt="" className="w-full h-20 object-cover rounded-xl border" /></a>
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">{f.momento === 'RECEPCION' ? 'recibo' : f.momento === 'ENTREGA' ? 'entrega' : 'proceso'}</span>
                    <button onClick={() => borrarFoto(f.id)} className="absolute top-1 right-1 bg-white/90 rounded-full p-1 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={11} /></button>
                  </div>
                ))}
                <label className="h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:border-pink-300 hover:text-pink-500">
                  {subiendo ? <Loader2 size={18} className="animate-spin" /> : <><Camera size={18} /><span className="text-[10px] mt-0.5">Agregar</span></>}
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" disabled={subiendo} onChange={e => tomarFotos(e.target.files)} />
                </label>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">El cliente ve estas fotos en el enlace de su orden.</p>
            </div>

            {/* Pagos */}
            {o.pagos.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 text-xs font-semibold text-gray-500">PAGOS</div>
                {o.pagos.map((p: any) => (
                  <div key={p.id} className="flex justify-between px-4 py-2.5 border-b last:border-0 text-sm">
                    <span className="text-gray-600">{p.forma_nombre || 'Pago'} <span className="text-gray-400 text-xs">· {fechaHora(p.creado_en)}</span></span>
                    <span className="font-medium text-green-600">{fmt(p.monto)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Logística */}
            <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-2.5 text-sm">
              <p className="text-xs font-semibold text-gray-500">LOGÍSTICA</p>
              <p className="flex items-center gap-1.5 text-gray-600">{o.retiro_domicilio || o.entrega_domicilio ? <Truck size={13} className="text-pink-500" /> : <Store size={13} className="text-pink-500" />}{o.retiro_domicilio || o.entrega_domicilio ? 'Servicio a domicilio' : 'Atención en local'}</p>
              {o.retiro_domicilio && <div><p className="text-xs text-gray-400">Retiro</p><p className="text-gray-700">{fechaCorta(o.fecha_recogida)} · {o.ruta_retiro || 'sin ruta'}</p>{o.direccion_retiro && <p className="text-xs text-gray-500 flex items-start gap-1 mt-0.5"><MapPin size={11} className="mt-0.5 flex-shrink-0" />{o.direccion_retiro}</p>}</div>}
              <div><p className="text-xs text-gray-400">Entrega</p><p className="text-gray-700">{fechaCorta(o.fecha_entrega)} · {o.entrega_domicilio ? (o.ruta_entrega || 'sin ruta') : 'en local'}</p>{o.entrega_domicilio && o.direccion_entrega && <p className="text-xs text-gray-500 flex items-start gap-1 mt-0.5"><MapPin size={11} className="mt-0.5 flex-shrink-0" />{o.direccion_entrega}</p>}</div>
              <div className="flex justify-between text-gray-500 text-xs pt-1 border-t"><span>Bultos: {o.bultos}</span>{Number(o.kilos) > 0 && <span>{Number(o.kilos)} kg</span>}<span>{o.tipo_doc}</span></div>
              {o.observaciones && <p className="text-xs bg-yellow-50 text-yellow-800 rounded-lg p-2">{o.observaciones}</p>}
            </div>

            {/* Historial */}
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">HISTORIAL</p>
              <div className="space-y-3">
                {o.historial.map((h: any) => (
                  <div key={h.id} className="flex gap-2.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-pink-400 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {h.estado && <p className="font-medium text-gray-700">{ESTADO_LABEL[h.estado] || h.estado}</p>}
                      {h.nota && <p className="text-gray-500">{h.nota}</p>}
                      <p className="text-gray-400 flex items-center gap-1"><Clock size={9} />{fechaHora(h.creado_en)}{h.usuario_nombre ? ` · ${h.usuario_nombre}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TICKET 80mm ── */}
      <div className="print-only text-black" style={{ width: '54mm', fontSize: '10px', fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <p style={{ fontWeight: 'bold', fontSize: 12 }}>{local.nombre || 'LADYS LAVANDERÍA'}</p>
          <p>{local.dir_salida || 'Av. Concón Reñaca 102, L. 5 y 6'}</p>
          <p>{local.telefono || '+56 9 7541 0232'}</p>
        </div>
        <p style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '3px 0', textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>ORDEN {ot(o.id)}</p>
        {qr && (
          <div style={{ textAlign: 'center', margin: '6px 0' }}>
            <img src={qr} alt="" style={{ width: 86, height: 86 }} />
            <p style={{ fontSize: 9, marginTop: 2 }}>Escanear en cada etapa</p>
          </div>
        )}
        <p>Fecha: {fechaHora(o.creado_en)}</p>
        <p>Cliente: {o.cliente_nombre}</p>
        <p>Fono: {o.cliente_telefono || '—'}</p>
        {o.tipo_servicio === 'EXPRESS' && <p style={{ fontWeight: 'bold' }}>** EXPRESS **</p>}
        <p style={{ borderTop: '1px dashed #000', marginTop: 4, paddingTop: 4 }}>DETALLE</p>
        {o.items.map((i: any) => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{Number(i.cantidad)}x {i.nombre.slice(0, 18)}</span><span>{fmt(i.subtotal)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #000', marginTop: 4, paddingTop: 4 }}>
          {Number(o.descuento_monto) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Dcto continuidad</span><span>-{fmt(o.descuento_monto)}</span></div>}
          {Number(o.monto_delivery) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery</span><span>{fmt(o.monto_delivery)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13 }}><span>TOTAL</span><span>{fmt(o.monto_total)}</span></div>
          {Number(o.monto_abonado) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pagado</span><span>{fmt(o.monto_abonado)}</span></div>}
          {Number(o.saldo_pendiente) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>SALDO</span><span>{fmt(o.saldo_pendiente)}</span></div>}
        </div>
        <div style={{ borderTop: '1px dashed #000', marginTop: 4, paddingTop: 4 }}>
          <p>Entrega: {fechaCorta(o.fecha_entrega)} {o.entrega_domicilio ? `(${o.ruta_entrega || 'domicilio'})` : '(en local)'}</p>
          <p>Bultos: {o.bultos}</p>
          {o.observaciones && <p>Obs: {o.observaciones}</p>}
        </div>
        <p style={{ textAlign: 'center', marginTop: 8 }}>¡Gracias por preferirnos!</p>
      </div>

      {/* ── MODALES ── */}
      {modal === 'pago' && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Registrar pago</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            <p className="text-sm text-gray-500">Saldo pendiente: <strong className="text-pink-600">{fmt(o.saldo_pendiente)}</strong></p>
            <select value={pago.forma_pago_id} onChange={e => setPago({ ...pago, forma_pago_id: e.target.value })} className={inp}>
              <option value="">Forma de pago…</option>{formas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
            <input type="number" value={pago.monto} onChange={e => setPago({ ...pago, monto: e.target.value })} placeholder="Monto" className={inp} />
            <input value={pago.referencia || ''} onChange={e => setPago({ ...pago, referencia: e.target.value })} placeholder="Referencia (opcional)" className={inp} />
            <div className="flex gap-2"><button onClick={pagar} className="flex-1 py-3 rounded-xl bg-green-500 text-white font-semibold text-sm">Confirmar pago</button><button onClick={() => setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button></div>
          </div>
        </div>
      )}

      {modal === 'items' && (
        <div className="no-print fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 my-8 space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-bold">Editar ítems de {ot(o.id)}</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            <ItemsPicker servicios={servicios} kilos={kilos} setKilos={setKilos} express={express} setExpress={setExpress} prendas={prendas} setPrendas={setPrendas} />
            <div className="flex gap-2"><button onClick={guardarItems} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}><Save size={15} /> Guardar y recalcular</button><button onClick={() => setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button></div>
          </div>
        </div>
      )}

      {modal === 'logistica' && edit && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Editar retiro y entrega</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            {o.retiro_domicilio && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500">Fecha retiro</label><input type="date" value={edit.fecha_recogida} onChange={e => setEdit({ ...edit, fecha_recogida: e.target.value, ruta_recogida_id: '' })} className={inp} /></div>
                <div><label className="text-xs text-gray-500">Ruta retiro</label><select value={edit.ruta_recogida_id} onChange={e => setEdit({ ...edit, ruta_recogida_id: e.target.value })} className={inp}><option value="">—</option>{rutas.filter(r => r.dia_semana === diaSemana(edit.fecha_recogida) && r.tipo !== 'SOLO_ENTREGAS').map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">Fecha entrega</label><input type="date" value={edit.fecha_entrega} onChange={e => setEdit({ ...edit, fecha_entrega: e.target.value, ruta_entrega_id: '' })} className={inp} /></div>
              {o.entrega_domicilio && <div><label className="text-xs text-gray-500">Ruta entrega</label><select value={edit.ruta_entrega_id} onChange={e => setEdit({ ...edit, ruta_entrega_id: e.target.value })} className={inp}><option value="">—</option>{rutas.filter(r => r.dia_semana === diaSemana(edit.fecha_entrega) && r.tipo !== 'SOLO_RETIROS').map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></div>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs text-gray-500">Bultos</label><input type="number" min="1" value={edit.bultos} onChange={e => setEdit({ ...edit, bultos: e.target.value })} className={inp} /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Observaciones</label><input value={edit.observaciones} onChange={e => setEdit({ ...edit, observaciones: e.target.value })} className={inp} /></div>
            </div>
            <div className="flex gap-2"><button onClick={guardarLogistica} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>Guardar</button><button onClick={() => setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button></div>
          </div>
        </div>
      )}

      {modal === 'aviso' && aviso && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Avisar al cliente</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            <div className="flex gap-1.5 flex-wrap">
              {[['INGRESO','Recibimos tu pedido'],['LISTA','Ya está lista'],['EN_RUTA','Vamos en camino'],['ENTREGADA','Entregada']].map(([k,l]) => (
                <button key={k} onClick={() => prepararAviso(k)} className={`px-2.5 py-1 rounded-lg text-xs ${aviso.tipo === k ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
              ))}
            </div>
            <textarea value={aviso.mensaje} onChange={e => setAviso({ ...aviso, mensaje: e.target.value })} rows={7} className={inp + ' text-xs'} />
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
              <Link2 size={12} className="flex-shrink-0" />
              <span className="truncate">{aviso.link}</span>
              <button onClick={() => { navigator.clipboard.writeText(aviso.link); toast.success('Enlace copiado') }} className="text-pink-600 font-medium flex-shrink-0">Copiar</button>
            </div>
            {!aviso.telefono && <p className="text-xs text-amber-600">El cliente no tiene teléfono registrado; solo puedes copiar el enlace.</p>}
            <div className="flex gap-2">
              <button onClick={enviarAviso} disabled={!aviso.telefono} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 text-white font-semibold text-sm disabled:opacity-40"><MessageCircle size={15} /> Abrir WhatsApp</button>
              <button onClick={() => setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'anular' && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3">
            <h2 className="font-bold text-red-600">Anular {ot(o.id)}</h2>
            <p className="text-sm text-gray-500">La orden queda registrada pero se excluye de las ventas y de las rutas.</p>
            <input id="motivo" placeholder="Motivo de anulación" className={inp} />
            <div className="flex gap-2">
              <button onClick={() => cambiar('ANULADA', { motivo_anulacion: (document.getElementById('motivo') as HTMLInputElement)?.value })} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm">Anular orden</button>
              <button onClick={() => setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
