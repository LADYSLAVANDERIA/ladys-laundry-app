import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { seguimientoApi } from '../services/api'
import { Truck, MapPin, Clock, CheckCircle2, PackageCheck } from 'lucide-react'
import { cargarGoogle, ESTILO, pin } from '../lib/google'

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
    cargarGoogle().then(g => {
      const destino = { lat: d.destino.lat, lng: d.destino.lng }
      if (!mapa.current) {
        mapa.current = new g.maps.Map(div.current!, {
          center: destino, zoom: 14, styles: ESTILO,
          mapTypeControl: false, streetViewControl: false,
          fullscreenControl: false, zoomControl: false, gestureHandling: 'greedy',
        })
      }
      if (!pinCasa.current) {
        pinCasa.current = new g.maps.Marker({
          position: destino, map: mapa.current, icon: pin('C', '#E8177A'), title: 'Tu direccion',
        })
      }
      if (d.conductor) {
        const pos = { lat: d.conductor.lat, lng: d.conductor.lng }
        if (!pinAuto.current) {
          pinAuto.current = new g.maps.Marker({
            position: pos, map: mapa.current, icon: pin('R', '#4AAEE0'),
            title: 'Repartidor', zIndex: 90,
          })
        } else pinAuto.current.setPosition(pos)
        const caja = new g.maps.LatLngBounds()
        caja.extend(pos); caja.extend(destino)
        mapa.current.fitBounds(caja, 50)
        // con los dos puntos casi encima, fitBounds acerca de mas
        g.maps.event.addListenerOnce(mapa.current, 'idle', () => {
          if (mapa.current.getZoom() > 15) mapa.current.setZoom(15)
        })
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
