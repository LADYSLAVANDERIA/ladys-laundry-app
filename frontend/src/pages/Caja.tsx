import { useEffect, useState } from 'react'
import { cajaApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  Lock, Unlock, Plus, Minus, ArrowDownToLine, Wallet, CheckCircle2,
  AlertTriangle, History, Banknote,
} from 'lucide-react'

const plata = (n: any) => '$' + Number(n || 0).toLocaleString('es-CL')

function Historial({ filas }: { filas: any[] }) {
  const cerradas = filas.filter(f => f.estado === 'CERRADA')
  if (!cerradas.length) return null
  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <p className="px-4 py-2.5 text-sm font-medium border-b flex items-center gap-2 text-gray-700">
        <History size={15} /> Cierres anteriores
      </p>
      <div className="divide-y max-h-72 overflow-y-auto">
        {cerradas.map(f => (
          <div key={f.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-gray-700">
              {String(f.fecha_apertura).slice(0, 10)}
              <span className="text-gray-400"> · {f.hora_apertura}–{f.hora_cierre}</span>
            </span>
            <span className="text-gray-600 flex items-center gap-1.5">
              <Wallet size={13} className="text-gray-400" /> {plata(f.cierre_efect)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Caja() {
  const [d, setD] = useState<any>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [apertura, setApertura] = useState('')
  const [conteo, setConteo] = useState('')
  const [mov, setMov] = useState({ tipo: 'EGRESO', monto: '', concepto: '' })
  const [cerrando, setCerrando] = useState(false)

  const cargar = () => {
    cajaApi.estado().then(r => setD(r.data)).catch(() => toast.error('No se pudo cargar la caja'))
    cajaApi.historial().then(r => setHistorial(r.data.cajas || [])).catch(() => {})
  }
  useEffect(cargar, [])

  const abrir = async () => {
    try {
      await cajaApi.abrir({ apertura_efect: Number(apertura) || 0 })
      toast.success('Caja abierta'); setApertura(''); cargar()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo abrir') }
  }

  const agregarMov = async () => {
    if (!Number(mov.monto)) return toast.error('Falta el monto')
    try {
      await cajaApi.movimiento({ ...mov, monto: Number(mov.monto) })
      toast.success('Registrado'); setMov({ tipo: 'EGRESO', monto: '', concepto: '' }); cargar()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo registrar') }
  }

  const cerrar = async () => {
    try {
      const { data } = await cajaApi.cerrar({ cierre_efect: Number(conteo) || 0 })
      toast.success(data.cuadra ? 'Caja cerrada y cuadrada' : `Cerrada con diferencia de ${plata(data.diferencia)}`)
      setConteo(''); setCerrando(false); cargar()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo cerrar') }
  }

  if (!d) return <p className="text-center text-gray-400 py-16">Cargando…</p>

  if (!d.abierta) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Caja</h1>
        <div className="bg-white rounded-2xl border p-6 text-center space-y-4">
          <Lock size={36} className="mx-auto text-gray-300" />
          <p className="text-gray-600">No hay caja abierta</p>
          <div className="text-left">
            <label className="text-xs text-gray-500 block mb-1">¿Con cuánto efectivo parte?</label>
            <input type="number" value={apertura} onChange={e => setApertura(e.target.value)}
                   placeholder="0" className="w-full border rounded-xl px-3 py-3 text-lg outline-none" />
          </div>
          <button onClick={abrir}
                  className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            <Unlock size={17} /> Abrir caja
          </button>
        </div>
        <Historial filas={historial} />
      </div>
    )
  }

  const t = d.totales

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Caja</h1>
        <span className="text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-700">
          Abierta desde las {d.caja.hora_apertura}
        </span>
      </div>

      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
        <p className="text-sm opacity-90">Debería haber en efectivo</p>
        <p className="text-4xl font-bold mt-1">{plata(t.esperado_en_caja)}</p>
        <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
          <span className="opacity-90">Apertura</span><span className="text-right">{plata(t.apertura)}</span>
          <span className="opacity-90">Cobrado en efectivo</span><span className="text-right">+{plata(t.efectivo)}</span>
          {!!t.ingresos && <><span className="opacity-90">Otros ingresos</span><span className="text-right">+{plata(t.ingresos)}</span></>}
          {!!t.egresos && <><span className="opacity-90">Egresos</span><span className="text-right">−{plata(t.egresos)}</span></>}
          {!!t.retiros && <><span className="opacity-90">Retiros</span><span className="text-right">−{plata(t.retiros)}</span></>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <p className="px-4 py-2.5 text-sm font-medium border-b text-gray-700">Cobros por forma de pago</p>
        {d.cobros.length ? (
          <div className="divide-y">
            {d.cobros.map((c: any) => (
              <div key={c.forma_id} className="px-4 py-2.5 flex justify-between text-sm">
                <span className="text-gray-700">{c.forma} <span className="text-gray-400">({c.n})</span></span>
                <b className="text-gray-800">{plata(c.total)}</b>
              </div>
            ))}
            <div className="px-4 py-2.5 flex justify-between text-sm bg-gray-50">
              <b>Total cobrado</b><b>{plata(t.cobrado_total)}</b>
            </div>
          </div>
        ) : <p className="px-4 py-6 text-center text-sm text-gray-400">Todavía no hay cobros</p>}
      </div>

      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Registrar movimiento</p>
        <div className="grid grid-cols-3 gap-2">
          {[['EGRESO', 'Gasto', Minus], ['RETIRO', 'Retiro', ArrowDownToLine], ['INGRESO', 'Ingreso', Plus]].map(([k, txt, Icon]: any) => (
            <button key={k} onClick={() => setMov({ ...mov, tipo: k })}
                    className={`py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 border ${mov.tipo === k ? 'text-white' : 'text-gray-600'}`}
                    style={mov.tipo === k ? { background: '#1F2430', borderColor: '#1F2430' } : {}}>
              <Icon size={14} /> {txt}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="number" value={mov.monto} onChange={e => setMov({ ...mov, monto: e.target.value })}
                 placeholder="Monto" className="w-32 border rounded-xl px-3 py-2.5 text-sm outline-none" />
          <input value={mov.concepto} onChange={e => setMov({ ...mov, concepto: e.target.value })}
                 placeholder="¿De qué se trata?" className="flex-1 border rounded-xl px-3 py-2.5 text-sm outline-none" />
          <button onClick={agregarMov} className="px-4 rounded-xl text-white text-sm" style={{ background: '#E8177A' }}>
            Anotar
          </button>
        </div>
        {!!d.movimientos.length && (
          <div className="divide-y border-t pt-1">
            {d.movimientos.map((m: any) => (
              <div key={m.id} className="py-2 flex justify-between text-sm">
                <span className="text-gray-600">
                  <span className="text-gray-400">{m.hora}</span> · {m.concepto || m.tipo}
                </span>
                <span className={m.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-500'}>
                  {m.tipo === 'INGRESO' ? '+' : '−'}{plata(m.monto)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Banknote size={16} className="text-gray-400" /> Cierre de caja
        </p>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Cuenta el efectivo del cajón y escríbelo aquí</label>
          <input type="number" value={conteo} onChange={e => setConteo(e.target.value)}
                 placeholder="0" className="w-full border rounded-xl px-3 py-3 text-lg outline-none" />
        </div>
        {conteo !== '' && (
          <div className={`rounded-xl p-3 flex items-center gap-2 text-sm ${
            Math.abs(Number(conteo) - t.esperado_en_caja) < 1 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
            {Math.abs(Number(conteo) - t.esperado_en_caja) < 1
              ? <><CheckCircle2 size={16} /> Cuadra exacto</>
              : <><AlertTriangle size={16} /> {Number(conteo) > t.esperado_en_caja ? 'Sobran' : 'Faltan'} {plata(Math.abs(Number(conteo) - t.esperado_en_caja))}</>}
          </div>
        )}
        {!cerrando ? (
          <button onClick={() => setCerrando(true)} disabled={conteo === ''}
                  className="w-full py-3 rounded-xl border text-gray-700 font-medium disabled:opacity-40 flex items-center justify-center gap-2">
            <Lock size={16} /> Cerrar caja
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setCerrando(false)} className="flex-1 py-3 rounded-xl border text-gray-600">Volver</button>
            <button onClick={cerrar} className="flex-1 py-3 rounded-xl text-white font-medium" style={{ background: '#dc2626' }}>
              Confirmar cierre
            </button>
          </div>
        )}
      </div>

      <Historial filas={historial} />
    </div>
  )
}
