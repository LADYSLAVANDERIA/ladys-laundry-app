import { useEffect, useRef, useState } from 'react'
import { repartoApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  Wand2, ChevronUp, ChevronDown, Navigation, Route, Clock, GripVertical,
  AlertTriangle, Check, X, Smartphone, RefreshCw, Package,
} from 'lucide-react'
import { rutaCompletaMaps } from '../utils'
import { cargarGoogle, ESTILO, pin } from '../lib/google'

const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
const plata = (n: any) => '$' + Number(n || 0).toLocaleString('es-CL')
const hhmm = (t: any) => (t ? String(t).slice(0, 5) : '—')

const nombreDe = (p: any) => (p.es_empresa && p.razon_social)
  ? p.razon_social : [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Sin nombre'
const dirDe = (p: any) => [p.calle, p.depto, p.sector, p.ciudad].filter(Boolean).join(', ') || 'Sin dirección'

export default function Reparto() {
  const [fecha, setFecha] = useState(hoy())
  const [inicio, setInicio] = useState('19:00')
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const [encima, setEncima] = useState<number | null>(null)
  const [data, setData] = useState<any>(null)
  const [paradas, setParadas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [optimizando, setOptimizando] = useState(false)
  const [resumen, setResumen] = useState<any>(null)

  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<any>(null)
  const capa = useRef<any[]>([])   // marcadores y trazado, para poder limpiarlos
  const globo = useRef<any>(null)

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
    cargarGoogle().then(g => {
      if (!mapa.current) {
        mapa.current = new g.maps.Map(div.current!, {
          center: { lat: -32.9337, lng: -71.5322 }, zoom: 13, styles: ESTILO,
          mapTypeControl: false, streetViewControl: false, gestureHandling: 'greedy',
        })
        globo.current = new g.maps.InfoWindow()
      }
      capa.current.forEach((x: any) => x.setMap(null))
      capa.current = []

      const base = data?.base
      const caja = new g.maps.LatLngBounds()
      let cuantos = 0

      if (base) {
        const m = new g.maps.Marker({
          position: { lat: base.lat, lng: base.lng }, map: mapa.current,
          icon: pin('L', '#1F2430'), title: 'Local Ladys', zIndex: 50,
        })
        m.addListener('click', () => {
          globo.current.setContent('<b>Local Ladys</b>'); globo.current.open(mapa.current, m)
        })
        capa.current.push(m); caja.extend({ lat: base.lat, lng: base.lng }); cuantos++
      }

      paradas.filter(p => p.lat && p.lng).forEach(p => {
        const color = p.estado === 'COMPLETADA' ? '#16a34a'
          : p.estado === 'FALLIDA' ? '#dc2626'
          : p.tipo === 'RETIRO' ? '#4AAEE0' : '#E8177A'
        const m = new g.maps.Marker({
          position: { lat: p.lat, lng: p.lng }, map: mapa.current,
          icon: pin(String(p.secuencia || '.'), color), title: nombreDe(p),
        })
        m.addListener('click', () => {
          globo.current.setContent(
            `<div style="font-size:13px;line-height:1.4"><b>${p.secuencia ? p.secuencia + '. ' : ''}` +
            `${nombreDe(p)}</b><br>${dirDe(p)}<br><small>` +
            `${p.tipo === 'RETIRO' ? 'Retiro' : 'Entrega'} &middot; ~${hhmm(p.hora_estimada)}</small></div>`)
          globo.current.open(mapa.current, m)
        })
        capa.current.push(m); caja.extend({ lat: p.lat, lng: p.lng }); cuantos++
      })

      const enRuta = paradas.filter(p => p.lat && p.lng && p.secuencia)
        .sort((a, b) => a.secuencia - b.secuencia).map(p => ({ lat: p.lat, lng: p.lng }))
      if (enRuta.length && base) {
        capa.current.push(new g.maps.Polyline({
          path: [{ lat: base.lat, lng: base.lng }, ...enRuta, { lat: base.lat, lng: base.lng }],
          map: mapa.current, strokeColor: '#A87BC8', strokeOpacity: 0, strokeWeight: 3,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 3 },
                    offset: '0', repeat: '12px' }],
        }))
      }
      if (cuantos > 1) mapa.current.fitBounds(caja, 35)
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

  const guardarOrden = async (copia: any[]) => {
    copia.forEach((p, k) => (p.secuencia = k + 1))
    setParadas(copia)
    try { await repartoApi.reordenar(copia.map(p => p.id)) }
    catch { toast.error('No se pudo guardar el orden'); cargar() }
  }

  const mover = (i: number, dir: number) => {
    const j = i + dir
    if (j < 0 || j >= paradas.length) return
    const copia = [...paradas]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    guardarOrden(copia)
  }

  // Arrastrar y soltar para reordenar la ruta.
  // La parada se saca de su posicion y se inserta en la nueva, en vez de
  // intercambiarla con la de destino: mover la parada 5 al primer lugar debe
  // empujar al resto hacia abajo, no cambiarla de puesto con la que estaba ahi.
  const soltarEn = (destino: number) => {
    const origen = arrastrando
    setArrastrando(null); setEncima(null)
    if (origen === null || origen === destino) return
    const copia = [...paradas]
    const [p] = copia.splice(origen, 1)
    copia.splice(destino, 0, p)
    guardarOrden(copia)
  }

  // toda la ruta abierta de una vez en el navegador del teléfono
  const linkRutaCompleta = () => {
    // Las paradas sin coordenadas también van: se mandan por dirección escrita.
    // Antes se descartaban y la ruta salía incompleta sin avisar.
    const enRuta = paradas.filter(p => p.estado === 'PENDIENTE')
      .sort((a, b) => a.secuencia - b.secuencia)
      .map(p => (p.lat && p.lng) ? `${p.lat},${p.lng}` : dirDe(p))
      .filter(Boolean)
    if (!enRuta.length) return ''
    return rutaCompletaMaps(enRuta)
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

      {!cargando && paradas.some(p => !p.secuencia) && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 border"
             style={{ background: '#FFF7E6', borderColor: '#F5C26B' }}>
          <AlertTriangle size={18} style={{ color: '#B7791F' }} className="shrink-0 mt-0.5" />
          <div className="text-sm" style={{ color: '#7A5A17' }}>
            <b>La ruta no está ordenada.</b> Hay {paradas.filter(p => !p.secuencia).length} parada(s)
            sin posición: el conductor las vería en orden de número de pedido, no por cercanía.
            Aprieta <b>Armar recorrido</b> antes de que salga.
          </div>
        </div>
      )}

      {resumen?.rutas?.length > 1 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {resumen.rutas.map((r: any) => (
            <div key={r.ruta_id ?? r.ruta} className="bg-white border rounded-xl px-3 py-2.5">
              <p className="text-sm font-semibold text-gray-700">{r.ruta}</p>
              <p className="text-xs text-gray-500">
                Sale {r.salida} · vuelve {r.termina} · {r.paradas} parada(s) · {r.km} km
              </p>
            </div>
          ))}
        </div>
      )}

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
            {paradas.length > 1 && (
              <span className="ml-2 font-normal text-xs text-gray-400">
                arrastra para cambiar el orden
              </span>
            )}
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
              <div key={p.id}>
              {(i === 0 || paradas[i - 1].ruta_id !== p.ruta_id) && (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-y">
                  <span className="text-xs font-semibold text-gray-600">
                    {p.ruta_nombre || 'Sin ruta asignada'}
                  </span>
                  <span className="text-[11px] text-gray-500 flex items-center gap-2">
                    {paradas.filter(x => x.ruta_id === p.ruta_id).length} parada(s)
                    {(() => {
                      // Lo que hay que subir a la camioneta para esta ruta: solo
                      // cuentan las entregas, porque los retiros vienen vacios.
                      const carga = paradas
                        .filter(x => x.ruta_id === p.ruta_id && x.tipo === 'ENTREGA' && x.estado !== 'COMPLETADA')
                        .reduce((t, x) => t + (Number(x.bultos) || 0), 0)
                      return carga > 0 ? (
                        <span className="font-semibold text-gray-700 flex items-center gap-1">
                          <Package size={12} /> cargar {carga} bulto{carga > 1 ? 's' : ''}
                        </span>
                      ) : null
                    })()}
                  </span>
                </div>
              )}
              <div
                   draggable
                   onDragStart={() => setArrastrando(i)}
                   onDragEnd={() => { setArrastrando(null); setEncima(null) }}
                   onDragOver={e => { e.preventDefault(); if (encima !== i) setEncima(i) }}
                   onDrop={e => { e.preventDefault(); soltarEn(i) }}
                   className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                     arrastrando === i ? 'opacity-40' : ''} ${
                     encima === i && arrastrando !== null && arrastrando !== i
                       ? 'bg-pink-50 border-t-2 border-pink-400' : ''}`}>
                <div className="flex items-center gap-1 shrink-0">
                  <GripVertical size={18} className="text-gray-300 cursor-grab active:cursor-grabbing" />
                  {/* las flechas quedan para el telefono, donde arrastrar es incomodo */}
                  <div className="flex flex-col sm:hidden">
                    <button onClick={() => mover(i, -1)} disabled={i === 0}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={16} /></button>
                    <button onClick={() => mover(i, 1)} disabled={i === paradas.length - 1}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={16} /></button>
                  </div>
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
                    {p.tipo === 'ENTREGA' && Number(p.bultos) > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 flex items-center gap-1">
                        <Package size={11} /> {p.bultos} bulto{Number(p.bultos) > 1 ? 's' : ''}
                        {Number(p.kilos) > 0 ? ` · ${p.kilos} kg` : ''}
                      </span>
                    )}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
