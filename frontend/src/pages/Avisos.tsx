import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BellRing, Send, RefreshCw, Truck, Store, CheckCircle2, MessageCircle } from 'lucide-react'
import { avisosApi, ordenesApi } from '../services/api'
import { waLink, mensajeSegunEtapa, linkOT, tipoAviso, ot, fmt } from '../utils'

// Pedidos embolsados que todavia no se le avisan al cliente (bitacora #118).
//
// El boton de avisar al embolsar existe, pero cuando hay fila de escaneo se
// salta. Aca queda la lista de lo que falta, con un boton por pedido: cada uno
// abre WhatsApp con el mensaje armado y deja el aviso anotado en la OT, que es lo
// que saca al pedido de esta lista. Con el enlace de WhatsApp no se puede mandar
// todo de una vez: el envio masivo automatico llega con la API de Meta.
export default function Avisos() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [avisados, setAvisados] = useState<Set<number>>(new Set())

  const cargar = () => {
    setCargando(true)
    avisosApi.pendientes()
      .then(r => { setPedidos(r.data.pedidos || []); setAvisados(new Set()) })
      .catch(e => toast.error(e?.response?.data?.error || 'No se pudo cargar la lista'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, [])

  const avisar = (p: any) => {
    const msg = mensajeSegunEtapa(p, linkOT(p.id, p.token_publico))
    // La ventana se abre ANTES de cualquier await: si no, el navegador la toma
    // como popup y la bloquea.
    window.open(waLink(p.cliente_telefono, msg), '_blank')
    ordenesApi.aviso(p.id, { tipo: tipoAviso(p), mensaje: msg })
      .then(() => {
        setAvisados(s => new Set(s).add(p.id))
        toast.success(`${ot(p.id)} anotado como avisado`)
      })
      .catch(() => toast.error(`Se abrió WhatsApp, pero no se pudo anotar el aviso en ${ot(p.id)}`))
  }

  const faltan = pedidos.filter(p => !avisados.has(p.id))

  const espera = (h: number) => h >= 48 ? `${Math.floor(h / 24)} días` : `${Math.round(h)} h`

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BellRing size={22} /> Avisos pendientes
          </h1>
          <p className="text-sm text-gray-500">Embolsados que el cliente todavía no sabe que están listos</p>
        </div>
        <button onClick={cargar} className="p-2 rounded-xl border text-gray-500" title="Actualizar">
          <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {!cargando && faltan.length === 0 && (
        <div className="bg-white rounded-2xl border p-8 text-center text-gray-500">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-green-600" />
          Todos los pedidos embolsados están avisados.
        </div>
      )}

      {faltan.length > 0 && (
        <p className="text-sm text-gray-600">
          <b>{faltan.length}</b> por avisar. Toca cada botón, manda el mensaje en WhatsApp y vuelve aquí.
        </p>
      )}

      <div className="space-y-2">
        {pedidos.map(p => {
          const hecho = avisados.has(p.id)
          const viejo = Number(p.horas_esperando) >= 24
          return (
            <div key={p.id} className={`bg-white rounded-2xl border p-4 ${hecho ? 'opacity-50' : ''}`}
                 style={!hecho && viejo ? { borderColor: '#FECACA' } : {}}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/ordenes/${p.id}`} className="font-semibold text-gray-800">
                    {ot(p.id)} · {p.cliente_nombre}
                  </Link>
                  <p className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 mt-0.5">
                    {p.entrega_domicilio
                      ? <span className="flex items-center gap-1"><Truck size={12} /> a domicilio{p.ruta_entrega ? ` (${p.ruta_entrega})` : ''}</span>
                      : <span className="flex items-center gap-1"><Store size={12} /> retira en local</span>}
                    {Number(p.bultos) > 0 && <span>· {p.bultos} bulto{Number(p.bultos) > 1 ? 's' : ''}</span>}
                    {Number(p.saldo_pendiente) > 0 && <span className="text-amber-700 font-semibold">· saldo {fmt(p.saldo_pendiente)}</span>}
                  </p>
                  <p className={`text-xs mt-1 ${viejo ? 'text-red-700 font-semibold' : 'text-gray-400'}`}>
                    Embolsado hace {espera(Number(p.horas_esperando))}
                  </p>
                </div>
              </div>

              {hecho ? (
                <p className="mt-3 text-sm text-green-700 flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Avisado
                </p>
              ) : p.cliente_telefono ? (
                <button onClick={() => avisar(p)}
                        className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold"
                        style={{ background: '#16a34a' }}>
                  <Send size={15} /> Avisar por WhatsApp
                </button>
              ) : (
                <Link to={`/ordenes/${p.id}`}
                      className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl border text-sm text-gray-600">
                  <MessageCircle size={15} /> Sin teléfono: abrir el pedido
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
