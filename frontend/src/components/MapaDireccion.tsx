import { useEffect, useRef, useState } from 'react'
import { Search, MapPin, Crosshair, Loader2, Check } from 'lucide-react'
import { dirApi } from '../services/api'
import toast from 'react-hot-toast'
import { cargarGoogle, ESTILO } from '../lib/google'

const CONCON: [number, number] = [-32.9280, -71.5280]
const COMUNAS = ['Concón', 'Reñaca', 'Viña del Mar', 'Valparaíso', 'Quintero']
const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300'

type Props = {
  valor: any
  onChange: (d: any) => void
  alto?: number
}

export default function MapaDireccion({ valor, onChange, alto = 220 }: Props) {
  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<any>(null)
  const pin = useRef<any>(null)
  const [busca, setBusca] = useState('')
  const [opciones, setOpciones] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)
  const [listo, setListo] = useState(false)

  // inicializar el mapa
  useEffect(() => {
    let vivo = true
    cargarGoogle().then(g => {
      if (!vivo || !div.current || mapa.current) return
      const centro = valor?.lat && valor?.lng
        ? { lat: Number(valor.lat), lng: Number(valor.lng) }
        : { lat: CONCON[0], lng: CONCON[1] }
      const m = new g.maps.Map(div.current, {
        center: centro, zoom: valor?.lat ? 18 : 13, styles: ESTILO,
        mapTypeControl: false, streetViewControl: false,
        fullscreenControl: false, gestureHandling: 'greedy',
      })
      const p = new g.maps.Marker({ position: centro, map: m, draggable: true })

      // Al soltar el pin se guarda la coordenada y, si la ficha aun no tiene
      // calle, se completa con la que Google reconoce en ese punto.
      p.addListener('dragend', async () => {
        const lat = p.getPosition().lat(), lng = p.getPosition().lng()
        onChange({ ...valor, lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)) })
        try {
          const { data } = await dirApi.desdePunto({ lat, lng })
          if (data.calle && !valor?.calle) {
            onChange({ ...valor, lat, lng, calle: data.calle, numero: data.numero || valor?.numero })
          }
        } catch { /* opcional */ }
      })
      m.addListener('click', (e: any) => {
        const lat = e.latLng.lat(), lng = e.latLng.lng()
        p.setPosition(e.latLng)
        onChange({ ...valor, lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)) })
      })
      mapa.current = m; pin.current = p; setListo(true)
    }).catch(() => toast.error('No se pudo cargar el mapa'))
    return () => { vivo = false; mapa.current = null; pin.current = null }
  }, [])

  // mover el pin si cambian las coordenadas desde fuera
  useEffect(() => {
    if (!listo || !valor?.lat || !valor?.lng) return
    const ll = { lat: Number(valor.lat), lng: Number(valor.lng) }
    pin.current?.setPosition(ll)
    mapa.current?.panTo(ll)
    if (mapa.current && mapa.current.getZoom() < 18) mapa.current.setZoom(18)
  }, [valor?.lat, valor?.lng, listo])

  const buscar = async () => {
    const texto = busca.trim() || [valor?.calle, valor?.numero, valor?.ciudad].filter(Boolean).join(' ')
    if (texto.length < 4) return toast.error('Escribe la calle y el número')
    setCargando(true)
    try {
      const { data } = await dirApi.buscar(texto)
      setOpciones(data)
      if (!data.length) toast('Sin resultados. Ubica el pin a mano en el mapa.', { icon: '📍' })
      else if (data.length === 1) elegir(data[0])
    } catch { toast.error('No se pudo buscar') } finally { setCargando(false) }
  }

  const elegir = (o: any) => {
    onChange({
      ...valor, lat: o.lat, lng: o.lng,
      calle: o.calle || valor?.calle || '',
      numero: valor?.numero || o.numero || '',
      ciudad: COMUNAS.find(c => o.comuna?.includes(c.replace('ñ', 'ñ'))) || o.comuna || valor?.ciudad || 'Concón',
    })
    setOpciones([])
    setBusca('')
  }

  const ubicarme = () => {
    if (!navigator.geolocation) return toast.error('Tu navegador no da la ubicación')
    navigator.geolocation.getCurrentPosition(
      p => onChange({ ...valor, lat: Number(p.coords.latitude.toFixed(7)), lng: Number(p.coords.longitude.toFixed(7)) }),
      () => toast.error('No pudimos obtener tu ubicación'), { enableHighAccuracy: true, timeout: 8000 })
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2">
        <input value={valor?.calle || ''} onChange={e => onChange({ ...valor, calle: e.target.value })}
          placeholder="Calle *" className={inp + ' col-span-6'} />
        <input value={valor?.numero || ''} onChange={e => onChange({ ...valor, numero: e.target.value })}
          placeholder="N°" className={inp + ' col-span-2'} />
        <select value={valor?.ciudad || 'Concón'} onChange={e => onChange({ ...valor, ciudad: e.target.value })}
          className={inp + ' col-span-4'}>{COMUNAS.map(c => <option key={c}>{c}</option>)}</select>
        <input value={valor?.otro || ''} onChange={e => onChange({ ...valor, otro: e.target.value })}
          placeholder="Depto, casa, block, referencia" className={inp + ' col-span-8'} />
        <button type="button" onClick={buscar} disabled={cargando}
          className="col-span-4 flex items-center justify-center gap-1.5 rounded-xl text-white text-sm font-medium"
          style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
          {cargando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Ubicar
        </button>
      </div>

      {opciones.length > 1 && (
        <div className="border rounded-xl divide-y max-h-40 overflow-y-auto bg-white">
          {opciones.map((o, i) => (
            <button type="button" key={i} onClick={() => elegir(o)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-pink-50">
              <MapPin size={11} className="inline mr-1 text-pink-500" />{o.etiqueta}
            </button>
          ))}
        </div>
      )}

      <div className="relative rounded-xl overflow-hidden border">
        <div ref={div} style={{ height: alto }} className="bg-gray-100" />
        {!listo && <div className="absolute inset-0 flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-pink-400" size={22} /></div>}
        <button type="button" onClick={ubicarme}
          className="absolute bottom-2 right-2 z-[1000] bg-white shadow rounded-lg px-2.5 py-1.5 text-[11px] flex items-center gap-1 text-gray-600">
          <Crosshair size={12} /> Estoy aquí
        </button>
      </div>

      <p className="text-[11px] text-gray-400 flex items-center gap-1">
        {valor?.lat
          ? <><Check size={11} className="text-green-500" /> Punto guardado ({Number(valor.lat).toFixed(5)}, {Number(valor.lng).toFixed(5)}). Arrastra el pin si está corrido.</>
          : <><MapPin size={11} /> Escribe la dirección y toca Ubicar, o marca el punto en el mapa.</>}
      </p>
    </div>
  )
}
