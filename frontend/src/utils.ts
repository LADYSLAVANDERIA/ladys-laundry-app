import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const fmt = (n: number | string | null | undefined) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0))
export const hoy = () => new Date().toLocaleDateString('en-CA')
export const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']
export const diaSemana = (fecha: string) => (fecha ? DIAS[new Date(fecha + 'T12:00:00').getDay()] : '')
export const addDias = (fecha: string, n: number) => { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
export const addDiasHabiles = (fecha: string, n: number) => {
  const d = new Date(fecha + 'T12:00:00'); let c = 0
  while (c < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) c++ }
  return d.toLocaleDateString('en-CA')
}
export const telWa = (t?: string | null) => {
  const d = (t || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('56') && d.length === 11) return d
  if (d.length === 9) return '56' + d
  if (d.length === 8) return '569' + d
  return d
}
export const waLink = (tel?: string | null, texto = '') => `https://wa.me/${telWa(tel)}?text=${encodeURIComponent(texto)}`
export const ot = (id: number | string) => '#' + String(id).padStart(5, '0')
export const ESTADO_COLOR: Record<string, string> = {
  PRE_ORDEN: 'bg-orange-100 text-orange-700', EN_PROCESO: 'bg-yellow-100 text-yellow-700', LISTA: 'bg-green-100 text-green-700',
  ENTREGADA: 'bg-blue-100 text-blue-700', PAGADA: 'bg-purple-100 text-purple-700', ANULADA: 'bg-red-100 text-red-600',
}
export const ESTADO_LABEL: Record<string, string> = {
  PRE_ORDEN: 'Por retirar', EN_PROCESO: 'En proceso', LISTA: 'Lista', ENTREGADA: 'Entregada', PAGADA: 'Pagada', ANULADA: 'Anulada',
}
export const PAGO_COLOR: Record<string, string> = { PAGADA: 'bg-green-100 text-green-700', PARCIAL: 'bg-amber-100 text-amber-700', PENDIENTE: 'bg-red-50 text-red-600' }
export const fechaCorta = (f?: string | null) => (f ? format(new Date(String(f).slice(0, 10) + 'T12:00:00'), 'EEE d MMM', { locale: es }) : '—')
export const fechaLarga = (f?: string | null) => (f ? format(new Date(String(f).slice(0, 10) + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es }) : '—')
export const fechaHora = (f?: string | null) => (f ? format(new Date(f), 'd MMM HH:mm', { locale: es }) : '—')
export const hora = (t?: string | null) => (t ? String(t).slice(0, 5) : '')

// Mensaje de aviso al cliente, con fecha en español
export const linkOT = (id: number | string, token?: string | null) =>
  `${location.origin}${location.pathname.replace(/\/$/, '')}/#/ot/${id}/${token || ''}`

export const mensajeAviso = (tipo: string, o: any, link: string) => {
  const n = String(o.cliente_nombre || o.cliente || '').split(' ')[0]
  const saldo = Number(o.saldo_pendiente || 0) > 0 ? ` Saldo a pagar: ${fmt(o.saldo_pendiente)}.` : ' Ya está pagada.'
  const num = ot(o.id)
  if (tipo === 'INGRESO') return `Hola ${n}, recibimos tu pedido en Ladys Lavandería. Tu orden es la ${num} por ${fmt(o.monto_total)}.${saldo}\n\nSíguela acá: ${link}`
  if (tipo === 'EN_RUTA') return `Hola ${n}, vamos en camino con tu pedido ${num} de Ladys Lavandería.${saldo}\n\n${link}`
  if (tipo === 'RETIRADO') return `Hola ${n}, ya retiramos tu ropa. Quedó registrada como la orden ${num} y te avisamos apenas esté lista.\n\n${link}`
  if (tipo === 'ENTREGADA') return `Hola ${n}, tu pedido ${num} fue entregado. ¡Gracias por preferirnos!\n\n${link}`
  const donde = o.entrega_domicilio
    ? `Te lo llevamos el ${fechaLarga(o.fecha_entrega)}${o.ruta_entrega ? `, entre las ${hora(o.ruta_entrega_hora) || '14:00'} y las ${hora(o.ruta_entrega_fin) || '15:00'}` : ''}.`
    : 'Puedes pasar a retirarlo al local, Av. Concón Reñaca 102, locales 5 y 6.'
  return `Hola ${n}, tu pedido ${num} ya está listo. ${donde}${saldo}\n\nDetalle: ${link}`
}

export const mapsLink = (dir?: string | null) =>
  dir ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir + ', Chile')}` : ''

// Orden geográfico de la ruta: el furgón sale de Concón hacia el sur
export const ORDEN_COMUNA: Record<string, number> = {
  'concón': 1, 'concon': 1, 'reñaca': 2, 'renaca': 2,
  'viña del mar': 3, 'vina del mar': 3, 'viña': 3,
  'valparaíso': 4, 'valparaiso': 4, 'quintero': 5,
}
export const pesoSector = (dir?: string | null) => {
  const d = (dir || '').toLowerCase()
  for (const [k, v] of Object.entries(ORDEN_COMUNA)) if (d.includes(k)) return v
  return 9
}
export const ordenarParadas = (lista: any[], campo: 'dir_retiro' | 'dir_entrega') =>
  [...lista].sort((a, b) => pesoSector(a[campo]) - pesoSector(b[campo]) || a.id - b.id)

export const rutaCompletaMaps = (dirs: string[]) => {
  const v = dirs.filter(Boolean).map(d => encodeURIComponent(d + ', Chile'))
  if (!v.length) return ''
  const destino = v[v.length - 1], medio = v.slice(0, -1)
  return `https://www.google.com/maps/dir/?api=1&destination=${destino}` + (medio.length ? `&waypoints=${medio.join('%7C')}` : '') + '&travelmode=driving'
}
