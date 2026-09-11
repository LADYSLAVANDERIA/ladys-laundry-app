import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Megaphone, MessageCircle, Undo2, SkipForward, Pencil, Check, ChevronDown, RefreshCw } from 'lucide-react'
import { marketingApi } from '../services/api'
import { fmt, telWa } from '../utils'

// Recuperar clientes que dejaron de venir. El botón abre WhatsApp con el texto
// listo; al tocarlo se registra como enviado, así nadie recibe dos veces el
// mismo mensaje y después se puede medir quién volvió.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const SEG: Record<string, { titulo: string, detalle: string, color: string }> = {
  riesgo:    { titulo: 'En riesgo',  detalle: '3+ pedidos, no vuelven hace 30 a 70 días', color: 'bg-amber-100 text-amber-800' },
  perdido:   { titulo: 'Perdidos',   detalle: '3+ pedidos, no vuelven hace más de 70 días', color: 'bg-red-100 text-red-700' },
  ocasional: { titulo: 'Ocasionales', detalle: '2 pedidos, no vuelven hace 30+ días', color: 'bg-sky-100 text-sky-700' },
}

// Los nombres vienen en mayúsculas desde EasyLaundry: "MARIA ELENA" → "Maria".
const primerNombre = (n?: string) => {
  const p = String(n || '').trim().split(/\s+/)[0] || ''
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''
}
const nombreCompleto = (c: any) =>
  `${c.nombre || ''} ${c.apellido || ''}`.trim().toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase())
const mesDe = (f?: string) => (f ? MESES[Number(String(f).slice(5, 7)) - 1] : '')

const armar = (plantilla: string, c: any) =>
  (plantilla || '')
    .replace(/\{nombre\}/g, primerNombre(c.nombre))
    .replace(/\{mes\}/g, mesDe(c.ultima))

type Filtro = 'pendientes' | 'enviados' | 'volvieron'

export default function Marketing() {
  const [clientes, setClientes] = useState<any[]>([])
  const [plantillas, setPlantillas] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [seg, setSeg] = useState<string>('todos')
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [editandoPl, setEditandoPl] = useState<string | null>(null)
  const [textoPl, setTextoPl] = useState('')
  const [editMsg, setEditMsg] = useState<Record<number, string>>({})
  const [abierto, setAbierto] = useState<number | null>(null)

  const cargar = () => {
    setCargando(true)
    marketingApi.lista()
      .then(r => { setClientes(r.data.clientes || []); setPlantillas(r.data.plantillas || {}) })
      .catch(() => toast.error('No pude cargar la lista'))
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const mensajeDe = (c: any) => editMsg[c.cliente_id] ?? armar(plantillas[c.segmento], c)

  const enviar = (c: any) => {
    const tel = telWa(c.telefono)
    const msg = mensajeDe(c)
    // Se abre primero: si se espera la respuesta del servidor, Safari bloquea la ventana.
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
    setClientes(cs => cs.map(x => x.cliente_id === c.cliente_id ? { ...x, envio: 'ENVIADO', enviado_en: new Date().toISOString() } : x))
    marketingApi.enviado({ cliente_id: c.cliente_id, segmento: c.segmento, telefono: c.telefono, mensaje: msg })
      .catch(() => {
        toast.error(`No quedó registrado el envío a ${primerNombre(c.nombre)}`)
        setClientes(cs => cs.map(x => x.cliente_id === c.cliente_id ? { ...x, envio: null, enviado_en: null } : x))
      })
  }

  const saltar = (c: any) => {
    setClientes(cs => cs.map(x => x.cliente_id === c.cliente_id ? { ...x, envio: 'DESCARTADO' } : x))
    marketingApi.descartar({ cliente_id: c.cliente_id, segmento: c.segmento, telefono: c.telefono })
      .catch(() => { toast.error('No se pudo saltar'); cargar() })
  }

  const deshacer = (c: any) => {
    setClientes(cs => cs.map(x => x.cliente_id === c.cliente_id ? { ...x, envio: null, enviado_en: null } : x))
    marketingApi.deshacer(c.cliente_id).catch(() => { toast.error('No se pudo deshacer'); cargar() })
  }

  const guardarPlantilla = async () => {
    if (!editandoPl) return
    try {
      await marketingApi.plantilla(editandoPl, textoPl)
      setPlantillas(p => ({ ...p, [editandoPl]: textoPl }))
      setEditandoPl(null)
      toast.success('Mensaje guardado')
    } catch { toast.error('No se pudo guardar') }
  }

  const delSeg = useMemo(() => clientes.filter(c => seg === 'todos' || c.segmento === seg), [clientes, seg])
  const visibles = useMemo(() => delSeg.filter(c =>
    filtro === 'pendientes' ? !c.envio :
    filtro === 'enviados' ? c.envio === 'ENVIADO' :
    c.envio === 'ENVIADO' && c.volvio_en), [delSeg, filtro])

  const cuenta = (s: string) => {
    const l = clientes.filter(c => s === 'todos' || c.segmento === s)
    return { total: l.length, hechos: l.filter(c => c.envio).length }
  }
  const enviados = clientes.filter(c => c.envio === 'ENVIADO')
  const volvieron = enviados.filter(c => c.volvio_en)
  const tot = cuenta('todos')

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center"><Megaphone size={20} /></div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Marketing</h1>
          <p className="text-sm text-gray-500">Recuperar clientes que dejaron de venir</p>
        </div>
        <button onClick={cargar} className="p-2.5 border rounded-xl text-gray-500 hover:bg-gray-50"><RefreshCw size={16} /></button>
      </div>

      {/* Avance del día */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{tot.total - tot.hechos}</p><p className="text-xs text-gray-500">Por enviar</p>
        </div>
        <div className="bg-white border rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{enviados.length}</p><p className="text-xs text-gray-500">Enviados</p>
        </div>
        <div className="bg-white border rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-pink-600">{volvieron.length}</p><p className="text-xs text-gray-500">Volvieron</p>
        </div>
      </div>
      {tot.total > 0 && (
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${(tot.hechos / tot.total) * 100}%` }} />
        </div>
      )}

      {/* Segmentos */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['todos', 'riesgo', 'perdido', 'ocasional'].map(s => {
          const k = cuenta(s)
          return (
            <button key={s} onClick={() => setSeg(s)}
              className={`whitespace-nowrap px-3 py-2 rounded-xl text-sm font-medium border ${seg === s ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600'}`}>
              {s === 'todos' ? 'Todos' : SEG[s].titulo} <span className="opacity-70">{k.hechos}/{k.total}</span>
            </button>
          )
        })}
      </div>
      {seg !== 'todos' && <p className="text-xs text-gray-500 -mt-2">{SEG[seg].detalle}. Ordenados por lo que han gastado.</p>}

      {/* Mensaje base del segmento */}
      {seg !== 'todos' && (
        <div className="bg-white border rounded-2xl p-4">
          {editandoPl === seg ? (
            <>
              <textarea value={textoPl} onChange={e => setTextoPl(e.target.value)} rows={7}
                className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
              <p className="text-xs text-gray-400 mt-1">Usa {'{nombre}'} para el primer nombre y {'{mes}'} para el mes de su último pedido.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={guardarPlantilla} className="flex-1 bg-pink-600 text-white rounded-xl py-2 text-sm font-medium">Guardar</button>
                <button onClick={() => setEditandoPl(null)} className="px-4 border rounded-xl text-sm">Cancelar</button>
              </div>
            </>
          ) : (
            <div className="flex gap-3">
              <p className="flex-1 text-sm text-gray-600 whitespace-pre-line">{plantillas[seg]}</p>
              <button onClick={() => { setEditandoPl(seg); setTextoPl(plantillas[seg] || '') }}
                className="self-start p-2 border rounded-xl text-gray-500 hover:bg-gray-50"><Pencil size={14} /></button>
            </div>
          )}
        </div>
      )}

      {/* Pendientes / enviados / volvieron */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {(['pendientes', 'enviados', 'volvieron'] as Filtro[]).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize ${filtro === f ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>{f}</button>
        ))}
      </div>

      {cargando ? <p className="text-center text-gray-400 py-10">Cargando…</p> :
       !visibles.length ? <p className="text-center text-gray-400 py-10">
         {filtro === 'pendientes' ? '¡Listo! No quedan clientes por escribir en este grupo.' : 'Nada por aquí todavía.'}</p> : (
        <div className="space-y-3">
          {visibles.map(c => {
            const abiertoAqui = abierto === c.cliente_id
            const editando = editMsg[c.cliente_id] !== undefined
            return (
              <div key={c.cliente_id} className={`bg-white border rounded-2xl p-4 ${c.envio === 'DESCARTADO' ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 truncate">{nombreCompleto(c)}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${SEG[c.segmento]?.color}`}>{SEG[c.segmento]?.titulo}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.pedidos} pedidos · {fmt(c.gasto)} · último hace {c.dias} días ({mesDe(c.ultima)})
                    </p>
                    <p className="text-xs text-gray-400">{c.telefono}</p>
                    {c.envio === 'ENVIADO' && (
                      <p className="text-xs mt-1 text-green-600">
                        Enviado {new Date(c.enviado_en).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {c.volvio_en && <span className="text-pink-600 font-medium"> · volvió el {new Date(c.volvio_en).toLocaleDateString('es-CL')}</span>}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setAbierto(abiertoAqui ? null : c.cliente_id)} className="p-1 text-gray-400">
                    <ChevronDown size={18} className={`transition-transform ${abiertoAqui ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {abiertoAqui && (
                  <div className="mt-3">
                    {editando ? (
                      <textarea value={editMsg[c.cliente_id]} rows={7}
                        onChange={e => setEditMsg(m => ({ ...m, [c.cliente_id]: e.target.value }))}
                        className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    ) : (
                      <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-line">
                        {c.envio === 'ENVIADO' && c.mensaje_enviado ? c.mensaje_enviado : mensajeDe(c)}
                      </div>
                    )}
                    {!c.envio && (
                      <button onClick={() => setEditMsg(m => { const n = { ...m }; if (editando) delete n[c.cliente_id]; else n[c.cliente_id] = mensajeDe(c); return n })}
                        className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                        {editando ? <><Check size={12} /> Volver al mensaje base</> : <><Pencil size={12} /> Cambiar solo para este cliente</>}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  {!c.envio ? (
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
                      {c.envio === 'ENVIADO' && (
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
