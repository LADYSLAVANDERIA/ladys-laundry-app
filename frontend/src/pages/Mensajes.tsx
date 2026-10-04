import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MessagesSquare, Search, ArrowLeft, Send, Hand, Bot, Check, CheckCheck, Clock, User, Smartphone, AlertTriangle } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { bandejaApi } from '../services/api'

// Mensajes: todas las conversaciones de clientes en una sola pantalla (04-10-2026).
// Hoy WhatsApp; Instagram, Messenger y TikTok entran aca mismo cuando Meta y
// TikTok aprueben los permisos. Se ve lo que escribe el cliente, lo que responde
// SofIA, lo que el equipo manda desde la app y lo que se escribe desde el celular.
//
// "Tomo yo": SofIA deja de contestar esa conversacion (12 h o hasta soltarla).
// Responder desde aca la toma sola, para que SofIA no se cruce con una persona.

const CANAL: Record<string, { nombre: string, color: string }> = {
  WHATSAPP:  { nombre: 'WhatsApp',  color: 'bg-green-500' },
  INSTAGRAM: { nombre: 'Instagram', color: 'bg-pink-500' },
  MESSENGER: { nombre: 'Messenger', color: 'bg-blue-500' },
  TIKTOK:    { nombre: 'TikTok',    color: 'bg-gray-900' },
}

const lindo = (n?: string) =>
  String(n || '').trim().toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase())

const telLindo = (c: string) => {
  const d = String(c || '').replace(/\D/g, '')
  return d.length === 11 && d.startsWith('569') ? `+56 9 ${d.slice(3, 7)} ${d.slice(7)}` : c
}

const nombreDe = (c: any) =>
  lindo(c?.clientes?.[0]?.nombre) || c?.nombre_perfil || telLindo(c?.contacto)

const cuando = (f?: string) => {
  if (!f) return ''
  const d = new Date(f)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'ayer'
  return format(d, 'd MMM', { locale: es })
}

// SofIA escribe con **negritas** de markdown; WhatsApp usa *una*. Aca se muestran limpias.
const limpiar = (t?: string) => String(t || '').replace(/\*\*(.+?)\*\*/g, '$1')

const AUTOR: Record<string, { etiqueta: string, icono: any, burbuja: string }> = {
  sofia:   { etiqueta: 'SofIA',            icono: Bot,        burbuja: 'bg-violet-50 border border-violet-100' },
  equipo:  { etiqueta: 'Equipo (app)',     icono: User,       burbuja: 'bg-emerald-50 border border-emerald-100' },
  celular: { etiqueta: 'Equipo (celular)', icono: Smartphone, burbuja: 'bg-emerald-50 border border-emerald-100' },
  sistema: { etiqueta: 'Aviso automático', icono: Clock,      burbuja: 'bg-gray-50 border border-gray-200' },
}

function Tick({ estado }: { estado?: string }) {
  if (estado === 'read') return <CheckCheck size={14} className="text-sky-500" />
  if (estado === 'delivered') return <CheckCheck size={14} className="text-gray-400" />
  if (estado === 'sent') return <Check size={14} className="text-gray-400" />
  if (estado === 'failed') return <AlertTriangle size={14} className="text-red-500" />
  return null
}

function Media({ m }: { m: any }) {
  if (m.tipo_msg === 'image' && m.media_id)
    return (
      <a href={bandejaApi.mediaUrl(m.media_id)} target="_blank" rel="noreferrer">
        <img src={bandejaApi.mediaUrl(m.media_id)} alt="imagen" loading="lazy"
             className="rounded-lg max-h-64 max-w-full mb-1 bg-gray-100"
             onError={e => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('span'), { textContent: '[imagen vencida: Meta la guarda 7 días]', className: 'text-xs text-gray-400 italic' })) }} />
      </a>
    )
  if (m.tipo_msg === 'audio') return <p className="text-xs text-gray-500 italic">Nota de voz (escúchala en el celular)</p>
  return null
}

export default function Mensajes() {
  const [convs, setConvs] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'esperando'>('esperando')
  const [sel, setSel] = useState<{ canal: string, contacto: string } | null>(null)
  const [hilo, setHilo] = useState<any[]>([])
  const [conv, setConv] = useState<any>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fin = useRef<HTMLDivElement>(null)
  const ultimoId = useRef<number>(0)

  const cargarLista = (busca = q) =>
    bandejaApi.conversaciones(busca || undefined)
      .then(r => setConvs(r.data.conversaciones || []))
      .catch(e => toast.error(e?.response?.data?.error || 'No se pudo cargar la bandeja'))
      .finally(() => setCargando(false))

  const cargarHilo = (s = sel, marcar = false) => {
    if (!s) return
    bandejaApi.hilo(s.canal, s.contacto).then(r => {
      const ms = r.data.mensajes || []
      setHilo(ms)
      setConv(r.data.conversacion)
      const ult = Number(ms[ms.length - 1]?.id || 0)
      if (ult !== ultimoId.current) {
        ultimoId.current = ult
        setTimeout(() => fin.current?.scrollIntoView({ block: 'end' }), 50)
      }
      if (marcar) bandejaApi.leido(s.canal, s.contacto).then(() => cargarLista()).catch(() => {})
    }).catch(e => toast.error(e?.response?.data?.error || 'No se pudo abrir la conversación'))
  }

  useEffect(() => { cargarLista() }, [])
  useEffect(() => {
    const t = setTimeout(() => cargarLista(q), 350)
    return () => clearTimeout(t)
  }, [q])
  // La lista se refresca cada 15 s y el hilo abierto cada 6 s.
  useEffect(() => {
    const t = setInterval(() => cargarLista(), 15000)
    return () => clearInterval(t)
  }, [q])
  useEffect(() => {
    if (!sel) return
    ultimoId.current = 0
    setHilo([]); setConv(null)
    cargarHilo(sel, true)
    const t = setInterval(() => cargarHilo(sel), 6000)
    return () => clearInterval(t)
  }, [sel?.canal, sel?.contacto])

  const visibles = useMemo(
    () => filtro === 'esperando' ? convs.filter(c => c.esperando) : convs,
    [convs, filtro])
  const nEsperando = convs.filter(c => c.esperando).length

  const enviar = async () => {
    const t = texto.trim()
    if (!sel || !t || enviando) return
    setEnviando(true)
    try {
      const r = await bandejaApi.enviar(sel.canal, sel.contacto, t)
      if (r.data.ok) { setTexto(''); cargarHilo(sel); cargarLista() }
      else toast.error(r.data.fuera_de_ventana
        ? 'Pasaron más de 24 h desde su último mensaje: WhatsApp no deja mandar texto libre. Escríbele desde el celular.'
        : (r.data.error || 'No se pudo enviar'), { duration: 6000 })
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo enviar')
    } finally { setEnviando(false) }
  }

  const tomar = async (activo: boolean) => {
    if (!sel) return
    try {
      await bandejaApi.tomo(sel.canal, sel.contacto, activo)
      toast.success(activo ? 'Tomaste la conversación: SofIA no responde' : 'SofIA vuelve a responder')
      cargarHilo(sel); cargarLista()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo cambiar') }
  }

  const lista = (
    <div className={`${sel ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-gray-100 bg-white min-h-0`}>
      <div className="p-3 space-y-2 border-b border-gray-100">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nombre o teléfono"
                 className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
        </div>
        <div className="flex gap-1 text-xs">
          <button onClick={() => setFiltro('esperando')}
                  className={`px-3 py-1.5 rounded-full ${filtro === 'esperando' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Sin responder {nEsperando > 0 && `(${nEsperando})`}
          </button>
          <button onClick={() => setFiltro('todas')}
                  className={`px-3 py-1.5 rounded-full ${filtro === 'todas' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Todas
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {cargando && <p className="p-4 text-sm text-gray-400">Cargando…</p>}
        {!cargando && !visibles.length && (
          <p className="p-6 text-sm text-gray-400 text-center">
            {filtro === 'esperando' ? 'No hay clientes esperando respuesta 🎉' : 'Sin conversaciones'}
          </p>
        )}
        {visibles.map(c => {
          const activa = sel?.canal === c.canal && sel?.contacto === c.contacto
          return (
            <button key={c.canal + c.contacto} onClick={() => setSel({ canal: c.canal, contacto: c.contacto })}
                    className={`w-full text-left px-3 py-2.5 flex gap-3 items-start border-b border-gray-50 hover:bg-gray-50 ${activa ? 'bg-violet-50' : ''}`}>
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm">
                  {nombreDe(c).slice(0, 1).toUpperCase()}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${CANAL[c.canal]?.color || 'bg-gray-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span className={`truncate text-sm ${c.no_leidos ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>{nombreDe(c)}</span>
                  <span className={`text-[11px] shrink-0 ${c.no_leidos ? 'text-violet-600 font-semibold' : 'text-gray-400'}`}>{cuando(c.ultimo_en)}</span>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <span className="truncate text-xs text-gray-500">
                    {c.ultimo_autor === 'sofia' && '🤖 '}{(c.ultimo_autor === 'equipo' || c.ultimo_autor === 'celular') && 'Tú: '}
                    {limpiar(c.ultimo_texto)}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {c.tomo_yo && <Hand size={13} className="text-amber-600" />}
                    {c.no_leidos > 0 && <span className="bg-violet-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{c.no_leidos}</span>}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const fichas: any[] = conv?.clientes || []

  const panel = sel ? (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-[#f6f5f8]">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100">
        <button onClick={() => setSel(null)} className="md:hidden p-1 -ml-1 text-gray-500"><ArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate text-sm">{conv ? nombreDe(conv) : telLindo(sel.contacto)}</p>
          <p className="text-[11px] text-gray-500 truncate">
            {CANAL[sel.canal]?.nombre} · {telLindo(sel.contacto)}
            {fichas.length > 0 && ' · '}
            {fichas.map((f, i) => (
              <span key={f.id}>{i > 0 && ', '}
                <Link to={`/clientes/${f.id}`} className="text-violet-600 hover:underline">{lindo(f.nombre)} ({f.pedidos})</Link>
              </span>
            ))}
            {conv && !fichas.length && ' · sin ficha'}
          </p>
        </div>
        {conv?.tomo_yo ? (
          <button onClick={() => tomar(false)} title={`Tomada por ${conv.tomo_yo_por || 'alguien'}`}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-medium">
            <Hand size={14} /> {conv.tomo_yo_por ? lindo(conv.tomo_yo_por) : 'Tomada'} · soltar
          </button>
        ) : (
          <button onClick={() => tomar(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-amber-50">
            <Hand size={14} /> Tomo yo
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {!hilo.length && <p className="text-center text-sm text-gray-400 py-8">Cargando…</p>}
        {hilo.map((m, i) => {
          const sale = m.direccion === 'salida'
          const a = AUTOR[m.autor]
          const cambiaAutor = i === 0 || hilo[i - 1].autor !== m.autor
          const nuevoDia = i === 0 || new Date(hilo[i - 1].creado_en).toDateString() !== new Date(m.creado_en).toDateString()
          return (
            <div key={m.id + (m.wamid || '')}>
              {nuevoDia && (
                <p className="text-center text-[11px] text-gray-400 my-2">
                  {isToday(new Date(m.creado_en)) ? 'Hoy' : format(new Date(m.creado_en), "EEEE d 'de' MMMM", { locale: es })}
                </p>
              )}
              <div className={`flex ${sale ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${sale ? (a?.burbuja || 'bg-white') : 'bg-white'}`}>
                  {sale && a && cambiaAutor && (
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 mb-0.5">
                      <a.icono size={11} /> {m.autor === 'equipo' && m.usuario ? lindo(m.usuario) : a.etiqueta}
                    </p>
                  )}
                  <Media m={m} />
                  {!(m.tipo_msg === 'image' && /^\[image\]$/.test(m.texto || '')) && (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{limpiar(m.texto)}</p>
                  )}
                  <p className="flex items-center justify-end gap-1 text-[10px] text-gray-400 mt-0.5">
                    {format(new Date(m.creado_en), 'HH:mm')} {sale && <Tick estado={m.estado} />}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={fin} />
      </div>

      <div className="bg-white border-t border-gray-100 p-2">
        {conv && !conv.ventana_abierta ? (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Pasaron más de 24 h desde su último mensaje. WhatsApp solo deja escribirle con plantilla aprobada: por ahora, escríbele desde el celular.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={1}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) { e.preventDefault(); enviar() } }}
                      placeholder={conv?.tomo_yo ? 'Escribe tu respuesta…' : 'Escribe… (al enviar, SofIA deja de responder aquí)'}
                      className="flex-1 resize-none max-h-32 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
            <button onClick={enviar} disabled={!texto.trim() || enviando}
                    className="p-2.5 rounded-full bg-violet-600 text-white disabled:opacity-40">
              <Send size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="hidden md:flex flex-1 items-center justify-center text-gray-400 text-sm bg-[#f6f5f8]">
      <div className="text-center"><MessagesSquare size={40} className="mx-auto mb-2 text-gray-300" />Elige una conversación</div>
    </div>
  )

  return (
    <div className="-m-4 md:-m-6 h-[calc(100dvh-3.6rem)] flex overflow-hidden bg-white">
      {lista}
      {panel}
    </div>
  )
}
