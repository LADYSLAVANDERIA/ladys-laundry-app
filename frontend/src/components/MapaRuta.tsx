import { useEffect, useRef } from 'react'
import { cargarGoogle, ESTILO, pin } from '../lib/google'

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
  const marcas = useRef<any[]>([])
  const linea = useRef<any>(null)
  const yo = useRef<any>(null)
  const globo = useRef<any>(null)

  useEffect(() => {
    if (!div.current) return
    cargarGoogle().then(g => {
      if (!mapa.current) {
        mapa.current = new g.maps.Map(div.current!, {
          center: { lat: base?.lat ?? -32.9337, lng: base?.lng ?? -71.5322 },
          zoom: 13,
          styles: ESTILO,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        })
        globo.current = new g.maps.InfoWindow()
      }

      // se limpia lo dibujado antes de volver a pintar la ruta
      marcas.current.forEach(m => m.setMap(null))
      marcas.current = []
      if (linea.current) linea.current.setMap(null)

      const caja = new g.maps.LatLngBounds()

      if (base) {
        const m = new g.maps.Marker({
          position: { lat: base.lat, lng: base.lng }, map: mapa.current,
          icon: pin('L', '#1F2430'), title: 'Local Ladys', zIndex: 50,
        })
        m.addListener('click', () => {
          globo.current.setContent('<b>Local Ladys</b>')
          globo.current.open(mapa.current, m)
        })
        marcas.current.push(m)
        caja.extend({ lat: base.lat, lng: base.lng })
      }

      const ubicadas = paradas.filter(p => p.lat && p.lng)
      ubicadas.forEach(p => {
        const color = p.estado === 'COMPLETADA' ? '#16a34a'
          : p.estado === 'FALLIDA' ? '#dc2626'
          : p.estado === 'EN_CAMINO' ? '#f59e0b'
          : p.tipo === 'RETIRO' ? '#4AAEE0' : '#E8177A'
        const m = new g.maps.Marker({
          position: { lat: p.lat, lng: p.lng }, map: mapa.current,
          icon: pin(String(p.secuencia || '.'), color),
          title: nombreDe(p),
        })
        m.addListener('click', () => {
          globo.current.setContent(
            `<div style="font-size:13px;line-height:1.4">` +
            `<b>${p.secuencia ? p.secuencia + '. ' : ''}${nombreDe(p)}</b><br>${dirDe(p)}<br>` +
            `<small>${p.tipo === 'RETIRO' ? 'Retiro' : 'Entrega'}` +
            `${p.hora_estimada ? ' &middot; ~' + String(p.hora_estimada).slice(0, 5) : ''}</small></div>`)
          globo.current.open(mapa.current, m)
          if (onTocarParada) onTocarParada(p)
        })
        marcas.current.push(m)
        caja.extend({ lat: p.lat, lng: p.lng })
      })

      // el trazado sigue el orden del recorrido y vuelve al local
      const enOrden = ubicadas.filter(p => p.secuencia).sort((a, b) => a.secuencia - b.secuencia)
      if (enOrden.length && base) {
        linea.current = new g.maps.Polyline({
          path: [{ lat: base.lat, lng: base.lng },
                 ...enOrden.map(p => ({ lat: p.lat, lng: p.lng })),
                 { lat: base.lat, lng: base.lng }],
          map: mapa.current, strokeColor: '#A87BC8', strokeOpacity: 0, strokeWeight: 4,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, scale: 3 },
                    offset: '0', repeat: '14px' }],
        })
      }

      if (marcas.current.length > 1) mapa.current.fitBounds(caja, 40)
      else if (marcas.current.length === 1) mapa.current.setZoom(16)
    })
  }, [paradas, base])

  // la posicion propia se actualiza sola, sin redibujar todo el mapa
  useEffect(() => {
    const g = (window as any).google
    if (!mapa.current || !miPos || !g?.maps) return
    if (!yo.current) {
      yo.current = new g.maps.Marker({
        position: miPos, map: mapa.current, title: 'Tu estas aqui', zIndex: 100,
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2563eb',
                fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
      })
    } else yo.current.setPosition(miPos)
  }, [miPos])

  return <div ref={div} style={{ height: alto }} className="rounded-2xl overflow-hidden" />
}
