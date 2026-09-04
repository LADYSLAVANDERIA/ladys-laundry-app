import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Scale, Package, Clock, CheckCircle2, Truck, Store, Zap, Phone, AlertTriangle, TrendingUp, CreditCard, ChevronRight, ChevronDown, Loader2, Radio, MapPin } from 'lucide-react'
import { fmt, ot, fechaCorta, fechaHora, hora } from '../utils'
import MapaEnVivo from '../components/MapaEnVivo'

const SEG_URL = (import.meta.env.VITE_API_URL || '').replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-seguimiento')
const PORTAL = (import.meta.env.VITE_API_URL || '').replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-portal')
const ESTADOS: Record<string, { t: string; c: string }> = {
  PRE_ORDEN:  { t: 'Por retirar', c: 'bg-orange-100 text-orange-700' },
  EN_PROCESO: { t: 'En proceso',  c: 'bg-yellow-100 text-yellow-700' },
  LISTA:      { t: 'Lista',       c: 'bg-green-100 text-green-700' },
  ENTREGADA:  { t: 'Entregada',   c: 'bg-gray-100 text-gray-500' },
}

// Cada pedido consulta su estado de reparto: si va en camino, muestra el
// distintivo y permite desplegar el mapa en vivo sin salir del portal.
function TarjetaPedido({ o, seg, abierto, onToggle }: { o: any; seg: any; abierto: boolean; onToggle: () => void }) {
  const enCamino = seg?.estado === 'EN_CAMINO'
  const enRuta = seg && seg.estado !== 'SIN_RUTA' && seg.destino

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${enCamino ? 'ring-2' : ''}`}
         style={enCamino ? { borderColor: '#4AAEE0', boxShadow: '0 0 0 2px #4AAEE033' } : {}}>
      <div className="p-4 cursor-pointer" onClick={() => enRuta ? onToggle() : (window.location.hash = `#/ot/${o.id}/${o.token_publico}`)}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">{ot(o.id)}</span>
              {enCamino ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full text-white flex items-center gap-1"
                      style={{ background: '#4AAEE0' }}>
                  <Radio size={9} className="animate-pulse" /> En camino
                </span>
              ) : (
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${ESTADOS[o.estado]?.c || ''}`}>
                  {ESTADOS[o.estado]?.t || o.estado}
                </span>
              )}
              {o.tipo_servicio === 'EXPRESS' && <Zap size={11} className="text-amber-500" />}
              {o.es_membresia && <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Plan</span>}
            </div>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              {o.entrega_domicilio ? <Truck size={11} /> : <Store size={11} />}
              {o.fecha_entrega ? `Entrega ${fechaCorta(o.fecha_entrega)}` : fechaCorta(o.creado_en)}
              {Number(o.kilos) > 0 && ` · ${Number(o.kilos)} kg`}
            </p>
            {enCamino && seg?.eta_min != null && !abierto && (
              <p className="text-xs mt-1.5 font-medium flex items-center gap-1" style={{ color: '#2b7fa8' }}>
                <MapPin size={11} /> Llega en unos {seg.eta_min} min · toca para ver el mapa
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0 flex items-center gap-2">
            <div>
              <p className="font-bold text-gray-800">{fmt(o.monto_total)}</p>
              {Number(o.saldo_pendiente) > 0
                ? <p className="text-[11px] text-red-500">debe {fmt(o.saldo_pendiente)}</p>
                : <p className="text-[11px] text-green-600">pagada</p>}
            </div>
            {enRuta
              ? (abierto ? <ChevronDown size={16} className="text-gray-300" /> : <ChevronRight size={16} className="text-gray-300" />)
              : <ChevronRight size={16} className="text-gray-300" />}
          </div>
        </div>
      </div>

      {abierto && enRuta && (
        <div className="border-t">
          <MapaEnVivo datos={seg} />
          <a href={`#/ot/${o.id}/${o.token_publico}`}
             className="block text-center py-2.5 text-xs text-gray-500 border-t">
            Ver el detalle del pedido
          </a>
        </div>
      )}
    </div>
  )
}

export default function PortalCliente() {
  const { id, token } = useParams()
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'inicio' | 'pedidos' | 'movimientos'>('inicio')
  const [segs, setSegs] = useState<Record<number, any>>({})
  const [abierta, setAbierta] = useState<number | null>(null)

  useEffect(() => {
    axios.get(`${PORTAL}/${id}/${token}`).then(r => setD(r.data))
      .catch(e => setError(e.response?.data?.error || 'No pudimos abrir tu cuenta'))
  }, [id, token])

  useEffect(() => {
    const activos = (d?.ordenes || [])
      .filter((o: any) => o.estado !== 'ENTREGADA' && o.estado !== 'ANULADA').slice(0, 5)
    if (!activos.length) return
    let vivo = true
    const traer = () => {
      Promise.all(activos.map((o: any) =>
        axios.get(`${SEG_URL}/seguir/${o.id}/${o.token_publico}`)
          .then(r => [o.id, r.data]).catch(() => [o.id, null])))
        .then(pares => { if (vivo) setSegs(Object.fromEntries(pares.filter((x: any) => x[1]))) })
    }
    traer()
    const t = setInterval(traer, 15000)
    return () => { vivo = false; clearInterval(t) }
  }, [d])

  if (error) return <div className="min-h-screen flex items-center justify-center p-8 text-center text-gray-500">{error}</div>
  if (!d) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-pink-500" size={32} /></div>

  const m = d.membresia
  const wa = d.local?.whatsapp
  const enCamino = d.ordenes?.find((o: any) => segs[o.id]?.estado === 'EN_CAMINO')

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Cabecera */}
      <div className="text-white px-5 pt-6 pb-8" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
        <p className="text-sm opacity-80">{d.local?.nombre || 'Ladys Lavandería'}</p>
        <h1 className="text-2xl font-bold">Hola, {String(d.cliente.nombre).split(' ')[0]}</h1>
        {m && <p className="text-sm opacity-90">{m.plan}</p>}
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-5 space-y-4">
        {/* Va en camino: lo primero que ve al abrir, sin entrar a Pedidos */}
        {enCamino && (
          <button onClick={() => { setTab('pedidos'); setAbierta(enCamino.id) }}
                  className="w-full text-left rounded-2xl p-4 shadow-sm text-white flex items-center gap-3"
                  style={{ background: 'linear-gradient(135deg,#4AAEE0,#2b7fa8)' }}>
            <div className="w-11 h-11 rounded-full bg-white/25 flex items-center justify-center shrink-0">
              <Truck size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold flex items-center gap-1.5">
                <Radio size={11} className="animate-pulse" />
                {segs[enCamino.id]?.tipo === 'RETIRO' ? 'Vamos a retirar tu ropa' : 'Tu pedido va en camino'}
              </p>
              <p className="text-sm opacity-95">
                {segs[enCamino.id]?.eta_min != null
                  ? `Llegamos en unos ${segs[enCamino.id].eta_min} min · toca para ver el mapa`
                  : 'Toca para seguir al conductor en el mapa'}
              </p>
            </div>
            <ChevronRight size={18} className="opacity-80" />
          </button>
        )}
        {/* Kilos disponibles */}
        {m ? (
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            {m.modalidad === 'KILOS' ? (
              <>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 flex items-center gap-1"><Scale size={12} /> KILOS DISPONIBLES</p>
                    {m.sin_tope
                      ? <p className="text-3xl font-bold text-pink-600">Sin tope</p>
                      : <p className="text-4xl font-bold text-pink-600 leading-none">{m.restantes}<span className="text-xl text-gray-400"> / {m.cupo} kg</span></p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Renueva en</p>
                    <p className="text-lg font-bold text-gray-700">{m.dias_restantes} días</p>
                    <p className="text-[11px] text-gray-400">{fechaCorta(m.ciclo_fin)}</p>
                  </div>
                </div>
                {!m.sin_tope && (
                  <div className="h-3 bg-gray-100 rounded-full mb-2">
                    <div className="h-3 rounded-full transition-all" style={{ width: `${Math.max(m.pct, 2)}%`, background: m.pct > 40 ? 'linear-gradient(90deg,#E8177A,#A87BC8)' : m.pct > 15 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                )}
                <p className="text-xs text-gray-500">Usaste {m.usados} kg de este ciclo{!m.sin_tope && m.restantes <= m.cupo * 0.2 && ', te queda poco'}.</p>

                {m.extra_ciclo > 0 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle size={14} /> Kilos adicionales</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Este ciclo usaste {m.kilos_extra_ciclo} kg sobre tu plan, a {fmt(m.kilo_adicional)} por kilo.
                    </p>
                    <p className="text-xl font-bold text-amber-800 mt-1">{fmt(m.extra_ciclo)}</p>
                    <p className="text-[11px] text-amber-600">Se cobra junto con tu próximo pedido.</p>
                  </div>
                )}
                {!m.sin_tope && m.restantes === 0 && m.extra_ciclo === 0 && (
                  <p className="mt-3 text-xs bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-700">
                    Se te acabaron los kilos del ciclo. Los siguientes se cobran a {fmt(m.kilo_adicional)} el kilo.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-gray-400">SALDO DISPONIBLE</p>
                <p className="text-4xl font-bold text-pink-600">{fmt(m.saldo_dinero)}</p>
                <p className="text-xs text-gray-500 mt-1">Vence {fechaCorta(m.ciclo_fin)}</p>
              </>
            )}
          </div>
        ) : d.planes?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <p className="font-semibold text-gray-800 flex items-center gap-2"><CreditCard size={16} className="text-purple-500" /> Únete a El Club</p>
            <p className="text-xs text-gray-500 mt-1 mb-3">Kilos incluidos todos los meses, retiro y entrega, sin preocuparte de la cuenta.</p>
            <div className="space-y-2">
              {d.planes.map((p: any, i: number) => (
                <a key={i} href={p.link_pago} target="_blank" rel="noreferrer" className="flex items-center justify-between border rounded-xl px-3 py-2.5 hover:border-pink-300">
                  <div>
                    <p className="text-sm font-medium">{p.nombre.replace('Club ', '')}</p>
                    <p className="text-[11px] text-gray-400">{Number(p.kilos_incluidos) > 0 ? `${Number(p.kilos_incluidos)} kilos al mes` : 'Sin tope de kilos'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-pink-600 text-sm">{fmt(p.precio)}</span>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Saldo por pagar */}
        {Number(d.resumen?.saldo) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
            <div><p className="text-xs text-red-600">Tienes pendiente</p><p className="text-xl font-bold text-red-700">{fmt(d.resumen.saldo)}</p></div>
            {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hola, quiero pagar mi saldo pendiente')}`} target="_blank" rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-medium">Pagar</a>}
          </div>
        )}

        {/* Pestañas */}
        <div className="flex gap-1.5">
          {[['inicio', 'Resumen'], ['pedidos', `Pedidos${d.en_proceso ? ` (${d.en_proceso})` : ''}`], ...(m ? [['movimientos', 'Movimientos']] : [])].map(([k, l]: any) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium ${tab === k ? 'text-white' : 'bg-white border text-gray-500'}`}
              style={tab === k ? { background: 'linear-gradient(135deg,#E8177A,#A87BC8)' } : {}}>{l}</button>
          ))}
        </div>

        {tab === 'inicio' && (
          <div className="grid grid-cols-2 gap-3">
            {[['Pedidos', d.resumen?.ordenes || 0, Package], ['Kilos lavados', `${Number(d.resumen?.kilos || 0)} kg`, Scale],
              ['Total en servicios', fmt(d.resumen?.gasto), TrendingUp], ['Cliente desde', fechaCorta(d.resumen?.desde), Clock]].map(([l, v, I]: any, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border p-4">
                <p className="text-[11px] text-gray-400 flex items-center gap-1"><I size={11} /> {l}</p>
                <p className="text-lg font-bold text-gray-800">{v}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'pedidos' && (
          <div className="space-y-2">
            {d.ordenes.map((o: any) => (
              <TarjetaPedido key={o.id} o={o} seg={segs[o.id]}
                abierto={abierta === o.id}
                onToggle={() => setAbierta(abierta === o.id ? null : o.id)} />
            ))}
            {!d.ordenes.length && <p className="text-center text-gray-400 py-10 text-sm">Todavía no tienes pedidos</p>}
          </div>
        )}

        {tab === 'movimientos' && m && (
          <div className="bg-white rounded-2xl shadow-sm border divide-y">
            {m.movimientos.map((mv: any, i: number) => (
              <div key={i} className="flex items-start justify-between px-4 py-3">
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium">
                    {mv.tipo === 'CONSUMO_KILOS' ? `Pedido ${mv.orden_id ? ot(mv.orden_id) : ''}`
                      : mv.tipo === 'EXTRA' ? 'Kilos adicionales'
                      : mv.tipo === 'RENOVACION' ? 'Renovación del plan'
                      : mv.tipo === 'CARGA' ? 'Inicio del plan' : mv.tipo}
                  </p>
                  <p className="text-[11px] text-gray-400">{mv.detalle}</p>
                  <p className="text-[11px] text-gray-300">{fechaHora(mv.creado_en)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {Number(mv.kilos) > 0 && <p className={`text-sm font-bold ${mv.tipo === 'CONSUMO_KILOS' ? 'text-purple-600' : 'text-green-600'}`}>
                    {mv.tipo === 'CONSUMO_KILOS' ? '-' : '+'}{Number(mv.kilos)} kg</p>}
                  {Number(mv.monto) > 0 && mv.tipo === 'EXTRA' && <p className="text-xs text-amber-700">{fmt(mv.monto)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {wa && (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hola, necesito coordinar un retiro')}`} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-green-500 text-white font-semibold text-sm">
            <Phone size={16} /> Pedir un retiro por WhatsApp
          </a>
        )}
        <p className="text-center text-[11px] text-gray-400">{d.local?.horario}</p>
      </div>
    </div>
  )
}
