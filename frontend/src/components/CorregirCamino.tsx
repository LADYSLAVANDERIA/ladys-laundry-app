// CORREGIR CAMINO A MANO (26-sep-2026, bitácora 203).
//
// Google a veces manda a la conductora por un camino absurdo: la avenida tiene
// bandejón y el punto del cliente quedó en la pista contraria, o elige calles que
// en la práctica no sirven. Aquí se corrige sobre el mapa de Ruta en vivo:
//   - tocar el mapa agrega un punto por donde TIENE que pasar (se pueden arrastrar;
//     tocar un punto lo borra),
//   - la bandera es el punto de llegada: se arrastra a la pista o entrada correcta.
// El camino nuevo se ve antes de guardar. Se guarda en la DIRECCIÓN del cliente,
// así vale para esta visita y las siguientes. La navegación de la conductora
// (ladys-navegacion) lo toma en su siguiente cálculo.
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { rutaCallesApi } from '../services/api'
import { cargarGoogle } from '../lib/google'
import { decodificar } from '../lib/navegacion'

type P = { lat: number; lng: number }

export default function CorregirCamino({ mapa, parada, origen, onCerrar }: {
  mapa: any; parada: any; origen: P | null; onCerrar: (guardado: boolean) => void
}) {
  const [llegada, setLlegada] = useState<P | null>(null)
  const [via, setVia] = useState<P[]>([])
  const [original, setOriginal] = useState<P | null>(null)
  const [tenia, setTenia] = useState(false)
  const [previa, setPrevia] = useState<{ m: number; seg: number } | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const g = useRef<any>(null)
  const [listo, setListo] = useState(false)   // Google cargado: recién ahí se puede dibujar
  const bandera = useRef<any>(null)
  const marcas = useRef<any[]>([])
  const linea = useRef<any>(null)
  const oyente = useRef<any>(null)
  const viaRef = useRef<P[]>([])
  viaRef.current = via

  // Cargar lo que ya tiene guardado esa dirección.
  useEffect(() => {
    let vivo = true
    cargarGoogle().then(gg => { g.current = gg; setListo(true) })
    rutaCallesApi.correccion(parada.id).then(r => {
      if (!vivo) return
      const x = r.data
      const base = { lat: Number(x.lat ?? parada.lat), lng: Number(x.lng ?? parada.lng) }
      setOriginal(base)
      setLlegada(x.nav_llegada ? { lat: Number(x.nav_llegada.lat), lng: Number(x.nav_llegada.lng) } : base)
      setVia(Array.isArray(x.nav_via) ? x.nav_via.map((v: any) => ({ lat: Number(v.lat), lng: Number(v.lng) })) : [])
      setTenia(!!(x.nav_llegada || (x.nav_via && x.nav_via.length)))
    }).catch(() => {
      const base = { lat: Number(parada.lat), lng: Number(parada.lng) }
      setOriginal(base); setLlegada(base)
    })
    return () => { vivo = false }
  }, [parada.id])

  // Tocar el mapa agrega un punto de paso.
  useEffect(() => {
    let vivo = true
    cargarGoogle().then(gg => {
      if (!vivo || !mapa) return
      g.current = gg; setListo(true)
      oyente.current = mapa.addListener('click', (e: any) => {
        setVia(v => [...v, { lat: e.latLng.lat(), lng: e.latLng.lng() }].slice(0, 10))
      })
      mapa.setOptions({ draggableCursor: 'crosshair' })
    })
    return () => {
      vivo = false
      oyente.current?.remove?.()
      mapa?.setOptions?.({ draggableCursor: null })
      bandera.current?.setMap(null)
      marcas.current.forEach(m => m.setMap(null))
      linea.current?.setMap(null)
    }
  }, [mapa])

  // Dibujar bandera y puntos de paso.
  useEffect(() => {
    const gg = g.current
    if (!gg || !mapa || !llegada) return
    if (!bandera.current) {
      bandera.current = new gg.maps.Marker({
        map: mapa, draggable: true, zIndex: 200, title: 'Punto de llegada (arrástralo)',
        icon: { path: 'M 0,0 0,-34 18,-27 0,-20', strokeColor: '#E8177A', strokeWeight: 3,
                fillColor: '#E8177A', fillOpacity: 1, scale: 1 },
      })
      bandera.current.addListener('dragend', (e: any) => setLlegada({ lat: e.latLng.lat(), lng: e.latLng.lng() }))
      const caja = new gg.maps.LatLngBounds()
      caja.extend(llegada); if (origen) caja.extend(origen)
      mapa.fitBounds(caja, 60)
    }
    bandera.current.setPosition(llegada)

    marcas.current.forEach(m => m.setMap(null))
    marcas.current = via.map((v, i) => {
      const m = new gg.maps.Marker({
        map: mapa, position: v, draggable: true, zIndex: 190, title: 'Punto de paso (toca para borrar)',
        label: { text: String(i + 1), color: '#fff', fontSize: '11px', fontWeight: '700' },
        icon: { path: gg.maps.SymbolPath.CIRCLE, scale: 11, fillColor: '#0D8394', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      })
      m.addListener('click', () => setVia(viaRef.current.filter((_, k) => k !== i)))
      m.addListener('dragend', (e: any) => setVia(viaRef.current.map((x, k) => k === i ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : x)))
      return m
    })
  }, [llegada, via, listo])

  // Ver el camino nuevo antes de guardar.
  useEffect(() => {
    if (!llegada || !origen) return
    const t = setTimeout(() => {
      setCalculando(true); setError('')
      rutaCallesApi.previa({ origen, destino: llegada, via }).then(r => {
        const gg = g.current
        setPrevia({ m: r.data.m, seg: r.data.seg })
        if (!gg) return
        linea.current?.setMap(null)
        linea.current = new gg.maps.Polyline({
          map: mapa, path: decodificar(r.data.polyline), strokeColor: '#16A34A', strokeOpacity: 0.95,
          strokeWeight: 6, zIndex: 150,
          icons: [{ icon: { path: gg.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2.5 }, offset: '30px', repeat: '100px' }],
        })
      }).catch(e => { setPrevia(null); setError(e?.response?.data?.error || 'No se pudo calcular el camino') })
        .finally(() => setCalculando(false))
    }, 500)
    return () => clearTimeout(t)
  }, [llegada, via, origen?.lat, origen?.lng, listo])

  const cambioLlegada = !!(llegada && original && (Math.abs(llegada.lat - original.lat) > 1e-6 || Math.abs(llegada.lng - original.lng) > 1e-6))

  const guardar = async (quitar = false) => {
    setGuardando(true)
    try {
      await rutaCallesApi.guardar(quitar ? { parada_id: parada.id, quitar: true }
        : { parada_id: parada.id, llegada: cambioLlegada ? llegada : null, via })
      toast.success(quitar ? 'Corrección quitada' : 'Camino guardado. La navegación lo usa desde su próximo cálculo')
      onCerrar(true)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo guardar')
    } finally { setGuardando(false) }
  }

  return (
    <div className="rounded-xl border-2 bg-white px-4 py-3 space-y-2" style={{ borderColor: '#16A34A' }}>
      <div className="text-sm font-medium" style={{ color: '#1F2430' }}>
        Corregir camino a {parada.n}. {parada.cliente}
        <span className="block text-xs font-normal text-gray-500">{parada.direccion}{parada.comuna ? `, ${parada.comuna}` : ''}</span>
      </div>
      <div className="text-xs text-gray-600 leading-relaxed">
        <b>Toca el mapa</b> donde tiene que pasar (se numeran en orden; toca un punto para borrarlo, o arrástralo).
        <b> Arrastra la bandera</b> a la entrada o pista correcta. La línea verde es el camino nuevo
        {origen ? '' : ' (sin posición de la camioneta: no hay vista previa)'}.
      </div>
      <div className="text-xs">
        {calculando ? <span className="text-gray-400">Calculando…</span>
          : error ? <span className="text-red-600">{error}</span>
          : previa ? <span style={{ color: '#16A34A' }}>Camino nuevo: {(previa.m / 1000).toFixed(1).replace('.', ',')} km · {Math.round(previa.seg / 60)} min</span>
          : null}
        {via.length > 0 && <span className="text-gray-500"> · {via.length} punto{via.length > 1 ? 's' : ''} de paso</span>}
        {cambioLlegada && <span className="text-gray-500"> · llegada movida</span>}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button disabled={guardando || (!via.length && !cambioLlegada)} onClick={() => guardar(false)}
          className="px-3 py-1.5 rounded-lg text-sm text-white disabled:opacity-40" style={{ background: '#16A34A' }}>
          Guardar camino
        </button>
        {via.length > 0 && (
          <button onClick={() => setVia(via.slice(0, -1))} className="px-3 py-1.5 rounded-lg text-sm border">Deshacer punto</button>
        )}
        {cambioLlegada && (
          <button onClick={() => setLlegada(original)} className="px-3 py-1.5 rounded-lg text-sm border">Bandera a su lugar</button>
        )}
        {tenia && (
          <button disabled={guardando} onClick={() => guardar(true)} className="px-3 py-1.5 rounded-lg text-sm border text-red-600">
            Quitar corrección
          </button>
        )}
        <button onClick={() => onCerrar(false)} className="px-3 py-1.5 rounded-lg text-sm border text-gray-600">Cancelar</button>
      </div>
    </div>
  )
}
