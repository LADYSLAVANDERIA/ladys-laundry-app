import { useEffect, useState } from 'react'
import { usuariosApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, X, Check, KeyRound, UserX, UserCheck, Pencil } from 'lucide-react'

const PERFILES = [
  { id: 'ADMINISTRADOR', label: 'Administrador', desc: 'Ve todo, incluida la plata y la configuración' },
  { id: 'JEFE_LOCAL',    label: 'Jefe de local', desc: 'Opera el local y la ruta, sin configuración' },
  { id: 'ASISTENTE',     label: 'Asistente',     desc: 'Recepción, producción y entrega' },
  { id: 'CONDUCTOR',     label: 'Conductor',     desc: 'Solo la app de reparto' },
]
const COLOR: Record<string, string> = {
  ADMINISTRADOR: 'bg-purple-100 text-purple-700',
  JEFE_LOCAL:    'bg-pink-100 text-pink-700',
  ASISTENTE:     'bg-blue-100 text-blue-700',
  CONDUCTOR:     'bg-amber-100 text-amber-700',
}
const inp = 'w-full border rounded-xl px-3 py-2 text-sm'

export default function Usuarios() {
  const { user: yo } = useAuthStore()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState<any>(null)
  const [editando, setEditando] = useState<any>(null)
  const [clave, setClave] = useState('')

  const cargar = () => {
    setCargando(true)
    usuariosApi.getAll()
      .then(r => setUsuarios(r.data))
      .catch(() => toast.error('No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const crear = async () => {
    try {
      await usuariosApi.create(nuevo)
      toast.success('Usuario creado')
      setNuevo(null); cargar()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo crear') }
  }

  const guardar = async () => {
    const datos: any = {
      nombre: editando.nombre, apellido: editando.apellido,
      email: editando.email, telefono: editando.telefono,
      perfil: editando.perfil, estado: editando.estado,
    }
    if (clave.trim()) datos.password = clave.trim()
    try {
      await usuariosApi.update(editando.id, datos)
      toast.success(clave.trim() ? 'Guardado y clave cambiada' : 'Guardado')
      setEditando(null); setClave(''); cargar()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo guardar') }
  }

  // Desactivar es reversible y no borra nada: el historial de ese usuario queda.
  const cambiarEstado = async (u: any) => {
    try {
      await usuariosApi.update(u.id, { estado: !u.estado })
      toast.success(u.estado ? `${u.nombre} quedó desactivado` : `${u.nombre} quedó activo`)
      cargar()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo cambiar') }
  }

  if (cargando) return <div className="py-20 text-center text-gray-400">Cargando…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        <button onClick={() => setNuevo({ perfil: 'ASISTENTE' })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="space-y-3">
        {usuarios.map(u => (
          <div key={u.id} className={`bg-white rounded-xl border p-4 ${u.estado ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                   style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                {String(u.nombre || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">
                  {u.nombre}
                  {u.id === yo?.id && <span className="ml-2 text-[10px] text-gray-400">(tú)</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${COLOR[u.perfil] || 'bg-gray-100 text-gray-600'}`}>
                  {u.perfil}
                </span>
                <p className={`text-xs flex items-center justify-end gap-1 ${u.estado ? 'text-green-600' : 'text-gray-400'}`}>
                  {u.estado ? <><Check size={13} /> Activo</> : 'Desactivado'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t">
              <button onClick={() => { setEditando({ ...u }); setClave('') }}
                      className="flex-1 py-2 rounded-xl border text-xs text-gray-600 flex items-center justify-center gap-1.5">
                <Pencil size={14} /> Editar
              </button>
              <button onClick={() => cambiarEstado(u)} disabled={u.id === yo?.id}
                      className={`flex-1 py-2 rounded-xl border text-xs flex items-center justify-center gap-1.5 ${
                        u.id === yo?.id ? 'text-gray-300' : u.estado ? 'text-red-600' : 'text-green-700'}`}>
                {u.estado ? <><UserX size={14} /> Desactivar</> : <><UserCheck size={14} /> Activar</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
             onClick={() => setEditando(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[92vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Editar usuario</h2>
              <button onClick={() => setEditando(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Nombre</label>
                <input value={editando.nombre || ''} onChange={e => setEditando({ ...editando, nombre: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Apellido</label>
                <input value={editando.apellido || ''} onChange={e => setEditando({ ...editando, apellido: e.target.value })} className={inp} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Correo</label>
              <input value={editando.email || ''} type="email"
                     onChange={e => setEditando({ ...editando, email: e.target.value })} className={inp} />
              <p className="text-[11px] text-gray-400 mt-1">
                Es la llave con la que entra al sistema. Si la cambias, avísale.
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500">Teléfono</label>
              <input value={editando.telefono || ''} placeholder="+56 9 ..."
                     onChange={e => setEditando({ ...editando, telefono: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Perfil</label>
              <select value={editando.perfil} onChange={e => setEditando({ ...editando, perfil: e.target.value })} className={inp}>
                {PERFILES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                {PERFILES.find(p => p.id === editando.perfil)?.desc}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <label className="text-xs font-medium text-amber-900 flex items-center gap-1.5">
                <KeyRound size={13} /> Cambiar la clave de esta persona
              </label>
              <input value={clave} onChange={e => setClave(e.target.value)} type="text"
                     placeholder="dejar en blanco para no cambiarla" className={inp} />
              <p className="text-[11px] text-amber-800">
                Mínimo 6 caracteres. Avísale para que la cambie ella misma después.
              </p>
            </div>

            <button onClick={guardar} className="w-full py-3 rounded-xl text-white font-medium"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              Guardar cambios
            </button>
          </div>
        </div>
      )}

      {nuevo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
             onClick={() => setNuevo(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[92vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Nuevo usuario</h2>
              <button onClick={() => setNuevo(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            {[['nombre', 'Nombre', 'text'], ['email', 'Correo', 'email'],
              ['telefono', 'Teléfono', 'text'], ['password', 'Clave inicial', 'text']].map(([k, label, tipo]) => (
              <div key={k}>
                <label className="text-xs text-gray-500">{label}</label>
                <input type={tipo} value={nuevo[k] || ''}
                       onChange={e => setNuevo({ ...nuevo, [k]: e.target.value })} className={inp} />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500">Perfil</label>
              <select value={nuevo.perfil} onChange={e => setNuevo({ ...nuevo, perfil: e.target.value })} className={inp}>
                {PERFILES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">{PERFILES.find(p => p.id === nuevo.perfil)?.desc}</p>
            </div>
            <button onClick={crear} className="w-full py-3 rounded-xl text-white font-medium"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              Crear usuario
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
