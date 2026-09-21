// LA RUTA EN VIVO, MIRADA DESDE EL LOCAL (bitácora #84).
//
// Responde tres preguntas que hoy se contestan llamando al conductor: dónde va
// la camioneta, por dónde anduvo, y cuánto le falta.
//
// LA REGLA QUE NO SE PUEDE ROMPER: la posición sólo se reporta MIENTRAS la
// pantalla del conductor está abierta. Si la cierra, el último punto queda
// quieto y el mapa mentiría diciendo que está ahí parado. Por eso, pasados unos
// minutos sin reportar, la camioneta se dibuja apagada y arriba dice "sin señal
// desde las HH:MM": es información distinta a "está detenida".
import { useEffect, useMemo, useRef, useState } from 'react'
import { seguimientoApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  Truck, Clock, MapPin, RefreshCw, WifiOff, Check, X, Navigation, Route as RutaIcono,
} from 'lucide-react'
import { cargarGoogle, ESTILO, CENTRO, pin, camioneta, rumboEntre } from '../lib/google'

const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
const hhmm = (v: any) => v
  ? new Date(v).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false })
  : '—'
const hora = (t: any) => (t ? String(t).slice(0, 5) : '—')
const minDesde = (v: any) => (v ? Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 60000)) : null)
const enTiempo = (m: number | null) => m == null ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`

// Pasados estos minutos sin un reporte nuevo, dejamos de creerle al punto.
const SIN_SENAL_MIN = 4

const COLOR: Record<string, string> = {
  COMPLETADA: '#16a34a', FALLIDA: '#dc2626', EN_CAMINO: '#E8177A', PENDIENTE: '#94a3b8',
}

export default function RutaEnVivo() {
  const [fecha, setFecha] = useState(hoy())
  const [d, setD] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [tic, setTic] = useState(0)          // repinta los "hace X min" sin pedir datos

  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<any>(null)
  const auto = useRef<any>(null)
  const halo = useRef<any>(null)
  const latido = useRef<any>(null)
  const capa = useRef<any[]>([])
  const trazo = useRef<any>(null)
  const donde = useRef<any>(null)
  const cuadro = useRef<number>(0)
  const encuadrado = useRef(false)           // el encuadre se hace una vez: después manda el usuario
  const globo = useRef<any>(null)

  const traer = (f = fecha, silencioso = true) => {
    if (!silencioso) setCargando(true)
    seguimientoApi.recorrido(f)
      .then(r => setD(r.data))
      .catch(() => { if (!silencioso) toast.error('No se pudo cargar la ruta') })
      .finally(() => setCargando(false))
  }

  useEffect(() => { encuadrado.current = false; traer(fecha, false) }, [fecha])

  // Refresco automático sólo si estamos mirando hoy: un día pasado no cambia.
  useEffect(() => {
    if (fecha !== hoy()) return
    const t = setInterval(() => traer(fecha), 15000)
    const r = setInterval(() => setTic(x => x + 1), 30000)
    return () => { clearInterval(t); clearInterval(r) }
  }, [fecha])

  // LA MAÑANA Y LA TARDE SON DOS VIAJES (Lufi, 21-sep): se mira un tramo a la vez,
  // con sus paradas numeradas desde 1 y sólo el rastro de ese horario.
  const [tramoSel, setTramoSel] = useState('')
  const tramos = useMemo(() => {
    const m: Record<string, any> = {}
    ;(d?.paradas || []).forEach((p: any) => {
      const k = p.tramo || 'Sin ruta'
      if (!m[k]) m[k] = { clave: k, inicio: p.hora_inicio ? String(p.hora_inicio).slice(0, 5) : '',
                          fin: p.hora_fin ? String(p.hora_fin).slice(0, 5) : '', paradas: [] as any[] }
      m[k].paradas.push(p)
    })
    return Object.values(m).sort((a: any, b: any) => String(a.inicio).localeCompare(String(b.inicio))).map((t: any) => ({
      ...t, manana: t.inicio ? Number(t.inicio.slice(0, 2)) < 12 : /^AM/i.test(t.clave),
      pendientes: t.paradas.filter((p: any) => p.estado === 'PENDIENTE' || p.estado === 'EN_CAMINO').length,
      paradas: t.paradas.map((p: any, i: number) => ({ ...p, n: i + 1 })),
    })) as any[]
  }, [d])
  useEffect(() => {
    if (!tramos.length) return
    if (tramos.some(t => t.clave === tramoSel)) return
    const ahora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Santiago', hour12: false }).slice(0, 5)
    const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
    const t = fecha !== hoy() ? tramos[0]
      : tramos.find(t => t.pendientes && t.inicio && min(ahora) >= min(t.inicio) - 60 && min(ahora) <= min(t.fin) + 150)
        || tramos.find(t => t.pendientes) || tramos[tramos.length - 1]
    setTramoSel(t.clave)
  }, [tramos, tramoSel, fecha])
  useEffect(() => { setTramoSel(''); encuadrado.current = false }, [fecha])
  const tramo = tramos.find(t => t.clave === tramoSel) || null
  const paradasT: any[] = tramo ? tramo.paradas : []

  const conductor = d?.conductores?.[0] || null
  const sinSenal = conductor ? Number(conductor.min_sin_reportar) >= SIN_SENAL_MIN : false
  const detenidaMin = minDesde(d?.resumen?.ultimo_movimiento)

  // ── el mapa ──
  useEffect(() => {
    if (!div.current || !d) return
    let vivo = true

    cargarGoogle().then(g => {
      if (!vivo) return
      if (!mapa.current) {
        mapa.current = new g.maps.Map(div.current!, {
          center: d.base ? { lat: d.base.lat, lng: d.base.lng } : CENTRO,
          zoom: 14, styles: ESTILO, mapTypeControl: false, streetViewControl: false,
          fullscreenControl: false, gestureHandling: 'greedy',
        })
        globo.current = new g.maps.InfoWindow()
      }

      capa.current.forEach((x: any) => x.setMap(null))
      capa.current = []
      const caja = new g.maps.LatLngBounds()
      let puntos = 0

      if (d.base) {
        const m = new g.maps.Marker({
          position: { lat: d.base.lat, lng: d.base.lng }, map: mapa.current,
          icon: pin('L', '#1F2430'), title: 'Local Ladys', zIndex: 40,
        })
        capa.current.push(m); caja.extend({ lat: d.base.lat, lng: d.base.lng }); puntos++
      }

      // Las paradas del día, del color de su estado.
      ;paradasT.filter((p: any) => p.lat && p.lng).forEach((p: any) => {
        const m = new g.maps.Marker({
          position: { lat: Number(p.lat), lng: Number(p.lng) }, map: mapa.current,
          icon: pin(String(p.n), COLOR[p.estado] || '#94a3b8'),
          title: p.cliente, zIndex: p.estado === 'EN_CAMINO' ? 60 : 50,
        })
        m.addListener('click', () => {
          globo.current.setContent(
            `<div style="font-size:13px;line-height:1.45">` +
            `<b>${p.n}. ${p.cliente}</b><br>` +
            `${p.direccion || ''}${p.comuna ? ', ' + p.comuna : ''}<br><small>` +
            `${p.tipo === 'RETIRO' ? 'Retiro' : 'Entrega'} · pedido ${p.orden_id} · ` +
            `${p.llegada_real ? 'llegó ' + hhmm(p.llegada_real) : 'estimada ' + hora(p.hora_estimada)}` +
            `</small></div>`)
          globo.current.open(mapa.current, m)
        })
        capa.current.push(m); caja.extend({ lat: Number(p.lat), lng: Number(p.lng) }); puntos++
      })

      // El rastro: por dónde anduvo hoy de verdad, no por dónde debía andar.
      // Sólo el rastro del horario de este tramo: la mañana no se dibuja encima de la tarde.
      const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
      const desdeT = tramo?.inicio ? aMin(tramo.inicio) - 60 : 0
      const hastaT = tramo?.fin ? aMin(tramo.fin) + 150 : 24 * 60
      const camino = (d.rastro || []).filter((r: any) => {
        const h = new Date(r.momento).toLocaleTimeString('en-GB', { timeZone: 'America/Santiago', hour12: false }).slice(0, 5)
        return aMin(h) >= desdeT && aMin(h) <= hastaT
      }).map((r: any) => ({ lat: Number(r.lat), lng: Number(r.lng) }))
      if (trazo.current) trazo.current.setMap(null)
      if (camino.length > 1) {
        trazo.current = new g.maps.Polyline({
          path: camino, map: mapa.current, geodesic: true,
          strokeColor: '#A87BC8', strokeOpacity: 0.85, strokeWeight: 4, zIndex: 20,
        })
        camino.forEach((c: any) => caja.extend(c))
        puntos += camino.length
      }

      // ── la camioneta ──
      const pos = conductor ? { lat: Number(conductor.lat), lng: Number(conductor.lng) } : null
      if (!pos) {
        if (auto.current) { auto.current.setMap(null); auto.current = null }
        if (halo.current) { halo.current.setMap(null); halo.current = null }
        if (latido.current) { clearInterval(latido.current); latido.current = null }
      } else {
        if (!auto.current) {
          halo.current = new g.maps.Marker({
            position: pos, map: mapa.current, zIndex: 80, clickable: false,
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 16, fillColor: '#E8177A',
                    fillOpacity: 0.18, strokeColor: '#E8177A', strokeOpacity: 0.28, strokeWeight: 1 },
          })
          let t = 0
          latido.current = setInterval(() => {
            if (!halo.current) return
            t += 0.08
            const i = halo.current.getIcon()
            halo.current.setIcon({ ...i, scale: 15 + Math.sin(t) * 5, fillOpacity: 0.20 - Math.sin(t) * 0.07 })
          }, 60)
          auto.current = new g.maps.Marker({
            position: pos, map: mapa.current, icon: camioneta(0), zIndex: 90,
            title: conductor.conductor,
          })
          donde.current = pos
        } else {
          const desde = donde.current || pos
          const quieto = Math.abs(desde.lat - pos.lat) < 0.00002 && Math.abs(desde.lng - pos.lng) < 0.00002
          if (!quieto) auto.current.setIcon(camioneta(rumboEntre(desde, pos)))
          cancelAnimationFrame(cuadro.current)
          const t0 = performance.now(), DURA = 1400
          const paso = (t: number) => {
            const k = Math.min(1, (t - t0) / DURA)
            const suave = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
            const p = { lat: desde.lat + (pos.lat - desde.lat) * suave,
                        lng: desde.lng + (pos.lng - desde.lng) * suave }
            auto.current?.setPosition(p); halo.current?.setPosition(p); donde.current = p
            if (k < 1) cuadro.current = requestAnimationFrame(paso)
          }
          cuadro.current = requestAnimationFrame(paso)
        }
        // Sin señal: se apaga el halo y la camioneta queda pálida. El punto sigue
        // ahí porque es el último lugar conocido, pero deja de parecer presente.
        auto.current.setOpacity(sinSenal ? 0.45 : 1)
        halo.current?.setVisible(!sinSenal)
        caja.extend(pos); puntos++
      }

      if (puntos > 1 && !encuadrado.current) {
        mapa.current.fitBounds(caja, 50)
        encuadrado.current = true
      }
    })

    return () => { vivo = false; cancelAnimationFrame(cuadro.current) }
  }, [d, tramoSel])

  useEffect(() => { encuadrado.current = false }, [tramoSel])

  useEffect(() => () => { if (latido.current) clearInterval(latido.current) }, [])

  const r = d?.resumen
  const faltan = paradasT.filter(p => p.estado === 'PENDIENTE' || p.estado === 'EN_CAMINO').length
  const hechasT = paradasT.filter(p => p.estado === 'COMPLETADA').length
  const enCamino = paradasT.find((p: any) => p.estado === 'EN_CAMINO')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: '#1F2430' }}>
          <RutaIcono size={20} style={{ color: '#E8177A' }} /> Ruta en vivo
        </h1>
        <div className="flex items-center gap-2">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" />
          <button onClick={() => traer(fecha, false)}
            className="border rounded-lg px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-gray-50">
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* El estado de la camioneta va arriba de todo: es lo que se viene a mirar. */}
      <div className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
        style={{ background: sinSenal ? '#FFF7ED' : conductor ? '#FDF2F8' : '#F1F5F9' }}>
        {!conductor ? (
          <span className="flex items-center gap-2 text-gray-500">
            <Truck size={16} /> La camioneta no ha reportado posición {fecha === hoy() ? 'hoy' : 'ese día'}
          </span>
        ) : sinSenal ? (
          <span className="flex items-center gap-2" style={{ color: '#b45309' }}>
            <WifiOff size={16} />
            <b>Sin señal desde las {hhmm(conductor.actualizado)}</b>
            <span className="text-gray-500">
              · {conductor.conductor} · el punto del mapa es el último lugar conocido, no dónde está ahora
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-2" style={{ color: '#E8177A' }}>
            <Truck size={16} />
            <b>{conductor.conductor} en ruta</b>
            <span className="text-gray-600">
              · reportó {conductor.min_sin_reportar <= 1 ? 'recién' : `hace ${conductor.min_sin_reportar} min`}
              {detenidaMin != null && detenidaMin >= 5 && ` · detenida hace ${enTiempo(detenidaMin)}`}
            </span>
          </span>
        )}
        {enCamino && (
          <span className="flex items-center gap-1.5 text-gray-600">
            <Navigation size={14} style={{ color: '#E8177A' }} />
            Va a <b>{enCamino.cliente}</b> · {enCamino.direccion}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Dato titulo="Salió a ruta" valor={hhmm(r?.salida)} />
        <Dato titulo="Kilómetros del día" valor={`${r?.km ?? 0} km`} />
        <Dato titulo="Paradas hechas" valor={`${hechasT} de ${paradasT.length}`} />
        <Dato titulo="Le faltan" valor={`${faltan} parada${faltan === 1 ? '' : 's'}`} />
      </div>

      {tramos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tramos.map(t => (
            <button key={t.clave} onClick={() => setTramoSel(t.clave)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border ${tramoSel === t.clave ? 'text-white border-transparent' : 'bg-white text-gray-600'}`}
              style={tramoSel === t.clave ? { background: t.manana ? '#4AAEE0' : '#E8177A' } : {}}>
              {t.manana ? 'Mañana' : 'Tarde'} · {t.inicio}–{t.fin} · {t.paradas.length} parada{t.paradas.length === 1 ? '' : 's'}
              {t.pendientes ? ` · ${t.pendientes} por hacer` : ' · terminada'}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border bg-white">
        <div ref={div} style={{ height: '58vh', minHeight: 340 }} />
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-2.5 text-sm font-medium border-b" style={{ color: '#1F2430' }}>
          Paradas {tramo ? `de la ${tramo.manana ? 'mañana' : 'tarde'}` : 'del día'}
        </div>
        {paradasT.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-400 flex items-center gap-2">
            <MapPin size={15} /> No hay paradas cargadas para esta fecha
          </div>
        )}
        <ul className="divide-y">
          {paradasT.map((p: any) => (
            <li key={p.id} className="px-4 py-2.5 flex items-center gap-3 text-sm"
              style={{ background: p.estado === 'EN_CAMINO' ? '#FDF2F8' : undefined }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: COLOR[p.estado] || '#94a3b8' }}>
                {p.estado === 'COMPLETADA' ? <Check size={14} />
                  : p.estado === 'FALLIDA' ? <X size={14} />
                  : p.n}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ color: '#1F2430' }}>
                  {p.cliente}
                  <span className="text-gray-400 text-xs"> · {p.tipo === 'RETIRO' ? 'retiro' : 'entrega'} · pedido {p.orden_id}</span>
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {p.direccion}{p.comuna ? `, ${p.comuna}` : ''}
                </span>
              </span>
              <span className="text-xs text-right shrink-0 text-gray-500 flex items-center gap-1.5">
                <Clock size={12} />
                {p.llegada_real
                  ? <span style={{ color: '#16a34a' }}>llegó {hhmm(p.llegada_real)}</span>
                  : <span>~{hora(p.hora_estimada)}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-gray-400 px-1">
        Se actualiza sola cada 15 segundos mientras mires el día de hoy. La camioneta reporta su
        posición sólo con la pantalla del conductor abierta.
        <span className="hidden">{tic}</span>
      </p>
    </div>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className="text-lg font-semibold" style={{ color: '#1F2430' }}>{valor}</div>
    </div>
  )
}
