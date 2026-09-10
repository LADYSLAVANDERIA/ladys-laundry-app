import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi, ordenesApi, cierreApi } from '../services/api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Clock, CheckCircle, CalendarClock, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const num = (v: any) => Number(v) || 0
const fmt = (n: any) => '$' + Math.round(num(n)).toLocaleString('es-CL')
const corto = (n: any) => {
  const v = Math.round(num(n))
  return v >= 1000000 ? '$' + (v / 1000000).toFixed(1) + 'M'
       : v >= 1000    ? '$' + Math.round(v / 1000) + 'k'
       : '$' + v
}

// Los nombres del catalogo vienen del import de EasyLaundry, en mayusculas y con
// el proceso adentro: "SERVICIO LAVADO Y SECADO COBERTOR/CUBRECAMAS/QUILT KING".
// En una barra de 100px eso no se lee. Se deja solo la prenda.
function prenda(nombre: string) {
  let s = String(nombre || '')
    .replace(/^SERVICIO\s+/i, '')
    .replace(/^LAVADO Y SECADO\s+/i, '')
    .replace(/^LAVADO Y PLANCHADO\s+/i, '')
    .replace(/^SOLO PLANCHADO\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) s = String(nombre || '')
  s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  return s.length > 26 ? s.slice(0, 25) + '…' : s
}

// Solo lo que esta vivo. ENTREGADA trae las 4.658 de toda la historia y deja al
// resto en 0%: no dice nada del dia de hoy.
const ACTIVOS: Record<string, { label: string; color: string }> = {
  PRE_ORDEN:    { label: 'Agendadas',   color: '#C4B5FD' },
  RECEPCIONADA: { label: 'Recibidas',   color: '#93C5FD' },
  EN_PROCESO:   { label: 'En proceso',  color: '#FCD34D' },
  LISTA:        { label: 'Listas',      color: '#6EE7B7' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [res, setRes] = useState<any>({})
  const [loading, setLoading] = useState(true)

  // TODOS los hooks van antes del return de "cargando". Estaban despues, y eso
  // dejaba la pantalla EN BLANCO: React exige la misma cantidad de hooks en cada
  // render, y pasaban de 3 mientras cargaba a 7 cuando llegaban los datos.
  const hoyStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
  const [desde, setDesde] = useState(hoyStr)
  const [hasta, setHasta] = useState(hoyStr)
  const [cierre, setCierre] = useState<any>(null)
  const [cargandoCierre, setCargandoCierre] = useState(false)

  const verCierre = async (d = desde, h = hasta) => {
    setCargandoCierre(true)
    try { const r = await cierreApi.get(d, h); setCierre(r.data) }
    catch { setCierre(null) }
    finally { setCargandoCierre(false) }
  }

  useEffect(() => {
    ordenesApi.resumen().then(r => setRes(r.data)).catch(() => {})
    dashboardApi.get().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false))
    verCierre()
  }, [])

  // El servidor manda los montos como texto y SALTA los dias sin ventas: 25
  // puntos para 29 dias. Con texto, la curva se corta; con dias faltantes, une
  // el 15 con el 17 como si el 16 no existiera. Se convierte a numero y se
  // rellenan los dias vacios con cero, que es lo que de verdad pasó.
  const serie = useMemo(() => {
    const crudo = (data?.ventasDiarias || []).map((d: any) => ({
      fecha: String(d.fecha).slice(0, 10),
      total: num(d.total),
      ordenes: num(d.ordenes),
    }))
    if (!crudo.length) return []
    const porFecha = new Map(crudo.map((d: any) => [d.fecha, d]))
    const salida: any[] = []
    const cursor = new Date(crudo[0].fecha + 'T12:00:00')
    const fin = new Date(hoyStr + 'T12:00:00')
    while (cursor <= fin) {
      const k = cursor.toLocaleDateString('sv-SE')
      salida.push(porFecha.get(k) || { fecha: k, total: 0, ordenes: 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    return salida
  }, [data, hoyStr])

  // Por plata, no por cantidad: 186 kilos y 6 cobertores no se comparan.
  const servicios = useMemo(() => {
    const filas = (data?.topServicios || []).map((s: any) => ({
      nombre: prenda(s.nombre), total: num(s.total), cantidad: num(s.cantidad),
    }))
    // El catalogo viejo dejo nombres duplicados ("Traje / ambo / terno" dos veces).
    const juntos = new Map<string, any>()
    for (const f of filas) {
      const y = juntos.get(f.nombre)
      if (y) { y.total += f.total; y.cantidad += f.cantidad }
      else juntos.set(f.nombre, { ...f })
    }
    return [...juntos.values()].sort((a, b) => b.total - a.total).slice(0, 6)
  }, [data])

  const activos = useMemo(() => {
    const filas = (data?.estadoOrdenes || [])
      .filter((e: any) => ACTIVOS[e.estado])
      .map((e: any) => ({ ...ACTIVOS[e.estado], estado: e.estado, cantidad: num(e.cantidad) }))
      .sort((a: any, b: any) => b.cantidad - a.cantidad)
    const total = filas.reduce((s: number, x: any) => s + x.cantidad, 0)
    return { filas, total }
  }, [data])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" />
    </div>
  )

  const mes = num(data?.kpis?.ventas_mes)
  const mesAnterior = num(data?.ventasMesAnterior)
  const variacion = mesAnterior > 0 ? Math.round((mes / mesAnterior - 1) * 100) : null
  const topServicio = servicios[0]?.total || 1

  const hoyCards = [
    { l: 'Retiros hoy',  v: num(res.retiros_hoy),  c: '#C2410C', bg: '#FFF4EC', to: '/programacion' },
    { l: 'Entregas hoy', v: num(res.entregas_hoy), c: '#1D4ED8', bg: '#EFF4FF', to: '/programacion' },
    { l: 'Órdenes hoy',  v: num(data?.kpis?.ordenes_hoy), c: '#7C3AED', bg: '#F5F0FF', to: '/ordenes' },
    { l: 'Ventas hoy',   v: fmt(data?.kpis?.ventas_hoy),  c: '#BE185D', bg: '#FFF0F6', to: '/caja' },
  ]
  const estadoCards = [
    { l: 'En proceso',        v: num(res.en_proceso ?? data?.kpis?.en_proceso), icon: Clock,         c: '#B45309', bg: '#FEF6E0', to: '/ordenes' },
    { l: 'Listas por entregar', v: num(res.lista ?? data?.kpis?.listas),        icon: CheckCircle,   c: '#047857', bg: '#E9F8F1', to: '/ordenes' },
    { l: 'Agendadas',         v: num(data?.kpis?.pre_ordenes),                  icon: CalendarClock, c: '#6D28D9', bg: '#F3EEFF', to: '/programacion' },
    { l: 'Por cobrar',        v: fmt(res.por_cobrar),                           icon: Wallet,        c: '#BE123C', bg: '#FFF0F1', to: '/por-cobrar' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm">{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
      </div>

      {/* Lo que pasa hoy */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {hoyCards.map(k => (
          <button key={k.l} onClick={() => navigate(k.to)}
                  className="rounded-xl p-4 text-left hover:shadow-md transition-shadow"
                  style={{ background: k.bg }}>
            <p className="text-xs text-gray-500">{k.l}</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color: k.c }}>{k.v}</p>
          </button>
        ))}
      </div>

      {/* Lo que hay en el local ahora */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {estadoCards.map(k => (
          <button key={k.l} onClick={() => navigate(k.to)}
                  className="bg-white rounded-xl p-4 shadow-sm border text-left hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: k.bg }}>
                <k.icon size={17} style={{ color: k.c }} />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-800 leading-tight truncate">{k.v}</p>
                <p className="text-xs text-gray-500 truncate">{k.l}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Ventas del mes */}
      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-700">Ventas del mes</h2>
            <p className="text-3xl font-bold mt-1" style={{ color: '#E8177A' }}>{fmt(mes)}</p>
          </div>
          {variacion !== null && (
            <div className="text-right">
              <span className={`inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-lg ${
                variacion >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                {variacion >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {variacion > 0 ? '+' : ''}{variacion}%
              </span>
              <p className="text-xs text-gray-400 mt-1">mes anterior {fmt(mesAnterior)}</p>
            </div>
          )}
        </div>
        {serie.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">Todavía no hay ventas cargadas.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={serie} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPink" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E8177A" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#E8177A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F1F4" vertical={false} />
              <XAxis dataKey="fecha" tickFormatter={d => format(parseISO(d), 'd/M')}
                     tick={{ fontSize: 11, fill: '#9CA3AF' }} minTickGap={22}
                     axisLine={false} tickLine={false} />
              <YAxis tickFormatter={corto} tick={{ fontSize: 11, fill: '#9CA3AF' }}
                     axisLine={false} tickLine={false} width={52} />
              <Tooltip
                formatter={(v: any, _n: any, p: any) =>
                  [`${fmt(v)} · ${p?.payload?.ordenes || 0} ${p?.payload?.ordenes === 1 ? 'orden' : 'órdenes'}`, 'Ventas']}
                labelFormatter={l => format(parseISO(l as string), "EEEE d 'de' MMMM", { locale: es })}
                contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 13 }} />
              <Area type="monotone" dataKey="total" stroke="#E8177A" fill="url(#gradPink)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top servicios, medidos en plata */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-700">Qué deja más plata este mes</h2>
          <p className="text-xs text-gray-400 mb-4">Medido en venta, no en cantidad: 186 kilos y 6 cobertores no se comparan.</p>
          {servicios.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin servicios cargados este mes.</p>
          ) : (
            <div className="space-y-3">
              {servicios.map((s: any) => (
                <div key={s.nombre}>
                  <div className="flex justify-between items-baseline text-sm mb-1 gap-2">
                    <span className="text-gray-700 truncate">{s.nombre}</span>
                    <span className="font-semibold text-gray-800 shrink-0">{fmt(s.total)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-2 rounded-full"
                         style={{ width: `${Math.max(3, Math.round(s.total / topServicio * 100))}%`,
                                  background: 'linear-gradient(90deg,#E8177A,#A87BC8)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estado de las órdenes vivas */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-700">Órdenes en el local</h2>
          <p className="text-xs text-gray-400 mb-4">
            {activos.total} en curso. Las entregadas no cuentan acá.
          </p>
          {activos.filas.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No hay órdenes en curso.</p>
          ) : (
            <div className="space-y-3">
              {activos.filas.map((e: any) => {
                const pct = activos.total ? Math.round(e.cantidad / activos.total * 100) : 0
                return (
                  <div key={e.estado}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{e.label}</span>
                      <span className="font-semibold text-gray-800">{e.cantidad}<span className="text-gray-400 font-normal text-xs"> · {pct}%</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: e.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cierre por período — antes era la pantalla "Reporte de Control" */}
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-gray-700">Cierre por período</h2>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Desde</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                     className="border rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hasta</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                     className="border rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <button onClick={() => verCierre()} className="px-5 py-2 rounded-xl text-white text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>Ver</button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap text-xs">
          {[['Hoy', hoyStr, hoyStr],
            ['Ayer', new Date(Date.now() - 86400000).toLocaleDateString('sv-SE'), new Date(Date.now() - 86400000).toLocaleDateString('sv-SE')],
            ['Este mes', hoyStr.slice(0, 8) + '01', hoyStr]].map(([l, d, h]) => (
            <button key={l} onClick={() => { setDesde(d); setHasta(h); verCierre(d, h) }}
                    className="px-3 py-1.5 rounded-lg border text-gray-600 hover:bg-gray-50">{l}</button>
          ))}
        </div>

        {cargandoCierre ? (
          <p className="text-center text-sm text-gray-400 py-6">Cargando…</p>
        ) : !cierre ? (
          <p className="text-center text-sm text-gray-400 py-6">Sin movimientos en el período.</p>
        ) : num(cierre.ordenes) === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">
            No hay órdenes con retiro en estas fechas. Prueba con “Este mes”.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[['Órdenes', num(cierre.ordenes), '#1F2430'],
                ['Kilos', num(cierre.kilos), '#1F2430'],
                ['Ventas', fmt(cierre.ventas), '#E8177A'],
                ['Pagado', fmt(cierre.pagado), '#047857']].map(([l, v, col]) => (
                <div key={l as string} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{l as string}</p>
                  <p className="font-bold" style={{ color: col as string }}>{v as any}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-1.5">
                Cómo pagaron estas órdenes · queda por cobrar {fmt(cierre.por_cobrar)}
              </p>
              {(cierre.medios || []).length === 0 ? (
                <p className="text-xs text-gray-400">No hay pagos registrados en estas fechas.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {cierre.medios.map((m: any) => (
                    <div key={m.medio} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400">{m.medio}</p>
                      <p className="font-bold text-sm text-gray-700">{fmt(m.total)}</p>
                      <p className="text-[11px] text-gray-400">{m.pagos} {num(m.pagos) === 1 ? 'pago' : 'pagos'}</p>
                    </div>
                  ))}
                </div>
              )}
              {num(cierre.sin_desglosar) > 0 && (
                <p className="text-[11px] text-amber-700 mt-2">
                  {fmt(cierre.sin_desglosar)} cobrados sin forma de pago registrada.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
