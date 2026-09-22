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
  MapPin, Volume2, VolumeX, X, Check, LocateFixed, ExternalLink, Loader2, Merge, Navigation2,
} from 'lucide-react'
import { cargarGoogle, ESTILO } from '../lib/google'
import { navegacionApi } from '../services/api'
import {
  armarRuta, proyectar, siguiente, distTxt, distVoz, hablar, metros, rumbo as rumboDe, puntoEn, type Ruta, type Punto,
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

// Cámara (22-sep-2026, v2). Mapa VECTORIAL de Google con la cámara nativa:
// gira con la camioneta (lo de adelante siempre arriba), se inclina para ver
// el camino en perspectiva, y los nombres de calle quedan derechos.
// La camioneta va en el tercio de abajo: el centro de la cámara se pone unos
// metros POR DELANTE de ella, así la pantalla muestra lo que viene.
// (La v1 giraba el mapa con CSS; Google se confundía con el tamaño del mapa
// girado y la camioneta quedaba pegada arriba. Descartado.)
// DEMO_MAP_ID sirve para mapas vectoriales sin configurar nada en la nube.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID'
const ALTO_CAMIONETA = 0.78   // la camioneta a este % del alto del mapa
const INCLINACION = 50        // grados
const VOLVER_SOLO_MS = 12000  // si el conductor movió el mapa, vuelve a seguirlo solo
const ANIM_MS = 950           // cuánto dura el paso de una lectura del GPS a la siguiente

function zoomPara(vel: number, distProx: number | null, resta: number | null) {
  if ((distProx != null && distProx < 120) || (resta != null && resta < 150)) return 18.8
  if (vel > 16) return 17.2   // sobre ~60 km/h: más lejos para anticipar
  if (vel > 9) return 17.7
  return 18.2
}

// Un punto a `m` metros de `p` en dirección `rumbo`.
function avanzar(p: Punto, rumbo: number, m: number): Punto {
  const R = 6371000, d = m / R, b = rumbo * Math.PI / 180
  const la = p.lat * Math.PI / 180, lo = p.lng * Math.PI / 180
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b))
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2))
  return { lat: la2 * 180 / Math.PI, lng: lo2 * 180 / Math.PI }
}
const difAng = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180

// La flecha de navegación como elemento HTML (se gira a mano contra la cámara).
function crearFlecha() {
  const el = document.createElement('div')
  el.style.cssText = 'width:54px;height:54px;transform-origin:50% 50%;transform:translateY(50%);pointer-events:none'
  el.innerHTML =
    '<svg viewBox="0 0 54 54" width="54" height="54" style="display:block;transition:transform 300ms linear">' +
    '<circle cx="27" cy="27" r="25" fill="#1a73e8" fill-opacity="0.18"/>' +
    '<path d="M27 6 L42 44 L27 35 L12 44 Z" fill="#1a73e8" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>'
  return el
}

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
  const [modo, setModo] = useState<'rumbo' | 'norte'>(() => {
    try { return localStorage.getItem('nav_modo') === 'norte' ? 'norte' : 'rumbo' } catch { return 'rumbo' }
  })
  const [brujula, setBrujula] = useState(0)   // rumbo de la cámara, para dibujar la N
  const flechaEl = useRef<HTMLDivElement | null>(null)
  const vectorial = useRef(false)
  const rumboVista = useRef<number | null>(null)  // hacia dónde va la camioneta
  // lo que está dibujado ahora mismo (se anima desde aquí hacia la lectura nueva)
  const cam = useRef<{ p: Punto; rumbo: number; zoom: number } | null>(null)
  const meta = useRef<{ p: Punto; rumbo: number; zoom: number } | null>(null)
  const anim = useRef<number | null>(null)
  const siguiendoRef = useRef(siguiendo); siguiendoRef.current = siguiendo
  const modoRef = useRef(modo); modoRef.current = modo

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
      const inicio = pos ? { lat: pos.lat, lng: pos.lng } : { lat: destino.lat, lng: destino.lng }
      mapa.current = new g.maps.Map(div.current!, {
        center: inicio, zoom: 18, heading: 0, tilt: INCLINACION,
        mapId: MAP_ID, renderingType: g.maps.RenderingType?.VECTOR,
        disableDefaultUI: true, gestureHandling: 'greedy', clickableIcons: false,
        headingInteractionEnabled: true, tiltInteractionEnabled: true,
      })
      const verTipo = () => { vectorial.current = mapa.current.getRenderingType?.() === 'VECTOR' }
      verTipo(); mapa.current.addListener('renderingtype_changed', verTipo)
      mapa.current.addListener('dragstart', () => setSiguiendo(false))
      mapa.current.addListener('heading_changed', () => {
        const h = mapa.current.getHeading?.() || 0
        setBrujula(h); girarFlecha()
      })
      pinDestino.current = new g.maps.Marker({
        position: { lat: destino.lat, lng: destino.lng }, map: mapa.current, zIndex: 60,
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 11, fillColor: destino.tipo === 'RETIRO' ? '#4AAEE0' : '#E8177A',
                fillOpacity: 1, strokeColor: '#fff', strokeWeight: 4 },
      })
    })
    return () => { if (anim.current) cancelAnimationFrame(anim.current) }
  }, [])

  // la flecha siempre apunta hacia donde va la camioneta, descontando el giro del mapa
  function girarFlecha() {
    const svg = flechaEl.current?.firstElementChild as HTMLElement | null
    if (!svg) return
    const h = mapa.current?.getHeading?.() || 0
    svg.style.transform = `rotate(${(rumboVista.current ?? 0) - h}deg)`
  }

  // Mueve la cámara al estado `c`: centro por delante de la camioneta para
  // que ésta quede abajo, girada y con inclinación.
  function ponerCamara(c: { p: Punto; rumbo: number; zoom: number }) {
    const m = mapa.current
    if (!m || !div.current) return
    const h = div.current.clientHeight || 600
    const rumboCam = modoRef.current === 'rumbo' ? c.rumbo : 0
    const incl = vectorial.current ? INCLINACION : 0
    // metros por píxel en el centro; la perspectiva estira lo de abajo un poco
    const mpp = 156543.03392 * Math.cos(c.p.lat * Math.PI / 180) / Math.pow(2, c.zoom)
    const px = (ALTO_CAMIONETA - 0.5) * h
    const adelante = px * mpp * (incl ? 0.95 / Math.cos(incl * Math.PI / 180) * 0.8 : 1)
    const centro = avanzar(c.p, rumboCam, adelante)
    if (vectorial.current) m.moveCamera({ center: centro, heading: rumboCam, tilt: incl, zoom: c.zoom })
    else { m.setCenter(centro); if (Math.abs(m.getZoom() - Math.round(c.zoom)) > 0.1) m.setZoom(Math.round(c.zoom)) }
  }

  // anima de lo dibujado a la meta nueva, cuadro a cuadro
  function animar() {
    if (anim.current) cancelAnimationFrame(anim.current)
    const desde = cam.current, hacia = meta.current
    if (!hacia) return
    if (!desde) { cam.current = hacia; dibujar(); return }
    const t0 = performance.now()
    const dr = difAng(desde.rumbo, hacia.rumbo)
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / ANIM_MS)
      cam.current = {
        p: { lat: desde.p.lat + (hacia.p.lat - desde.p.lat) * k, lng: desde.p.lng + (hacia.p.lng - desde.p.lng) * k },
        rumbo: (desde.rumbo + dr * k + 360) % 360,
        zoom: desde.zoom + (hacia.zoom - desde.zoom) * k,
      }
      dibujar()
      anim.current = k < 1 ? requestAnimationFrame(paso) : null
    }
    anim.current = requestAnimationFrame(paso)
  }
  function dibujar() {
    const c = cam.current, g = (window as any).google
    if (!c || !g || !mapa.current) return
    if (!flecha.current) {
      flechaEl.current = crearFlecha()
      const AM = g.maps.marker?.AdvancedMarkerElement
      flecha.current = AM
        ? new AM({ map: mapa.current, position: c.p, content: flechaEl.current, zIndex: 99 })
        : new g.maps.Marker({ map: mapa.current, position: c.p, zIndex: 99 })
    }
    if ('position' in flecha.current && !flecha.current.setPosition) flecha.current.position = c.p
    else flecha.current.setPosition(c.p)
    if (siguiendoRef.current) ponerCamara(c)
    girarFlecha()
  }

  useEffect(() => {
    try { localStorage.setItem('nav_modo', modo) } catch { /* */ }
    if (siguiendo && cam.current) ponerCamara(cam.current)
  }, [modo])

  // si el conductor movió el mapa, a los 12 s sin tocarlo vuelve a seguir la camioneta
  useEffect(() => {
    if (siguiendo || !mapa.current) return
    const g = (window as any).google
    let t = window.setTimeout(() => recentrar(), VOLVER_SOLO_MS)
    const reset = () => { window.clearTimeout(t); t = window.setTimeout(() => recentrar(), VOLVER_SOLO_MS) }
    const ls = ['dragstart', 'drag'].map(ev => mapa.current.addListener(ev, reset))
    return () => { window.clearTimeout(t); ls.forEach(l => g?.maps.event.removeListener(l)) }
  }, [siguiendo])

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
      const donde: Punto = enCamino ? e.p : { lat: pos.lat, lng: pos.lng }
      const vel = pos.velocidad || 0
      // rumbo: sobre la ruta, hacia un punto 30 m más adelante (gira con la
      // calle, no con el ruido del GPS); fuera de ella, el del GPS si se mueve;
      // detenido, se queda con el último para que el mapa no baile.
      let dir: number | null = null
      if (enCamino && ruta && ruta.total - e.s > 8) dir = rumboDe(e.p, puntoEn(ruta, e.s + 30))
      else if (vel > 2 && pos.rumbo != null) dir = pos.rumbo
      else dir = rumboVista.current ?? (e ? e.dir : 0)
      const d: number = dir ?? 0
      const rumboNuevo = rumboVista.current != null && Math.abs(difAng(rumboVista.current, d)) < 3 ? rumboVista.current : d
      rumboVista.current = rumboNuevo
      const sg = ruta && e ? siguiente(ruta, e.s) : null
      meta.current = { p: donde, rumbo: rumboNuevo, zoom: zoomPara(vel, sg?.prox ? sg.distProx : null, sg ? sg.resta : null) }
      animar()
    }
  }, [pos, ruta])

  useEffect(() => () => { if (anim.current) cancelAnimationFrame(anim.current) }, [])

  function recentrar() {
    setSiguiendo(true)
    siguiendoRef.current = true
    if (cam.current) ponerCamara(cam.current)
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
      <div className="relative flex-1 min-h-0 overflow-hidden bg-[#f5f5f5]">
        <div ref={div} className="absolute inset-0" />
        <button onClick={() => (siguiendo ? setModo(m => (m === 'rumbo' ? 'norte' : 'rumbo')) : recentrar())}
                className="absolute top-3 right-3 z-20 bg-white rounded-full w-12 h-12 shadow-lg flex items-center justify-center"
                aria-label={modo === 'rumbo' ? 'Poner el norte arriba' : 'Girar con la camioneta'}>
          <span style={{ transform: `rotate(${-brujula}deg)` }} className="flex flex-col items-center leading-none">
            <Navigation2 size={16} className={modo === 'rumbo' ? 'text-red-600' : 'text-gray-500'} fill="currentColor" />
            <span className="text-[10px] font-bold text-gray-700">N</span>
          </span>
        </button>
        {pidiendo && ruta && (
          <div className="absolute z-20 top-3 left-1/2 -translate-x-1/2 bg-white/95 rounded-full px-3 py-1.5 text-sm shadow flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Recalculando…
          </div>
        )}
        {error && ruta && (
          <div className="absolute z-20 top-16 left-3 right-3 bg-amber-100 text-amber-900 rounded-xl px-3 py-2 text-sm shadow">{error}</div>
        )}
        {!siguiendo && (
          <button onClick={recentrar}
                  className="absolute z-20 bottom-4 right-4 bg-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-semibold text-blue-700">
            <LocateFixed size={18} /> Centrar
          </button>
        )}
        {pos && (pos.exactitud || 0) > 60 && (
          <div className="absolute z-20 bottom-4 left-4 bg-white/95 rounded-full px-3 py-1.5 text-xs shadow text-gray-600">
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

