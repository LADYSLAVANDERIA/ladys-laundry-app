import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { seguimientoApi } from '../services/api'
import { Truck, MapPin, Clock, CheckCircle2, PackageCheck } from 'lucide-react'

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

function haceCuanto(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'recién'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  return `hace ${Math.floor(m / 60)} h`
}

export default function SeguirPedido() {
  const { id, token } = useParams()
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<any>(null)
  const pinAuto = useRef<any>(null)
  const pinCasa = useRef<any>(null)

  const cargar = () => {
    seguimientoApi.seguir(id!, token!)
      .then(r => { setD(r.data); setError('') })
      .catch(() => setError('No pudimos cargar tu pedido'))
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 15000)   // se refresca solo cada 15 segundos
    return () => clearInterval(t)
  }, [id, token])

  useEffect(() => {
    if (!div.current || !d?.destino) return
    cargarLeaflet().then(L => {
      if (!mapa.current) {
        mapa.current = L.map(div.current!, { zoomControl: false })
          .setView([d.destino.lat, d.destino.lng], 14)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(mapa.current)
      }
      if (!pinCasa.current) {
        pinCasa.current = L.marker([d.destino.lat, d.destino.lng], {
          icon: L.divIcon({
            className: '', iconSize: [34, 34], iconAnchor: [17, 17],
            html: `<div style="width:34px;height:34px;border-radius:50%;background:#E8177A;color:#fff;
              display:flex;align-items:center;justify-content:center;font-size:16px;
              border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏡</div>`,
          }),
        }).addTo(mapa.current)
      }
      if (d.conductor) {
        const pos: [number, number] = [d.conductor.lat, d.conductor.lng]
        if (!pinAuto.current) {
          pinAuto.current = L.marker(pos, {
            icon: L.divIcon({
              className: '', iconSize: [38, 38], iconAnchor: [19, 19],
              html: `<div style="width:38px;height:38px;border-radius:50%;background:#4AAEE0;color:#fff;
                display:flex;align-items:center;justify-content:center;font-size:18px;
                border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)">🚚</div>`,
            }),
          }).addTo(mapa.current)
        } else pinAuto.current.setLatLng(pos)
        mapa.current.fitBounds([pos, [d.destino.lat, d.destino.lng]], { padding: [50, 50], maxZoom: 15 })
      }
    })
  }, [d])

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-gray-500">{error}</div>
  if (!d) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando…</div>

  const entregado = d.estado === 'COMPLETADA'
  const enCamino = d.estado === 'EN_CAMINO'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-5 pt-6 pb-8" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
        <p className="text-xs opacity-90">Ladys Lavandería</p>
        <h1 className="text-2xl font-bold mt-1">
          {entregado ? (d.tipo === 'RETIRO' ? 'Ropa retirada' : 'Pedido entregado')
            : enCamino ? 'Vamos en camino' : 'Tu pedido está en ruta'}
        </h1>
        {!entregado && d.eta_min != null && (
          <p className="mt-2 text-lg flex items-center gap-2">
            <Clock size={18} /> Llegamos en unos <b>{d.eta_min} min</b>
          </p>
        )}
        {!entregado && d.eta_min == null && (
          <p className="mt-2 text-sm opacity-90">
            {d.hora_estimada ? `Pasamos alrededor de las ${String(d.hora_estimada).slice(0, 5)}` : 'Te avisamos al salir'}
          </p>
        )}
      </div>

      <div className="px-4 -mt-4 space-y-3 pb-8">
        {entregado ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <CheckCircle2 size={40} className="mx-auto mb-2 text-green-600" />
            <p className="text-gray-700 font-medium">
              {d.tipo === 'RETIRO' ? 'Ya tenemos tu ropa con nosotros' : 'Entregado en tu dirección'}
            </p>
            {d.completada_el && (
              <p className="text-sm text-gray-400 mt-1">
                {new Date(d.completada_el).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        ) : (
          <>
            <div ref={div} className="rounded-2xl overflow-hidden shadow-sm bg-white" style={{ height: 320 }} />
            {d.conductor ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                     style={{ background: '#4AAEE0' }}><Truck size={18} /></div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">Conductor en ruta</p>
                  <p className="text-xs text-gray-400">Ubicación actualizada {haceCuanto(d.conductor.actualizado)}</p>
                </div>
                {d.paradas_antes > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    {d.paradas_antes} antes que tú
                  </span>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <PackageCheck size={20} className="text-gray-400" />
                <p className="text-sm text-gray-600">Tu pedido está agendado. Te avisamos cuando salgamos.</p>
              </div>
            )}
          </>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3">
          <MapPin size={18} className="text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-400">{d.tipo === 'RETIRO' ? 'Retiramos en' : 'Entregamos en'}</p>
            <p className="text-gray-800">{d.direccion || 'Tu dirección registrada'}</p>
          </div>
        </div>

        <a href="https://wa.me/56975410232" target="_blank" rel="noreferrer"
           className="block text-center py-3 rounded-xl border text-gray-600 text-sm bg-white">
          Escribirnos por WhatsApp
        </a>
      </div>
    </div>
  )
}
