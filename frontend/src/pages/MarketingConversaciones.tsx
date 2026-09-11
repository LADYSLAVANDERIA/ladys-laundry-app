import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { MessageCircle, Undo2, SkipForward, Pencil, Check, ChevronDown, RefreshCw, Search } from 'lucide-react'
import { marketingApi } from '../services/api'
import { fmt, telWa } from '../utils'

// Conversaciones que quedaron a medias: gente que escribió pidiendo un retiro y
// no terminó agendando, casi siempre porque no llegaba al pedido mínimo. Son los
// más recuperables de todos, porque ya querían el servicio.

const MOTIVO: Record<string, { titulo: string, detalle: string, color: string }> = {
  minimo:      { titulo: 'Por el mínimo', detalle: 'Se habló del pedido mínimo y no siguieron', color: 'bg-amber-100 text-amber-800' },
  sin_cierre:  { titulo: 'Sin cierre',    detalle: 'Pidieron retiro y la conversación quedó ahí', color: 'bg-sky-100 text-sky-700' },
  horario:     { titulo: 'Por horario',   detalle: 'No les acomodó el horario de ruta', color: 'bg-violet-100 text-violet-700' },
}

const primerNombre = (n?: string) => {
  const p = String(n || '').trim().split(/\s+/)[0] || ''
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''
}
const lindo = (n?: string) =>
  String(n || '').trim().toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase()) || 'Sin nombre'

const armar = (plantilla: string, c: any) =>
  (plantilla || '').replace(/\{nombre\}/g, primerNombre(c.nombre))

type Filtro = 'pendientes' | 'enviados' | 'volvieron'

export default function MarketingConversaciones() {
  const [items, setItems] = useState<any[]>([])
  const [plantilla, setPlantilla] = useState('')
  const [cargando, setCargando] = useState(true)
  const [escaneando, setEscaneando] = useState(false)
  const [motivo, setMotivo] = useState<string>('todos')
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [editandoPl, setEditandoPl] = useState(false)
  const [textoPl, setTextoPl] = useState('')
  const [editMsg, setEditMsg] = useState<Record<number, string>>({})
  const [abierto, setAbierto] = useState<number | null>(null)

  const cargar = () => {
    setCargando(true)
    marketingApi.conversaciones()
      .then(r => { setItems(r.data.items || []); setPlantilla(r.data.plantilla || '') })
      .catch(() => toast.error('No pude cargar las conversaciones'))
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const escanear = async () => {
    setEscaneando(true)
    try {
      const r = await marketingApi.convEscanear(60)
      if (r.data.error) toast.error(r.data.error)
      else toast.success(`${r.data.guardadas} nuevas de ${r.data.revisadas} conversaciones`)
      cargar()
    } catch { toast.error('No se pudo revisar WhatsApp') }
    finally { setEscaneando(false) }
  }

  const mensajeDe = (c: any) => editMsg[c.id] ?? armar(plantilla, c)

  const enviar = (c: any) => {
    const msg = mensajeDe(c)
    window.open(`https://wa.me/${telWa(c.telefono)}?text=${encodeURIComponent(msg)}`, '_blank')
    setItems(xs => xs.map(x => x.id === c.id ? { ...x, estado: 'ENVIADO', enviado_en: new Date().toISOString() } : x))
    marketingApi.convEnviado({ id: c.id, mensaje: msg })
      .catch(() => {
        toast.error(`No quedó registrado el envío a ${primerNombre(c.nombre)}`)
        setItems(xs => xs.map(x => x.id === c.id ? { ...x, estado: null, enviado_en: null } : x))
      })
  }

  const saltar = (c: any) => {
    setItems(xs => xs.map(x => x.id === c.id ? { ...x, estado: 'DESCARTADO' } : x))
    marketingApi.convDescartar({ id: c.id }).catch(() => { toast.error('No se pudo saltar'); cargar() })
  }

  const deshacer = (c: any) => {
    setItems(xs => xs.map(x => x.id === c.id ? { ...x, estado: null, enviado_en: null } : x))
    marketingApi.convDeshacer(c.id).catch(() => { toast.error('No se pudo deshacer'); cargar() })
  }

  const guardarPlantilla = async () => {
    try {
      await marketingApi.plantilla('conversacion', textoPl)
      setPlantilla(textoPl); setEditandoPl(false)
      toast.success('Mensaje guardado')
    } catch { toast.error('No se pudo guardar') }
  }

  const delMotivo = useMemo(() =>
    items.filter(c => motivo === 'todos' || c.motivo === motivo), [items, motivo])
  const visibles = useMemo(() => delMotivo.filter(c =>
    filtro === 'pendientes' ? !c.estado :
    filtro === 'enviados' ? c.estado === 'ENVIADO' :
    c.estado === 'ENVIADO' && c.volvio_en), [delMotivo, filtro])

  const cuenta = (m: string) => {
    const l = items.filter(c => m === 'todos' || c.motivo === m)
    return { total: l.length, hechos: l.filter(c => c.estado).length }
  }
  const enviados = items.filter(c => c.estado === 'ENVIADO')
  const volvieron = enviados.filter(c => c.volvio_en)
  const tot = cuenta('todos')

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm text-gray-500">
          Escribieron pidiendo un retiro y no llegaron a agendar. Ya querían el servicio:
          son los más fáciles de recuperar.
        </p>
        <button onClick={escanear} disabled={escaneando}
          className="flex items-center gap-2 px-3 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          <Search size={14} className={escaneando ? 'animate-pulse' : ''} />
          {escaneando ? 'Revisando…' : 'Revisar WhatsApp'}
        </button>
        <button onClick={cargar} className="p-2.5 border rounded-xl text-gray-500 hover:bg-gray-50">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{tot.total - tot.hechos}</p>
          <p className="text-xs text-gray-500">Por escribir</p>
        </div>
        <div className="bg-white border rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{enviados.length}</p>
          <p className="text-xs text-gray-500">Enviados</p>
        </div>
        <div className="bg-white border rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-pink-600">{volvieron.length}</p>
          <p className="text-xs text-gray-500">Agendaron</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['todos', 'minimo', 'sin_cierre', 'horario'].map(m => {
          const k = cuenta(m)
          if (m !== 'todos' && !k.total) return null
          return (
            <button key={m} onClick={() => setMotivo(m)}
              className={`whitespace-nowrap px-3 py-2 rounded-xl text-sm font-medium border ${motivo === m ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600'}`}>
              {m === 'todos' ? 'Todas' : MOTIVO[m].titulo} <span className="opacity-70">{k.hechos}/{k.total}</span>
            </button>
          )
        })}
      </div>
      {motivo !== 'todos' && <p className="text-xs text-gray-500 -mt-2">{MOTIVO[motivo].detalle}</p>}

      <div className="bg-white border rounded-2xl p-4">
        {editandoPl ? (
          <>
            <textarea value={textoPl} onChange={e => setTextoPl(e.target.value)} rows={7}
              className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <p className="text-xs text-gray-400 mt-1">Usa {'{nombre}'} para el primer nombre.</p>
            <div className="flex gap-2 mt-2">
              <button onClick={guardarPlantilla} className="flex-1 bg-pink-600 text-white rounded-xl py-2 text-sm font-medium">Guardar</button>
              <button onClick={() => setEditandoPl(false)} className="px-4 border rounded-xl text-sm">Cancelar</button>
            </div>
          </>
        ) : (
          <div className="flex gap-3">
            <p className="flex-1 text-sm text-gray-600 whitespace-pre-line">{plantilla || 'Sin mensaje base todavía.'}</p>
            <button onClick={() => { setEditandoPl(true); setTextoPl(plantilla) }}
              className="self-start p-2 border rounded-xl text-gray-500 hover:bg-gray-50"><Pencil size={14} /></button>
          </div>
        )}
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1">
        {(['pendientes', 'enviados', 'volvieron'] as Filtro[]).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize ${filtro === f ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
            {f === 'volvieron' ? 'Agendaron' : f}
          </button>
        ))}
      </div>

      {cargando ? <p className="text-center text-gray-400 py-10">Cargando…</p> :
       !items.length ? (
        <div className="text-center py-10 space-y-2">
          <p className="text-gray-400">Todavía no hay conversaciones revisadas.</p>
          <button onClick={escanear} disabled={escaneando}
            className="text-sm text-pink-600 font-medium">Revisar WhatsApp ahora</button>
        </div>
       ) :
       !visibles.length ? <p className="text-center text-gray-400 py-10">
         {filtro === 'pendientes' ? '¡Listo! No quedan conversaciones por recuperar.' : 'Nada por aquí todavía.'}</p> : (
        <div className="space-y-3">
          {visibles.map(c => {
            const abiertoAqui = abierto === c.id
            const editando = editMsg[c.id] !== undefined
            return (
              <div key={c.id} className={`bg-white border rounded-2xl p-4 ${c.estado === 'DESCARTADO' ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 truncate">{lindo(c.nombre)}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${MOTIVO[c.motivo]?.color}`}>
                        {MOTIVO[c.motivo]?.titulo}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Escribió hace {c.dias} días
                      {c.pedidos > 0 && <> · {c.pedidos} pedidos · {fmt(c.gasto)}</>}
                      {!c.cliente_id && <span className="text-amber-600"> · nunca compró</span>}
                    </p>
                    <p className="text-xs text-gray-400">{c.telefono}</p>
                    {c.estado === 'ENVIADO' && (
                      <p className="text-xs mt-1 text-green-600">
                        Enviado {new Date(c.enviado_en).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {c.volvio_en && <span className="text-pink-600 font-medium"> · agendó el {new Date(c.volvio_en).toLocaleDateString('es-CL')}</span>}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setAbierto(abiertoAqui ? null : c.id)} className="p-1 text-gray-400">
                    <ChevronDown size={18} className={`transition-transform ${abiertoAqui ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {c.extracto && (
                  <div className="mt-2 bg-gray-50 border-l-2 border-gray-300 pl-3 py-1.5">
                    <p className="text-xs text-gray-600 italic">«{c.extracto}»</p>
                  </div>
                )}

                {abiertoAqui && (
                  <div className="mt-3">
                    {editando ? (
                      <textarea value={editMsg[c.id]} rows={7}
                        onChange={e => setEditMsg(m => ({ ...m, [c.id]: e.target.value }))}
                        className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    ) : (
                      <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-line">
                        {c.estado === 'ENVIADO' && c.mensaje ? c.mensaje : mensajeDe(c)}
                      </div>
                    )}
                    {!c.estado && (
                      <button onClick={() => setEditMsg(m => { const n = { ...m }; if (editando) delete n[c.id]; else n[c.id] = mensajeDe(c); return n })}
                        className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                        {editando ? <><Check size={12} /> Volver al mensaje base</> : <><Pencil size={12} /> Cambiar solo para este</>}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  {!c.estado ? (
                    <>
                      <button onClick={() => enviar(c)}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 font-semibold">
                        <MessageCircle size={18} /> Enviar por WhatsApp
                      </button>
                      <button onClick={() => saltar(c)} title="No escribirle"
                        className="px-3 border rounded-xl text-gray-400 hover:bg-gray-50"><SkipForward size={16} /></button>
                    </>
                  ) : (
                    <>
                      {c.estado === 'ENVIADO' && (
                        <a href={`https://wa.me/${telWa(c.telefono)}`} target="_blank" rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 border border-green-200 text-green-600 rounded-xl py-2.5 text-sm font-medium">
                          <MessageCircle size={16} /> Abrir chat
                        </a>
                      )}
                      <button onClick={() => deshacer(c)}
                        className="flex items-center gap-1 px-3 py-2.5 border rounded-xl text-sm text-gray-500 hover:bg-gray-50">
                        <Undo2 size={14} /> Deshacer
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
