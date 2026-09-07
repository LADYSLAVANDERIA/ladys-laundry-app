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
// El número de OT continúa el correlativo de EasyLaundry (6431 en adelante),
// así que se muestra tal cual: rellenarlo con ceros lo haría irreconocible.
export const ot = (id: number | string) => '#' + String(id)
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

export const mapsLink = (dir?: string | null, lat?: number | null, lng?: number | null) =>
  lat && lng ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : dir ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir + ', Chile')}` : ''

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

// Punto de partida y de regreso de la ruta.
export const BASE_LADYS = 'Av. Concón Reñaca 102, Concón'

// Una parada puede venir como coordenadas ("-32.93,-71.53") o como texto.
// A las coordenadas NO se les puede pegar ", Chile": Google deja de leerlas
// como punto y el mapa no abre. Ese era el motivo de que el botón no hiciera nada.
const esCoordenada = (s: string) => /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(String(s).trim())
const punto = (s: string) => encodeURIComponent(esCoordenada(s) ? String(s).trim() : String(s).trim() + ', Chile')

// Google Maps acepta hasta 9 paradas intermedias en un enlace. Con más, el
// enlace se ignora entero, así que se corta y se avisa por separado.
export const TOPE_PARADAS_MAPS = 9

export const rutaCompletaMaps = (dirs: string[]) => {
  const v = dirs.filter(Boolean).map(String).map(s => s.trim()).filter(s => s.length > 3)
  if (!v.length) return ''
  const paradas = v.slice(0, TOPE_PARADAS_MAPS + 1)
  const destino = punto(paradas[paradas.length - 1])
  const medio = paradas.slice(0, -1).map(punto)
  // Sale y vuelve del local: así el recorrido que muestra Maps es el real.
  return `https://www.google.com/maps/dir/?api=1&origin=${punto(BASE_LADYS)}` +
         `&destination=${destino}` +
         (medio.length ? `&waypoints=${medio.join('%7C')}` : '') +
         '&travelmode=driving'
}

// Nombre del servicio para el ticket interno y las listas de producción.
// "Lavado y secado" es el servicio por defecto (4.892 de 9.134 líneas), así que
// se sobreentiende y solo ocupa el ancho del ticket. En cambio "lavado y
// planchado" y "solo planchado" o "solo secado" SÍ se conservan: son servicios
// distintos y confundirlos significa devolver la prenda mal.
export const servicioCorto = (nombre: string) =>
  String(nombre || '')
    .replace(/^SERVICIO\s+/i, '')
    .replace(/^LAVADO Y SECADO\s*[-–]?\s*/i, '')
    .replace(/\s*[-–]\s*/g, ' ')
    .trim()

// El número de operación de Mercado Pago es el mismo que la máquina imprime en
// el ticket ("Operación #..."). Con ese número se ubica la boleta en el portal
// de Mercado Pago, que es quien la emite: el folio del SII no viaja por la API,
// así que este es el único puente que tenemos hacia el documento.
export const opMercadoPago = (referencia?: string | null) => {
  // sin anclar al final: la referencia puede traer una nota detrás del número
  // (por ejemplo cuando el cobro se hizo en la máquina de respaldo)
  const m = String(referencia || '').match(/^MP(?:POS)?-(\d+)/)
  return m ? m[1] : ''
}

// Formas de pago de Mercado Pago: 3 = POS, 6 = Link de pago. Cuando el cobro se
// registra a mano (venta hecha en la maquina de respaldo, o cobro en ruta) hay
// que anotar el numero de operacion: es lo unico que permite reimprimir el
// comprobante desde la maquina o ubicar la boleta en el portal.
export const esPagoMercadoPago = (formaPagoId?: string | number | null) =>
  ['3', '6'].includes(String(formaPagoId || ''))

export const refDesdeOperacion = (formaPagoId?: string | number | null, valor?: string | null) => {
  const v = String(valor || '').trim()
  if (!v) return null
  if (/^MP(POS)?-/.test(v)) return v
  if (!esPagoMercadoPago(formaPagoId) || !/^\d+$/.test(v)) return v
  return (String(formaPagoId) === '6' ? 'MP-' : 'MPPOS-') + v
}

// ── Mensaje de WhatsApp según la etapa real del pedido ──────────────────────
// El botón de WhatsApp de la OT sirve en cualquier momento del proceso, así que
// el texto NO puede ser fijo: mandaba "tu pedido ya está listo" incluso con la
// ropa recién recepcionada.
//
// Son DOS mensajes, no uno por etapa. Lavado y secado no le sirven de nada al
// cliente: mientras no esté listo, el mensaje útil es el de recepción, porque
// lo que necesita guardar es su número de OT.
//   1) Recepción  → hasta EN_SECADO. Número de OT + fecha estimada de entrega.
//   2) Listo      → desde EMBOLSADO. Dónde retirar o cuándo se lo llevamos,
//                   pidiendo que confirme.
// Las etapas AGENDADO y ENTREGADO tienen su propia línea sólo para no mentir:
// en una la ropa todavía no está en el local, en la otra ya se entregó.
export const ETAPA_LABEL: Record<string, string> = {
  AGENDADO: 'Agendado', RECEPCIONADO: 'Recepcionado', EN_LAVADO: 'En lavado',
  EN_SECADO: 'En secado', EMBOLSADO: 'Embolsado', LISTO_RETIRO: 'Listo para retiro',
  ASIGNADO_RUTA: 'En ruta', EN_CAMINO: 'En camino', ENTREGADO: 'Entregado',
}

// Sólo desde EMBOLSADO en adelante se puede afirmar que está listo.
const ETAPAS_LISTAS = ['EMBOLSADO', 'LISTO_RETIRO', 'ASIGNADO_RUTA', 'EN_CAMINO']
const HORARIO_LOCAL = 'de lunes a viernes de 10:00 a 13:30 y de 14:30 a 18:30, y sábados de 10:00 a 13:30'

export const mensajeSegunEtapa = (o: any, link: string) => {
  const n = String(o?.cliente_nombre || o?.cliente || '').split(' ')[0]
  const num = ot(o?.id)
  const etapa = String(o?.etapa || (o?.estado === 'PRE_ORDEN' ? 'AGENDADO' : 'RECEPCIONADO'))
  const saldo = Number(o?.saldo_pendiente || 0)
  const conSaldo = saldo > 0 ? ` Saldo a pagar: ${fmt(saldo)}.` : ''

  // en un pedido agendado la fecha que le importa al cliente es la del retiro
  const fRef = etapa === 'AGENDADO' ? (o?.fecha_recogida || o?.fecha_entrega) : o?.fecha_entrega
  const cuando = fRef ? fechaLarga(fRef) : null
  const ventana = o?.ruta_entrega_hora
    ? ` entre las ${hora(o.ruta_entrega_hora)} y las ${hora(o.ruta_entrega_fin) || '18:00'}`
    : ''

  let cuerpo: string
  if (o?.estado === 'ANULADA') {
    cuerpo = `tu pedido ${num} quedó anulado. Si necesitas ayuda, respóndenos por acá.`
  } else if (etapa === 'AGENDADO') {
    cuerpo = `tenemos agendado el retiro de tu ropa${cuando ? ` para el ${cuando}` : ''}. Te avisamos cuando vayamos en camino.`
  } else if (etapa === 'ENTREGADO') {
    cuerpo = `tu pedido ${num} fue entregado. ¡Gracias por preferirnos!`
  } else if (ETAPAS_LISTAS.includes(etapa)) {
    cuerpo = o?.entrega_domicilio
      ? `tu pedido ${num} ya está listo. Te lo llevamos${cuando ? ` el ${cuando}` : ''}${ventana}.${conSaldo} ¿Nos confirmas si puedes recibirlo?`
      : `tu pedido ${num} ya está listo. Puedes pasar a retirarlo a Av. Concón Reñaca 102, locales 5 y 6, ${HORARIO_LOCAL}.${conSaldo}`
  } else {
    cuerpo = `recepcionamos tu pedido con la orden de trabajo ${num}.${cuando ? ` Fecha estimada de entrega: ${cuando}.` : ''} Te confirmamos apenas esté listo.${conSaldo}`
  }
  return `Hola ${n}, ${cuerpo}\n\nSíguelo acá: ${link}`
}
