import { useEffect, useRef, useState } from 'react'
import { repartoApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  Wand2, ChevronUp, ChevronDown, Navigation, Route, Clock,
  AlertTriangle, Check, X, Smartphone, RefreshCw,
} from 'lucide-react'

const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
const plata = (n: any) => '$' + Number(n || 0).toLocaleString('es-CL')
const hhmm = (t: any) => (t ? String(t).slice(0, 5) : '—')

declare global { interface Window { L: any } }
function cargarLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L)
  return new Promise((res, rej) => {
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link')
      css.id = 'leaflet-css'; css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(css)
    }
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => res(window.L); s.onerror = rej
    document.head.appendChild(s)
  })
}

const nombreDe = (p: any) => (p.es_empresa && p.razon_social)
  ? p.razon_social : [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Sin nombre'
const dirDe = (p: any) => [p.calle, p.depto, p.sector, p.ciudad].filter(Boolean).join(', ') || 'Sin dirección'

export default function Reparto() {
  const [fecha, setFecha] = useState(hoy())
  const [inicio, setInicio] = useState('16:00')
  const [data, setData] = useState<any>(null)
  const [paradas, setParadas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [optimizando, setOptimizando] = useState(false)
  const [resumen, setResumen] = useState<any>(null)

  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<any>(null)
  const capa = useRef<any>(null)

  const cargar = (f = fecha) => {
    setCargando(true)
    repartoApi.dia(f)
      .then(r => { setData(r.data); setParadas(r.data.paradas || []) })
      .catch(() => toast.error('No se pudo cargar el reparto'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar(fecha) }, [fecha])

  // ── mapa: pines numerados y el trazado del recorrido ──
  useEffect(() => {
    if (!div.current) return
    cargarLeaflet().then(L => {
      if (!mapa.current) {
        mapa.current = L.map(div.current!).setView([-32.9337, -71.5322], 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(mapa.current)
      }
      if (capa.current) capa.current.remove()
      capa.current = L.layerGroup().addTo(mapa.current)

      const base = data?.base
      const pts: any[] = []
      if (base) {
        L.marker([base.lat, base.lng], {
          icon: L.divIcon({
            className: '', iconSize: [30, 30], iconAnchor: [15, 15],
            html: `<div style="width:30px;height:30px;border-radius:50%;background:#1F2430;color:#fff;
              display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;
              border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">🏠</div>`,
          }),
        }).addTo(capa.current).bindPopup('Local Ladys')
        pts.push([base.lat, base.lng])
      }

      paradas.filter(p => p.lat && p.lng).forEach(p => {
        const color = p.estado === 'COMPLETADA' ? '#16a34a'
          : p.estado === 'FALLIDA' ? '#dc2626'
          : p.tipo === 'RETIRO' ? '#4AAEE0' : '#E8177A'
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: '', iconSize: [28, 28], iconAnchor: [14, 14],
            html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:#fff;
              display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
              border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${p.secuencia || '·'}</div>`,
          }),
        }).addTo(capa.current)
          .bindPopup(`<b>${p.secuencia ? p.secuencia + '. ' : ''}${nombreDe(p)}</b><br>${dirDe(p)}<br>
                      <small>${p.tipo === 'RETIRO' ? 'Retiro' : 'Entrega'} · ~${hhmm(p.hora_estimada)}</small>`)
        pts.push([p.lat, p.lng])
      })

      const enRuta = paradas.filter(p => p.lat && p.lng && p.secuencia)
        .sort((a, b) => a.secuencia - b.secuencia).map(p => [p.lat, p.lng])
      if (enRuta.length && base) {
        L.polyline([[base.lat, base.lng], ...enRuta, [base.lat, base.lng]],
          { color: '#A87BC8', weight: 3, opacity: .7, dashArray: '6,8' }).addTo(capa.current)
      }
      if (pts.length > 1) mapa.current.fitBounds(pts, { padding: [30, 30] })
    })
  }, [paradas, data])

  const optimizar = async () => {
    setOptimizando(true)
    try {
      const r = await repartoApi.optimizar(fecha, inicio)
      setResumen(r.data)
      toast.success(`Recorrido armado: ${r.data.ordenadas} paradas`)
      cargar()
    } catch { toast.error('No se pudo optimizar') }
    finally { setOptimizando(false) }
  }

  const mover = async (i: number, dir: number) => {
    const j = i + dir
    if (j < 0 || j >= paradas.length) return
    const copia = [...paradas]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    copia.forEach((p, k) => (p.secuencia = k + 1))
    setParadas(copia)
    try { await repartoApi.reordenar(copia.map(p => p.id)) }
    catch { toast.error('No se pudo guardar el orden'); cargar() }
  }

  // toda la ruta abierta de una vez en el navegador del teléfono
  const linkRutaCompleta = () => {
    const base = data?.base
    const enRuta = paradas.filter(p => p.lat && p.lng && p.estado === 'PENDIENTE')
      .sort((a, b) => a.secuencia - b.secuencia)
    if (!enRuta.length || !base) return '#'
    const wp = enRuta.slice(0, -1).map(p => `${p.lat},${p.lng}`).join('|')
    const fin = enRuta[enRuta.length - 1]
    return `https://www.google.com/maps/dir/?api=1&origin=${base.lat},${base.lng}` +
      `&destination=${fin.lat},${fin.lng}${wp ? `&waypoints=${wp}` : ''}&travelmode=driving`
  }

  const sinUbicar = paradas.filter(p => !p.lat).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Reparto del día</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                 className="border rounded-xl px-3 py-2 text-sm" />
          <input type="time" value={inicio} onChange={e => setInicio(e.target.value)}
                 className="border rounded-xl px-3 py-2 text-sm w-28" title="Hora de salida" />
          <button onClick={() => cargar()} className="p-2.5 rounded-xl border text-gray-600"><RefreshCw size={16} /></button>
          <button onClick={optimizar} disabled={optimizando || !paradas.length}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            <Wand2 size={16} /> {optimizando ? 'Calculando…' : 'Armar recorrido'}
          </button>
        </div>
      </div>

      {resumen && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1.5 bg-white border rounded-xl px-3 py-2">
            <Route size={15} className="text-gray-400" /> {resumen.km_total} km
          </span>
          <span className="flex items-center gap-1.5 bg-white border rounded-xl px-3 py-2">
            <Clock size={15} className="text-gray-400" /> {resumen.min_total} min estimados
          </span>
          <a href={linkRutaCompleta()} target="_blank" rel="noreferrer"
             className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-white"
             style={{ background: '#4AAEE0' }}>
            <Navigation size={15} /> Abrir la ruta en Google Maps
          </a>
        </div>
      )}

      {sinUbicar > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{sinUbicar} parada(s) sin dirección ubicada. Quedan fuera del recorrido: hay que
            ponerles el pin en la ficha del cliente para que entren.</span>
        </div>
      )}

      <div ref={div} className="rounded-2xl border overflow-hidden" style={{ height: 380 }} />

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="font-semibold text-gray-700">
            {paradas.length} parada(s){data ? ` · ${data.completadas} listas` : ''}
          </span>
          <a href="#/conductor" className="text-xs flex items-center gap-1.5 text-gray-500 hover:text-gray-700">
            <Smartphone size={14} /> Vista del conductor
          </a>
        </div>

        {cargando ? (
          <p className="p-8 text-center text-gray-400">Cargando…</p>
        ) : !paradas.length ? (
          <p className="p-8 text-center text-gray-400">No hay retiros ni entregas a domicilio para este día</p>
        ) : (
          <div className="divide-y">
            {paradas.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <button onClick={() => mover(i, -1)} disabled={i === 0}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={16} /></button>
                  <button onClick={() => mover(i, 1)} disabled={i === paradas.length - 1}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={16} /></button>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                     style={{ background: p.estado === 'COMPLETADA' ? '#16a34a'
                       : p.estado === 'FALLIDA' ? '#dc2626'
                       : p.tipo === 'RETIRO' ? '#4AAEE0' : '#E8177A' }}>
                  {p.secuencia || '·'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 truncate">{nombreDe(p)}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full text-white"
                          style={{ background: p.tipo === 'RETIRO' ? '#4AAEE0' : '#E8177A' }}>
                      {p.tipo === 'RETIRO' ? 'Retiro' : 'Entrega'}
                    </span>
                    {p.estado === 'COMPLETADA' && <Check size={14} className="text-green-600" />}
                    {p.estado === 'FALLIDA' && <X size={14} className="text-red-500" />}
                    {!p.lat && <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">sin ubicar</span>}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{dirDe(p)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-gray-700">{hhmm(p.hora_estimada)}</p>
                  {p.km_tramo && <p className="text-xs text-gray-400">{p.km_tramo} km</p>}
                  {Number(p.saldo_pendiente) > 0 &&
                    <p className="text-xs font-semibold text-amber-700">{plata(p.saldo_pendiente)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
