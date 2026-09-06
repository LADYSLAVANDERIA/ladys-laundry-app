import { useEffect, useState } from 'react'
import { configApi, transferenciasApi } from '../services/api'
import toast from 'react-hot-toast'
import { Save, Eye, EyeOff, Copy, Landmark, RefreshCw, ShieldCheck } from 'lucide-react'

const inp = 'w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300'

export default function ConfigBci() {
  const [cfg, setCfg] = useState<any>({})
  const [ver, setVer] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [suscribiendo, setSuscribiendo] = useState(false)
  const [avisos, setAvisos] = useState<any[]>([])
  const [callback, setCallback] = useState('')

  const cargar = () => {
    configApi.get()
      .then(({ data }) => setCfg(data || {}))
      .catch(() => toast.error('No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  const cargarAvisos = () => {
    transferenciasApi.ultimos()
      .then(({ data }) => { setAvisos(data.avisos || []); setCallback(data.callback || '') })
      .catch(() => {})
  }
  useEffect(() => { cargar(); cargarAvisos() }, [])

  const guardar = async () => {
    setGuardando(true)
    try {
      await configApi.set({
        bci_api_key: cfg.bci_api_key || '',
        bci_cuenta: cfg.bci_cuenta || '',
        bci_rut: cfg.bci_rut || '',
        bci_dv: cfg.bci_dv || '',
        bci_ambiente: cfg.bci_ambiente || 'sandbox',
      })
      toast.success('Datos guardados')
      cargar(); cargarAvisos()
    } catch { toast.error('No se pudo guardar') }
    finally { setGuardando(false) }
  }

  const suscribir = async () => {
    setSuscribiendo(true)
    try {
      const { data } = await transferenciasApi.suscribir()
      if (data.ok) toast.success('Suscripción enviada al banco')
      else toast.error(`El banco respondió ${data.status}`)
      console.log('BCI suscripción:', data)
      alert(`Respuesta del banco (${data.status}):\n\n${data.respuesta || 'sin cuerpo'}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo suscribir')
    } finally { setSuscribiendo(false) }
  }

  const copiar = (t: string) => {
    navigator.clipboard.writeText(t)
    toast.success('Copiado')
  }

  const productivo = (cfg.bci_ambiente || 'sandbox') === 'production'
  const listo = !!(cfg.bci_api_key || '').trim() && !!(cfg.bci_cuenta || '').trim() && !!(cfg.bci_rut || '').trim()

  if (cargando) return <div className="py-16 text-center text-gray-400">Cargando…</div>

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Landmark size={17} className="text-gray-400" /> Aviso de transferencias BCI
          </h2>
          <span className={`text-xs px-2.5 py-1 rounded-full ${listo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {listo ? (productivo ? 'Productivo' : 'Pruebas') : 'Sin configurar'}
          </span>
        </div>

        <p className="text-sm text-gray-600">
          Cuando un cliente transfiere, el banco avisa acá y la transferencia se confirma sola.
          Sin esto, el comprobante de WhatsApp libera la ropa pero el pago queda por confirmar a mano.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-600 mb-1 block">Clave de la aplicación (Consumer Key)</label>
            <div className="flex gap-2">
              <input type={ver ? 'text' : 'password'} className={inp} placeholder="pegar la clave de BCI"
                     value={cfg.bci_api_key || ''}
                     onChange={e => setCfg({ ...cfg, bci_api_key: e.target.value })} />
              <button type="button" onClick={() => setVer(!ver)} className="px-3 border rounded-lg text-gray-500">
                {ver ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Número de cuenta corriente</label>
            <input className={inp} value={cfg.bci_cuenta || ''}
                   onChange={e => setCfg({ ...cfg, bci_cuenta: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-gray-600 mb-1 block">RUT (sin puntos ni guion)</label>
              <input className={inp} placeholder="78035214" value={cfg.bci_rut || ''}
                     onChange={e => setCfg({ ...cfg, bci_rut: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">DV</label>
              <input className={inp} maxLength={1} value={cfg.bci_dv || ''}
                     onChange={e => setCfg({ ...cfg, bci_dv: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Ambiente</label>
            <select className={inp} value={cfg.bci_ambiente || 'sandbox'}
                    onChange={e => setCfg({ ...cfg, bci_ambiente: e.target.value })}>
              <option value="sandbox">Pruebas (sandbox) — datos ficticios</option>
              <option value="production">Productivo — plata real</option>
            </select>
          </div>
        </div>

        {productivo && (
          <div className="text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200">
            En productivo el banco avisa movimientos reales de la cuenta. Revisa que el número de cuenta
            y el RUT sean exactamente los de la cuenta de Ladys.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={guardar} disabled={guardando}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar datos'}
          </button>
          <button onClick={suscribir} disabled={suscribiendo || !listo}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium text-gray-700 disabled:opacity-40">
            <RefreshCw size={16} className={suscribiendo ? 'animate-spin' : ''} />
            {suscribiendo ? 'Enviando…' : 'Suscribir la cuenta'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <ShieldCheck size={16} className="text-gray-400" /> Dirección donde el banco debe avisar
        </h3>
        <p className="text-sm text-gray-600">
          Si BCI te pide registrar la URL a mano, es esta. Lleva la clave incluida:
          nadie sin ella puede inventar un pago.
        </p>
        <div className="flex gap-2">
          <input readOnly className={`${inp} bg-gray-50 text-xs`} value={callback} />
          <button onClick={() => copiar(callback)} className="px-3 border rounded-lg text-gray-500">
            <Copy size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Últimos avisos recibidos</h3>
          <button onClick={cargarAvisos} className="text-sm flex items-center gap-1.5" style={{ color: '#E8177A' }}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
        {avisos.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no llega ningún aviso del banco.</p>
        ) : (
          <div className="space-y-2">
            {avisos.map(a => (
              <details key={a.id} className="border rounded-lg">
                <summary className="px-3 py-2 text-sm cursor-pointer flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    {a.crudo?.concepto?.nombre || a.crudo?.idEvento || `Aviso ${a.id}`}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {a.crudo?.monto ? `$${Number(a.crudo.monto).toLocaleString('es-CL')}` : ''}
                  </span>
                </summary>
                <pre className="px-3 pb-3 text-[11px] text-gray-600 overflow-x-auto">
                  {JSON.stringify(a.crudo, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">
          Todo aviso queda guardado tal como llega, aunque no calce con ningún pedido.
        </p>
      </div>
    </div>
  )
}
