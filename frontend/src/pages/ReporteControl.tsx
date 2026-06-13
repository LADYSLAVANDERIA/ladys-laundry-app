import { useEffect, useState } from 'react'
import { reportesApi } from '../services/api'
import { BarChart2 } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)

export default function ReporteControl() {
  const hoy = new Date().toISOString().split('T')[0]
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await reportesApi.control({ desde, hasta }); setData(r.data) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">Reporte de Control</h1>
      <div className="flex gap-3 items-end flex-wrap">
        {[['Desde',desde,setDesde],['Hasta',hasta,setHasta]].map(([l,v,s]) => (
          <div key={l as string}>
            <label className="text-xs text-gray-500 block mb-1">{l as string}</label>
            <input type="date" value={v as string} onChange={e => (s as Function)(e.target.value)} className="border rounded-xl px-3 py-2 text-sm outline-none"/>
          </div>
        ))}
        <button onClick={load} className="px-5 py-2 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>Ver reporte</button>
      </div>

      {loading ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"/></div> : data.length > 0 ? (
        data.map((r,i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
              <BarChart2 size={16} className="text-pink-500"/>
              <p className="font-semibold text-gray-700">{r.local}</p>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Órdenes',r.ordenes,'text-gray-700'],
                ['Anuladas',r.anuladas,'text-red-500'],
                ['Ventas',fmt(r.ventas),'text-pink-600'],
                ['Ingresos',fmt(r.ingresos),'text-green-600'],
                ['Efectivo',fmt(r.efectivo),'text-gray-700'],
                ['POS',fmt(r.pos),'text-gray-700'],
                ['Transferencia',fmt(r.transferencia),'text-gray-700'],
              ].map(([l,v,c]) => (
                <div key={l as string} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{l as string}</p>
                  <p className={`font-bold text-sm ${c as string}`}>{v as string}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-16 text-gray-400">
          <BarChart2 size={40} className="mx-auto mb-2 opacity-30"/>
          <p>No hay datos para el período seleccionado</p>
        </div>
      )}
    </div>
  )
}
