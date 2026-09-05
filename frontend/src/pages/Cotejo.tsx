import { useEffect, useState } from 'react'
import { cotejoApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  CheckCircle2, AlertTriangle, Copy, Scale, ArrowRight, History,
} from 'lucide-react'

const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
const plata = (n: any) => '$' + Number(n || 0).toLocaleString('es-CL')

// Se pega en la consola de EasyLaundry (F12) estando dentro del sistema.
// Trae las OT del día y las deja copiadas en el portapapeles.
const GUION = `fetch('/ws.aspx/OT_RETIRADAS_X_LOCAL_Traer_Periodo',{method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({FECHA_INICIO:'@DIA@',FECHA_TERMINO:'@DIA@'})})
.then(r=>r.json()).then(d=>{const x=JSON.parse(d.d||'[]');
copy(JSON.stringify(x));console.log('Copiadas '+x.length+' OT')})`

export default function Cotejo() {
  const [fecha, setFecha] = useState(hoy())
  const [pegado, setPegado] = useState('')
  const [r, setR] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  const [historial, setHistorial] = useState<any[]>([])

  useEffect(() => { cotejoApi.historial().then(x => setHistorial(x.data.cotejos || [])).catch(() => {}) }, [r])

  const comparar = async () => {
    let filas: any[]
    try {
      filas = JSON.parse(pegado)
      if (!Array.isArray(filas)) throw new Error()
    } catch { return toast.error('Eso no parece la lista de EasyLaundry') }
    setCargando(true)
    try {
      const { data } = await cotejoApi.comparar(fecha, filas)
      setR(data)
      toast.success(data.resumen.cuadra ? 'Cuadra perfecto' : 'Hay diferencias que revisar')
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo comparar') }
    finally { setCargando(false) }
  }

  const guion = GUION.replace(/@DIA@/g, fecha)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Cotejo con EasyLaundry</h1>
      <p className="text-sm text-gray-500">
        Mientras convivan los dos sistemas, esto compara pedido por pedido lo que registró
        cada uno y muestra dónde no coinciden.
      </p>

      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Día a comparar</span>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                 className="border rounded-xl px-3 py-2 text-sm" />
        </div>

        <div className="bg-gray-900 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400">
              1. Abre EasyLaundry, presiona F12, pestaña Console, y pega esto
            </p>
            <button onClick={() => { navigator.clipboard.writeText(guion); toast.success('Copiado') }}
                    className="flex items-center gap-1.5 text-xs text-white bg-white/10 px-2.5 py-1.5 rounded-lg">
              <Copy size={12} /> Copiar
            </button>
          </div>
          <pre className="text-[10px] text-green-300 overflow-x-auto whitespace-pre-wrap">{guion}</pre>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">2. Pega aquí lo que quedó copiado</p>
          <textarea value={pegado} onChange={e => setPegado(e.target.value)} rows={4}
                    placeholder='[{"OT":"6420","CLIENTE":"...","TOTAL":"12000"}, ...]'
                    className="w-full border rounded-xl p-3 text-xs font-mono outline-none" />
        </div>

        <button onClick={comparar} disabled={cargando || !pegado.trim()}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
          <Scale size={16} /> {cargando ? 'Comparando…' : 'Comparar'}
        </button>
      </div>

      {r && (
        <>
          <div className={`rounded-2xl p-4 flex items-start gap-3 ${r.resumen.cuadra ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            {r.resumen.cuadra
              ? <CheckCircle2 size={22} className="text-green-600 mt-0.5" />
              : <AlertTriangle size={22} className="text-amber-600 mt-0.5" />}
            <div className="flex-1">
              <p className="font-semibold text-gray-800">
                {r.resumen.cuadra ? 'Los dos sistemas coinciden' : 'Hay diferencias'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">EasyLaundry</p>
                  <p className="font-bold">{r.resumen.easylaundry.pedidos} pedidos</p>
                  <p className="text-gray-600">{plata(r.resumen.easylaundry.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">App Ladys</p>
                  <p className="font-bold">{r.resumen.app.pedidos} pedidos</p>
                  <p className="text-gray-600">{plata(r.resumen.app.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Diferencia</p>
                  <p className={`font-bold ${r.resumen.diferencia_total ? 'text-red-600' : 'text-green-600'}`}>
                    {plata(r.resumen.diferencia_total)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {[['solo_easylaundry', 'Están en EasyLaundry y no en la app', '#dc2626'],
            ['solo_app', 'Están en la app y no en EasyLaundry', '#4AAEE0']].map(([k, titulo, color]: any) => (
            !!r[k]?.length && (
              <div key={k} className="bg-white rounded-2xl border overflow-hidden">
                <p className="px-4 py-2.5 text-sm font-medium border-b" style={{ color }}>
                  {titulo} ({r[k].length})
                </p>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {r[k].map((f: any, i: number) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate">
                        <b>OT {f.ot || f.id}</b> · {f.cliente || 'sin nombre'}
                      </span>
                      <span className="text-gray-500">{plata(f.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}

          {!!r.diferentes?.length && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <p className="px-4 py-2.5 text-sm font-medium border-b text-amber-700">
                Mismo pedido, distinto monto ({r.diferentes.length})
              </p>
              <div className="divide-y max-h-64 overflow-y-auto">
                {r.diferentes.map((d: any, i: number) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm gap-3">
                    <span className="text-gray-700 truncate flex-1">
                      <b>OT {d.ot}</b> · {d.cliente}
                    </span>
                    <span className="text-gray-500 flex items-center gap-1.5 shrink-0">
                      {plata(d.easylaundry)} <ArrowRight size={12} /> {plata(d.app)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!!historial.length && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <p className="px-4 py-2.5 text-sm font-medium border-b flex items-center gap-2 text-gray-700">
            <History size={15} /> Cómo viene la semana
          </p>
          <div className="divide-y">
            {historial.map((h: any) => {
              const cuadra = !h.solo_easy && !h.solo_app && !h.diferentes
              return (
                <div key={h.fecha} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-gray-700">{h.fecha}</span>
                  <span className="text-gray-500">{h.n_easylaundry} vs {h.n_app} pedidos</span>
                  <span className={cuadra ? 'text-green-600' : 'text-amber-600'}>
                    {cuadra ? 'cuadró' : `${h.solo_easy + h.solo_app + h.diferentes} diferencias`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
