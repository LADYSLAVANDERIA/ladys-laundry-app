import { useEffect, useState } from 'react'
import { tableroApi } from '../services/api'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, RefreshCw, Scale, Receipt, Users, Wallet } from 'lucide-react'

const plata = (n: any) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')
const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
const primeroDelMes = () => hoy().slice(0, 8) + '01'
const COLORES = ['#E8177A', '#4AAEE0', '#A87BC8', '#F59E0B', '#10B981', '#6B7280', '#EF4444', '#8B5CF6']

// Las fechas del servidor vienen como instante UTC. Se recorta el texto antes
// de leerlas, o en Chile se corren un día hacia atrás.
const diaCorto = (f: any) => {
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function Delta({ v }: { v: number | null }) {
  if (v === null || v === undefined) return <span className="text-xs text-gray-400">sin comparación</span>
  const sube = v >= 0
  const I = sube ? TrendingUp : TrendingDown
  return (
    <span className={`text-xs flex items-center gap-1 ${sube ? 'text-green-600' : 'text-red-500'}`}>
      <I size={13} /> {sube ? '+' : ''}{v}% vs período anterior
    </span>
  )
}

function Reparto({ datos, campo }: { datos: any[]; campo: string }) {
  const total = datos.reduce((s, d) => s + Number(d.total), 0) || 1
  return (
    <>
      <div className="flex h-3 rounded-full overflow-hidden">
        {datos.map((d, i) => (
          <div key={d[campo]} title={d[campo]}
               style={{ width: `${(Number(d.total) / total) * 100}%`, background: COLORES[i % COLORES.length] }} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
        {datos.map((d, i) => (
          <div key={d[campo]} className="flex items-center justify-between text-sm gap-2">
            <span className="flex items-center gap-2 text-gray-700 truncate">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORES[i % COLORES.length] }} />
              {d[campo]}
            </span>
            <span className="text-gray-500 shrink-0">
              {plata(d.total)} · {Math.round((Number(d.total) / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function Tarjeta({ titulo, valor, icono: I, children }: any) {
  return (
    <div className="bg-white rounded-xl border p-4 space-y-1">
      <p className="text-xs text-gray-500 flex items-center gap-1">{I && <I size={12} />} {titulo}</p>
      <p className="text-xl font-bold text-gray-800">{valor}</p>
      {children}
    </div>
  )
}

export default function Tablero() {
  const [desde, setDesde] = useState(primeroDelMes())
  const [hasta, setHasta] = useState(hoy())
  const [d, setD] = useState<any>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = (dd = desde, hh = hasta) => {
    setCargando(true)
    tableroApi.resumen(dd, hh)
      .then(r => setD(r.data))
      .catch(() => toast.error('No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, [])

  const atajo = (dd: string, hh: string) => { setDesde(dd); setHasta(hh); cargar(dd, hh) }
  const mesPasado = () => {
    const [a, m] = primeroDelMes().split('-')
    const ini = Number(m) === 1 ? `${Number(a) - 1}-12-01` : `${a}-${String(Number(m) - 1).padStart(2, '0')}-01`
    const fin = new Date(primeroDelMes() + 'T12:00:00')
    fin.setDate(0)
    atajo(ini, fin.toLocaleDateString('sv-SE'))
  }

  if (cargando || !d) return <div className="py-20 text-center text-gray-400">Cargando…</div>

  const maxDia = Math.max(...(d.diarias || []).map((x: any) => Number(x.total)), 1)
  const maxServ = Math.max(...(d.servicios || []).map((s: any) => Number(s.total)), 1)
  const maxMes = Math.max(...(d.por_mes || []).map((m: any) => Number(m.total)), 1)
  const cobrado = (d.pagado + d.por_cobrar) || 1

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Análisis</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                 className="border rounded-xl px-3 py-2 text-sm" />
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                 className="border rounded-xl px-3 py-2 text-sm" />
          <button onClick={() => cargar()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            <RefreshCw size={15} /> Consultar
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <button onClick={() => atajo(primeroDelMes(), hoy())} className="px-3 py-1.5 rounded-lg border text-gray-600">Este mes</button>
        <button onClick={mesPasado} className="px-3 py-1.5 rounded-lg border text-gray-600">Mes pasado</button>
        <button onClick={() => atajo(hoy().slice(0, 4) + '-01-01', hoy())} className="px-3 py-1.5 rounded-lg border text-gray-600">Este año</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta titulo="Ventas" valor={plata(d.ventas)}>
          <Delta v={d.vs_anterior?.ventas} />
        </Tarjeta>
        <Tarjeta titulo="Pedidos" valor={d.ordenes} icono={Receipt}>
          <Delta v={d.vs_anterior?.ordenes} />
          <p className="text-xs text-gray-400">ticket {plata(d.ticket_promedio)}</p>
        </Tarjeta>
        <Tarjeta titulo="Kilos" valor={Number(d.kilos).toLocaleString('es-CL')} icono={Scale}>
          <Delta v={d.vs_anterior?.kilos} />
          <p className="text-xs text-gray-400">{d.kilos_por_orden} kg por pedido</p>
        </Tarjeta>
        <Tarjeta titulo="Clientes" valor={d.clientes?.activos ?? 0} icono={Users}>
          <p className="text-xs text-green-600">{d.clientes?.nuevos ?? 0} nuevos</p>
          <p className="text-xs text-amber-700">{d.clientes?.enfriandose ?? 0} sin volver hace 2 meses</p>
        </Tarjeta>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Wallet size={16} className="text-gray-400" /> Cobrado y por cobrar
          </h2>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div style={{ width: `${(d.pagado / cobrado) * 100}%`, background: '#10B981' }} />
            <div style={{ width: `${(d.por_cobrar / cobrado) * 100}%`, background: '#374151' }} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-700">Pagado {plata(d.pagado)}</span>
            <span className="text-gray-700">Por cobrar {plata(d.por_cobrar)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 space-y-1">
          <h2 className="font-semibold text-gray-800">Ventas y compras</h2>
          <p className="text-sm text-gray-500">Utilidad bruta del período</p>
          <p className="text-2xl font-bold" style={{ color: d.utilidad >= 0 ? '#059669' : '#DC2626' }}>{plata(d.utilidad)}</p>
          <p className="text-xs text-gray-400">ventas {plata(d.ventas)} · compras {plata(d.compras)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Ventas por día</h2>
        {(d.diarias || []).length === 0 ? <p className="text-sm text-gray-400">Sin ventas en el período.</p> : (
          <div className="flex items-end gap-1 h-36">
            {d.diarias.map((x: any) => (
              <div key={x.fecha} className="flex-1 flex flex-col items-center gap-1 min-w-0"
                   title={`${plata(x.total)} · ${x.ordenes} pedidos`}>
                <div className="w-full rounded-t"
                     style={{ height: `${(Number(x.total) / maxDia) * 100}%`,
                              background: 'linear-gradient(180deg,#E8177A,#A87BC8)', minHeight: 3 }} />
                <span className="text-[10px] text-gray-400 truncate">{diaCorto(x.fecha)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Empresas y particulares</h2>
          <Reparto campo="k" datos={[
            { k: 'Particulares', total: d.particulares },
            { k: 'Empresas', total: d.empresas },
          ].filter(x => Number(x.total) > 0)} />
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Ventas por sector</h2>
          {(d.sectores || []).length ? <Reparto campo="sector" datos={d.sectores} />
            : <p className="text-sm text-gray-400">Sin datos.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Medios de pago</h2>
          {(d.medios || []).length ? <Reparto campo="medio" datos={d.medios} />
            : <p className="text-sm text-gray-400">No se registraron pagos en el período.</p>}
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Gastos por tipo</h2>
          {(d.gastos || []).length ? <Reparto campo="tipo" datos={d.gastos} />
            : <p className="text-sm text-gray-400">No hay compras cargadas en el período.</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Servicios que más facturan</h2>
        {(d.servicios || []).length === 0 ? <p className="text-sm text-gray-400">Sin datos.</p> : (
          <div className="space-y-2">
            {d.servicios.map((s: any) => (
              <div key={s.nombre} className="space-y-1">
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-gray-700 truncate">{s.nombre.replace(/^SERVICIO /i, '')}</span>
                  <span className="text-gray-500 shrink-0">{plata(s.total)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                       style={{ width: `${(Number(s.total) / maxServ) * 100}%`,
                                background: 'linear-gradient(90deg,#E8177A,#A87BC8)' }} />
                </div>
                <p className="text-xs text-gray-400">{s.cantidad} unidades · {s.ordenes} pedidos</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Ranking de clientes</h2>
        <div className="divide-y">
          {(d.top_clientes || []).map((c: any, i: number) => (
            <div key={c.id} className="py-2 flex items-center gap-3">
              <span className="w-6 text-xs text-gray-400 shrink-0">{i + 1}</span>
              <Link to={`/clientes/${c.id}`} className="flex-1 text-sm text-gray-800 truncate hover:underline">
                {c.cliente}
                {c.tipo === 'EMPRESA' &&
                  <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">empresa</span>}
              </Link>
              <span className="text-sm text-gray-500 shrink-0">
                {plata(c.total)} <span className="text-gray-400">· {c.ordenes}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Tendencia de los últimos 24 meses</h2>
        <div className="flex items-end gap-0.5 h-40 overflow-x-auto">
          {(d.por_mes || []).map((m: any) => (
            <div key={m.mes} className="flex-1 flex flex-col items-center gap-1 min-w-[18px]"
                 title={`${m.mes}: ${plata(m.total)} · ${m.ordenes} pedidos`}>
              <div className="w-full rounded-t"
                   style={{ height: `${(Number(m.total) / maxMes) * 100}%`,
                            background: m.mes.startsWith(hoy().slice(0, 4)) ? '#E8177A' : '#9CA3AF',
                            minHeight: 2 }} />
              <span className="text-[9px] text-gray-400">{m.mes.slice(5)}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">En rosado el año en curso. Mantén el dedo en una barra para ver el monto.</p>
      </div>
    </div>
  )
}
