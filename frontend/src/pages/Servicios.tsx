import { useEffect, useState } from 'react'
import { serviciosApi, categoriasApi } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, X, Save, Scissors } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)

export default function Servicios() {
  const [servicios, setServicios] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<any>(null)
  const [form, setForm] = useState<any>({})

  const load = () => {
    Promise.all([serviciosApi.getAll(), categoriasApi.getAll()])
      .then(([s,c]) => { setServicios(s.data); setCategorias(c.data) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm({ precio_lav_planch: 0, precio_lav_secado: 0, precio_productos: 0, precio_solo_planch: 0 }); setModal('new') }
  const openEdit = (s: any) => { setForm(s); setModal('edit') }

  const save = async () => {
    if (!form.nombre || !form.categoria_id) return toast.error('Nombre y categoría requeridos')
    try {
      if (modal === 'new') await serviciosApi.create(form)
      else await serviciosApi.update(form.id, form)
      toast.success('Guardado'); setModal(null); load()
    } catch { toast.error('Error al guardar') }
  }

  const remove = async (id: number) => {
    if (!confirm('¿Desactivar servicio?')) return
    try { await serviciosApi.remove(id); toast.success('Servicio desactivado'); load() }
    catch { toast.error('Error') }
  }

  const byCategoria = categorias.map(c => ({
    ...c, items: servicios.filter(s => s.categoria_id === c.id)
  })).filter(c => c.items.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Servicios y Precios</h1>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
          <Plus size={16}/> Nuevo
        </button>
      </div>

      {loading ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"/></div> : (
        byCategoria.map(cat => (
          <div key={cat.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
              <Scissors size={14} className="text-pink-500"/>
              <p className="font-semibold text-gray-700 text-sm">{cat.nombre}</p>
              <span className="text-xs text-gray-400">({cat.items.length})</span>
            </div>
            <div className="divide-y">
              {cat.items.map((s: any) => (
                <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                  <p className="flex-1 text-sm font-medium text-gray-800">{s.nombre}</p>
                  <div className="hidden md:flex gap-4 text-xs text-gray-500">
                    {s.precio_lav_planch > 0 && <span>Lav+Planch: <strong>{fmt(s.precio_lav_planch)}</strong></span>}
                    {s.precio_lav_secado > 0 && <span>Lav+Sec: <strong>{fmt(s.precio_lav_secado)}</strong></span>}
                    {s.precio_solo_planch > 0 && <span>Solo Planch: <strong>{fmt(s.precio_solo_planch)}</strong></span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><Edit2 size={14}/></button>
                    <button onClick={() => remove(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">{modal==='new'?'Nuevo servicio':'Editar servicio'}</h2>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Categoría</label>
                <select value={form.categoria_id||''} onChange={e => setForm({...form, categoria_id: e.target.value})}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none">
                  <option value="">Seleccionar</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nombre del servicio</label>
                <input value={form.nombre||''} onChange={e => setForm({...form, nombre: e.target.value})}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[['precio_lav_planch','Lav + Plancha'],['precio_lav_secado','Lav + Secado'],['precio_productos','Con Productos'],['precio_solo_planch','Solo Plancha']].map(([k,l]) => (
                  <div key={k}>
                    <label className="text-xs text-gray-500 block mb-1">{l}</label>
                    <input type="number" value={form[k]||0} onChange={e => setForm({...form, [k]: Number(e.target.value)})}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
                <Save size={14}/> Guardar
              </button>
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
