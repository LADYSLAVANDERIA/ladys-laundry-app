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

// La camioneta de Ladys vista de costado, blanca con el logo (Lufi, 21-sep: el
// ícono anterior no se notaba). Mira hacia la izquierda o la derecha según el
// rumbo, así se entiende hacia dónde va. La imagen vive en el sitio (/ruta/).
export function camioneta(rumbo = 90, apagada = false) {
  const g = (window as any).google
  const haciaIzq = rumbo > 180 && rumbo < 360
  const f = apagada ? 'camioneta-gris.png' : haciaIzq ? 'camioneta-izq.png' : 'camioneta-der.png'
  return {
    url: `https://ladyslavanderia.cl/ruta/${f}`,
    scaledSize: new g.maps.Size(88, 55),
    anchor: new g.maps.Point(44, 50),
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
