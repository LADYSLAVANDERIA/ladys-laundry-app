import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Truck, Clock, MapPin } from 'lucide-react'

const SEG = (import.meta.env.VITE_API_URL || 'https://vhjsizkbmabznupkfzji.supabase.co/functions/v1/ladys/api')
  .replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-seguimiento')

declare global { interface Window { L: any } }
function cargarLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L)
  return new Promise((res, rej) => {
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link')
      css.id = 'leaflet-css'; css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(css)
    }
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => res(window.L); s.onerror = rej
    document.head.appendChild(s)
  })
}

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
    cargarLeaflet().then(L => {
      if (!mapa.current) {
        mapa.current = L.map(div.current!, { zoomControl: false, attributionControl: false })
          .setView([datos.destino.lat, datos.destino.lng], 14)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapa.current)
        L.marker([datos.destino.lat, datos.destino.lng], {
          icon: L.divIcon({
            className: '', iconSize: [30, 30], iconAnchor: [15, 15],
            html: `<div style="width:30px;height:30px;border-radius:50%;background:#E8177A;
              display:flex;align-items:center;justify-content:center;font-size:14px;
              border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">🏡</div>`,
          }),
        }).addTo(mapa.current)
      }
      if (datos.conductor) {
        const pos: [number, number] = [datos.conductor.lat, datos.conductor.lng]
        if (!auto.current) {
          auto.current = L.marker(pos, {
            icon: L.divIcon({
              className: '', iconSize: [34, 34], iconAnchor: [17, 17],
              html: `<div style="width:34px;height:34px;border-radius:50%;background:#4AAEE0;
                display:flex;align-items:center;justify-content:center;font-size:16px;
                border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35)">🚚</div>`,
            }),
          }).addTo(mapa.current)
        } else auto.current.setLatLng(pos)
        mapa.current.fitBounds([pos, [datos.destino.lat, datos.destino.lng]],
          { padding: [40, 40], maxZoom: 15 })
      }
      setTimeout(() => mapa.current?.invalidateSize(), 120)
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
