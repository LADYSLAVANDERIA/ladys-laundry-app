import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Truck, Clock, MapPin } from 'lucide-react'
import { cargarGoogle, ESTILO, pin, camioneta, rumboEntre } from '../lib/google'
import { decodificar, metros } from '../lib/navegacion'

const SEG = (import.meta.env.VITE_API_URL || 'https://vhjsizkbmabznupkfzji.supabase.co/functions/v1/ladys/api')
  .replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-seguimiento')

function haceCuanto(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 90) return 'recién'
  const m = Math.floor(s / 60)
  return m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h`
}

// Consulta el estado de reparto de un pedido. Se usa para el distintivo
// "En camino" en la lista y para el mapa cuando el cliente lo despliega.
export function useSeguimiento(ordenId: number, token: string, activo: boolean) {
  const [d, setD] = useState<any>(null)
  useEffect(() => {
    if (!activo) return
    let vivo = true
    const traer = () => {
      axios.get(`${SEG}/seguir/${ordenId}/${token}`)
        .then(r => { if (vivo) setD(r.data) })
        .catch(() => {})
    }
    traer()
    const t = setInterval(traer, 15000)
    return () => { vivo = false; clearInterval(t) }
  }, [ordenId, token, activo])
  return d
}

export default function MapaEnVivo({ datos }: { datos: any }) {
  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<any>(null)
  const auto = useRef<any>(null)
  const halo = useRef<any>(null)
  const latido = useRef<any>(null)
  const ruta = useRef<any>(null)
  const donde = useRef<any>(null)     // dónde está dibujada la camioneta ahora
  const cuadro = useRef<number>(0)    // animación en curso
  const rutaDe = useRef<string>('')   // la última ruta dibujada
  const tocado = useRef(false)        // si el cliente movió el mapa, no se lo reencuadramos

  useEffect(() => {
    if (!div.current || !datos?.destino) return
    let vivo = true

    cargarGoogle().then(g => {
      if (!vivo) return
      const destino = { lat: datos.destino.lat, lng: datos.destino.lng }

      if (!mapa.current) {
        mapa.current = new g.maps.Map(div.current!, {
          center: destino, zoom: 14, styles: ESTILO,
          mapTypeControl: false, streetViewControl: false,
          fullscreenControl: false, zoomControl: false,
          gestureHandling: 'greedy',
        })
        mapa.current.addListener('dragstart', () => { tocado.current = true })
        new g.maps.Marker({ position: destino, map: mapa.current,
          icon: pin('C', '#E8177A'), title: 'Tu dirección' })
      }

      if (!datos.conductor) return
      const pos = { lat: datos.conductor.lat, lng: datos.conductor.lng }

      // ── La camioneta ──
      if (!auto.current) {
        // Un halo que late debajo: es lo que hace que se lea como algo vivo y
        // no como un dibujo pegado al mapa.
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
          halo.current.setIcon({ ...i, scale: 15 + Math.sin(t) * 5,
            fillOpacity: 0.20 - Math.sin(t) * 0.07 })
        }, 60)

        auto.current = new g.maps.Marker({ position: pos, map: mapa.current,
          icon: camioneta(0), title: 'La camioneta de Ladys', zIndex: 90 })
        donde.current = pos
      } else {
        // No salta de un punto a otro: se desliza. Ese movimiento es lo que el
        // cliente lee como "viene en camino".
        const desde = donde.current || pos
        const quieto = Math.abs(desde.lat - pos.lat) < 0.00002 &&
                       Math.abs(desde.lng - pos.lng) < 0.00002
        if (!quieto) auto.current.setIcon(camioneta(rumboEntre(desde, pos)))
        cancelAnimationFrame(cuadro.current)
        const t0 = performance.now(), DURA = 1400
        const paso = (t: number) => {
          const k = Math.min(1, (t - t0) / DURA)
          const suave = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
          const p = { lat: desde.lat + (pos.lat - desde.lat) * suave,
                      lng: desde.lng + (pos.lng - desde.lng) * suave }
          auto.current?.setPosition(p)
          halo.current?.setPosition(p)
          donde.current = p
          if (k < 1) cuadro.current = requestAnimationFrame(paso)
        }
        cuadro.current = requestAnimationFrame(paso)
      }

      // ── La ruta que va a seguir la camioneta ──
      // (22-sep-2026) La calcula el servidor con Routes API y tráfico en vivo,
      // pasando por las paradas que hace antes. Antes se pedía desde aquí a una
      // API que la clave no tenía, fallaba callado y quedaba una recta punteada.
      // Se dibuja desde donde está la camioneta ahora: lo ya recorrido se corta.
      const poly = datos.ruta?.polyline as string | undefined
      let camino: any[] = [pos, destino]
      if (poly) {
        const pts = decodificar(poly)
        let k = 0, mejor = Infinity
        for (let i = 0; i < Math.min(pts.length, 200); i++) {
          const d = metros(pos, pts[i]); if (d < mejor) { mejor = d; k = i }
        }
        camino = [pos, ...pts.slice(k + 1)]
      }
      if (!ruta.current) {
        ruta.current = new g.maps.Polyline({ map: mapa.current, zIndex: 20, strokeWeight: 6 })
      }
      ruta.current.setOptions({
        path: camino, strokeColor: poly ? '#1a73e8' : '#A87BC8', strokeOpacity: poly ? 0.9 : 0,
        // sin ruta del servidor (Google caído) queda punteada: es la dirección, no el camino
        icons: poly ? [] : [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.85, strokeColor: '#A87BC8', scale: 3 },
                              offset: '0', repeat: '12px' }],
      })

      // encuadre: al abrir y cada vez que cambia la ruta, salvo que el cliente
      // haya movido el mapa con el dedo
      const firma = poly ? poly.slice(0, 40) : 'recta'
      if (!tocado.current && rutaDe.current !== firma) {
        rutaDe.current = firma
        const caja = new g.maps.LatLngBounds()
        camino.forEach((p: any) => caja.extend(p)); caja.extend(destino)
        mapa.current.fitBounds(caja, 45)
        g.maps.event.addListenerOnce(mapa.current, 'idle', () => {
          if (mapa.current.getZoom() > 16) mapa.current.setZoom(16)
        })
      }
    })

    return () => {
      vivo = false
      cancelAnimationFrame(cuadro.current)
      if (latido.current) { clearInterval(latido.current); latido.current = null }
    }
  }, [datos])

  if (!datos) return <div className="py-6 text-center text-gray-400 text-sm">Cargando el mapa…</div>

  if (datos.estado === 'SIN_RUTA' || !datos.destino) {
    return (
      <div className="py-5 px-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
        <MapPin size={15} /> Este pedido todavía no sale a ruta
      </div>
    )
  }

  return (
    <div>
      {datos.eta_min != null && (
        <div className="px-4 py-3 flex items-center gap-2 text-sm" style={{ background: '#EAF6FC' }}>
          <Clock size={15} style={{ color: '#2b7fa8' }} />
          <span style={{ color: '#2b7fa8' }}>
            Llegamos en unos <b>{datos.eta_min} min</b>
            {datos.llegada && <> · a las <b>{new Date(datos.llegada).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })}</b></>}
            {datos.paradas_antes > 0 && ` · ${datos.paradas_antes} parada(s) antes que tú`}
            {datos.eta_fuente === 'trafico' && <span className="block text-[11px] opacity-80">Calculado con el tráfico de este momento</span>}
          </span>
        </div>
      )}
      <div ref={div} style={{ height: 260 }} />
      {datos.conductor && (
        <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-gray-500 border-t">
          <Truck size={13} style={{ color: '#E8177A' }} />
          Ubicación de la camioneta actualizada {haceCuanto(datos.conductor.actualizado)}
        </div>
      )}
    </div>
  )
}
