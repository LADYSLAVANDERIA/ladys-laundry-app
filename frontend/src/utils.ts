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
