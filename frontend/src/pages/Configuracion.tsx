import { useEffect, useState } from 'react'
import { configApi } from '../services/api'
import toast from 'react-hot-toast'
import { Store, CreditCard, Map, Save, Eye, EyeOff, ExternalLink, ShieldCheck } from 'lucide-react'
import ConfigLocal from './ConfigLocal'
import MercadoPago from './MercadoPago'

const inp = 'w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300'

function GoogleMaps() {
  const [cfg, setCfg] = useState<any>({})
  const [ver, setVer] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  const cargar = () => {
    configApi.get()
      .then(({ data }) => setCfg(data || {}))
      .catch(() => toast.error('No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, [])

  const guardar = async () => {
    setGuardando(true)
    try {
      await configApi.set({ google_maps_api_key: cfg.google_maps_api_key || '' })
      toast.success('Llave guardada')
      cargar()
    } catch { toast.error('No se pudo guardar') }
    finally { setGuardando(false) }
  }

  const tiene = !!(cfg.google_maps_api_key || '').trim()

  if (cargando) return <div className="py-16 text-center text-gray-400">Cargando…</div>

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Llave de Google Maps</h2>
          <span className={`text-xs px-2.5 py-1 rounded-full ${tiene ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {tiene ? 'Configurada' : 'Sin configurar'}
          </span>
        </div>

        <p className="text-sm text-gray-600">
          Se usa para ubicar direcciones con precisión y para calcular el recorrido real por calle.
          El mapa que ves en pantalla y la navegación del conductor no la usan, así que no generan costo.
        </p>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Clave de API</label>
          <div className="flex gap-2">
            <input type={ver ? 'text' : 'password'} className={inp} placeholder="AIza…"
                   value={cfg.google_maps_api_key || ''}
                   onChange={e => setCfg({ ...cfg, google_maps_api_key: e.target.value })} />
            <button type="button" onClick={() => setVer(!ver)} className="px-3 border rounded-lg text-gray-500">
              {ver ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button onClick={guardar} disabled={guardando}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
          <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar llave'}
        </button>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <ShieldCheck size={16} className="text-gray-400" /> Cómo obtenerla y protegerla
        </h3>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal pl-5">
          <li>En la consola de Google Cloud, crea un proyecto y activa la facturación con tu tarjeta.</li>
          <li>En APIs y servicios, habilita <b>Geocoding API</b> y <b>Routes API</b>.</li>
          <li>En Credenciales, crea una clave de API y pégala arriba.</li>
          <li>
            <b>Importante:</b> en cada API pon una <b>cuota diaria</b> (por ejemplo 200 solicitudes).
            Las alertas de presupuesto avisan después de gastar; solo la cuota detiene el consumo.
          </li>
        </ol>
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer"
           className="inline-flex items-center gap-1.5 text-sm" style={{ color: '#E8177A' }}>
          Abrir la consola de Google Cloud <ExternalLink size={13} />
        </a>
        <p className="text-xs text-gray-400">
          Tu volumen queda muy por debajo de los 10.000 eventos mensuales gratuitos de cada servicio.
        </p>
      </div>
    </div>
  )
}

const TABS = [
  { id: 'local',  label: 'Local',        icon: Store },
  { id: 'mp',     label: 'Mercado Pago', icon: CreditCard },
  { id: 'google', label: 'Google Maps',  icon: Map },
]

export default function Configuracion() {
  const [tab, setTab] = useState('local')
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>

      <div className="flex gap-2 border-b overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const activo = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
                      activo ? 'text-gray-900' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    style={activo ? { borderColor: '#E8177A' } : {}}>
              <Icon size={16} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'local'  && <ConfigLocal />}
      {tab === 'mp'     && <MercadoPago />}
      {tab === 'google' && <GoogleMaps />}
    </div>
  )
}
