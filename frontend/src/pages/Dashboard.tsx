import { useEffect, useState } from 'react'
import { dashboardApi } from '../services/api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Users, Package, Clock, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.get().then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" />
    </div>
  )

  const kpis = [
    { label: 'Clientes', value: data?.kpis?.total_clientes, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Órdenes hoy', value: data?.kpis?.ordenes_hoy, icon: Package, color: 'text-pink-500', bg: 'bg-pink-50' },
    { label: 'En proceso', value: data?.kpis?.en_proceso, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { label: 'Listas p/entregar', value: data?.kpis?.listas, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm">{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center`}>
                <k.icon size={20} className={k.color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{k.value ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Ventas del mes */}
      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-700">Ventas del mes</h2>
          <TrendingUp size={18} className="text-pink-400" />
        </div>
        <p className="text-2xl font-bold text-pink-600 mb-4">{fmt(data?.kpis?.ventas_mes || 0)}</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data?.ventasDiarias || []}>
            <defs>
              <linearGradient id="gradPink" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8177A" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#E8177A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="fecha" tickFormatter={d => format(parseISO(d), 'd/M')} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={l => format(parseISO(l as string), 'd MMM', { locale: es })} />
            <Area type="monotone" dataKey="ventas" stroke="#E8177A" fill="url(#gradPink)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top servicios */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-700 mb-4">Top Servicios del mes</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={(data?.topServicios || []).slice(0,6)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={(v: number) => [`${v} items`]} />
              <Bar dataKey="cantidad" fill="#A87BC8" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Estado de órdenes */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-700 mb-4">Estado de Órdenes</h2>
          <div className="space-y-3">
            {(data?.estadoOrdenes || []).map((e: any) => {
              const colors: Record<string,string> = {
                EN_PROCESO: 'bg-yellow-400', LISTA: 'bg-green-400',
                ENTREGADA: 'bg-blue-400', PAGADA: 'bg-purple-400', PRE_ORDEN: 'bg-gray-300'
              }
              const total = (data?.estadoOrdenes || []).reduce((s: number, x: any) => s + parseInt(x.cantidad), 0)
              const pct = total ? Math.round(parseInt(e.cantidad) / total * 100) : 0
              return (
                <div key={e.estado}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{e.estado.replace('_',' ')}</span>
                    <span className="font-semibold">{e.cantidad}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className={`h-2 rounded-full ${colors[e.estado] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {data?.kpis?.pre_ordenes > 0 && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-orange-50 rounded-lg">
                <AlertCircle size={14} className="text-orange-500" />
                <span className="text-xs text-orange-700">{data.kpis.pre_ordenes} pre-orden(es) pendiente(s)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
