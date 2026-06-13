import { useEffect, useState } from 'react'
import { cajaApi } from '../services/api'
import toast from 'react-hot-toast'
import { DollarSign, Lock, Unlock } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)

export default function Caja() {
  const [caja, setCaja] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [apertura, setApertura] = useState('0')
  const [cierre, setCierre] = useState('0')
  const [hoy] = useState(new Date().toISOString().split('T')[0])
  const [reporte, setReporte] = useState<any[]>([])

  const load = async () => {
    try {
      const [c, r] = await Promise.all([cajaApi.estado(), cajaApi.reporte({ desde: hoy, hasta: hoy })])
      setCaja(c.data); setReporte(r.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const abrir = async () => {
    try { await cajaApi.abrir({ apertura_efect: Number(apertura) }); toast.success('Caja abierta'); load() }
    catch { toast.error('Error al abrir caja') }
  }

  const cerrar = async () => {
    if (!caja || !confirm('¿Confirmas cerrar la caja?')) return
    try { await cajaApi.cerrar(caja.id, { cierre_efect: Number(cierre) }); toast.success('Caja cerrada'); load() }
    catch { toast.error('Error al cerrar caja') }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"/></div>

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">Caja</h1>

      <div className={`rounded-2xl p-6 text-white shadow-lg ${caja ? 'bg-green-500' : 'bg-gray-400'}`}
        style={caja ? {background:'linear-gradient(135deg,#22c55e,#16a34a)'} : {}}>
        <div className="flex items-center gap-3 mb-2">
          {caja ? <Unlock size={24}/> : <Lock size={24}/>}
          <p className="font-bold text-lg">{caja ? 'CAJA ABIERTA' : 'CAJA CERRADA'}</p>
        </div>
        {caja && <p className="text-sm opacity-80">Apertura: {fmt(caja.apertura_efect)}</p>}
      </div>

      {!caja ? (
        <div className="bg-white rounded-xl p-5 shadow-sm border space-y-3">
          <p className="font-semibold text-gray-700">Abrir caja</p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Efectivo inicial</label>
            <input type="number" value={apertura} onChange={e => setApertura(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-300"/>
          </div>
          <button onClick={abrir} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold" style={{background:'linear-gradient(135deg,#22c55e,#16a34a)'}}>
            <Unlock size={16}/> Abrir caja
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-5 shadow-sm border space-y-3">
          <p className="font-semibold text-gray-700">Cerrar caja</p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Efectivo al cierre</label>
            <input type="number" value={cierre} onChange={e => setCierre(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300"/>
          </div>
          <button onClick={cerrar} className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors">
            <Lock size={16} className="inline mr-2"/> Cerrar caja
          </button>
        </div>
      )}

      {reporte.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><DollarSign size={16} className="text-pink-500"/> Resumen hoy</p>
          {reporte.map((r,i) => (
            <div key={i} className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                {[['Ventas',r.ventas],['Ingresos',r.ingresos],['Efectivo',r.efectivo],['POS',r.pos],['Transferencia',r.transferencia]].map(([l,v]) => (
                  <div key={l as string} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">{l as string}</p>
                    <p className="font-bold text-gray-800 text-sm">{fmt(Number(v))}</p>
                  </div>
                ))}
                <div className="bg-pink-50 rounded-xl p-3">
                  <p className="text-xs text-pink-600">Órdenes</p>
                  <p className="font-bold text-pink-700">{r.ordenes}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
