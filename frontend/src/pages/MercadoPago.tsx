import { useEffect, useState } from 'react'
import { configApi } from '../services/api'
import toast from 'react-hot-toast'
import { Save, Copy, CheckCircle2, AlertTriangle, RefreshCw, CreditCard, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { fmt, fechaHora } from '../utils'

const MP_URL = (import.meta.env.VITE_API_URL || '').replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-mercadopago')
const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300 font-mono'

export default function MercadoPago() {
  const [cfg, setCfg] = useState<any>({})
  const [salud, setSalud] = useState<any>(null)
  const [eventos, setEventos] = useState<any[]>([])
  const [ver, setVer] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const load = async () => {
    try {
      const { data } = await configApi.get()
      setCfg({ mp_access_token: data.mp_access_token || '', mp_webhook_secret: data.mp_webhook_secret || '', mp_auto_activar: data.mp_auto_activar ?? '1' })
      const r = await fetch(`${MP_URL}/salud`).then(x => x.json()).catch(() => null)
      setSalud(r)
      setEventos(r?.ultimo_evento ? [r.ultimo_evento] : [])
    } catch { toast.error('No se pudo cargar la configuración') }
  }
  useEffect(() => { load() }, [])

  const guardar = async () => {
    setGuardando(true)
    try { await configApi.set(cfg); toast.success('Credenciales guardadas'); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') } finally { setGuardando(false) }
  }

  const copiar = (t: string) => { navigator.clipboard.writeText(t); toast.success('Copiado') }
  const listo = !!salud?.token_cargado

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mercado Pago</h1>
        <p className="text-gray-500 text-sm">Activación automática de las suscripciones de El Club</p>
      </div>

      <div className={`rounded-2xl border p-4 flex items-start gap-3 ${listo ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        {listo ? <CheckCircle2 size={20} className="text-green-600 mt-0.5" /> : <AlertTriangle size={20} className="text-amber-600 mt-0.5" />}
        <div className="text-sm">
          <p className={`font-semibold ${listo ? 'text-green-700' : 'text-amber-700'}`}>
            {listo ? 'Conexión lista' : 'Falta cargar el Access Token'}
          </p>
          <p className={listo ? 'text-green-600' : 'text-amber-600'}>
            {listo ? 'Cuando alguien se suscriba, el plan se activa solo.' : 'Sin el token no podemos leer quién pagó.'}
            {salud?.firma_configurada ? ' Firma verificada.' : ' Sin clave secreta la firma no se valida.'}
          </p>
        </div>
      </div>

      {/* Paso 1 */}
      <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-3">
        <p className="font-semibold text-gray-700">1 · Pega la URL en Mercado Pago</p>
        <p className="text-sm text-gray-500">
          Entra a <a href="https://www.mercadopago.cl/developers/panel" target="_blank" rel="noreferrer" className="text-pink-600 font-medium inline-flex items-center gap-1">tu panel de desarrollador <ExternalLink size={11} /></a>,
          elige tu aplicación, abre <b>Webhooks</b> y pega esta dirección. Marca los eventos
          <b> Suscripciones</b>, <b>Pagos de suscripción</b> y <b>Pagos</b>.
        </p>
        <div className="flex gap-2">
          <input readOnly value={MP_URL} className={inp + ' bg-gray-50 text-xs'} />
          <button onClick={() => copiar(MP_URL)} className="px-3 rounded-xl bg-gray-100 text-gray-600"><Copy size={15} /></button>
        </div>
      </div>

      {/* Paso 2 */}
      <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-3">
        <p className="font-semibold text-gray-700">2 · Trae las credenciales</p>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Access Token de producción (empieza con APP_USR-)</label>
          <div className="flex gap-2">
            <input type={ver ? 'text' : 'password'} value={cfg.mp_access_token || ''} onChange={e => setCfg({ ...cfg, mp_access_token: e.target.value })}
              placeholder="APP_USR-..." className={inp} autoComplete="off" />
            <button onClick={() => setVer(!ver)} className="px-3 rounded-xl bg-gray-100 text-gray-600">{ver ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Panel → tu aplicación → Credenciales de producción.</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Clave secreta del webhook (opcional pero recomendada)</label>
          <input type={ver ? 'text' : 'password'} value={cfg.mp_webhook_secret || ''} onChange={e => setCfg({ ...cfg, mp_webhook_secret: e.target.value })}
            placeholder="Se genera al crear el webhook" className={inp} autoComplete="off" />
          <p className="text-[11px] text-gray-400 mt-1">Sirve para comprobar que el aviso viene de verdad de Mercado Pago.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={cfg.mp_auto_activar !== '0'} onChange={e => setCfg({ ...cfg, mp_auto_activar: e.target.checked ? '1' : '0' })} />
          Activar la membresía automáticamente al recibir el pago
        </label>
        <button onClick={guardar} disabled={guardando} className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
          <Save size={15} className="inline mr-1.5" /> {guardando ? 'Guardando…' : 'Guardar credenciales'}
        </button>
      </div>

      {/* Estado */}
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-700 flex items-center gap-2"><CreditCard size={16} className="text-pink-500" /> Último aviso recibido</p>
          <button onClick={load} className="p-2 rounded-lg bg-gray-100 text-gray-500"><RefreshCw size={14} /></button>
        </div>
        {eventos.length ? eventos.map((e, i) => (
          <div key={i} className="border rounded-xl p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{e.tipo}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${['ACTIVADA', 'RENOVADA'].includes(e.resultado) ? 'bg-green-100 text-green-700' : e.resultado === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{e.resultado}</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">{e.detalle}</p>
            <p className="text-gray-300 text-[11px]">{fechaHora(e.creado_en)}</p>
          </div>
        ) ) : <p className="text-sm text-gray-400">Todavía no llega ningún aviso de Mercado Pago.</p>}
      </div>

      <div className="bg-gray-50 border rounded-2xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-600">Cómo reconoce al cliente</p>
        <p>Busca por el correo del pagador; si no lo encuentra, por el teléfono. Si no existe, crea la ficha nueva con los datos de Mercado Pago.</p>
        <p>El plan lo identifica por el monto: {fmt(75000)}, {fmt(100000)}, {fmt(150000)} o {fmt(200000)}. Cada mes que Mercado Pago cobre la cuota, el cupo de kilos se renueva solo.</p>
      </div>
    </div>
  )
}
