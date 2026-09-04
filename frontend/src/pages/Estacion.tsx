import { useEffect, useRef, useState } from 'react'
import { etapasApi } from '../services/api'
import {
  Camera, Check, X, Package, Droplets, Wind, Truck, Store,
  Settings, Keyboard, Sun,
} from 'lucide-react'

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

// Un pitido corto: en el taller no siempre se puede mirar la pantalla
function pitar(ok: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = ok ? 880 : 240
    g.gain.setValueAtTime(0.18, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.18 : 0.45))
    o.start(); o.stop(ctx.currentTime + (ok ? 0.2 : 0.5))
  } catch { /* sin audio, quedan la vibración y el color */ }
}

export default function Estacion() {
  const [estacion, setEstacion] = useState(() => localStorage.getItem('ladys-estacion') || 'EN_LAVADO')
  const [elegir, setElegir] = useState(!localStorage.getItem('ladys-estacion'))
  const [flash, setFlash] = useState<any>(null)
  const [hechos, setHechos] = useState<any[]>([])
  const [manual, setManual] = useState('')
  const [listo, setListo] = useState(false)
  const [pidiendoBultos, setPidiendoBultos] = useState<any>(null)

  const lector = useRef<any>(null)
  const wake = useRef<any>(null)
  const ultimo = useRef<{ cod: string; t: number }>({ cod: '', t: 0 })
  const est = ESTACIONES.find(e => e.id === estacion)!

  const marcar = async (codigo: string, nBultos?: number) => {
    const ahora = Date.now()
    if (codigo === ultimo.current.cod && ahora - ultimo.current.t < 3500) return
    ultimo.current = { cod: codigo, t: ahora }
    try {
      const { data } = await etapasApi.marcar({ codigo, etapa: estacion, bultos: nBultos })
      const alerta = data.repetida || data.retrocede
      pitar(!alerta)
      navigator.vibrate?.(alerta ? [60, 80, 60] : 70)
      setFlash({ ok: !alerta, ...data })
      setHechos(h => [{ ...data, hora: new Date() }, ...h].slice(0, 40))
      if (estacion === 'EMBOLSADO' && nBultos == null && !data.repetida) setPidiendoBultos(data)
      setTimeout(() => setFlash(null), 2200)
    } catch (e: any) {
      pitar(false)
      navigator.vibrate?.([90, 60, 90])
      setFlash({ ok: false, error: e?.response?.data?.error || 'No se pudo marcar' })
      setTimeout(() => setFlash(null), 2800)
    }
  }

  // La cámara arranca sola y no se apaga: el teléfono queda fijo en el puesto.
  const encender = async () => {
    try {
      const H = await cargarLector()
      if (lector.current) { try { await lector.current.stop() } catch { /* ya estaba */ } }
      lector.current = new H('lector-estacion')
      await lector.current.start({ facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (txt: string) => marcar(txt), () => {})
      try { wake.current = await (navigator as any).wakeLock?.request('screen') } catch { /* opcional */ }
      setListo(true)
    } catch {
      setFlash({ ok: false, error: 'No pude abrir la cámara. Revisa el permiso del navegador.' })
    }
  }

  useEffect(() => { if (!elegir) encender() }, [elegir, estacion])
  useEffect(() => () => { try { lector.current?.stop(); wake.current?.release?.() } catch { /* al salir */ } }, [])

  // si la pantalla se durmió y vuelve, recupera el bloqueo de pantalla
  useEffect(() => {
    const v = async () => {
      if (document.visibilityState === 'visible' && !wake.current) {
        try { wake.current = await (navigator as any).wakeLock?.request('screen') } catch { /* nada */ }
      }
    }
    document.addEventListener('visibilitychange', v)
    return () => document.removeEventListener('visibilitychange', v)
  }, [])

  const cambiar = (id: string) => {
    localStorage.setItem('ladys-estacion', id)
    setEstacion(id); setElegir(false); setHechos([])
  }

  // ── elección de estación: se hace una vez y queda guardada en ese teléfono ──
  if (elegir) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-5 flex flex-col justify-center">
        <h1 className="text-2xl font-bold mb-1">¿Qué estación es este teléfono?</h1>
        <p className="text-gray-400 text-sm mb-6">Queda guardado. Solo se pregunta una vez.</p>
        <div className="grid grid-cols-2 gap-3">
          {ESTACIONES.map(e => {
            const Icon = e.icon
            return (
              <button key={e.id} onClick={() => cambiar(e.id)}
                      className="py-8 rounded-2xl font-bold text-lg flex flex-col items-center gap-3"
                      style={{ background: e.color }}>
                <Icon size={34} /> {e.txt}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: est.color }}>
        <div className="flex items-center gap-2">
          <est.icon size={22} />
          <div>
            <p className="font-bold text-lg leading-tight">{est.txt}</p>
            <p className="text-xs opacity-90">{hechos.length} pedidos en esta jornada</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {listo && <Sun size={16} className="opacity-70" />}
          <button onClick={() => setElegir(true)} className="p-2 rounded-lg bg-black/20"><Settings size={18} /></button>
        </div>
      </div>

      <div className="relative flex-1">
        <div id="lector-estacion" className="w-full" />
        {!listo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Camera size={40} />
            <p className="text-sm">Abriendo la cámara…</p>
            <button onClick={encender} className="px-4 py-2 rounded-xl bg-white/10 text-sm">Reintentar</button>
          </div>
        )}

        {/* Aviso grande: se tiene que leer a un metro de distancia */}
        {flash && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-20"
               style={{ background: flash.ok ? 'rgba(22,163,74,.96)' : 'rgba(220,38,38,.96)' }}>
            {flash.ok ? <Check size={80} /> : <X size={80} />}
            {flash.error ? (
              <p className="text-2xl font-bold mt-3">{flash.error}</p>
            ) : (
              <>
                <p className="text-3xl font-extrabold mt-3">#{flash.orden_id}</p>
                <p className="text-xl mt-1">{flash.cliente}</p>
                <p className="text-base opacity-90 mt-2">
                  {flash.aviso ? flash.aviso
                    : flash.destino === 'LISTO_DESPACHO' ? 'A estantería · sale a domicilio'
                    : flash.destino === 'LISTO_RETIRO' ? 'A estantería · retira en local'
                    : `Pasó a ${est.txt}`}
                </p>
                {flash.entrega_domicilio && (
                  <p className="mt-3 px-3 py-1 rounded-full bg-black/25 text-sm flex items-center gap-1.5">
                    <Truck size={14} /> Va a domicilio
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-800 flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-gray-700 rounded-xl px-3">
          <Keyboard size={16} className="text-gray-400" />
          <input value={manual} onChange={e => setManual(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter' && manual.trim()) { marcar(manual.trim()); setManual('') } }}
                 placeholder="Número de pedido"
                 className="flex-1 py-2.5 bg-transparent text-sm outline-none text-white" inputMode="numeric" />
        </div>
        <button onClick={() => { if (manual.trim()) { marcar(manual.trim()); setManual('') } }}
                className="px-4 rounded-xl text-white text-sm font-medium" style={{ background: est.color }}>
          Marcar
        </button>
      </div>

      {!!hechos.length && (
        <div className="bg-gray-800 max-h-40 overflow-y-auto divide-y divide-gray-700">
          {hechos.slice(0, 10).map((h, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-2 text-sm">
              {h.repetida || h.retrocede
                ? <X size={13} className="text-amber-400 shrink-0" />
                : <Check size={13} className="text-green-400 shrink-0" />}
              <span className="text-gray-300 truncate flex-1">#{h.orden_id} {h.cliente}</span>
              <span className="text-gray-500 text-xs">
                {h.hora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bultos: botones enormes, para resolverlo de un toque y seguir */}
      {pidiendoBultos && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-5">
          <div className="bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Pedido #{pidiendoBultos.orden_id}</p>
              <p className="font-bold text-lg">¿Cuántos bultos?</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button key={n}
                        onClick={() => {
                          etapasApi.marcar({ orden_id: pidiendoBultos.orden_id, etapa: 'EMBOLSADO', bultos: n })
                          setPidiendoBultos(null)
                        }}
                        className="py-6 rounded-xl text-2xl font-bold" style={{ background: '#E8177A' }}>
                  {n}
                </button>
              ))}
            </div>
            <button onClick={() => setPidiendoBultos(null)}
                    className="w-full py-3 rounded-xl bg-gray-700 text-sm text-gray-300">
              Saltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
