import { useEffect, useState } from 'react'
import { configApi } from '../services/api'
import toast from 'react-hot-toast'
import { Save, Eye, EyeOff, Copy, Bot } from 'lucide-react'

// SofIA 2.0 corre en el edge function ladys-sofia2 y saca sus credenciales de
// la tabla configuracion, no del código. Sin esta pantalla no había dónde
// pegarlas: había que entrar a la base a mano.
const inp = 'w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300'
const WEBHOOK = 'https://vhjsizkbmabznupkfzji.supabase.co/functions/v1/ladys-sofia2/mensaje'

export default function ConfigSofia() {
  const [cfg, setCfg] = useState<any>({})
  const [ver, setVer] = useState<Record<string, boolean>>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    configApi.get()
      .then(({ data }) => setCfg(data || {}))
      .catch(() => toast.error('No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, [])

  const guardar = async (extra: Record<string, string> = {}) => {
    setGuardando(true)
    try {
      await configApi.set({
        anthropic_api_key: cfg.anthropic_api_key || '',
        ghl_pit: cfg.ghl_pit || '',
        ghl_location_id: cfg.ghl_location_id || '',
        ...extra,
      })
      toast.success('Guardado')
      cargar()
    } catch { toast.error('No se pudo guardar') }
    finally { setGuardando(false) }
  }

  const tiene = (k: string) => !!String(cfg[k] || '').trim()
  const activa = String(cfg.sofia_activa || 'false') === 'true'
  const lista = tiene('anthropic_api_key') && tiene('ghl_pit') && tiene('ghl_location_id')

  const encender = async () => {
    if (!activa && !lista) return toast.error('Faltan credenciales: no se puede encender')
    await guardar({ sofia_activa: activa ? 'false' : 'true' })
  }

  const campo = (clave: string, label: string, ayuda: string, ph: string) => (
    <div>
      <label className="text-xs text-gray-600 mb-1 block">{label}</label>
      <div className="flex gap-2">
        <input type={ver[clave] ? 'text' : 'password'} className={inp} placeholder={ph}
               value={cfg[clave] || ''} onChange={e => setCfg({ ...cfg, [clave]: e.target.value })} />
        <button type="button" onClick={() => setVer({ ...ver, [clave]: !ver[clave] })}
                className="px-3 border rounded-lg text-gray-500">
          {ver[clave] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1">{ayuda}</p>
    </div>
  )

  if (cargando) return <div className="py-16 text-center text-gray-400">Cargando…</div>

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Bot size={17} /> SofIA 2.0</h2>
          <span className={`text-xs px-2.5 py-1 rounded-full ${activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {activa ? 'Respondiendo' : 'Apagada'}
          </span>
        </div>

        <p className="text-sm text-gray-600">
          El agente vive en nuestro sistema y consulta los pedidos de verdad. GHL sigue siendo
          el canal de WhatsApp y la bandeja de Alexandra. Mientras esté apagada no responde
          nada, aunque las llaves estén cargadas.
        </p>

        {campo('anthropic_api_key', 'Clave de Anthropic',
               'console.anthropic.com → API Keys. Es lo que le paga el pensamiento a SofIA.', 'sk-ant-…')}
        {campo('ghl_pit', 'Token privado de GHL (PIT)',
               'GHL → Settings → Private Integrations, con permisos de conversaciones y contactos. Es lo que le permite responder por WhatsApp.', 'pit-…')}

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Location ID de GHL</label>
          <input className={inp} value={cfg.ghl_location_id || ''}
                 onChange={e => setCfg({ ...cfg, ghl_location_id: e.target.value })} />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={() => guardar()} disabled={guardando}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            <Save size={15} /> {guardando ? 'Guardando…' : 'Guardar credenciales'}
          </button>
          <button onClick={encender} disabled={guardando || (!activa && !lista)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-40 ${
                    activa ? 'border-red-200 text-red-600' : 'border-green-300 text-green-700'}`}>
            {activa ? 'Apagar SofIA' : 'Encender SofIA'}
          </button>
        </div>

        {!lista && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Falta{[!tiene('anthropic_api_key') && ' la clave de Anthropic',
                   !tiene('ghl_pit') && ' el token de GHL'].filter(Boolean).join(' y')}.
            Hasta tenerlas, el botón de encender queda bloqueado.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-3">
        <h2 className="font-semibold text-gray-800">Dirección para el webhook de GHL</h2>
        <p className="text-sm text-gray-600">
          En GHL, el workflow que escucha los mensajes entrantes tiene que hacer un POST acá.
          Esta es la puerta por la que le llegan los mensajes a SofIA.
        </p>
        <div className="flex gap-2">
          <input readOnly value={WEBHOOK} className={inp + ' bg-gray-50 text-xs'}
                 onFocus={e => e.currentTarget.select()} />
          <button onClick={() => { navigator.clipboard.writeText(WEBHOOK); toast.success('Copiado') }}
                  className="px-3 border rounded-lg text-gray-500"><Copy size={16} /></button>
        </div>
        <p className="text-xs text-gray-400">
          Antes de encenderla hay que apagar la SofIA vieja en GHL (Conversation AI). Dos agentes
          respondiendo el mismo WhatsApp es peor que uno solo.
        </p>
      </div>
    </div>
  )
}
