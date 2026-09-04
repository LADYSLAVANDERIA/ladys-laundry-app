import { useEffect, useRef } from 'react'

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

const nombreDe = (p: any) => (p.es_empresa && p.razon_social)
  ? p.razon_social : [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Sin nombre'
const dirDe = (p: any) => [p.calle, p.depto, p.sector, p.ciudad].filter(Boolean).join(', ')

type Props = {
  base: any
  paradas: any[]
  miPos?: { lat: number; lng: number } | null
  alto?: number
  onTocarParada?: (p: any) => void
}

export default function MapaRuta({ base, paradas, miPos, alto = 300, onTocarParada }: Props) {
  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<any>(null)
  const capa = useRef<any>(null)
  const yo = useRef<any>(null)

  useEffect(() => {
    if (!div.current) return
    cargarLeaflet().then(L => {
      if (!mapa.current) {
        mapa.current = L.map(div.current!, { attributionControl: false })
          .setView([base?.lat ?? -32.9337, base?.lng ?? -71.5322], 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapa.current)
      }
      if (capa.current) capa.current.remove()
      capa.current = L.layerGroup().addTo(mapa.current)

      const puntos: any[] = []

      if (base) {
        L.marker([base.lat, base.lng], {
          icon: L.divIcon({
            className: '', iconSize: [28, 28], iconAnchor: [14, 14],
            html: `<div style="width:28px;height:28px;border-radius:50%;background:#1F2430;
              display:flex;align-items:center;justify-content:center;font-size:13px;
              border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">🏠</div>`,
          }),
        }).addTo(capa.current).bindPopup('Local Ladys')
        puntos.push([base.lat, base.lng])
      }

      const ubicadas = paradas.filter(p => p.lat && p.lng)
      ubicadas.forEach(p => {
        const color = p.estado === 'COMPLETADA' ? '#16a34a'
          : p.estado === 'FALLIDA' ? '#dc2626'
          : p.estado === 'EN_CAMINO' ? '#f59e0b'
          : p.tipo === 'RETIRO' ? '#4AAEE0' : '#E8177A'
        const m = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: '', iconSize: [30, 30], iconAnchor: [15, 15],
            html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};color:#fff;
              display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
              border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${p.secuencia || '·'}</div>`,
          }),
        }).addTo(capa.current)
        m.bindPopup(
          `<b>${p.secuencia ? p.secuencia + '. ' : ''}${nombreDe(p)}</b><br>${dirDe(p)}<br>` +
          `<small>${p.tipo === 'RETIRO' ? 'Retiro' : 'Entrega'}` +
          `${p.hora_estimada ? ' · ~' + String(p.hora_estimada).slice(0, 5) : ''}</small>`)
        if (onTocarParada) m.on('click', () => onTocarParada(p))
        puntos.push([p.lat, p.lng])
      })

      // el trazado sigue el orden del recorrido y vuelve al local
      const enOrden = ubicadas.filter(p => p.secuencia).sort((a, b) => a.secuencia - b.secuencia)
      if (enOrden.length && base) {
        const linea = [[base.lat, base.lng], ...enOrden.map(p => [p.lat, p.lng]), [base.lat, base.lng]]
        L.polyline(linea, { color: '#A87BC8', weight: 4, opacity: .75, dashArray: '8,8' }).addTo(capa.current)
      }

      if (puntos.length > 1) mapa.current.fitBounds(puntos, { padding: [35, 35] })
      setTimeout(() => mapa.current?.invalidateSize(), 120)
    })
  }, [paradas, base])

  // la posición propia se actualiza sola, sin redibujar todo el mapa
  useEffect(() => {
    if (!mapa.current || !miPos || !window.L) return
    const L = window.L
    if (!yo.current) {
      yo.current = L.circleMarker([miPos.lat, miPos.lng], {
        radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1,
      }).addTo(mapa.current).bindPopup('Tú estás aquí')
    } else yo.current.setLatLng([miPos.lat, miPos.lng])
  }, [miPos])

  return <div ref={div} style={{ height: alto }} className="rounded-2xl overflow-hidden" />
}
