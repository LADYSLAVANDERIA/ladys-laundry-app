import { useEffect, useState } from 'react'
import { rutasApi } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Truck, X, Save } from 'lucide-react'

const DIAS = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO']

export default function Rutas() {
  const [rutas, setRutas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({ tipo: 'RETIROS_Y_ENTREGAS', hrs_anticipacion: 24, puntos_disp: 4 })

  const load = () => { rutasApi.getAll().then(r => setRutas(r.data)).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.nombre || !form.dia_semana) return toast.error('Nombre y día requeridos')
    try { await rutasApi.create(form); toast.success('Ruta creada'); setModal(false); setForm({ tipo: 'RETIROS_Y_ENTREGAS', hrs_anticipacion: 24, puntos_disp: 4 }); load() }
    catch { toast.error('Error al crear ruta') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Rutas de Delivery</h1>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
          <Plus size={16}/> Nueva ruta
        </button>
      </div>
      {loading ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"/></div> : (
        <div className="grid gap-3">
          {DIAS.map(dia => {
            const rutasDia = rutas.filter(r => r.dia_semana === dia)
            if (rutasDia.length === 0) return null
            return (
              <div key={dia} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <p className="font-semibold text-gray-700 text-sm">{dia}</p>
                </div>
                {rutasDia.map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center gap-4 border-b last:border-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#4AAEE0,#A87BC8)'}}>
                      <Truck size={16} className="text-white"/>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{r.nombre}</p>
                      <p className="text-xs text-gray-400">{r.tipo.replace('_',' ')} · {r.hora_inicio?.substring(0,5)} – {r.hora_fin?.substring(0,5)} · {r.puntos_disp} puntos</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
          {rutas.length === 0 && <div className="text-center py-12 text-gray-400"><Truck size={36} className="mx-auto mb-2 opacity-30"/><p>No hay rutas configuradas</p></div>}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Nueva ruta</h2>
              <button onClick={() => setModal(false)}><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nombre de la ruta</label>
                <input value={form.nombre||''} onChange={e => setForm({...form,nombre:e.target.value})} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Día</label>
                  <select value={form.dia_semana||''} onChange={e => setForm({...form,dia_semana:e.target.value})} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none">
                    <option value="">Seleccionar</option>
                    {DIAS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({...form,tipo:e.target.value})} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none">
                    <option value="RETIROS_Y_ENTREGAS">Retiros y Entregas</option>
                    <option value="SOLO_RETIROS">Solo Retiros</option>
                    <option value="SOLO_ENTREGAS">Solo Entregas</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Hora inicio</label>
                  <input type="time" value={form.hora_inicio||''} onChange={e => setForm({...form,hora_inicio:e.target.value})} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Hora fin</label>
                  <input type="time" value={form.hora_fin||''} onChange={e => setForm({...form,hora_fin:e.target.value})} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Hrs anticipación</label>
                  <input type="number" value={form.hrs_anticipacion} onChange={e => setForm({...form,hrs_anticipacion:Number(e.target.value)})} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Puntos disponibles</label>
                  <input type="number" value={form.puntos_disp} onChange={e => setForm({...form,puntos_disp:Number(e.target.value)})} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
                <Save size={14}/> Guardar
              </button>
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
