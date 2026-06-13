import { useEffect, useState } from 'react'
import { usuariosApi } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, UserCog, X, Save, Check, XCircle } from 'lucide-react'

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({ perfil: 'ASISTENTE' })

  const load = () => { usuariosApi.getAll().then(r => setUsuarios(r.data)).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.nombre || !form.email || !form.password) return toast.error('Nombre, email y contraseña requeridos')
    try { await usuariosApi.create(form); toast.success('Usuario creado'); setModal(false); setForm({ perfil: 'ASISTENTE' }); load() }
    catch { toast.error('Error al crear usuario') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
          <Plus size={16}/> Nuevo usuario
        </button>
      </div>
      {loading ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"/></div> : (
        <div className="grid gap-3">
          {usuarios.map(u => (
            <div key={u.id} className="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
                {u.nombre[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{u.nombre} {u.apellido}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.perfil === 'ADMINISTRADOR' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.perfil}</span>
                <p className="text-xs mt-1">{u.estado ? <span className="text-green-500 flex items-center gap-1 justify-end"><Check size={11}/>Activo</span> : <span className="text-red-400 flex items-center gap-1 justify-end"><XCircle size={11}/>Inactivo</span>}</p>
              </div>
            </div>
          ))}
          {usuarios.length === 0 && <div className="text-center py-12 text-gray-400"><UserCog size={36} className="mx-auto mb-2 opacity-30"/><p>Sin usuarios</p></div>}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Nuevo usuario</h2>
              <button onClick={() => setModal(false)}><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[['nombre','Nombre'],['apellido','Apellido'],['email','Email'],['password','Contraseña'],['telefono','Teléfono']].map(([k,l]) => (
                  <div key={k} className={k==='email'||k==='password'?'col-span-2':''}>
                    <label className="text-xs text-gray-500 block mb-1">{l}</label>
                    <input type={k==='password'?'password':k==='email'?'email':'text'} value={form[k]||''} onChange={e => setForm({...form,[k]:e.target.value})}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Perfil</label>
                  <select value={form.perfil} onChange={e => setForm({...form,perfil:e.target.value})} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none">
                    <option value="ASISTENTE">ASISTENTE</option>
                    <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                    <option value="CONDUCTOR">CONDUCTOR</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
                <Save size={14}/> Crear usuario
              </button>
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
