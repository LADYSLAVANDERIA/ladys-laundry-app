import { useEffect, useState } from 'react'
import { comprasApi } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, X, ShoppingCart } from 'lucide-react'
import { format } from 'date-fns'

const fmt = (n: number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)

export default function Compras() {
  const hoy = new Date().toISOString().split('T')[0]
  const inicioMes = hoy.substring(0,8)+'01'
  const [compras, setCompras] = useState<any[]>([])
  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState(hoy)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>({ tipo_doc: 'BOLETA', fecha_compra: hoy })

  const load = () => {
    setLoading(true)
    comprasApi.getAll({ desde, hasta }).then(r => setCompras(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [desde, hasta])

  const save = async () => {
    if (!form.tipo_gasto || !form.total) return toast.error('Tipo de gasto y total requeridos')
    try { await comprasApi.create(form); toast.success('Gasto registrado'); setShowForm(false); setForm({ tipo_doc: 'BOLETA', fecha_compra: hoy }); load() }
    catch { toast.error('Error al registrar') }
  }
  const remove = async (id: number) => {
    if (!confirm('¿Eliminar?')) return
    try { await comprasApi.remove(id); toast.success('Eliminado'); load() } catch { toast.error('Error') }
  }

  const total = compras.reduce((s,c) => s+Number(c.total), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Compras / Gastos</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
          <Plus size={16}/> Nuevo gasto
        </button>
      </div>
      <div className="flex gap-3 items-center">
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border rounded-xl px-3 py-2 text-sm outline-none"/>
        <span className="text-gray-400">—</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border rounded-xl px-3 py-2 text-sm outline-none"/>
      </div>
      <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
        <p className="text-xs text-pink-600">Total período</p>
        <p className="text-2xl font-bold text-pink-700">{fmt(total)}</p>
      </div>
      {loading ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"/></div> : (
        <div className="space-y-2">
          {compras.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-gray-800">{c.tipo_gasto}</p>
                <p className="text-xs text-gray-400">{c.fecha_compra ? format(new Date(c.fecha_compra+'T12:00:00'),'dd/MM/yyyy') : ''} · {c.tipo_doc} {c.folio ? `#${c.folio}` : ''}</p>
                {c.glosa && <p className="text-xs text-gray-500 mt-0.5">{c.glosa}</p>}
              </div>
              <div className="flex items-center gap-3">
                <p className="font-bold text-gray-800">{fmt(c.total)}</p>
                <button onClick={() => remove(c.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
          {compras.length === 0 && <div className="text-center py-12 text-gray-400"><ShoppingCart size={36} className="mx-auto mb-2 opacity-30"/><p>Sin gastos registrados</p></div>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Nuevo gasto</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="space-y-3">
              {[['fecha_compra','Fecha','date'],['folio','Folio','text'],['tipo_gasto','Tipo de gasto','text'],['total','Total','number'],['glosa','Descripción','text']].map(([k,l,t]) => (
                <div key={k as string}>
                  <label className="text-xs text-gray-500 block mb-1">{l as string}</label>
                  <input type={t as string} value={form[k as string]||''} onChange={e => setForm({...form,[k as string]:e.target.value})}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo documento</label>
                <select value={form.tipo_doc} onChange={e => setForm({...form,tipo_doc:e.target.value})} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none">
                  <option>BOLETA</option><option>FACTURA</option><option>OTRO</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>Guardar</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
