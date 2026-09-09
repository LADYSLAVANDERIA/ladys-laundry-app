import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { etapasApi, cobrosApi, transferenciasApi, itemNotaApi} from '../services/api'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ordenesApi, formasPagoApi, serviciosApi, localApi, rutasApi, configApi } from '../services/api'
import ItemsPicker from '../components/ItemsPicker'
import type { Item } from '../components/ItemsPicker'
import toast from 'react-hot-toast'
import { ArrowLeft, Printer, MessageCircle, Save, X, Truck, Store, Zap, Clock, DollarSign, Ban, Edit3, MapPin, Package, Camera, Trash2, Send, Link2, Loader2, CreditCard, RotateCcw } from 'lucide-react'
import { fmt, ot, fechaCorta, fechaHora, hora, waLink, ESTADO_COLOR, ESTADO_LABEL, PAGO_COLOR, diaSemana, mensajeAviso, linkOT, servicioCorto, opMercadoPago, esPagoMercadoPago, refDesdeOperacion, mensajeSegunEtapa, tipoAviso, describirCambios, resumenItems} from '../utils'

const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300'
const FLUJO = ['PRE_ORDEN', 'EN_PROCESO', 'LISTA', 'ENTREGADA']

export default function OrdenDetalle() {
  const { id } = useParams(); const navigate = useNavigate(); const [params] = useSearchParams()
  const [o, setO] = useState<any>(null); const [local, setLocal] = useState<any>({})
  const [formas, setFormas] = useState<any[]>([]); const [servicios, setServicios] = useState<any[]>([]); const [rutas, setRutas] = useState<any[]>([])
  const [pago, setPago] = useState<any>({ forma_pago_id: '', monto: '' })
  const [cobro, setCobro] = useState<any>(null)
  const [config, setConfig] = useState<any>({})
  const [motivoVuelta, setMotivoVuelta] = useState('')
  const [generando, setGenerando] = useState(false)
  const [comp, setComp] = useState<any>({ monto: '', nombre_origen: '', nota: '' })
  const [pos, setPos] = useState<any>(null)          // { mp_order_id, monto, estado }
  const [posError, setPosError] = useState('')
  const [modal, setModal] = useState<string | null>(null)
  const [edit, setEdit] = useState<any>(null)
  const [kilos, setKilos] = useState(''); const [express, setExpress] = useState(false); const [prendas, setPrendas] = useState<Item[]>([])
  const [subiendo, setSubiendo] = useState(false); const [aviso, setAviso] = useState<any>(null); const [momento, setMomento] = useState('RECEPCION')

  const guardarNota = async (texto: string) => {
    try {
      await itemNotaApi.guardar(nota.id, texto)
      toast.success(texto ? 'Instrucción guardada' : 'Instrucción borrada')
      setNota(null); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo guardar') }
  }

  const load = async () => {
    try {
      const { data } = await ordenesApi.getById(id!)
      setO(data)
      setPago((p: any) => ({ ...p, monto: String(Math.round(Number(data.saldo_pendiente || 0))) }))
    } catch { toast.error('Orden no encontrada'); navigate('/ordenes') }
  }
  useEffect(() => {
    load()
    Promise.all([formasPagoApi.getAll(), serviciosApi.getAll(), localApi.get(), rutasApi.getAll(), configApi.get()])
      .then(([f, s, l, r, c]) => { setFormas(f.data); setServicios(s.data); setLocal(l.data || {}); setRutas(r.data.filter((x: any) => x.activo !== false)); setConfig(c.data || {}) }).catch(() => {})
  }, [id])
  // El QR del ticket: lo lee la pistola y tambien la camara del celular en Produccion
  const [qr, setQr] = useState('')
  const [traza, setTraza] = useState<any[]>([])
  useEffect(() => {
    if (!o) return
    etapasApi.orden(o.id).then(r => setTraza(r.data.pasos || [])).catch(() => setTraza([]))
  }, [o])
  const [tipoTicket, setTipoTicket] = useState<'cliente' | 'interno'>('cliente')
  const [nota, setNota] = useState<any>(null)
  useEffect(() => {
    if (!o) return
    QRCode.toDataURL(String(o.id), { margin: 0, width: 150 })
      .then(setQr).catch(() => setQr(''))
  }, [o])
  const imprimir = (tipo: 'cliente' | 'interno') => {
    setTipoTicket(tipo)
    setTimeout(() => window.print(), 200)   // deja que el ticket correcto se dibuje
  }
  useEffect(() => { if (o && params.get('print') === '1' && qr) setTimeout(() => window.print(), 600) }, [o, qr])

  // Viene de Nueva Orden con la máquina elegida: se abre el cobro solo, así el
  // terminal recibe el monto sin que nadie tenga que buscar el botón.
  const [posAuto, setPosAuto] = useState(false)
  useEffect(() => {
    if (o && !posAuto && params.get('cobrar') === 'pos' && Number(o.saldo_pendiente) > 0) {
      setPosAuto(true)
      setModal('maquina')
      setTimeout(() => cobrarEnMaquina(), 400)
    }
  }, [o, posAuto])


  const cambiar = async (estado: string, extra: object = {}) => {
    try { await ordenesApi.cambiarEstado(o.id, { estado, ...extra }); toast.success(`Orden ${ESTADO_LABEL[estado].toLowerCase()}`); setModal(null); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  const deshacerEntrega = async () => {
    if (!motivoVuelta.trim()) return toast.error('Escribe el motivo: queda en el historial de la orden')
    try {
      await ordenesApi.cambiarEstado(o.id, { estado: 'LISTA', nota: motivoVuelta.trim() })
      toast.success('Entrega deshecha. La orden vuelve a quedar lista.')
      setModal(null); setMotivoVuelta(''); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo deshacer') }
  }

  const pagar = async () => {
    if (!pago.forma_pago_id || !Number(pago.monto)) return toast.error('Elige forma de pago y monto')
    if (esPagoMercadoPago(pago.forma_pago_id) && !String(pago.referencia || '').trim())
      return toast.error('Anota el N.° de operación de Mercado Pago: sin él no se puede reimprimir el comprobante')
    try { await ordenesApi.pagar(o.id, { forma_pago_id: Number(pago.forma_pago_id), monto: Number(pago.monto), referencia: refDesdeOperacion(pago.forma_pago_id, pago.referencia) }); toast.success('Pago registrado'); setModal(null); load() }
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
    const base = buildItems(servicios, kilos, express, prendas)
    if (!base.length) return toast.error('La orden debe tener al menos un ítem')

    // El pedido mínimo se aplicaba solo en Nueva Orden. Cuando la orden venía
    // agendada y se le cargaban los ítems acá, nadie cobraba el diferencial: la
    // OT 6407 quedó en $18.705 con mínimo a domicilio de $25.000.
    const minimo = Number(o.retiro_domicilio || o.entrega_domicilio
      ? (config.minimo_retiro || 25000)
      : (config.minimo_venta_local || 14500))
    const suma = base.reduce((t: number, i: any) => t + Number(i.subtotal || 0), 0)
    const faltante = Math.max(0, minimo - suma)
    let items = base
    if (faltante > 0 && !o.es_membresia) {
      const domicilio = !!(o.retiro_domicilio || o.entrega_domicilio)
      const ok = window.confirm(
        `Esta orden suma ${fmt(suma)} y el mínimo ${domicilio ? 'a domicilio' : 'del local'} es ${fmt(minimo)}.\n\n` +
        `Aceptar agrega el ajuste por ${fmt(faltante)} y la deja en ${fmt(minimo)}.\n` +
        `Cancelar la guarda en ${fmt(suma)}, sin cobrar el mínimo.`)
      if (ok) items = [...base, { servicio_id: 78, nombre: 'AJUSTE POR PEDIDO MÍNIMO',
                                  cantidad: 1, precio_unit: faltante, subtotal: faltante }]
    }
    const datos = { items, kilos: Number(String(kilos).replace(',', '.') || 0), tipo_servicio: express ? 'EXPRESS' : 'NORMAL' }
    const cambios = [
      ...describirCambios(o, datos, { kilos: 'Kilos', tipo_servicio: 'Servicio' }),
      ...(resumenItems(o.items) !== resumenItems(items) ? [`Detalle: ${resumenItems(o.items)} → ${resumenItems(items)}`] : []),
    ]
    if (!cambios.length) { toast('No cambiaste nada'); setModal(null); return }
    try { await ordenesApi.update(o.id, { ...datos, nota: 'Ítems editados · ' + cambios.join(' · ') }); toast.success('Ítems actualizados'); setModal(null); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  const guardarLogistica = async () => {
    try {
      // ot_easylaundry se editaba en el formulario pero nunca se enviaba
      const datos = {
        fecha_recogida: edit.fecha_recogida || null, ruta_recogida_id: edit.ruta_recogida_id || null,
        fecha_entrega: edit.fecha_entrega || null, ruta_entrega_id: edit.ruta_entrega_id || null,
        observaciones: edit.observaciones || null, bultos: Number(edit.bultos || 1),
        ot_easylaundry: edit.ot_easylaundry || null,
      }
      const nombreRuta = (id: any) => rutas.find((r: any) => String(r.id) === String(id))?.nombre || '—'
      const cambios = describirCambios(o, datos, {
        fecha_recogida: 'Retiro', fecha_entrega: 'Entrega',
        ruta_recogida_id: 'Ruta de retiro', ruta_entrega_id: 'Ruta de entrega',
        bultos: 'Bultos', observaciones: 'Observaciones', ot_easylaundry: 'OT EasyLaundry',
      }, {
        fecha_recogida: (v: any) => (v ? fechaCorta(v) : '—'),
        fecha_entrega: (v: any) => (v ? fechaCorta(v) : '—'),
        ruta_recogida_id: nombreRuta, ruta_entrega_id: nombreRuta,
      })
      if (!cambios.length) { toast('No cambiaste nada'); setModal(null); setEdit(null); return }
      await ordenesApi.update(o.id, { ...datos, nota: 'Editada · ' + cambios.join(' · ') })
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

  const idx = FLUJO.indexOf(o?.estado)
  const sig = idx >= 0 && idx < 3 ? FLUJO[idx + 1] : null
  const generarLink = async () => {
    setGenerando(true)
    try {
      const { data } = await cobrosApi.link(o.id)
      setCobro(data)
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo generar el link') }
    finally { setGenerando(false) }
  }

  const guardarComprobante = async () => {
    const monto = Number(comp.monto)
    if (!monto) return toast.error('Escribe el monto de la transferencia')
    try {
      await transferenciasApi.comprobante({ orden_id: o.id, monto,
        nombre_origen: comp.nombre_origen || null, nota: comp.nota || null })
      toast.success('Anotada. Queda por confirmar con el banco.')
      setModal(null); setComp({ monto: '', nombre_origen: '', nota: '' }); load()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo registrar') }
  }

  const cobrarEnMaquina = async () => {
    setPosError(''); setPos({ cargando: true })
    try {
      const { data } = await cobrosApi.cobrarPos(o.id)
      setPos({ ...data, estado: 'esperando' })
    } catch (e: any) {
      setPos(null)
      setPosError(e?.response?.data?.error || 'No se pudo mandar el cobro a la máquina')
    }
  }

  const cancelarMaquina = async () => {
    if (!pos?.mp_order_id) { setModal(null); setPos(null); return }
    try { await cobrosApi.cancelarPos(pos.mp_order_id); toast.success('Cobro cancelado') }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Cancélalo desde la máquina') }
    setModal(null); setPos(null)
  }

  // Mientras el cobro está vivo se pregunta cada 3 s cómo va.
  useEffect(() => {
    if (modal !== 'maquina' || !pos?.mp_order_id || pos.estado === 'PAGADA') return
    const t = setInterval(async () => {
      try {
        const { data } = await cobrosApi.estadoPos(pos.mp_order_id)
        setPos((p: any) => ({ ...p, estado: data.estado }))
        if (data.estado === 'PAGADA') { toast.success('Pago recibido'); load() }
      } catch { /* si falla una consulta, se reintenta en la siguiente */ }
    }, 3000)
    return () => clearInterval(t)
  }, [modal, pos?.mp_order_id, pos?.estado])

  // Esta salida va después de TODOS los hooks. Si se pone antes, al llegar la
  // orden aparecen hooks que en el render anterior no existían y React tumba
  // la pantalla: se veía en blanco al abrir cualquier pedido.
  if (!o) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div>

  const avisarWhatsapp = () => {
    // La ventana se abre ANTES del await: si se abre después, el navegador la
    // toma como popup y la bloquea. Primero WhatsApp, después el registro.
    window.open(waLink(o.cliente_telefono, msgWa), '_blank')
    ordenesApi.aviso(o.id, { tipo: tipoAviso(o), mensaje: msgWa })
      .then(() => load())
      .catch(() => toast.error('Se abrió WhatsApp, pero no se pudo dejar el registro en la OT'))
  }

  const msgWa = mensajeSegunEtapa(o, linkOT(o.id, o.token_publico))

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

        {!!traza.length && (
          <div className="bg-white rounded-2xl border p-4">
            <p className="font-semibold text-gray-800 mb-3">Trazabilidad</p>
            <div className="space-y-0">
              {traza.map((t: any, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full mt-1.5"
                         style={{ background: i === traza.length - 1 ? '#E8177A' : '#cbd5e1' }} />
                    {i < traza.length - 1 && <div className="w-px flex-1 bg-gray-200" />}
                  </div>
                  <div className="pb-4 min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {String(t.etapa).replace(/_/g, ' ')}
                      {t.bultos ? ` · ${t.bultos} bulto(s)` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {fechaHora(t.en)} · {t.usuario}
                    </p>
                    {t.nota && <p className="text-xs text-gray-400 italic">{t.nota}</p>}
                  </div>
                </div>
              ))}
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
          <button onClick={() => imprimir('cliente')} title="Ticket del cliente"
                  className="p-2.5 border rounded-xl text-gray-500 hover:bg-gray-50"><Printer size={16} /></button>
          <button onClick={() => imprimir('interno')} title="Ticket interno de producción"
                  className="px-3 py-2.5 border rounded-xl text-xs font-medium"
                  style={{ borderColor: '#E8177A', color: '#E8177A' }}>Ticket interno</button>
          {o.cliente_telefono && <button onClick={avisarWhatsapp} title="Avisar por WhatsApp y dejarlo en el historial" className="p-2.5 border rounded-xl text-green-600 hover:bg-green-50"><MessageCircle size={16} /></button>}
        </div>

        {/* Acciones de estado */}
        {o.estado !== 'ANULADA' && (
          <div className="flex gap-2 flex-wrap">
            {sig && <button onClick={() => cambiar(sig)} className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>Marcar como {ESTADO_LABEL[sig].toLowerCase()}</button>}
            {Number(o.saldo_pendiente) > 0 && <button onClick={() => setModal('pago')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold"><DollarSign size={14} /> Registrar pago {fmt(o.saldo_pendiente)}</button>}
            {Number(o.saldo_pendiente) > 0 && !o.entrega_domicilio && <button onClick={() => { setPos(null); setPosError(''); setModal('maquina') }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"><CreditCard size={14} /> Cobrar en la máquina {fmt(o.saldo_pendiente)}</button>}
            {Number(o.saldo_pendiente) > 0 && o.entrega_domicilio && (
              <span className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-xs self-center">
                A domicilio no va la máquina: cobra por transferencia o link
              </span>
            )}
            {Number(o.saldo_pendiente) > 0 && <button onClick={() => { setCobro(null); setModal('cobrar') }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-gray-600 text-sm"><Link2 size={14} /> Cobrar con link</button>}
            {Number(o.saldo_pendiente) > 0 && <button onClick={() => { setComp({ monto: String(Math.round(Number(o.saldo_pendiente))), nombre_origen: '', nota: '' }); setModal('comprobante') }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-gray-600 text-sm"><Send size={14} /> Comprobante de transferencia</button>}
            {o.estado === 'ENTREGADA' && (
              <button onClick={() => { setMotivoVuelta(''); setModal('deshacer') }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium">
                <RotateCcw size={14} /> Deshacer entrega
              </button>
            )}
            {o.estado !== 'ENTREGADA' && <button onClick={abrirEdicionItems} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-gray-600 text-sm"><Package size={14} /> Editar ítems</button>}
            <button onClick={() => { setEdit({ ot_easylaundry: o.ot_easylaundry || '', fecha_recogida: o.fecha_recogida || '', ruta_recogida_id: o.ruta_recogida_id || '', fecha_entrega: o.fecha_entrega || '', ruta_entrega_id: o.ruta_entrega_id || '', observaciones: o.observaciones || '', bultos: o.bultos }); setModal('logistica') }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-gray-600 text-sm"><Edit3 size={14} /> Editar entrega</button>
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
                <div key={i.id} className="px-4 py-2.5 border-b last:border-0 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-700">{i.nombre} <span className="text-gray-400">× {Number(i.cantidad)}</span></span>
                    <span className="font-medium shrink-0">{fmt(i.subtotal)}</span>
                  </div>
                  {i.nota
                    ? <button onClick={() => setNota({ id: i.id, nombre: i.nombre, nota: i.nota })}
                        className="mt-1 text-xs text-left text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 w-full">
                        {i.nota}
                      </button>
                    : <button onClick={() => setNota({ id: i.id, nombre: i.nombre, nota: '' })}
                        className="mt-1 text-xs text-gray-400 hover:text-pink-600">
                        + instrucción para este servicio
                      </button>}
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
                    <span className="text-gray-600">{p.forma_nombre || 'Pago'} <span className="text-gray-400 text-xs">· {fechaHora(p.creado_en)}{opMercadoPago(p.referencia) ? ` · Operación ${opMercadoPago(p.referencia)}` : ''}</span></span>
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
                {[
                  // El backend deja DOS filas por aviso: una en historial y otra
                  // en orden_avisos con el texto completo. Se muestra la segunda
                  // y se descarta la primera, si no el aviso aparece duplicado.
                  ...o.historial.filter((h: any) => !/^Aviso al cliente:/i.test(String(h.nota || ''))),
                  ...(o.avisos || []).map((a: any) => ({ ...a, es_aviso: true, id: 'av' + a.id })),
                ]
                  .sort((a: any, b: any) => String(b.creado_en).localeCompare(String(a.creado_en)))
                  .map((h: any) => (
                  <div key={h.id} className="flex gap-2.5 text-xs">
                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${h.es_aviso ? 'bg-green-500' : 'bg-pink-400'}`} />
                    <div className="flex-1 min-w-0">
                      {h.es_aviso ? (
                        <>
                          <p className="font-medium text-green-700 flex items-center gap-1">
                            <MessageCircle size={10} /> WhatsApp enviado · {String(h.tipo || '').toLowerCase()}
                          </p>
                          <p className="text-gray-500 whitespace-pre-line border-l-2 border-gray-100 pl-2 my-1">{h.mensaje}</p>
                        </>
                      ) : (
                        <>
                          {h.estado && <p className="font-medium text-gray-700">{ESTADO_LABEL[h.estado] || h.estado}</p>}
                          {h.nota && <p className="text-gray-500">{h.nota}</p>}
                        </>
                      )}
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

      {/* Ticket interno: lo que producción necesita ver de un vistazo, nada más */}
      <div className={`print-only text-black ${tipoTicket === 'cliente' ? 'no-imprimir-ahora' : ''}`}
           style={{ width: '54mm', fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' }}>
        <p style={{ fontWeight: 'bold', fontSize: 13, letterSpacing: 1 }}>LADYS · INTERNO</p>
        <p style={{ border: '2px solid #000', padding: '4px 0', fontWeight: 'bold',
                    fontSize: 20, margin: '4px 0' }}>{ot(o.id)}</p>
        {qr && <img src={qr} alt="" style={{ width: 120, height: 120, margin: '2px auto' }} />}
        <p style={{ fontSize: 16, fontWeight: 'bold', marginTop: 5, lineHeight: 1.2 }}>
          {String(o.cliente_nombre || '')}
        </p>
        <p style={{ fontSize: 14, marginTop: 3 }}>
          Entrega: {o.fecha_entrega ? fechaCorta(o.fecha_entrega) : 'por definir'}
        </p>
        <p style={{ border: '1px solid #000', padding: '4px 0', fontWeight: 'bold',
                    fontSize: 14, marginTop: 6 }}>
          {o.entrega_domicilio ? 'DESPACHO A DOMICILIO' : 'ENTREGA EN LOCAL'}
        </p>
        {o.tipo_servicio === 'EXPRESS' && (
          <p style={{ fontWeight: 'bold', fontSize: 16, marginTop: 5 }}>** EXPRESS **</p>
        )}

        {/* Qué hay que hacer con esta ropa. Sin precios: al que lava no le
            sirven y ocupan el ancho del ticket. */}
        <div style={{ borderTop: '1px dashed #000', marginTop: 5, paddingTop: 4, textAlign: 'left' }}>
          {o.items.map((i: any) => (
            <div key={i.id} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', gap: 5, fontSize: 14 }}>
                <span style={{ fontWeight: 'bold', minWidth: 30 }}>{Number(i.cantidad)}x</span>
                <span style={{ flex: 1, lineHeight: 1.25, fontWeight: 'bold' }}>
                  {servicioCorto(i.nombre)}
                </span>
              </div>
              {/* La instrucción viaja pegada a su prenda, no perdida al final. */}
              {i.nota && (
                <p style={{ fontSize: 13, marginLeft: 30, lineHeight: 1.25,
                            borderLeft: '3px solid #000', paddingLeft: 5, marginTop: 2 }}>
                  {i.nota}
                </p>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold',
                        fontSize: 14, marginTop: 5, borderTop: '1px solid #000', paddingTop: 4 }}>
            <span>{Number(o.kilos) > 0 ? `${Number(o.kilos)} kg` : `${o.items.length} ${o.items.length === 1 ? 'ítem' : 'ítems'}`}</span>
            <span>{o.bultos} {Number(o.bultos) === 1 ? 'bulto' : 'bultos'}</span>
          </div>
        </div>

        {/* Manchas, instrucciones y lo que se recogió: es lo que evita reprocesos. */}
        {o.observaciones && (
          <p style={{ borderTop: '1px dashed #000', marginTop: 5, paddingTop: 4, fontSize: 13,
                      textAlign: 'left', lineHeight: 1.3 }}>{o.observaciones}</p>
        )}

        {/* Zona de corte entre un ticket y el siguiente.
            La impresora térmica avanza hasta el último punto de TINTA: las líneas
            en blanco no la mueven y el papel salía cortado al ras. Por eso acá van
            líneas visibles y separadas, que además sirven de guía para la tijera. */}
        {Array.from({ length: 4 }).map((_, k) => (
          <p key={k} style={{ borderTop: '1px dashed #000', marginTop: k === 0 ? 10 : 0,
                              height: '9mm', fontSize: 1, lineHeight: '9mm' }}>&nbsp;</p>
        ))}
        <p style={{ borderTop: '2px solid #000', fontSize: 9, paddingTop: 2,
                    letterSpacing: 1 }}>CORTAR AQUÍ</p>
      </div>

      <div className={`print-only text-black ${tipoTicket === 'interno' ? 'no-imprimir-ahora' : ''}`}
           style={{ width: '54mm', fontSize: '10px', fontFamily: 'monospace' }}>
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
      {modal === 'maquina' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Cobrar en la máquina</h2>
              <button onClick={() => { setModal(null); setPos(null) }}><X size={18} className="text-gray-400" /></button>
            </div>

            {!pos && !posError && (
              <>
                <p className="text-sm text-gray-500">Se le manda el monto de <strong className="text-pink-600">{fmt(o.saldo_pendiente)}</strong> a la máquina. El cliente solo pasa la tarjeta.</p>
                <button onClick={cobrarEnMaquina} className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm">
                  Mandar el cobro
                </button>
              </>
            )}

            {posError && (
              <>
                <p className="text-sm text-red-600">{posError}</p>
                <button onClick={() => { setPosError(''); setPos(null) }} className="w-full py-3 rounded-xl border text-sm font-medium text-gray-600">Reintentar</button>
              </>
            )}

            {pos?.cargando && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Mandando a la máquina…</p>}

            {pos?.mp_order_id && pos.estado !== 'PAGADA' && !['CANCELED','EXPIRED','FAILED'].includes(pos.estado) && (
              <>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center space-y-1">
                  <div className="text-2xl font-bold text-blue-700">{fmt(pos.monto)}</div>
                  <div className="text-sm text-blue-800 flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    {pos.estado === 'at_terminal' || pos.estado === 'EN_MAQUINA' ? 'En la máquina, esperando la tarjeta' : 'Esperando que la máquina lo tome'}
                  </div>
                </div>
                <p className="text-sm text-gray-500">Pásale la máquina al cliente. Si no aparece el monto, aprieta el botón verde del aparato.</p>
                <button onClick={cancelarMaquina} className="w-full py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium">Cancelar el cobro</button>
              </>
            )}

            {pos?.estado === 'PAGADA' && (
              <>
                <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center space-y-1">
                  <div className="text-2xl font-bold text-green-700">Pagado</div>
                  <div className="text-sm text-green-800">{fmt(pos.monto)} quedaron abonados al pedido</div>
                </div>
                <button onClick={() => { setModal(null); setPos(null) }} className="w-full py-3 rounded-xl bg-green-500 text-white font-semibold text-sm">Listo</button>
              </>
            )}

            {['CANCELED','EXPIRED','FAILED'].includes(pos?.estado) && (
              <>
                <p className="text-sm text-gray-600">El cobro {pos.estado === 'EXPIRED' ? 'expiró' : 'no se completó'}. Puedes mandarlo de nuevo.</p>
                <button onClick={() => setPos(null)} className="w-full py-3 rounded-xl border text-sm font-medium text-gray-600">Mandar otra vez</button>
              </>
            )}
          </div>
        </div>
      )}

      {modal === 'cobrar' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-bold">Cobrar con link</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            {!cobro ? (
              <>
                <p className="text-sm text-gray-500">Se genera un link de Mercado Pago por <strong className="text-pink-600">{fmt(o.saldo_pendiente)}</strong>. Cuando el cliente pague, el pedido se abona solo.</p>
                <button onClick={generarLink} disabled={generando} className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  {generando ? 'Generando…' : 'Generar el link'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">Link listo por <strong>{fmt(cobro.monto)}</strong>.</p>
                <input readOnly value={cobro.url} className={inp + ' bg-gray-50 text-xs'} onFocus={e => e.currentTarget.select()} />
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(cobro.url); toast.success('Link copiado') }} className="flex-1 py-3 rounded-xl border text-sm font-medium text-gray-600">Copiar link</button>
                  {cobro.whatsapp && <a href={cobro.whatsapp} target="_blank" rel="noreferrer" className="flex-1 py-3 rounded-xl bg-green-500 text-white text-sm font-semibold text-center">Mandar por WhatsApp</a>}
                </div>
                <p className="text-xs text-gray-400">El pedido queda sin pagar hasta que Mercado Pago avise que el cliente pagó.</p>
              </>
            )}
          </div>
        </div>
      )}

      {modal === 'comprobante' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-bold">Comprobante de transferencia</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            <p className="text-sm text-gray-500">El cliente mandó el comprobante. Se abona el pedido, pero queda en <strong>Pagos por revisar</strong> hasta que alguien confirme contra la cartola.</p>
            <input type="number" value={comp.monto} onChange={e => setComp({ ...comp, monto: e.target.value })} placeholder="Monto transferido" className={inp} />
            <input value={comp.nombre_origen} onChange={e => setComp({ ...comp, nombre_origen: e.target.value })} placeholder="Nombre de quien transfirió (opcional)" className={inp} />
            <input value={comp.nota} onChange={e => setComp({ ...comp, nota: e.target.value })} placeholder="Nota (opcional)" className={inp} />
            <div className="flex gap-2">
              <button onClick={guardarComprobante} className="flex-1 py-3 rounded-xl bg-green-500 text-white font-semibold text-sm">Anotar comprobante</button>
              <button onClick={() => setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'pago' && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Registrar pago</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            <p className="text-sm text-gray-500">Saldo pendiente: <strong className="text-pink-600">{fmt(o.saldo_pendiente)}</strong></p>
            <select value={pago.forma_pago_id} onChange={e => setPago({ ...pago, forma_pago_id: e.target.value })} className={inp}>
              <option value="">Forma de pago…</option>{formas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
            <input type="number" value={pago.monto} onChange={e => setPago({ ...pago, monto: e.target.value })} placeholder="Monto" className={inp} />
            <input value={pago.referencia || ''} onChange={e => setPago({ ...pago, referencia: e.target.value })}
              placeholder={esPagoMercadoPago(pago.forma_pago_id) ? 'N.° de operación de Mercado Pago' : 'Referencia (opcional)'} className={inp} />
            {esPagoMercadoPago(pago.forma_pago_id) && (
              <p className="text-xs text-gray-500 -mt-1">Está en la pantalla de la máquina y en el ticket. Con ese número se reimprime el comprobante y se ubica la boleta.</p>
            )}
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

      {modal === 'deshacer' && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Deshacer la entrega</h2>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600">
              La orden vuelve a quedar <b>lista</b>, se borra la hora de entrega y, si estaba
              programada para hoy, reaparece en el recorrido del conductor.
            </p>
            {Number(o.monto_abonado) > 0 && (
              <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2">
                Ojo: esta orden tiene {fmt(o.monto_abonado)} pagados. El dinero no se toca —
                si hay que devolverlo, se hace aparte.
              </p>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700">¿Por qué se deshace?</label>
              <textarea value={motivoVuelta} onChange={e => setMotivoVuelta(e.target.value)} rows={2} autoFocus
                        placeholder="Ej: se marcó por error, el pedido nunca salió del local"
                        className={inp + ' mt-1'} />
              <p className="text-[11px] text-gray-400 mt-1">Queda en el historial con tu nombre y la hora.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setModal(null)} className="py-2.5 rounded-xl border text-gray-600 text-sm">Cancelar</button>
              <button onClick={deshacerEntrega}
                      className="py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#d97706' }}>
                Deshacer entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'logistica' && edit && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Editar retiro y entrega</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            <div>
              <label className="text-xs text-gray-500">N° OT en EasyLaundry</label>
              <input value={edit.ot_easylaundry || ''} onChange={e => setEdit({ ...edit, ot_easylaundry: e.target.value })}
                     inputMode="numeric" placeholder="para aparear en el cotejo" className={inp} />
            </div>
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
      {nota && (
        <div className="no-print fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
             onClick={() => setNota(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 space-y-3"
               onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800">Instrucción para operaciones</h2>
            <p className="text-xs text-gray-500">{nota.nombre}</p>
            <textarea value={nota.nota} rows={3} autoFocus
                      onChange={e => setNota({ ...nota, nota: e.target.value })}
                      placeholder="Mancha de vino en la solapa, no usar secadora, etc."
                      className="w-full border rounded-xl px-3 py-2 text-sm" />
            <p className="text-[11px] text-gray-400">Sale impresa en el ticket interno, junto a este servicio.</p>
            <div className="flex gap-2">
              {nota.nota && (
                <button onClick={() => guardarNota('')} className="px-4 py-3 rounded-xl border text-sm text-red-600">
                  Borrar
                </button>
              )}
              <button onClick={() => guardarNota(nota.nota)} className="flex-1 py-3 rounded-xl text-white font-medium"
                      style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
