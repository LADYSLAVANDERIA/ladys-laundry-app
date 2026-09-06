import { useEffect, useState } from 'react'
import { tableroApi } from '../services/api'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, RefreshCw, Scale, Receipt, Users } from 'lucide-react'

const plata = (n: any) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')
const mesHoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }).slice(0, 7)
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const mesLargo = (m: string) => {
  const [a, b] = m.split('-')
  return `${MESES[Number(b) - 1]} ${a}`
}

// Una variación sin base de comparación no se muestra: un "+∞%" no dice nada.
function Delta({ v, texto }: { v: number | null; texto: string }) {
  if (v === null || v === undefined) return <span className="text-xs text-gray-400">sin comparación</span>
  const sube = v >= 0
  const Icono = sube ? TrendingUp : TrendingDown
  return (
    <span className={`text-xs flex items-center gap-1 ${sube ? 'text-green-600' : 'text-red-500'}`}>
      <Icono size={13} /> {sube ? '+' : ''}{v}% {texto}
    </span>
  )
}

export default function Tablero() {
  const [mes, setMes] = useState(mesHoy())
  const [d, setD] = useState<any>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = (m = mes) => {
    setCargando(true)
    tableroApi.resumen(m)
      .then(r => setD(r.data))
      .catch(() => toast.error('No se pudo cargar el análisis'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar(mes) }, [mes])

  if (cargando || !d) return <div className="py-20 text-center text-gray-400">Cargando…</div>

  const totalMix = (d.mix || []).reduce((s: number, m: any) => s + Number(m.total), 0) || 1
  const maxServ = Math.max(...(d.servicios || []).map((s: any) => Number(s.total)), 1)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Análisis</h1>
          <p className="text-gray-500 text-sm capitalize">{mesLargo(d.mes)}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                 className="border rounded-xl px-3 py-2 text-sm" />
          <button onClick={() => cargar()} className="p-2.5 rounded-xl border text-gray-600"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 space-y-1">
          <p className="text-xs text-gray-500">Ventas del mes</p>
          <p className="text-xl font-bold text-gray-800">{plata(d.ventas)}</p>
          <Delta v={d.vs_mes_anterior?.ventas} texto="vs mes anterior" />
          <Delta v={d.vs_ano_pasado?.ventas} texto="vs año pasado" />
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-1">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Receipt size={12} /> Pedidos</p>
          <p className="text-xl font-bold text-gray-800">{d.ordenes}</p>
          <Delta v={d.vs_mes_anterior?.ordenes} texto="vs mes anterior" />
          <p className="text-xs text-gray-400">ticket {plata(d.ticket_promedio)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-1">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Scale size={12} /> Kilos</p>
          <p className="text-xl font-bold text-gray-800">{Number(d.kilos).toLocaleString('es-CL')}</p>
          <Delta v={d.vs_mes_anterior?.kilos} texto="vs mes anterior" />
          <p className="text-xs text-gray-400">{d.kilos_por_orden} kg por pedido</p>
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-1">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Users size={12} /> Clientes</p>
          <p className="text-xl font-bold text-gray-800">{d.clientes?.activos_mes ?? 0}</p>
          <p className="text-xs text-green-600">{d.clientes?.nuevos_mes ?? 0} nuevos</p>
          <p className="text-xs text-amber-700">{d.clientes?.enfriandose ?? 0} sin volver hace 2 meses</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">De dónde viene la plata</h2>
        <div className="flex h-3 rounded-full overflow-hidden">
          {(d.mix || []).map((m: any, i: number) => (
            <div key={m.familia} title={m.familia}
                 style={{ width: `${(Number(m.total) / totalMix) * 100}%`,
                          background: ['#E8177A','#4AAEE0','#A87BC8','#F59E0B','#10B981','#6B7280'][i % 6] }} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(d.mix || []).map((m: any, i: number) => (
            <div key={m.familia} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: ['#E8177A','#4AAEE0','#A87BC8','#F59E0B','#10B981','#6B7280'][i % 6] }} />
                {m.familia}
              </span>
              <span className="text-gray-500">
                {plata(m.total)} · {Math.round((Number(m.total) / totalMix) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Servicios que más facturan</h2>
        {(d.servicios || []).length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos este mes.</p>
        ) : (
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
        <h2 className="font-semibold text-gray-800">Quiénes dejaron más este mes</h2>
        <div className="divide-y">
          {(d.top_clientes || []).map((c: any) => (
            <div key={c.id} className="py-2 flex items-center justify-between gap-3">
              <Link to={`/clientes/${c.id}`} className="text-sm text-gray-800 truncate hover:underline">
                {c.cliente}
              </Link>
              <span className="text-sm text-gray-500 shrink-0">
                {plata(c.total)} <span className="text-gray-400">· {c.ordenes} pedidos</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
