// NAVEGACIÓN DEL CONDUCTOR DENTRO DE LA APP (21-sep-2026).
//
// Reemplaza el salto a Google Maps al tocar "Ir". Al salir de la app, el
// navegador del teléfono deja de entregar la ubicación y el rastro del día se
// cortaba (37 puntos en una jornada). Aquí la app queda delante todo el viaje:
// sigue a la camioneta, anuncia cada maniobra con voz y mantiene la pantalla
// encendida. El GPS lo sigue reportando Conductor.tsx, que es quien lo abrió.
//
// La ruta la entrega ladys-navegacion (Routes API). Si la camioneta se sale
// del camino, se pide otra ruta desde donde está, como mucho cada 20 s.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, Undo2, RotateCw,
  MapPin, Volume2, VolumeX, X, Check, LocateFixed, ExternalLink, Loader2, Merge,
} from 'lucide-react'
import { cargarGoogle, ESTILO } from '../lib/google'
import { navegacionApi } from '../services/api'
import {
  armarRuta, proyectar, siguiente, distTxt, distVoz, hablar, metros, type Ruta, type Punto,
} from '../lib/navegacion'

export type PosGps = { lat: number; lng: number; rumbo?: number | null; velocidad?: number | null; exactitud?: number | null }

type Props = {
  destino: { id: number; lat: number; lng: number; nombre: string; direccion: string; tipo: string }
  pos: PosGps | null
  onLlegue: () => void
  onSalir: () => void
  linkGoogle: string
}

const DESVIO_M = 45          // fuera del camino a partir de aquí
const DESVIO_LECTURAS = 3    // lecturas seguidas fuera antes de recalcular
const RECALC_MIN_MS = 20000  // no pedir rutas más seguido que esto
const LLEGADA_M = 35

function Icono({ m, size = 44 }: { m?: string; size?: number }) {
  const x = String(m || '')
  const p = { size, strokeWidth: 2.6 }
  if (x.startsWith('UTURN')) return <Undo2 {...p} />
  if (x.startsWith('ROUNDABOUT')) return <RotateCw {...p} />
  if (x === 'TURN_SLIGHT_LEFT' || x === 'FORK_LEFT' || x === 'RAMP_LEFT') return <ArrowUpLeft {...p} />
  if (x === 'TURN_SLIGHT_RIGHT' || x === 'FORK_RIGHT' || x === 'RAMP_RIGHT') return <ArrowUpRight {...p} />
  if (x.includes('LEFT')) return <CornerUpLeft {...p} />
  if (x.includes('RIGHT')) return <CornerUpRight {...p} />
  if (x === 'MERGE') return <Merge {...p} />
  return <ArrowUp {...p} />
}

// Quita el punto final y el "con dirección a" repetido para que se lea corto.
const limpio = (t: string) => String(t || '').replace(/\s*\n\s*/g, '. ').replace(/\s+/g, ' ').replace(/\.$/, '').trim()

export default function Navegacion({ destino, pos, onLlegue, onSalir, linkGoogle }: Props) {
  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<any>(null)
  const lineaFalta = useRef<any>(null)
  const lineaHecha = useRef<any>(null)
  const flecha = useRef<any>(null)
  const pinDestino = useRef<any>(null)

  const [ruta, setRuta] = useState<Ruta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pidiendo, setPidiendo] = useState(false)
  const [voz, setVoz] = useState(true)
  const [siguiendo, setSiguiendo] = useState(true)
  const [llegaste, setLlegaste] = useState(false)
  const [estado, setEstado] = useState<{ s: number; lado: number; idx: number; p: Punto; dir: number } | null>(null)

  const ultimoPedido = useRef(0)
  const fuera = useRef(0)
  const dichos = useRef<Set<string>>(new Set())
  const vozRef = useRef(voz); vozRef.current = voz
  const decir = (t: string) => { if (vozRef.current) hablar(t) }

  // ── pedir la ruta ──
  const pedir = async (motivo: 'inicio' | 'desvio') => {
    if (!pos || pidiendo) return
    const ahora = Date.now()
    if (motivo === 'desvio' && ahora - ultimoPedido.current < RECALC_MIN_MS) return
    ultimoPedido.current = ahora
    setPidiendo(true)
    try {
      const rumbo = pos.velocidad && pos.velocidad > 2 && pos.rumbo != null ? pos.rumbo : null
      const { data } = await navegacionApi.ruta({
        origen: { lat: pos.lat, lng: pos.lng }, destino: { lat: destino.lat, lng: destino.lng },
        rumbo, parada_id: destino.id, motivo,
      })
      const r = armarRuta(data)
      if (r.pts.length < 2) throw new Error('ruta vacía')
      setRuta(r); setError(null); fuera.current = 0
      dichos.current = new Set()
      if (motivo === 'desvio') decir('Recalculando.')
      const p0 = r.pasos[0]
      setTimeout(() => decir(motivo === 'inicio'
        ? `Vamos donde ${destino.nombre}. ${limpio(p0?.texto)}`
        : limpio(p0?.texto)), motivo === 'desvio' ? 900 : 0)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo calcular la ruta')
    } finally { setPidiendo(false) }
  }

  // primera ruta apenas haya posición
  const pedidaInicial = useRef(false)
  useEffect(() => {
    if (pos && !pedidaInicial.current) { pedidaInicial.current = true; pedir('inicio') }
  }, [pos])

  // ── pantalla siempre encendida ──
  useEffect(() => {
    let lock: any = null, vivo = true
    const pedirLock = async () => {
      try { if (document.visibilityState === 'visible') lock = await (navigator as any).wakeLock?.request('screen') } catch { /* opcional */ }
    }
    const alVolver = () => { if (vivo && document.visibilityState === 'visible') pedirLock() }
    pedirLock()
    document.addEventListener('visibilitychange', alVolver)
    return () => { vivo = false; document.removeEventListener('visibilitychange', alVolver); try { lock?.release?.() } catch { /* */ } }
  }, [])

  // ── mapa ──
  useEffect(() => {
    if (!div.current) return
    cargarGoogle().then(g => {
      if (mapa.current) return
      mapa.current = new g.maps.Map(div.current!, {
        center: pos ? { lat: pos.lat, lng: pos.lng } : { lat: destino.lat, lng: destino.lng },
        zoom: 17, styles: ESTILO, disableDefaultUI: true, gestureHandling: 'greedy', clickableIcons: false,
      })
      mapa.current.addListener('dragstart', () => setSiguiendo(false))
      pinDestino.current = new g.maps.Marker({
        position: { lat: destino.lat, lng: destino.lng }, map: mapa.current, zIndex: 60,
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 11, fillColor: destino.tipo === 'RETIRO' ? '#4AAEE0' : '#E8177A',
                fillOpacity: 1, strokeColor: '#fff', strokeWeight: 4 },
      })
    })
  }, [])

  // dibujar la ruta nueva
  useEffect(() => {
    if (!ruta) return
    cargarGoogle().then(g => {
      if (!mapa.current) return
      lineaFalta.current?.setMap(null); lineaHecha.current?.setMap(null)
      lineaHecha.current = new g.maps.Polyline({ map: mapa.current, path: [], strokeColor: '#9ca3af', strokeWeight: 8, strokeOpacity: 0.9, zIndex: 1 })
      lineaFalta.current = new g.maps.Polyline({ map: mapa.current, path: ruta.pts, strokeColor: '#1a73e8', strokeWeight: 9, strokeOpacity: 0.95, zIndex: 2 })
      if (!siguiendo) {
        const caja = new g.maps.LatLngBounds(); ruta.pts.forEach(p => caja.extend(p)); mapa.current.fitBounds(caja, 60)
      }
    })
  }, [ruta])

  // ── cada lectura del GPS ──
  useEffect(() => {
    if (!pos) return
    const g = (window as any).google
    let e = null as any
    if (ruta) {
      e = proyectar(ruta, pos, estado?.idx || 0)
      setEstado(e)
      const malaSenal = (pos.exactitud || 0) > 60
      if (!malaSenal && e.lado > DESVIO_M) {
        fuera.current++
        if (fuera.current >= DESVIO_LECTURAS) pedir('desvio')
      } else fuera.current = 0

      // lo recorrido en gris, lo que falta en azul
      if (lineaFalta.current && lineaHecha.current) {
        lineaHecha.current.setPath([...ruta.pts.slice(0, e.idx + 1), e.p])
        lineaFalta.current.setPath([e.p, ...ruta.pts.slice(e.idx + 1)])
      }

      // voz: aviso anticipado y aviso en la esquina, una vez cada uno
      const sg = siguiente(ruta, e.s)
      const aviso = Math.max(180, Math.min(450, (pos.velocidad || 8) * 15))
      if (sg.prox) {
        const k = `${sg.paso + 1}`
        if (sg.distProx <= aviso && sg.distProx > 70 && !dichos.current.has('a' + k)) {
          dichos.current.add('a' + k); decir(`En ${distVoz(sg.distProx)}, ${limpio(sg.prox.texto).replace(/^./, c => c.toLowerCase())}`)
        } else if (sg.distProx <= 40 && !dichos.current.has('b' + k)) {
          dichos.current.add('a' + k); dichos.current.add('b' + k); decir(limpio(sg.prox.texto))
        }
      }
    }
    // llegada
    const aDestino = metros(pos, destino)
    if (!llegaste && (aDestino <= LLEGADA_M || (ruta && e && e.lado < 40 && ruta.total - e.s <= 20))) {
      setLlegaste(true); decir(`Llegaste donde ${destino.nombre}.`)
    }
    // la flecha: pegada al camino si va sobre él, y apuntando hacia donde avanza
    if (g && mapa.current) {
      const enCamino = e && e.lado < 25
      const donde = enCamino ? e.p : { lat: pos.lat, lng: pos.lng }
      const dir = pos.velocidad && pos.velocidad > 2 && pos.rumbo != null ? pos.rumbo : (e ? e.dir : 0)
      const icono = { path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 7, rotation: dir,
                      fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }
      if (!flecha.current) flecha.current = new g.maps.Marker({ map: mapa.current, position: donde, icon: icono, zIndex: 99 })
      else { flecha.current.setPosition(donde); flecha.current.setIcon(icono) }
      if (siguiendo) mapa.current.panTo(donde)
    }
  }, [pos, ruta])

  const recentrar = () => {
    setSiguiendo(true)
    if (mapa.current && pos) { mapa.current.setZoom(17); mapa.current.panTo(estado?.lado != null && estado.lado < 25 ? estado.p : pos) }
  }

  const info = useMemo(() => (ruta && estado ? siguiente(ruta, estado.s) : null), [ruta, estado])
  const restaMin = ruta && info ? Math.max(1, Math.round((ruta.seg * (info.resta / Math.max(1, ruta.total))) / 60)) : null
  const horaLlegada = restaMin != null
    ? new Date(Date.now() + restaMin * 60000).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })
    : null

  // en el primer tramo todavía no hay "próxima maniobra": se muestra la salida
  const cartel = llegaste
    ? { icono: 'DEST', dist: '', texto: `Llegaste · ${destino.nombre}` }
    : info?.prox
      ? { icono: info.prox.maniobra, dist: distTxt(info.distProx), texto: limpio(info.prox.texto) }
      : info
        ? { icono: 'STRAIGHT', dist: distTxt(info.resta), texto: 'Destino al frente' }
        : null

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col" style={{ height: '100dvh' }}>
      {/* cartel de la próxima maniobra */}
      <div className="shrink-0 text-white px-4 pt-4 pb-3 flex items-center gap-3"
           style={{ background: llegaste ? '#16a34a' : '#0b8043', paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="shrink-0">{llegaste ? <MapPin size={44} strokeWidth={2.6} /> : <Icono m={cartel?.icono} />}</div>
        <div className="flex-1 min-w-0">
          {cartel ? (
            <>
              {cartel.dist && <p className="text-3xl font-bold leading-none">{cartel.dist}</p>}
              <p className="text-lg leading-snug mt-1 line-clamp-2">{cartel.texto}</p>
            </>
          ) : error ? (
            <p className="text-base">{error}</p>
          ) : (
            <p className="text-base flex items-center gap-2"><Loader2 size={18} className="animate-spin" />
              {pos ? 'Calculando la ruta…' : 'Esperando tu ubicación…'}</p>
          )}
        </div>
        <button onClick={() => setVoz(v => !v)} className="shrink-0 p-2.5 rounded-full bg-white/20" aria-label="voz">
          {voz ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>
      </div>

      {/* mapa */}
      <div className="relative flex-1 min-h-0">
        <div ref={div} className="absolute inset-0" />
        {pidiendo && ruta && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 rounded-full px-3 py-1.5 text-sm shadow flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Recalculando…
          </div>
        )}
        {error && ruta && (
          <div className="absolute top-3 left-3 right-3 bg-amber-100 text-amber-900 rounded-xl px-3 py-2 text-sm shadow">{error}</div>
        )}
        {!siguiendo && (
          <button onClick={recentrar}
                  className="absolute bottom-4 right-4 bg-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-semibold text-blue-700">
            <LocateFixed size={18} /> Centrar
          </button>
        )}
        {pos && (pos.exactitud || 0) > 60 && (
          <div className="absolute bottom-4 left-4 bg-white/95 rounded-full px-3 py-1.5 text-xs shadow text-gray-600">
            GPS débil (±{Math.round(pos.exactitud || 0)} m)
          </div>
        )}
      </div>

      {/* destino y acciones */}
      <div className="shrink-0 bg-white px-4 pt-3 space-y-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {restaMin != null ? `${restaMin} min` : '—'}
              {info && <span className="text-base font-medium text-gray-500"> · {distTxt(info.resta)}</span>}
            </p>
            <p className="text-sm text-gray-600 truncate mt-1">
              <span className="font-bold" style={{ color: destino.tipo === 'RETIRO' ? '#4AAEE0' : '#E8177A' }}>
                {destino.tipo === 'RETIRO' ? 'Retiro' : 'Entrega'}
              </span> · {destino.nombre}
            </p>
            <p className="text-xs text-gray-400 truncate">{destino.direccion}</p>
          </div>
          {horaLlegada && <p className="text-sm text-gray-500 shrink-0">llegas {horaLlegada}</p>}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button onClick={onLlegue}
                  className={`py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 ${llegaste ? 'animate-pulse' : ''}`}
                  style={{ background: '#16a34a' }}>
            <Check size={20} /> Llegué
          </button>
          <button onClick={onSalir} className="px-5 rounded-xl border text-gray-600 font-medium flex items-center gap-1.5">
            <X size={18} /> Salir
          </button>
        </div>
        <a href={linkGoogle} target="_blank" rel="noreferrer"
           className="flex items-center justify-center gap-1 text-[11px] text-gray-400 pb-1">
          <ExternalLink size={11} /> Abrir en Google Maps (se corta tu ubicación en vivo)
        </a>
      </div>
    </div>
  )
}

