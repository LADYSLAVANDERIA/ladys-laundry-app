import { useEffect, useState } from 'react'
import { prepagosApi } from '../services/api'
import { CreditCard } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)

export default function Prepagos() {
  const [saldos, setSaldos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    prepagosApi.saldos().then(r => setSaldos(r.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Prepagos</h1>
      {loading ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"/></div> : (
        <div className="grid gap-3">
          {saldos.map(s => {
            const pct = s.saldo_inicial > 0 ? Math.round(s.saldo_actual/s.saldo_inicial*100) : 0
            return (
              <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">{s.cliente}</p>
                    <p className="text-xs text-gray-500">{s.plan}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-pink-600">{fmt(s.saldo_actual)}</p>
                    <p className="text-xs text-gray-400">de {fmt(s.saldo_inicial)}</p>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-2 rounded-full transition-all" style={{width:`${pct}%`,background:'linear-gradient(90deg,#E8177A,#A87BC8)'}}/>
                </div>
                <p className="text-xs text-gray-400 mt-1">{pct}% disponible</p>
              </div>
            )
          })}
          {saldos.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CreditCard size={40} className="mx-auto mb-2 opacity-30"/>
              <p>No hay prepagos activos</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
