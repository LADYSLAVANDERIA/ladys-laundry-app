import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ordenesApi, formasPagoApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Package, DollarSign, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADOS = ['PRE_ORDEN','EN_PROCESO','LISTA','ENTREGADA','PAGADA','ANULADA']
const COLORES: Record<string,string> = {
  PRE_ORDEN:'bg-gray-100 text-gray-600', EN_PROCESO:'bg-yellow-100 text-yellow-700',
  LISTA:'bg-green-100 text-green-700', ENTREGADA:'bg-blue-100 text-blue-700',
  PAGADA:'bg-purple-100 text-purple-700', ANULADA:'bg-red-100 text-red-600',
}
const fmt = (n: number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)

export default function OrdenDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [orden, setOrden] = useState<any>(null)
  const [formasPago, setFormasPago] = useState<any[]>([])
  const [pago, setPago] = useState<any>({ forma_pago_id: '', monto: 0 })
  const [loading, setLoading] = useState(true)
  const [showPago, setShowPago] = useState(false)

  const load = () => {
    ordenesApi.getById(Number(id)).then(r => setOrden(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    formasPagoApi.getAll().then(r => setFormasPago(r.data))
  }, [id])

  const cambiarEstado = async (nuevoEstado: string) => {
    if (nuevoEstado === 'ANULADA' && !confirm('¿Confirmas anular esta orden?')) return
    try {
      await ordenesApi.cambiarEstado(Number(id), { estado: nuevoEstado })
      toast.success(`Estado: ${nuevoEstado.replace('_',' ')}`)
      load()
    } catch { toast.error('Error al cambiar estado') }
  }

  const registrarPago = async () => {
    if (!pago.forma_pago_id || !pago.monto) return toast.error('Completa forma de pago y monto')
    try {
      await ordenesApi.pagar(Number(id), pago)
      toast.success('Pago registrado')
      setShowPago(false)
      setPago({ forma_pago_id: '', monto: 0 })
      load()
    } catch { toast.error('Error al registrar pago') }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"/></div>
  if (!orden) return <div className="text-center py-20 text-gray-400">Orden no encontrada</div>

  const idxActual = ESTADOS.indexOf(orden.estado)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ordenes')} className="p-2 rounded-xl hover:bg-gray-100"><ArrowLeft size={18}/></button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">OT #{String(orden.id).padStart(5,'0')}</h1>
          <p className="text-xs text-gray-500">{format(new Date(orden.creado_en), "d 'de' MMMM yyyy, HH:mm", {locale:es})}</p>
        </div>
        <span className={`ml-auto text-xs px-3 py-1 rounded-full font-medium ${COLORES[orden.estado]}`}>{orden.estado.replace('_',' ')}</span>
      </div>

      {/* Pipeline de estado */}
      {orden.estado !== 'ANULADA' && (
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-xs font-semibold text-gray-500 mb-3">ESTADO</p>
          <div className="flex items-center gap-1 overflow-x-auto">
            {ESTADOS.filter(e => e !== 'ANULADA').map((e, i) => (
              <div key={e} className="flex items-center gap-1">
                <button onClick={() => i > idxActual && cambiarEstado(e)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    i < idxActual ? 'bg-gray-100 text-gray-400' :
                    i === idxActual ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-pink-50 hover:text-pink-600 cursor-pointer'}`}
                  style={i === idxActual ? {background:'linear-gradient(135deg,#E8177A,#A87BC8)'} : {}}>
                  {e.replace('_',' ')}
                </button>
                {i < ESTADOS.filter(e => e !== 'ANULADA').length - 1 && <ChevronRight size={12} className="text-gray-300 flex-shrink-0"/>}
              </div>
            ))}
          </div>
          <button onClick={() => cambiarEstado('ANULADA')} className="mt-3 text-xs text-red-400 hover:text-red-600">Anular orden</button>
        </div>
      )}

      {/* Cliente */}
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <p className="text-xs font-semibold text-gray-500 mb-2">CLIENTE</p>
        <p className="font-semibold text-gray-800">{orden.cliente_nombre}</p>
        <p className="text-sm text-gray-500">{orden.cliente_telefono}</p>
        {orden.cliente_email && <p className="text-sm text-gray-500">{orden.cliente_email}</p>}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <p className="text-xs font-semibold text-gray-500 mb-3">SERVICIOS</p>
        <div className="space-y-2">
          {(orden.items||[]).map((i: any) => (
            <div key={i.id} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{i.nombre}</p>
                <p className="text-xs text-gray-400">x{i.cantidad} — {fmt(i.precio_unit)} c/u</p>
              </div>
              <p className="text-sm font-bold text-gray-700">{fmt(i.subtotal)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t space-y-1">
          {orden.monto_delivery > 0 && (
            <div className="flex justify-between text-sm text-gray-500"><span>Delivery</span><span>{fmt(orden.monto_delivery)}</span></div>
          )}
          <div className="flex justify-between font-bold"><span>Total</span><span className="text-pink-600">{fmt(orden.monto_total)}</span></div>
          <div className="flex justify-between text-sm text-gray-500"><span>Abonado</span><span className="text-green-600">{fmt(orden.monto_abonado)}</span></div>
          {orden.saldo_pendiente > 0 && (
            <div className="flex justify-between text-sm font-semibold text-red-500"><span>Pendiente</span><span>{fmt(orden.saldo_pendiente)}</span></div>
          )}
        </div>
      </div>

      {/* Pagos */}
      {(orden.pagos||[]).length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-xs font-semibold text-gray-500 mb-3">PAGOS REGISTRADOS</p>
          {orden.pagos.map((p: any) => (
            <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0">
              <span className="text-sm text-gray-600">{p.forma_nombre}</span>
              <span className="text-sm font-bold text-green-600">{fmt(p.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Registrar pago */}
      {orden.saldo_pendiente > 0 && orden.estado !== 'ANULADA' && (
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          {!showPago ? (
            <button onClick={() => setShowPago(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-medium text-sm"
              style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
              <DollarSign size={16}/> Registrar pago
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Registrar pago</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Forma de pago</label>
                  <select value={pago.forma_pago_id} onChange={e => setPago({...pago, forma_pago_id: e.target.value})}
                    className="w-full border rounded-xl px-3 py-2 text-sm outline-none">
                    <option value="">Seleccionar</option>
                    {formasPago.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Monto</label>
                  <input type="number" value={pago.monto} onChange={e => setPago({...pago, monto: Number(e.target.value)})}
                    className="w-full border rounded-xl px-3 py-2 text-sm outline-none"/>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={registrarPago} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>Confirmar</button>
                <button onClick={() => setShowPago(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info adicional */}
      {(orden.observaciones || orden.bultos) && (
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-xs font-semibold text-gray-500 mb-2">INFO ADICIONAL</p>
          {orden.bultos && <p className="text-sm text-gray-600"><span className="font-medium">Bultos:</span> {orden.bultos}</p>}
          {orden.observaciones && <p className="text-sm text-gray-600 mt-1"><span className="font-medium">Obs:</span> {orden.observaciones}</p>}
        </div>
      )}
    </div>
  )
}
