// Cargador único de Google Maps.
//
// Antes los mapas eran Leaflet con tiles de OpenStreetMap: en Concón y Reñaca
// muchas calles no están o están mal trazadas, así que el pin nunca calzaba con
// la puerta y el conductor terminaba adivinando.
//
// Esta es la clave LADYS NAVEGADOR, restringida en la consola de Google a
// ladyslavanderia.cl y sólo a Maps JavaScript API. Queda visible en el bundle,
// que es inevitable con Maps JS: lo que la protege es la restricción, no el
// ocultarla.
// NO confundir con LADYS SERVIDOR, que sólo tiene Geocoding API y vive en la
// base (configuracion.google_maps_api_key). Esa nunca debe llegar al navegador:
// no tiene restricción de dominio porque las llamadas salen desde Supabase.
const CLAVE = import.meta.env.VITE_GOOGLE_MAPS_KEY || 'AIzaSyBXWmkkrAT4WKG3k2l40Y5S7CMfZY8Ujr0'

let promesa: Promise<any> | null = null

export function cargarGoogle(): Promise<any> {
  if ((window as any).google?.maps) return Promise.resolve((window as any).google)
  if (promesa) return promesa
  promesa = new Promise((ok, error) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${CLAVE}&language=es&region=CL&libraries=marker`
    s.async = true
    s.onload = () => ok((window as any).google)
    s.onerror = () => error(new Error('No se pudo cargar Google Maps'))
    document.head.appendChild(s)
  })
  return promesa
}

// Concón, centro de la zona de reparto.
export const CENTRO = { lat: -32.9280, lng: -71.5250 }

// Estilo sobrio: sin puntos de interés que compitan con nuestros marcadores.
export const ESTILO = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
]

// Marcador redondo con número o ícono, del color que se le pase.
export function pin(texto: string, color: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">` +
    `<circle cx="17" cy="17" r="14" fill="${color}" stroke="#fff" stroke-width="3"/>` +
    `<text x="17" y="22" font-family="Arial,sans-serif" font-size="14" font-weight="bold" ` +
    `fill="#fff" text-anchor="middle">${texto}</text></svg>`
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new (window as any).google.maps.Size(34, 34),
    anchor: new (window as any).google.maps.Point(17, 17),
  }
}

// La camioneta de Ladys. Antes el conductor era un círculo azul con una "R":
// no se entendía que fuera un vehículo ni hacia dónde iba. Va apuntando según el
// rumbo, así el cliente ve de qué lado viene.
export function camioneta(rumbo = 0) {
  const g = (window as any).google
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">` +
      `<g transform="rotate(${Math.round(rumbo)} 26 26)">` +
        // Sombra suave, para que despegue del mapa.
        `<ellipse cx="26" cy="41" rx="11" ry="3.5" fill="#000" opacity="0.18"/>` +
        // Carrocería, apuntando hacia arriba (rumbo 0 = norte).
        `<rect x="15" y="12" width="22" height="27" rx="6" fill="#E8177A" stroke="#fff" stroke-width="2.5"/>` +
        // Parabrisas.
        `<path d="M18 18 h16 v5 a2 2 0 0 1-2 2 H20 a2 2 0 0 1-2-2 z" fill="#EAF6FC"/>` +
        // Costados de la caja.
        `<rect x="18.5" y="28" width="15" height="7.5" rx="2" fill="#fff" opacity="0.92"/>` +
        `<text x="26" y="34" font-family="Arial,Helvetica,sans-serif" font-size="5.5" ` +
          `font-weight="bold" fill="#A87BC8" text-anchor="middle" letter-spacing="0.4">LADYS</text>` +
      `</g>` +
    `</svg>`
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new g.maps.Size(52, 52),
    anchor: new g.maps.Point(26, 26),
  }
}

// Hacia dónde apunta: de dónde venía a dónde está ahora.
export function rumboEntre(a: any, b: any) {
  if (!a || !b) return 0
  const r = Math.PI / 180
  const dLng = (b.lng - a.lng) * r
  const y = Math.sin(dLng) * Math.cos(b.lat * r)
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) -
            Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}
