import { useEffect, useState } from 'react'
import { ordenesApi } from '../services/api'
import { Calendar, Package } from 'lucide-react'
import { format, addDays, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

const fmt = (n: number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)

export default function Agenda() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [semanaOffset, setSemanaOffset] = useState(0)

  const inicioSemana = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), semanaOffset * 7)
  const dias = Array.from({length:6}, (_,i) => addDays(inicioSemana, i))

  useEffect(() => {
    const desde = format(dias[0],'yyyy-MM-dd')
    const hasta = format(dias[5],'yyyy-MM-dd')
    ordenesApi.getAll({ desde, hasta }).then(r => setOrdenes(r.data)).finally(() => setLoading(false))
  }, [semanaOffset])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Agenda</h1>
        <div className="flex gap-2">
          <button onClick={() => setSemanaOffset(p => p-1)} className="px-3 py-1.5 rounded-xl bg-white border text-sm hover:bg-gray-50">← Anterior</button>
          <button onClick={() => setSemanaOffset(0)} className="px-3 py-1.5 rounded-xl bg-white border text-sm hover:bg-gray-50">Hoy</button>
          <button onClick={() => setSemanaOffset(p => p+1)} className="px-3 py-1.5 rounded-xl bg-white border text-sm hover:bg-gray-50">Siguiente →</button>
        </div>
      </div>
      <p className="text-sm text-gray-500">{format(dias[0],'d MMM',{locale:es})} – {format(dias[5],'d MMM yyyy',{locale:es})}</p>

      {loading ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"/></div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {dias.map(dia => {
            const fechaStr = format(dia,'yyyy-MM-dd')
            const retiros = ordenes.filter(o => o.fecha_recogida === fechaStr)
            const entregas = ordenes.filter(o => o.fecha_entrega === fechaStr)
            const esHoy = fechaStr === format(new Date(),'yyyy-MM-dd')
            return (
              <div key={fechaStr} className={`bg-white rounded-xl p-4 shadow-sm border ${esHoy ? 'ring-2 ring-pink-400' : ''}`}>
                <div className="mb-3">
                  <p className={`text-xs font-semibold uppercase ${esHoy ? 'text-pink-600' : 'text-gray-400'}`}>{format(dia,'EEE',{locale:es})}</p>
                  <p className={`text-xl font-bold ${esHoy ? 'text-pink-600' : 'text-gray-800'}`}>{format(dia,'d')}</p>
                </div>
                {retiros.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-yellow-600 mb-1">↑ Retiros ({retiros.length})</p>
                    {retiros.slice(0,3).map(o => <p key={o.id} className="text-xs text-gray-600 truncate">· {o.cliente_nombre}</p>)}
                    {retiros.length > 3 && <p className="text-xs text-gray-400">+{retiros.length-3} más</p>}
                  </div>
                )}
                {entregas.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-600 mb-1">↓ Entregas ({entregas.length})</p>
                    {entregas.slice(0,3).map(o => <p key={o.id} className="text-xs text-gray-600 truncate">· {o.cliente_nombre}</p>)}
                    {entregas.length > 3 && <p className="text-xs text-gray-400">+{entregas.length-3} más</p>}
                  </div>
                )}
                {retiros.length === 0 && entregas.length === 0 && (
                  <div className="text-center py-3"><Calendar size={20} className="mx-auto text-gray-200"/></div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
