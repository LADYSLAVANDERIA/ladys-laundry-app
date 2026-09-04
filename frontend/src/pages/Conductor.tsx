import { useEffect, useMemo, useRef, useState } from 'react'
import { repartoApi, seguimientoApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  Navigation, Phone, MessageCircle, Check, X, MapPin, Package,
  ChevronDown, ChevronUp, RefreshCw, LogOut, Banknote, Play, Radio,
} from 'lucide-react'

const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
const plata = (n: any) => '$' + Number(n || 0).toLocaleString('es-CL')
const hhmm = (t: any) => (t ? String(t).slice(0, 5) : '')

function nombreDe(p: any) {
  return (p.es_empresa && p.razon_social) ? p.razon_social
    : [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Sin nombre'
}
function dirDe(p: any) {
  return [p.calle, p.depto, p.sector, p.ciudad].filter(Boolean).join(', ') || 'Sin dirección'
}
// la navegación la hace el teléfono, no nuestro sistema: es gratis e ilimitada
function linkNav(p: any) {
  if (p.lat && p.lng) return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dirDe(p))}`
}
function soloNumeros(t: string) { return String(t || '').replace(/[^\d]/g, '') }

export default function Conductor() {
  const { user, logout } = useAuthStore()
  const [fecha, setFecha] = useState(hoy())
  const [data, setData] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [verTodas, setVerTodas] = useState(false)
  const [enVivo, setEnVivo] = useState(false)
  const [ultimoEnvio, setUltimoEnvio] = useState<Date | null>(null)
  const watch = useRef<number | null>(null)
  const wake = useRef<any>(null)

  const cargar = (f = fecha) => {
    setCargando(true)
    repartoApi.dia(f)
      .then(r => setData(r.data))
      .catch(() => toast.error('No se pudo cargar la ruta'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar(fecha) }, [fecha])

  // mientras esta pantalla este abierta, reportamos la posicion al servidor
  const partirGps = async () => {
    if (!navigator.geolocation) return toast.error('Este teléfono no entrega ubicación')
    try { wake.current = await (navigator as any).wakeLock?.request('screen') } catch { /* opcional */ }
    watch.current = navigator.geolocation.watchPosition(
      pos => {
        seguimientoApi.posicion({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          exactitud: Math.round(pos.coords.accuracy || 0),
          velocidad: pos.coords.speed ?? null, fecha,
        }).then(() => setUltimoEnvio(new Date())).catch(() => {})
      },
      () => toast.error('No pudimos leer tu ubicación'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    setEnVivo(true)
  }
  const pararGps = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
    watch.current = null
    try { wake.current?.release?.() } catch { /* da igual */ }
    wake.current = null
    setEnVivo(false)
  }
  useEffect(() => () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current) }, [])

  const paradas: any[] = data?.paradas || []
  const pendientes = useMemo(() => paradas.filter(p => p.estado === 'EN_CAMINO' || p.estado === 'PENDIENTE')
    .sort((a, b) => (a.estado === 'EN_CAMINO' ? -1 : 0) - (b.estado === 'EN_CAMINO' ? -1 : 0)), [paradas])
  const actual = pendientes[0]
  const hechas = paradas.filter(p => p.estado === 'COMPLETADA').length
  const fallidas = paradas.filter(p => p.estado === 'FALLIDA').length
  const avance = paradas.length ? Math.round((hechas / paradas.length) * 100) : 0

  const iniciar = async (p: any) => {
    try {
      const { data: r } = await seguimientoApi.iniciar(p.id)
      if (!enVivo) await partirGps()
      if (r.whatsapp) window.open(r.whatsapp, '_blank')
      else toast('Este cliente no tiene teléfono registrado')
      cargar()
    } catch { toast.error('No se pudo iniciar el trayecto') }
  }

  const marcar = async (p: any, estado: string) => {
    let nota: string | undefined
    if (estado === 'FALLIDA') {
      const n = window.prompt('¿Qué pasó? (no había nadie, dirección equivocada, etc.)')
      if (n === null) return
      nota = n
    }
    try {
      await repartoApi.parada(p.id, estado, nota)
      toast.success(estado === 'COMPLETADA' ? 'Parada lista' : 'Marcada como no lograda')
      setAbierta(null)
      cargar()
    } catch { toast.error('No se pudo guardar') }
  }

  const Tarjeta = ({ p, principal = false }: { p: any; principal?: boolean }) => {
    const esRetiro = p.tipo === 'RETIRO'
    const abierto = abierta === p.id || principal
    const cobra = Number(p.saldo_pendiente || 0) > 0
    return (
      <div className={`rounded-2xl border overflow-hidden ${principal ? 'border-2 shadow-lg' : 'bg-white'}`}
           style={principal ? { borderColor: '#E8177A', background: '#fff' } : { borderColor: '#e5e7eb' }}>
        <div className="p-4 cursor-pointer" onClick={() => !principal && setAbierta(abierto ? null : p.id)}>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                   style={{ background: esRetiro ? '#4AAEE0' : '#E8177A' }}>
                {p.secuencia || '·'}
              </div>
              {p.estado === 'COMPLETADA' && <Check size={16} className="text-green-600 mt-1" />}
              {p.estado === 'EN_CAMINO' && <Radio size={16} className="text-blue-500 mt-1 animate-pulse" />}
              {p.estado === 'FALLIDA' && <X size={16} className="text-red-500 mt-1" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: esRetiro ? '#4AAEE0' : '#E8177A' }}>
                  {esRetiro ? 'RETIRO' : 'ENTREGA'}
                </span>
                {p.hora_estimada && <span className="text-xs text-gray-500">~{hhmm(p.hora_estimada)}</span>}
                {!p.lat && <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">sin ubicar</span>}
              </div>
              <p className={`font-semibold text-gray-900 truncate ${principal ? 'text-lg' : ''}`}>{nombreDe(p)}</p>
              <p className={`text-gray-600 ${principal ? 'text-base' : 'text-sm truncate'}`}>{dirDe(p)}</p>
              {cobra && (
                <p className="text-sm font-bold mt-1 flex items-center gap-1" style={{ color: '#b45309' }}>
                  <Banknote size={14} /> Cobrar {plata(p.saldo_pendiente)}
                </p>
              )}
            </div>
            {!principal && (abierto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />)}
          </div>
        </div>

        {abierto && (
          <div className="px-4 pb-4 space-y-3">
            {(p.bultos || p.kilos) && (
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <Package size={14} />
                {p.bultos ? `${p.bultos} bulto(s)` : ''}{p.bultos && p.kilos ? ' · ' : ''}{p.kilos ? `${p.kilos} kg` : ''}
              </p>
            )}
            {p.observaciones && (
              <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-900">{p.observaciones}</p>
            )}
            {p.nota && <p className="text-sm text-gray-500 italic">Nota: {p.nota}</p>}

            <div className="grid grid-cols-3 gap-2">
              <a href={linkNav(p)} target="_blank" rel="noreferrer"
                 className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-white font-medium text-xs"
                 style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                <Navigation size={18} /> Ir
              </a>
              <a href={p.telefono ? `tel:+${soloNumeros(p.telefono)}` : undefined}
                 className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs font-medium border ${p.telefono ? 'text-gray-700' : 'text-gray-300 pointer-events-none'}`}>
                <Phone size={18} /> Llamar
              </a>
              <a href={p.telefono ? `https://wa.me/${soloNumeros(p.telefono)}` : undefined}
                 target="_blank" rel="noreferrer"
                 className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs font-medium border ${p.telefono ? 'text-green-700' : 'text-gray-300 pointer-events-none'}`}>
                <MessageCircle size={18} /> WhatsApp
              </a>
            </div>

            {p.estado === 'PENDIENTE' && (
              <button onClick={() => iniciar(p)}
                      className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
                      style={{ background: '#4AAEE0' }}>
                <Play size={18} /> Voy en camino · avisar al cliente
              </button>
            )}

            {p.estado === 'PENDIENTE' || p.estado === 'EN_CAMINO' ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => marcar(p, 'COMPLETADA')}
                        className="py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
                        style={{ background: '#16a34a' }}>
                  <Check size={18} /> {p.tipo === 'RETIRO' ? 'Retirado' : 'Entregado'}
                </button>
                <button onClick={() => marcar(p, 'FALLIDA')}
                        className="py-3 rounded-xl font-semibold border border-red-200 text-red-600 flex items-center justify-center gap-2">
                  <X size={18} /> No se pudo
                </button>
              </div>
            ) : (
              <button onClick={() => marcar(p, 'PENDIENTE')}
                      className="w-full py-2.5 rounded-xl border text-gray-600 text-sm">
                Reabrir esta parada
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="text-white px-4 pt-5 pb-6" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-90">Ruta de reparto</p>
            <h1 className="text-xl font-bold">{user?.nombre || 'Conductor'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => cargar()} className="p-2 rounded-lg bg-white/20"><RefreshCw size={18} /></button>
            <button onClick={logout} className="p-2 rounded-lg bg-white/20"><LogOut size={18} /></button>
          </div>
        </div>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
               className="mt-3 w-full rounded-xl px-3 py-2 text-gray-800 text-sm" />
        <button onClick={() => (enVivo ? pararGps() : partirGps())}
                className="mt-3 w-full py-2 rounded-xl text-sm flex items-center justify-center gap-2"
                style={{ background: enVivo ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.15)' }}>
          <Radio size={15} className={enVivo ? 'animate-pulse' : ''} />
          {enVivo
            ? `Compartiendo ubicación${ultimoEnvio ? ' · ' + ultimoEnvio.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}`
            : 'Activar ubicación en vivo'}
        </button>

        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span>{hechas} de {paradas.length} listas{fallidas ? ` · ${fallidas} sin lograr` : ''}</span>
            <span>{avance}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${avance}%` }} />
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-3">
        {cargando && <div className="bg-white rounded-2xl p-6 text-center text-gray-400">Cargando la ruta…</div>}

        {!cargando && !paradas.length && (
          <div className="bg-white rounded-2xl p-8 text-center">
            <MapPin size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No hay paradas para este día</p>
          </div>
        )}

        {!cargando && actual && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase pt-2">Tu próxima parada</p>
            <Tarjeta p={actual} principal />
          </>
        )}

        {!cargando && paradas.length > 0 && (
          <>
            <button onClick={() => setVerTodas(!verTodas)}
                    className="w-full py-2.5 rounded-xl bg-white border text-sm text-gray-600 flex items-center justify-center gap-2">
              {verTodas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {verTodas ? 'Ocultar' : `Ver las ${paradas.length} paradas`}
            </button>
            {verTodas && (
              <div className="space-y-2">
                {paradas.filter(p => p.id !== actual?.id).map(p => <Tarjeta key={p.id} p={p} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
