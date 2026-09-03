import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Package, MapPin, Phone, Clock, CheckCircle2, Truck, Store, Zap } from 'lucide-react'
import { fmt, ot, fechaLarga, fechaHora, hora } from '../utils'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const PASOS = [
  { k: 'PRE_ORDEN',  t: 'Recibimos tu solicitud' },
  { k: 'EN_PROCESO', t: 'Tu ropa está con nosotros' },
  { k: 'LISTA',      t: 'Lista para entregar' },
  { k: 'ENTREGADA',  t: 'Entregada' },
]

export default function OrdenPublica() {
  const { id, token } = useParams()
  const [o, setO] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get(`${BASE}/publico/${id}/${token}`).then(r => setO(r.data)).catch(() => setError('No encontramos esta orden. Revisa el enlace.'))
  }, [id, token])

  if (error) return <div className="min-h-screen flex items-center justify-center p-8 text-center text-gray-500">{error}</div>
  if (!o) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div>

  const idx = PASOS.findIndex(x => x.k === o.estado)
  const anulada = o.estado === 'ANULADA'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-5 py-6" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
        <p className="text-sm opacity-80">{o.local?.nombre || 'Ladys Lavandería'}</p>
        <h1 className="text-3xl font-bold">Orden {ot(o.id)}</h1>
        <p className="text-sm opacity-90">{o.cliente_nombre}</p>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 -mt-4">
        {/* Estado */}
        <div className="bg-white rounded-2xl shadow-sm border p-5">
          {anulada ? <p className="text-red-600 font-medium">Esta orden fue anulada.</p> : (
            <div className="space-y-3">
              {PASOS.map((s, i) => (
                <div key={s.k} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${i <= idx ? 'text-white' : 'bg-gray-100 text-gray-300'}`}
                    style={i <= idx ? { background: 'linear-gradient(135deg,#E8177A,#A87BC8)' } : {}}>
                    {i <= idx ? <CheckCircle2 size={15} /> : <span className="text-xs">{i + 1}</span>}
                  </div>
                  <p className={`text-sm ${i === idx ? 'font-bold text-gray-800' : i < idx ? 'text-gray-600' : 'text-gray-400'}`}>{s.t}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entrega */}
        <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-2">
          <p className="font-semibold text-gray-700 flex items-center gap-2">
            {o.entrega_domicilio ? <Truck size={16} className="text-pink-500" /> : <Store size={16} className="text-pink-500" />}
            {o.entrega_domicilio ? 'Entrega a domicilio' : 'Retiro en el local'}
          </p>
          {o.fecha_entrega && <p className="text-sm text-gray-600 capitalize flex items-center gap-2"><Clock size={13} className="text-gray-400" />{fechaLarga(o.fecha_entrega)}{o.entrega_domicilio && o.ruta_entrega_hora ? ` · entre ${hora(o.ruta_entrega_hora)} y ${hora(o.ruta_entrega_fin)}` : ''}</p>}
          {!o.entrega_domicilio && o.local?.dir_salida && <p className="text-sm text-gray-600 flex items-start gap-2"><MapPin size={13} className="text-gray-400 mt-0.5" />{o.local.dir_salida}</p>}
          {o.tipo_servicio === 'EXPRESS' && <p className="text-sm text-amber-600 flex items-center gap-1"><Zap size={13} /> Servicio express</p>}
          <p className="text-xs text-gray-400">Ingresada el {fechaHora(o.creado_en)} · {o.bultos} bulto{Number(o.bultos) > 1 ? 's' : ''}</p>
        </div>

        {/* Detalle */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 text-xs font-semibold text-gray-500 flex items-center gap-1.5"><Package size={12} /> DETALLE</div>
          {o.items.map((i: any, n: number) => (
            <div key={n} className="flex justify-between px-4 py-2.5 border-b last:border-0 text-sm">
              <span className="text-gray-700">{i.nombre} <span className="text-gray-400">× {Number(i.cantidad)}</span></span>
              <span className="font-medium">{fmt(i.subtotal)}</span>
            </div>
          ))}
          <div className="px-4 py-3 bg-gray-50 space-y-1 text-sm">
            {Number(o.descuento_monto) > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-{fmt(o.descuento_monto)}</span></div>}
            {Number(o.monto_delivery) > 0 && <div className="flex justify-between text-gray-500"><span>Delivery</span><span>{fmt(o.monto_delivery)}</span></div>}
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-pink-600">{fmt(o.monto_total)}</span></div>
            {Number(o.saldo_pendiente) > 0
              ? <div className="flex justify-between text-red-600 font-semibold"><span>Saldo por pagar</span><span>{fmt(o.saldo_pendiente)}</span></div>
              : <p className="text-green-600 text-sm font-medium">Pagada ✓</p>}
          </div>
        </div>

        {/* Fotos */}
        {o.fotos?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">FOTOS DE TU PEDIDO</p>
            <div className="grid grid-cols-3 gap-2">
              {o.fotos.map((f: any, n: number) => (
                <a key={n} href={f.url} target="_blank" rel="noreferrer">
                  <img src={f.url} alt="" className="w-full h-24 object-cover rounded-xl border" />
                </a>
              ))}
            </div>
          </div>
        )}

        {o.observaciones && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">{o.observaciones}</div>}

        {o.local?.whatsapp && (
          <a href={`https://wa.me/${o.local.whatsapp}?text=${encodeURIComponent(`Hola, consulto por mi orden ${ot(o.id)}`)}`} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-500 text-white font-semibold text-sm">
            <Phone size={15} /> Escribirnos por WhatsApp
          </a>
        )}
        <p className="text-center text-xs text-gray-400 pb-6">{o.local?.horario}</p>
      </div>
    </div>
  )
}
