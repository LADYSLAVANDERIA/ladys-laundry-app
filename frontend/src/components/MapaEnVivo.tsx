import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Truck, Clock, MapPin } from 'lucide-react'
import { cargarGoogle, ESTILO, pin } from '../lib/google'

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

  useEffect(() => {
    if (!div.current || !datos?.destino) return
    cargarGoogle().then(g => {
      const destino = { lat: datos.destino.lat, lng: datos.destino.lng }
      if (!mapa.current) {
        mapa.current = new g.maps.Map(div.current!, {
          center: destino, zoom: 14, styles: ESTILO,
          mapTypeControl: false, streetViewControl: false,
          fullscreenControl: false, zoomControl: false,
          gestureHandling: 'greedy',
        })
        new g.maps.Marker({ position: destino, map: mapa.current,
          icon: pin('C', '#E8177A'), title: 'Tu direccion' })
      }
      if (datos.conductor) {
        const pos = { lat: datos.conductor.lat, lng: datos.conductor.lng }
        if (!auto.current) {
          auto.current = new g.maps.Marker({ position: pos, map: mapa.current,
            icon: pin('R', '#4AAEE0'), title: 'Repartidor', zIndex: 90 })
        } else auto.current.setPosition(pos)
        const caja = new g.maps.LatLngBounds()
        caja.extend(pos); caja.extend(destino)
        mapa.current.fitBounds(caja, 45)
        // fitBounds acerca demasiado cuando los dos puntos estan casi juntos
        g.maps.event.addListenerOnce(mapa.current, 'idle', () => {
          if (mapa.current.getZoom() > 15) mapa.current.setZoom(15)
        })
      }
    })
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
            {datos.paradas_antes > 0 && ` · ${datos.paradas_antes} parada(s) antes que tú`}
          </span>
        </div>
      )}
      <div ref={div} style={{ height: 260 }} />
      {datos.conductor && (
        <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-gray-500 border-t">
          <Truck size={13} style={{ color: '#4AAEE0' }} />
          Ubicación del conductor actualizada {haceCuanto(datos.conductor.actualizado)}
        </div>
      )}
    </div>
  )
}
