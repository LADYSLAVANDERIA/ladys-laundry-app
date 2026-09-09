import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Clock, Package, QrCode, RefreshCw, MessageSquare, Send } from 'lucide-react'
import { tallerApi, tallerChatApi } from '../services/api'
import { ot } from '../utils'

// La vista de trabajo del taller. Producción tiene la estación de escaneo, que
// sirve para MARCAR; esto es lo otro: qué hay que hacer y en qué orden.
//
// El orden lo decide la fecha comprometida, no el número de orden. Un pedido que
// se entrega hoy va antes que uno que entró antes pero se entrega el viernes.

const COLOR: Record<string, { fondo: string; borde: string; texto: string; etiqueta: string }> = {
  atrasado:  { fondo: '#FEF2F2', borde: '#FECACA', texto: '#991B1B', etiqueta: 'Atrasado' },
  hoy:       { fondo: '#FFF7ED', borde: '#FED7AA', texto: '#9A3412', etiqueta: 'Sale hoy' },
  manana:    { fondo: '#FEFCE8', borde: '#FDE68A', texto: '#854D0E', etiqueta: 'Sale mañana' },
  holgado:   { fondo: '#F8FAFC', borde: '#E2E8F0', texto: '#475569', etiqueta: '' },
  sin_fecha: { fondo: '#F5F3FF', borde: '#DDD6FE', texto: '#5B21B6', etiqueta: 'Sin fecha' },
}

function Ficha({ p }: { p: any }) {
  const c = COLOR[p.urgencia] || COLOR.holgado
  const quieto = p.horas_en_etapa != null && p.horas_en_etapa >= 24
  return (
    <Link to={`/ordenes/${p.id}`}
          className="block rounded-xl border p-3 mb-2"
          style={{ background: c.fondo, borderColor: c.borde }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-800">{ot(p.id)} · {p.cliente}</p>
          <p className="text-xs text-gray-600 truncate">{p.detalle || 'sin ítems cargados'}</p>
        </div>
        {c.etiqueta && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ color: c.texto, background: '#fff', border: `1px solid ${c.borde}` }}>
            {c.etiqueta}
          </span>
        )}
      </div>

      {p.observaciones && (
        <p className="mt-2 text-xs flex items-start gap-1.5 text-gray-700 bg-white/70 rounded-lg px-2 py-1.5">
          <MessageSquare size={12} className="mt-0.5 shrink-0" />
          <span>{p.observaciones}</span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
        {Number(p.kilos) > 0 && <span>{p.kilos} kg</span>}
        {Number(p.bultos) > 0 && <span>· {p.bultos} bulto{Number(p.bultos) > 1 ? 's' : ''}</span>}
        {p.tipo_servicio === 'EXPRESS' && <span className="font-semibold text-pink-600">· EXPRESS</span>}
        {p.entrega_domicilio && <span>· a domicilio{p.ruta_entrega ? ` (${p.ruta_entrega})` : ''}</span>}
        {quieto && (
          <span className="flex items-center gap-1 font-semibold text-amber-700">
            <Clock size={11} /> {Math.floor(p.horas_en_etapa / 24)} día(s) en esta etapa
          </span>
        )}
      </div>
    </Link>
  )
}


// Lo que pasa en el taller se decide en el momento: un pedido que se lavo en tres
// cargas, una maquina que se detuvo, un cobertor que hubo que resecar. Si nadie
// lo escribe, se pierde, y el calculo de plazos queda en adivinanza.
function Conversacion() {
  const [msgs, setMsgs] = useState<any[]>([])
  const [txt, setTxt] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = () => tallerChatApi.leer().then(r => setMsgs(r.data.mensajes || [])).catch(() => {})
  useEffect(() => { cargar(); const t = setInterval(cargar, 45000); return () => clearInterval(t) }, [])

  const enviar = async () => {
    const t = txt.trim()
    if (!t) return
    setEnviando(true)
    try { await tallerChatApi.responder(t); setTxt(''); cargar() } finally { setEnviando(false) }
  }

  const abiertas = msgs.filter(m => m.de === 'SISTEMA' && !m.leido)

  return (
    <div className="bg-white border rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="font-bold text-gray-800 text-sm">Cuéntanos del taller</h2>
        <p className="text-xs text-gray-500">
          Si un pedido se lavó en varias cargas, si una máquina falló, si algo hubo que
          rehacer: escríbelo acá. Con eso el sistema aprende cuánto demora de verdad
          cada cosa, en vez de suponerlo.
        </p>
      </div>

      {abiertas.map(m => (
        <div key={m.id} className="text-sm rounded-xl px-3 py-2.5 bg-blue-50 border border-blue-200 text-blue-900">
          <b>Pregunta:</b> {m.texto}
        </div>
      ))}

      <div className="max-h-56 overflow-y-auto space-y-2">
        {msgs.slice(-12).map(m => (
          <div key={m.id}
               className={`text-sm rounded-xl px-3 py-2 ${m.de === 'TALLER'
                 ? 'bg-gray-50 text-gray-800'
                 : 'bg-blue-50/60 text-blue-900'}`}>
            <span className="text-[11px] text-gray-400 block">
              {m.de === 'TALLER' ? (m.quien || 'Taller') : 'Sistema'} ·{' '}
              {new Date(m.creado_en).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            {m.orden_id ? <b>#{m.orden_id} · </b> : null}{m.texto}
          </div>
        ))}
        {!msgs.length && <p className="text-xs text-gray-400 py-3 text-center">Todavía no hay nada escrito.</p>}
      </div>

      <div className="flex gap-2">
        <input value={txt} onChange={e => setTxt(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') enviar() }}
               placeholder="Por ejemplo: la 6465 fueron 3 cargas, eran cobertores"
               className="flex-1 border rounded-xl px-3 py-2.5 text-sm" />
        <button onClick={enviar} disabled={enviando || !txt.trim()}
                className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

export default function Taller() {
  const [d, setD] = useState<any>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = () => {
    setCargando(true)
    tallerApi.cola().then(r => setD(r.data)).catch(() => {}).finally(() => setCargando(false))
  }
  // Se refresca solo: en el taller nadie va a estar apretando un botón.
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t) }, [])

  if (cargando && !d) return <p className="text-sm text-gray-400 py-10 text-center">Cargando el taller…</p>
  if (!d) return null

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">El taller</h1>
          <p className="text-sm text-gray-500">{d.total} pedidos con ropa acá adentro</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="p-2.5 rounded-xl border text-gray-500">
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
          </button>
          <Link to="/produccion"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            <QrCode size={15} /> Escanear
          </Link>
        </div>
      </div>

      {(d.atrasados > 0 || d.para_hoy > 0) && (
        <div className="flex gap-2 flex-wrap">
          {d.atrasados > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-800">
              <AlertTriangle size={14} /> {d.atrasados} atrasado{d.atrasados > 1 ? 's' : ''}
            </span>
          )}
          {d.para_hoy > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-800">
              <Package size={14} /> {d.para_hoy} sale{d.para_hoy > 1 ? 'n' : ''} hoy
            </span>
          )}
        </div>
      )}

      <Conversacion />

      {d.etapas.map((e: any) => (
        <section key={e.id}>
          <h2 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            {e.titulo}
            <span className="text-xs font-normal text-gray-400">{e.pedidos.length}</span>
          </h2>
          {e.pedidos.map((p: any) => <Ficha key={p.id} p={p} />)}
        </section>
      ))}

      {!d.etapas.length && (
        <p className="text-sm text-gray-400 py-10 text-center">No hay pedidos en proceso.</p>
      )}
    </div>
  )
}
