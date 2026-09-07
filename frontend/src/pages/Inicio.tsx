import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientesApi, ordenesApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { Search, UserPlus, FilePlus, Calendar, ClipboardList, Phone, X } from 'lucide-react'

const plata = (v: any) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CL')
const soloDigitos = (s: string) => s.replace(/\D/g, '')

const ESTADO_TXT: Record<string, string> = {
  PRE_ORDEN: 'agendada', RECEPCIONADA: 'en el local', EN_PROCESO: 'en proceso',
  LISTA: 'lista', ENTREGADA: 'entregada',
}

export default function Inicio() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuthStore()
  const [q, setQ] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [orden, setOrden] = useState<any>(null)
  const [buscando, setBuscando] = useState(false)
  const caja = useRef<HTMLInputElement>(null)

  useEffect(() => { caja.current?.focus() }, [])

  // Una sola caja para todo: si son puros dígitos y parece número de OT se busca
  // el pedido; en paralelo siempre se busca por teléfono y por nombre.
  useEffect(() => {
    const t = String(q).trim()
    if (t.length < 3) { setClientes([]); setOrden(null); return }
    setBuscando(true)
    const tarea = setTimeout(async () => {
      const digitos = soloDigitos(t)
      const pareceOT = /^\d{3,6}$/.test(t)
      const [cli, ot] = await Promise.all([
        clientesApi.getAll(t, { limit: 8 }).then(r => r.data).catch(() => []),
        pareceOT ? ordenesApi.getById(digitos).then(r => r.data).catch(() => null) : Promise.resolve(null),
      ])
      setClientes(Array.isArray(cli) ? cli : (cli?.clientes || cli?.data || []))
      setOrden(ot)
      setBuscando(false)
    }, 300)
    return () => clearTimeout(tarea)
  }, [q])

  const accesos = [
    { icon: FilePlus,      label: 'Nueva orden',    a: '/ordenes/nueva', ver: ['JEFE_LOCAL'] },
    { icon: UserPlus,      label: 'Nuevo cliente',  a: '/clientes/nuevo', ver: ['JEFE_LOCAL'] },
    { icon: Calendar,      label: 'Programación',   a: '/programacion',  ver: ['JEFE_LOCAL'] },
    { icon: ClipboardList, label: 'Pedidos',        a: '/ordenes',       ver: ['JEFE_LOCAL', 'ASISTENTE'] },
  ].filter(x => isAdmin() || x.ver.includes(user?.perfil || ''))

  return (
    <div className="max-w-lg mx-auto space-y-6 pt-2">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold" style={{ color: '#E8177A' }}>Ladys Lavandería</h1>
        <p className="text-sm text-gray-400">Hola {user?.nombre}, ¿qué necesitas?</p>
      </div>

      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={caja}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Teléfono, nombre o número de pedido"
          className="w-full border-2 rounded-2xl pl-12 pr-11 py-4 text-base focus:outline-none focus:border-pink-400"
        />
        {q && (
          <button onClick={() => { setQ(''); caja.current?.focus() }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            <X size={18} />
          </button>
        )}
      </div>

      {q.trim().length >= 3 && (
        <div className="space-y-3">
          {buscando && <p className="text-center text-sm text-gray-400">Buscando…</p>}

          {orden && (
            <button onClick={() => navigate(`/ordenes/${orden.id}`)}
                    className="w-full bg-white rounded-2xl border-2 border-pink-200 p-4 text-left">
              <p className="text-xs text-pink-600 font-medium">Pedido #{orden.id}</p>
              <p className="font-semibold text-gray-800">{orden.cliente_nombre || orden.cliente}</p>
              <p className="text-sm text-gray-500">
                {ESTADO_TXT[orden.estado] || orden.estado} · {plata(orden.monto_total)}
                {Number(orden.saldo_pendiente) > 0 && <span className="text-red-600"> · debe {plata(orden.saldo_pendiente)}</span>}
              </p>
            </button>
          )}

          {clientes.map((c: any) => (
            <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                    className="w-full bg-white rounded-2xl border p-4 text-left flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                   style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                {String(c.razon_social || c.nombre || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {c.razon_social || [c.nombre, c.apellido].filter(Boolean).join(' ')}
                </p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Phone size={11} /> {c.telefono || 'sin teléfono'}
                </p>
              </div>
            </button>
          ))}

          {!buscando && !orden && clientes.length === 0 && (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-gray-400">No encontré nada con "{q}".</p>
              {(isAdmin() || user?.perfil === 'JEFE_LOCAL') && (
                <button onClick={() => navigate('/clientes/nuevo')}
                        className="px-5 py-2.5 rounded-xl text-white text-sm font-medium"
                        style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  Crear cliente nuevo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {accesos.map(({ icon: Icon, label, a }) => (
          <button key={a} onClick={() => navigate(a)}
                  className="bg-white rounded-2xl border p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              <Icon size={26} className="text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
