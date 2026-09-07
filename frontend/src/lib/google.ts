// Cargador único de Google Maps.
//
// Antes los mapas eran Leaflet con tiles de OpenStreetMap: en Concón y Reñaca
// muchas calles no están o están mal trazadas, así que el pin nunca calzaba con
// la puerta y el conductor terminaba adivinando.
//
// La clave del navegador NO es un secreto (Google Maps JS la expone siempre);
// lo que la protege es la restricción por dominio en la consola de Google.
// Hay que dejarla limitada a ladyslavanderia.cl y a localhost.
const CLAVE = import.meta.env.VITE_GOOGLE_MAPS_KEY || 'AIzaSyBt9ITvPAoF2EtNcYFWceRsI9lnCE7k_zQ'

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
