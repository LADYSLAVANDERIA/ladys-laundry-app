import { useEffect, useRef, useState } from 'react'
import { etapasApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  Camera, CameraOff, Check, AlertTriangle, Package, Droplets,
  Wind, Truck, Store, Keyboard, MessageCircle,
} from 'lucide-react'

// La etapa la define la estación: se elige una vez y se escanea sin volver a tocar nada.
const ESTACIONES = [
  { id: 'EN_LAVADO', txt: 'Lavado',   icon: Droplets, color: '#4AAEE0' },
  { id: 'EN_SECADO', txt: 'Secado',   icon: Wind,     color: '#A87BC8' },
  { id: 'EMBOLSADO', txt: 'Doblado y embalado', icon: Package, color: '#E8177A' },
  { id: 'ENTREGADO', txt: 'Entrega en local',   icon: Store,   color: '#16a34a' },
]

declare global { interface Window { Html5Qrcode: any } }
function cargarLector(): Promise<any> {
  if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode)
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
    s.onload = () => res(window.Html5Qrcode); s.onerror = rej
    document.head.appendChild(s)
  })
}

export default function Produccion() {
  const [estacion, setEstacion] = useState('EN_LAVADO')
  const [camara, setCamara] = useState(false)
  const [manual, setManual] = useState('')
  const [hechos, setHechos] = useState<any[]>([])
  const [bultos, setBultos] = useState<any>(null)   // pedido esperando cantidad de bultos
  const lector = useRef<any>(null)
  const ultimo = useRef<{ cod: string; t: number }>({ cod: '', t: 0 })

  const est = ESTACIONES.find(e => e.id === estacion)!

  const marcar = async (codigo: string, nBultos?: number) => {
    // el lector dispara varias veces el mismo código: ignoramos repeticiones seguidas
    const ahora = Date.now()
    if (codigo === ultimo.current.cod && ahora - ultimo.current.t < 3000) return
    ultimo.current = { cod: codigo, t: ahora }

    try {
      const { data } = await etapasApi.marcar({ codigo, etapa: estacion, bultos: nBultos })
      if (navigator.vibrate) navigator.vibrate(data.repetida ? [40, 60, 40] : 60)
      if (data.aviso) toast(data.aviso, { icon: '⚠️' })
      else toast.success(`${data.cliente} · ${est.txt}`)
      setHechos(h => [{ ...data, hora: new Date() }, ...h].slice(0, 20))
      // al embalar preguntamos los bultos, que es el dato que se pierde si no se pide aquí
      if (estacion === 'EMBOLSADO' && nBultos == null) setBultos(data)
    } catch (e: any) {
      if (navigator.vibrate) navigator.vibrate([80, 50, 80])
      toast.error(e?.response?.data?.error || 'No se pudo marcar')
    }
  }

  const abrirCamara = async () => {
    try {
      const H = await cargarLector()
      lector.current = new H('lector')
      await lector.current.start({ facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (txt: string) => marcar(txt), () => {})
      setCamara(true)
    } catch { toast.error('No pudimos abrir la cámara. Revisa el permiso.') }
  }
  const cerrarCamara = async () => {
    try { await lector.current?.stop(); lector.current?.clear() } catch { /* ya estaba cerrada */ }
    setCamara(false)
  }
  useEffect(() => () => { try { lector.current?.stop() } catch { /* al salir */ } }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Producción</h1>
        <a href="#/estacion" className="text-sm px-4 py-2 rounded-xl text-white"
           style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
          Modo estación (pantalla completa)
        </a>
      </div>

      <div className="bg-white rounded-2xl border p-4">
        <p className="text-xs text-gray-500 mb-2">¿En qué estación estás?</p>
        <div className="grid grid-cols-4 gap-2">
          {ESTACIONES.map(e => {
            const Icon = e.icon
            const activa = estacion === e.id
            return (
              <button key={e.id} onClick={() => setEstacion(e.id)}
                      className={`py-3 rounded-xl text-xs font-medium flex flex-col items-center gap-1.5 border-2 ${
                        activa ? 'text-white' : 'text-gray-500 border-transparent bg-gray-50'}`}
                      style={activa ? { background: e.color, borderColor: e.color } : {}}>
                <Icon size={18} /> {e.txt}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b">
          <span className="text-sm font-medium text-gray-700">
            Escaneando a <b style={{ color: est.color }}>{est.txt}</b>
          </span>
          <button onClick={() => (camara ? cerrarCamara() : abrirCamara())}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs"
                  style={{ background: camara ? '#dc2626' : est.color }}>
            {camara ? <><CameraOff size={14} /> Detener</> : <><Camera size={14} /> Abrir cámara</>}
          </button>
        </div>

        <div id="lector" style={{ display: camara ? 'block' : 'none' }} />

        {!camara && (
          <div className="p-8 text-center text-gray-400 text-sm">
            <Camera size={30} className="mx-auto mb-2 opacity-40" />
            Abre la cámara y apunta al código del pedido
          </div>
        )}

        <div className="p-3 border-t flex gap-2">
          <div className="flex-1 flex items-center gap-2 border rounded-xl px-3">
            <Keyboard size={15} className="text-gray-400" />
            <input value={manual} onChange={e => setManual(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter' && manual.trim()) { marcar(manual.trim()); setManual('') } }}
                   placeholder="o escribe el número de pedido"
                   className="flex-1 py-2.5 text-sm outline-none" inputMode="numeric" />
          </div>
          <button onClick={() => { if (manual.trim()) { marcar(manual.trim()); setManual('') } }}
                  className="px-4 rounded-xl text-white text-sm" style={{ background: est.color }}>
            Marcar
          </button>
        </div>
      </div>

      {!!hechos.length && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <p className="px-4 py-2.5 text-xs text-gray-500 border-b">Marcados en esta sesión</p>
          <div className="divide-y max-h-80 overflow-y-auto">
            {hechos.map((h, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                {h.repetida
                  ? <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                  : <Check size={15} className="text-green-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">
                    <b>#{h.orden_id}</b> {h.cliente}
                  </p>
                  <p className="text-xs text-gray-400">
                    {h.etapa_anterior} → {h.etapa}
                    {h.entrega_domicilio && ' · va a domicilio'}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {h.hora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Al embalar: cuántos bultos y, si el cliente lo espera, el aviso */}
      {bultos && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div>
              <p className="font-semibold text-gray-800">Pedido #{bultos.orden_id}</p>
              <p className="text-sm text-gray-500">{bultos.cliente}</p>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">¿Cuántos bultos?</label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n}
                          onClick={() => { etapasApi.marcar({ orden_id: bultos.orden_id, etapa: 'EMBOLSADO', bultos: n }); setBultos({ ...bultos, n }) }}
                          className={`py-3 rounded-xl border text-sm font-medium ${bultos.n === n ? 'text-white' : 'text-gray-600'}`}
                          style={bultos.n === n ? { background: '#E8177A', borderColor: '#E8177A' } : {}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <a href={`#/ordenes/${bultos.orden_id}`}
               className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border text-sm text-gray-600">
              <MessageCircle size={15} /> Abrir el pedido para avisarle al cliente
            </a>
            <button onClick={() => setBultos(null)}
                    className="w-full py-3 rounded-xl text-white text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              Listo, seguir escaneando
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
