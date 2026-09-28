import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  UserSearch, MessageCircle, Undo2, Pencil, RefreshCw, CalendarPlus, CalendarCheck,
  ChevronDown, Check, X, Clock, Plus, Star,
} from 'lucide-react'
import { entrevistasApi } from '../services/api'
import { telWa } from '../utils'

// Entrevistas de trabajo. La citación sale a mano por WhatsApp (wa.me con el
// texto listo) desde el celular que tiene el WhatsApp de Ladys. Cuando la
// candidata responde, SofIA la atiende y un trigger deja su respuesta aquí:
// la pantalla se refresca sola cada 30 segundos.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const EST: Record<string, { txt: string, color: string }> = {
  POR_CITAR:  { txt: 'Por citar',       color: 'bg-gray-100 text-gray-600' },
  CITADA:     { txt: 'Esperando respuesta', color: 'bg-amber-100 text-amber-800' },
  CONFIRMADA: { txt: 'Confirmó',        color: 'bg-green-100 text-green-700' },
  REAGENDAR:  { txt: 'Pide otra hora',  color: 'bg-orange-100 text-orange-700' },
  NO_VIENE:   { txt: 'No viene',        color: 'bg-red-100 text-red-700' },
  RESERVA:    { txt: 'Reserva',         color: 'bg-sky-100 text-sky-700' },
  ASISTIO:    { txt: 'Asistió',         color: 'bg-emerald-100 text-emerald-700' },
  NO_ASISTIO: { txt: 'No llegó',        color: 'bg-red-100 text-red-700' },
  CONTRATADA: { txt: 'Contratada',      color: 'bg-violet-100 text-violet-700' },
  DESCARTADA: { txt: 'Descartada',      color: 'bg-gray-100 text-gray-400' },
}

const CRITERIOS = [
  { k: 'experiencia', txt: 'Experiencia similar' },
  { k: 'estabilidad', txt: 'Estabilidad' },
  { k: 'prueba', txt: 'Prueba práctica' },
  { k: 'disponibilidad', txt: 'Disponibilidad y traslado' },
  { k: 'actitud', txt: 'Actitud' },
]

const hoyIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
const sumar = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}
const diaLargo = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}
// Para el mensaje: "mañana martes 29 de septiembre", "hoy ...", o "el martes ...".
const diaMensaje = (iso?: string | null) => {
  if (!iso) return ''
  const hoy = hoyIso()
  if (iso === hoy) return `hoy ${diaLargo(iso)}`
  if (iso === sumar(hoy, 1)) return `mañana ${diaLargo(iso)}`
  return `el ${diaLargo(iso)}`
}
const mayus = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
const primerNombre = (n?: string) => {
  const p = String(n || '').trim().split(/\s+/)[0] || ''
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''
}

// El {dia} va al principio de la línea en la plantilla: se escribe con mayúscula.
const armar = (pl: string, e: any) =>
  (pl || '')
    .replace(/\{nombre\}/g, primerNombre(e.nombre))
    .replace(/\{cargo\}/g, e.proceso || 'el cargo')
    .replace(/(^|\n)([^\n{]*)\{dia\}/g, (_m, a, b) => `${a}${b}${/[a-záéíóúñ]/i.test(b) ? diaMensaje(e.fecha) : mayus(diaMensaje(e.fecha))}`)
    .replace(/\{dia\}/g, diaMensaje(e.fecha))
    .replace(/\{hora\}/g, e.hora || '')

const linkCalendario = (e: any) => {
  const [h, m] = String(e.hora || '10:00').split(':').map(Number)
  const ini = new Date(`${e.fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
  const fin = new Date(ini.getTime() + (Number(e.duracion_min) || 25) * 60000)
  const f = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Entrevista: ${e.nombre}`,
    dates: `${f(ini)}/${f(fin)}`,
    ctz: 'America/Santiago',
    location: 'Ladys Lavandería, Av. Concón Reñaca 102, locales 5 y 6, Concón',
    details: `${e.proceso}. Tel ${e.telefono}.${e.perfil ? `\n${e.perfil}` : ''}${e.respuesta ? `\nRespondió: ${e.respuesta}` : ''}`,
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

const horaDe = (f?: string) => f ? new Date(f).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export default function Entrevistas() {
  const [lista, setLista] = useState<any[]>([])
  const [plantilla, setPlantilla] = useState('')
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [editPl, setEditPl] = useState(false)
  const [textoPl, setTextoPl] = useState('')
  const [nueva, setNueva] = useState<any | null>(null)
  const [edHora, setEdHora] = useState<Record<number, { fecha: string, hora: string }>>({})

  const cargar = (silencioso = false) => {
    if (!silencioso) setCargando(true)
    entrevistasApi.lista()
      .then(r => { setLista(r.data.entrevistas || []); setPlantilla(r.data.plantilla || '') })
      .catch(() => { if (!silencioso) toast.error('No pude cargar las entrevistas') })
      .finally(() => setCargando(false))
  }
  useEffect(() => {
    cargar()
    const t = setInterval(() => cargar(true), 30000)
    return () => clearInterval(t)
  }, [])

  const cambiar = (id: number, datos: any) => setLista(l => l.map(x => x.id === id ? { ...x, ...datos } : x))

  const enviar = (e: any) => {
    const msg = armar(plantilla, e)
    // Se abre primero: si se espera al servidor, Safari bloquea la ventana.
    window.open(`https://wa.me/${telWa(e.telefono)}?text=${encodeURIComponent(msg)}`, '_blank')
    cambiar(e.id, { estado: 'CITADA', enviado_en: new Date().toISOString(), mensaje_enviado: msg })
    entrevistasApi.enviado(e.id, msg).catch(() => { toast.error(`No quedó registrado el envío a ${primerNombre(e.nombre)}`); cargar(true) })
  }

  const estado = (e: any, nuevo: string) => {
    cambiar(e.id, { estado: nuevo })
    entrevistasApi.estado(e.id, nuevo).catch(() => { toast.error('No se pudo cambiar'); cargar(true) })
  }

  const deshacer = (e: any) => {
    cambiar(e.id, { estado: 'POR_CITAR', enviado_en: null })
    entrevistasApi.deshacer(e.id).catch(() => { toast.error('No se pudo deshacer'); cargar(true) })
  }

  const calendario = (e: any) => {
    window.open(linkCalendario(e), '_blank')
    cambiar(e.id, { en_calendario: true })
    entrevistasApi.guardar(e.id, { en_calendario: true }).catch(() => {})
  }

  const guardarHora = async (e: any) => {
    const h = edHora[e.id]
    if (!h?.fecha || !h?.hora) return toast.error('Pon fecha y hora')
    const nuevoEstado = e.estado === 'RESERVA' ? 'POR_CITAR'
      : ['CITADA', 'CONFIRMADA', 'REAGENDAR'].includes(e.estado) ? 'REAGENDAR' : e.estado
    try {
      await entrevistasApi.guardar(e.id, { fecha: h.fecha, hora: h.hora, en_calendario: false })
      if (nuevoEstado !== e.estado) await entrevistasApi.estado(e.id, nuevoEstado)
      cambiar(e.id, { fecha: h.fecha, hora: h.hora, en_calendario: false, estado: nuevoEstado })
      setEdHora(x => { const n = { ...x }; delete n[e.id]; return n })
      toast.success('Hora cambiada. Envíale la citación nueva.')
    } catch { toast.error('No se pudo guardar la hora') }
  }

  const puntuar = (e: any, k: string, v: number) => {
    const p = { ...(e.puntaje || {}), [k]: v }
    cambiar(e.id, { puntaje: p })
    entrevistasApi.guardar(e.id, { puntaje: p }).catch(() => toast.error('No se guardó la nota'))
  }

  const guardarNotas = (e: any, notas: string) => {
    if (notas === (e.notas || '')) return
    cambiar(e.id, { notas })
    entrevistasApi.guardar(e.id, { notas }).catch(() => toast.error('No se guardaron las notas'))
  }

  const guardarPlantilla = async () => {
    try {
      await entrevistasApi.plantilla(textoPl)
      setPlantilla(textoPl); setEditPl(false); toast.success('Mensaje guardado')
    } catch { toast.error('No se pudo guardar el mensaje') }
  }

  const crear = async () => {
    if (!nueva?.nombre || !nueva?.telefono) return toast.error('Falta nombre o teléfono')
    try {
      await entrevistasApi.crear(nueva)
      setNueva(null); toast.success('Candidata agregada'); cargar(true)
    } catch { toast.error('No se pudo agregar') }
  }

  const conFecha = lista.filter(e => e.fecha && !['RESERVA', 'DESCARTADA'].includes(e.estado))
  const reservas = lista.filter(e => e.estado === 'RESERVA' || (!e.fecha && e.estado !== 'DESCARTADA'))
  const dias = useMemo(() => Array.from(new Set(conFecha.map(e => e.fecha))).sort(), [conFecha])
  const cuenta = (...s: string[]) => conFecha.filter(e => s.includes(e.estado)).length

  const tarjeta = (e: any) => {
    const ab = abierto === e.id
    const eh = edHora[e.id]
    const promedio = e.puntaje ? (() => {
      const v = Object.values(e.puntaje).map(Number).filter(n => n > 0)
      return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null
    })() : null
    const yaPaso = e.fecha && e.fecha <= hoyIso()
    return (
      <div key={e.id} className={`bg-white border rounded-2xl p-4 ${['NO_VIENE', 'NO_ASISTIO', 'DESCARTADA'].includes(e.estado) ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3">
          {e.hora && <div className="text-lg font-bold text-gray-800 w-14 shrink-0 tabular-nums">{e.hora}</div>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800">{e.nombre}</p>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${EST[e.estado]?.color}`}>{EST[e.estado]?.txt}</span>
              {promedio && <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 flex items-center gap-0.5"><Star size={10} />{promedio}</span>}
            </div>
            {e.perfil && <p className="text-xs text-gray-500 mt-0.5">{e.perfil}</p>}
            <p className="text-xs text-gray-400">{e.telefono}{e.enviado_en && ` · citada ${horaDe(e.enviado_en)}`}</p>
            {e.respuesta && (
              <div className="mt-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2 text-sm text-gray-700">
                <span className="text-xs text-gray-500">Respondió{e.respuesta_en ? ` ${horaDe(e.respuesta_en)}` : ''}: </span>{e.respuesta}
              </div>
            )}
          </div>
          <button onClick={() => setAbierto(ab ? null : e.id)} className="p-1 text-gray-400" aria-label="Más opciones">
            <ChevronDown size={18} className={`transition-transform ${ab ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Acción principal según el estado */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {['POR_CITAR', 'REAGENDAR'].includes(e.estado) && e.fecha && e.hora && (
            <button onClick={() => enviar(e)}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 font-semibold">
              <MessageCircle size={18} /> {e.estado === 'REAGENDAR' ? 'Enviar nueva citación' : 'Enviar citación por WhatsApp'}
            </button>
          )}
          {e.estado === 'CITADA' && (<>
            <button onClick={() => estado(e, 'CONFIRMADA')} className="flex-1 flex items-center justify-center gap-1 border border-green-200 text-green-700 rounded-xl py-2.5 text-sm font-medium"><Check size={15} /> Confirmó</button>
            <button onClick={() => estado(e, 'NO_VIENE')} className="flex-1 flex items-center justify-center gap-1 border border-red-200 text-red-600 rounded-xl py-2.5 text-sm font-medium"><X size={15} /> No viene</button>
          </>)}
          {e.estado === 'CONFIRMADA' && (e.en_calendario ? (
            <button onClick={() => calendario(e)} className="flex-1 flex items-center justify-center gap-2 border border-green-200 text-green-700 rounded-xl py-2.5 text-sm font-medium">
              <CalendarCheck size={16} /> Está en tu calendario
            </button>
          ) : (
            <button onClick={() => calendario(e)} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold">
              <CalendarPlus size={18} /> Agregar a mi calendario
            </button>
          ))}
          {yaPaso && ['CONFIRMADA', 'CITADA'].includes(e.estado) && (<>
            <button onClick={() => estado(e, 'ASISTIO')} className="flex-1 border border-emerald-200 text-emerald-700 rounded-xl py-2.5 text-sm font-medium">Asistió</button>
            <button onClick={() => estado(e, 'NO_ASISTIO')} className="flex-1 border rounded-xl py-2.5 text-sm text-gray-500">No llegó</button>
          </>)}
          {e.estado === 'ASISTIO' && (<>
            <button onClick={() => estado(e, 'CONTRATADA')} className="flex-1 bg-violet-600 text-white rounded-xl py-2.5 text-sm font-semibold">Contratar</button>
            <button onClick={() => estado(e, 'DESCARTADA')} className="flex-1 border rounded-xl py-2.5 text-sm text-gray-500">Descartar</button>
          </>)}
          {e.enviado_en && (
            <a href={`https://wa.me/${telWa(e.telefono)}`} target="_blank" rel="noreferrer"
              className="px-3 flex items-center border border-green-200 text-green-600 rounded-xl" title="Abrir chat"><MessageCircle size={16} /></a>
          )}
        </div>

        {ab && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {/* Cambiar fecha u hora */}
            {eh ? (
              <div className="flex gap-2 items-center flex-wrap">
                <input type="date" value={eh.fecha} onChange={x => setEdHora(s => ({ ...s, [e.id]: { ...eh, fecha: x.target.value } }))} className="border rounded-xl px-3 py-2 text-sm" />
                <input type="time" value={eh.hora} onChange={x => setEdHora(s => ({ ...s, [e.id]: { ...eh, hora: x.target.value } }))} className="border rounded-xl px-3 py-2 text-sm" />
                <button onClick={() => guardarHora(e)} className="bg-gray-800 text-white rounded-xl px-4 py-2 text-sm">Guardar</button>
                <button onClick={() => setEdHora(s => { const n = { ...s }; delete n[e.id]; return n })} className="text-sm text-gray-500 px-2">Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setEdHora(s => ({ ...s, [e.id]: { fecha: e.fecha || sumar(hoyIso(), 1), hora: e.hora || '10:00' } }))}
                className="text-sm text-gray-600 flex items-center gap-1"><Clock size={14} /> {e.fecha ? 'Cambiar día u hora' : 'Asignar día y hora'}</button>
            )}

            {/* Vista previa del mensaje */}
            {e.fecha && e.hora && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 whitespace-pre-line">
                {e.estado === 'CITADA' && e.mensaje_enviado ? e.mensaje_enviado : armar(plantilla, e)}
              </div>
            )}

            {/* Evaluación */}
            {['CONFIRMADA', 'ASISTIO', 'CONTRATADA', 'DESCARTADA', 'CITADA'].includes(e.estado) && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-gray-700">Evaluación</p>
                {CRITERIOS.map(c => (
                  <div key={c.k} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 flex-1">{c.txt}</span>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => puntuar(e, c.k, n)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium ${Number(e.puntaje?.[c.k]) === n ? 'bg-gray-800 text-white' : 'border text-gray-500'}`}>{n}</button>
                    ))}
                  </div>
                ))}
                <textarea defaultValue={e.notas || ''} onBlur={x => guardarNotas(e, x.target.value)} rows={3}
                  placeholder="Notas de la entrevista: referencias, desde cuándo puede, cómo le fue en la prueba…"
                  className="w-full border rounded-xl p-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
            )}

            <div className="flex gap-3 flex-wrap text-xs">
              {e.estado === 'CITADA' && <button onClick={() => deshacer(e)} className="flex items-center gap-1 text-gray-500"><Undo2 size={12} /> Deshacer envío</button>}
              {['REAGENDAR', 'NO_VIENE'].includes(e.estado) && <button onClick={() => estado(e, 'CITADA')} className="text-gray-500">Volver a esperando respuesta</button>}
              {!['DESCARTADA', 'CONTRATADA'].includes(e.estado) && <button onClick={() => estado(e, 'DESCARTADA')} className="text-gray-400">Descartar candidata</button>}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center"><UserSearch size={20} /></div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Entrevistas</h1>
          <p className="text-sm text-gray-500">Cita por WhatsApp; las respuestas llegan solas</p>
        </div>
        <button onClick={() => setNueva(nueva ? null : { proceso: 'Ayudante de Producción', fecha: sumar(hoyIso(), 1), hora: '' })}
          className="p-2.5 border rounded-xl text-gray-500 hover:bg-gray-50" aria-label="Agregar candidata"><Plus size={16} /></button>
        <button onClick={() => cargar()} className="p-2.5 border rounded-xl text-gray-500 hover:bg-gray-50" aria-label="Actualizar"><RefreshCw size={16} /></button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { n: cuenta('POR_CITAR'), t: 'Por citar', c: 'text-gray-800' },
          { n: cuenta('CITADA'), t: 'Sin respuesta', c: 'text-amber-600' },
          { n: cuenta('CONFIRMADA', 'ASISTIO'), t: 'Confirmadas', c: 'text-green-600' },
          { n: cuenta('REAGENDAR', 'NO_VIENE'), t: 'Por resolver', c: 'text-orange-600' },
        ].map(k => (
          <div key={k.t} className="bg-white border rounded-2xl p-3 text-center">
            <p className={`text-2xl font-bold ${k.c}`}>{k.n}</p><p className="text-[11px] text-gray-500 leading-tight">{k.t}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">Envía desde el celular que tiene el WhatsApp de Ladys: así las respuestas le llegan a SofIA y aparecen aquí.</p>

      {nueva && (
        <div className="bg-white border rounded-2xl p-4 space-y-2">
          <input placeholder="Nombre completo" value={nueva.nombre || ''} onChange={x => setNueva({ ...nueva, nombre: x.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" />
          <input placeholder="Teléfono (+569…)" value={nueva.telefono || ''} onChange={x => setNueva({ ...nueva, telefono: x.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" />
          <input placeholder="Cargo" value={nueva.proceso || ''} onChange={x => setNueva({ ...nueva, proceso: x.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" />
          <input placeholder="Nota corta del perfil (opcional)" value={nueva.perfil || ''} onChange={x => setNueva({ ...nueva, perfil: x.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input type="date" value={nueva.fecha || ''} onChange={x => setNueva({ ...nueva, fecha: x.target.value })} className="flex-1 border rounded-xl px-3 py-2 text-sm" />
            <input type="time" value={nueva.hora || ''} onChange={x => setNueva({ ...nueva, hora: x.target.value })} className="flex-1 border rounded-xl px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-gray-400">Sin hora queda como reserva.</p>
          <div className="flex gap-2">
            <button onClick={crear} className="flex-1 bg-violet-600 text-white rounded-xl py-2 text-sm font-medium">Agregar candidata</button>
            <button onClick={() => setNueva(null)} className="px-4 border rounded-xl text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Mensaje de citación */}
      <div className="bg-white border rounded-2xl p-4">
        {editPl ? (<>
          <textarea value={textoPl} onChange={x => setTextoPl(x.target.value)} rows={9}
            className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          <p className="text-xs text-gray-400 mt-1">Usa {'{nombre}'}, {'{cargo}'}, {'{dia}'} y {'{hora}'}. No cambies la frase "te escribimos de Ladys Lavandería Concón. Recibimos tu CV para": con ella SofIA reconoce la citación.</p>
          <div className="flex gap-2 mt-2">
            <button onClick={guardarPlantilla} className="flex-1 bg-violet-600 text-white rounded-xl py-2 text-sm font-medium">Guardar mensaje</button>
            <button onClick={() => setEditPl(false)} className="px-4 border rounded-xl text-sm">Cancelar</button>
          </div>
        </>) : (
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Mensaje de citación</p>
              <p className="text-xs text-gray-500">Se completa solo con el nombre, el día y la hora de cada una.</p>
            </div>
            <button onClick={() => { setEditPl(true); setTextoPl(plantilla) }} className="self-start p-2 border rounded-xl text-gray-500 hover:bg-gray-50" aria-label="Editar mensaje"><Pencil size={14} /></button>
          </div>
        )}
      </div>

      {cargando ? <p className="text-center text-gray-400 py-10">Cargando…</p> : (<>
        {!dias.length && <p className="text-center text-gray-400 py-6">No hay entrevistas agendadas. Agrega una candidata con +.</p>}
        {dias.map(d => (
          <div key={d} className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-600 pt-2">{mayus(diaMensaje(d))}</h2>
            {conFecha.filter(e => e.fecha === d).sort((a, b) => String(a.hora).localeCompare(String(b.hora))).map(tarjeta)}
          </div>
        ))}
        {reservas.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-600 pt-4">Reserva</h2>
            <p className="text-xs text-gray-500 -mt-2">Asígnales día y hora para poder citarlas.</p>
            {reservas.map(tarjeta)}
          </div>
        )}
      </>)}
    </div>
  )
}
