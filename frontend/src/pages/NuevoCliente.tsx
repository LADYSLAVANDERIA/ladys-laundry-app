import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientesApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Save } from 'lucide-react'

export default function NuevoCliente() {
  const navigate = useNavigate()
  const [tipo, setTipo] = useState('PARTICULAR')
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre) return toast.error('El nombre es obligatorio')
    setLoading(true)
    try {
      await clientesApi.create({ ...form, tipo })
      toast.success('Cliente creado')
      navigate('/clientes')
    } catch { toast.error('Error al crear cliente') }
    finally { setLoading(false) }
  }

  const F = ({ label, k, type = 'text', required = false }: { label: string, k: string, type?: string, required?: boolean }) => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}{required && <span className="text-pink-500 ml-1">*</span>}</label>
      <input type={type} value={form[k] || ''} onChange={e => set(k, e.target.value)} required={required}
        className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-pink-300 outline-none" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="p-2 rounded-xl hover:bg-gray-100"><ArrowLeft size={18} /></button>
        <h1 className="text-xl font-bold text-gray-800">Nuevo Cliente</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tipo */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-sm font-semibold text-gray-700 mb-3">Tipo de cliente</p>
          <div className="flex gap-3">
            {['PARTICULAR','EMPRESA'].map(t => (
              <button type="button" key={t} onClick={() => setTipo(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${tipo === t ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Datos personales */}
        <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
          <p className="text-sm font-semibold text-gray-700">Datos personales</p>
          <div className="grid grid-cols-2 gap-4">
            <F label="Nombre" k="nombre" required />
            <F label="Apellido" k="apellido" />
            <F label="Teléfono" k="telefono" type="tel" />
            <F label="Email" k="email" type="email" />
            <F label="Fecha nacimiento" k="fecha_nacimiento" type="date" />
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tipo documento</label>
              <select value={form.tipo_doc || 'BOLETA'} onChange={e => set('tipo_doc', e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-pink-300 outline-none">
                <option>BOLETA</option><option>FACTURA</option><option>SIN_DOCUMENTO</option>
              </select>
            </div>
          </div>
        </div>

        {/* Empresa */}
        {tipo === 'EMPRESA' && (
          <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
            <p className="text-sm font-semibold text-gray-700">Datos empresa</p>
            <div className="grid grid-cols-2 gap-4">
              <F label="RUT" k="id_fiscal" />
              <F label="Razón Social" k="razon_social" />
              <F label="Giro" k="giro" />
              <F label="Contacto" k="contacto" />
              <F label="Plazo pago (días)" k="plazo_pago" type="number" />
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <label className="text-xs font-medium text-gray-600 block mb-1">Observaciones</label>
          <textarea value={form.observaciones || ''} onChange={e => set('observaciones', e.target.value)} rows={3}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-pink-300 outline-none resize-none" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-70"
          style={{ background: 'linear-gradient(135deg, #E8177A, #A87BC8)' }}>
          <Save size={16} /> {loading ? 'Guardando...' : 'Guardar cliente'}
        </button>
      </form>
    </div>
  )
}
