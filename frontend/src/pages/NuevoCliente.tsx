import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientesApi, dirApi } from '../services/api'
import MapaDireccion from '../components/MapaDireccion'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, MapPin } from 'lucide-react'

// Definido fuera del componente a proposito. Adentro, React lo veia como un tipo
// nuevo en cada render: al escribir una letra cambiaba el formulario, el input
// se destruia y se creaba otro, y el cursor saltaba. Solo se podia escribir de a
// una letra volviendo a pinchar el campo.
function Campo({ label, valor, onChange, type = 'text', required = false }: {
  label: string; valor: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">
        {label}{required && <span className="text-pink-500 ml-1">*</span>}
      </label>
      <input type={type} value={valor} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-pink-300 outline-none" />
    </div>
  )
}

export default function NuevoCliente() {
  const navigate = useNavigate()
  const [tipo, setTipo] = useState('PARTICULAR')
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [dir, setDir] = useState<any>({ ciudad: 'Concón' })

  const set = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre) return toast.error('El nombre es obligatorio')
    setLoading(true)
    try {
      const { data } = await clientesApi.create({ ...form, tipo })
      if (dir.calle) {
        try { await dirApi.crear(data.id, { ...dir, es_principal: true }) }
        catch { toast('Cliente creado, pero la dirección no se guardó', { icon: '⚠️' }) }
      }
      toast.success('Cliente creado')
      navigate(`/clientes/${data.id}`)
    } catch { toast.error('Error al crear cliente') }
    finally { setLoading(false) }
  }

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
            <Campo label="Nombre" valor={form.nombre || ''} onChange={v => set('nombre', v)} required />
            <Campo label="Apellido" valor={form.apellido || ''} onChange={v => set('apellido', v)} />
            <Campo label="Teléfono" valor={form.telefono || ''} onChange={v => set('telefono', v)} type="tel" />
            <Campo label="Email" valor={form.email || ''} onChange={v => set('email', v)} type="email" />
            <Campo label="Fecha nacimiento" valor={form.fecha_nacimiento || ''} onChange={v => set('fecha_nacimiento', v)} type="date" />
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
              <Campo label="RUT" valor={form.id_fiscal || ''} onChange={v => set('id_fiscal', v)} />
              <Campo label="Razón Social" valor={form.razon_social || ''} onChange={v => set('razon_social', v)} />
              <Campo label="Giro" valor={form.giro || ''} onChange={v => set('giro', v)} />
              <Campo label="Contacto" valor={form.contacto || ''} onChange={v => set('contacto', v)} />
              <Campo label="Plazo pago (días)" valor={form.plazo_pago || ''} onChange={v => set('plazo_pago', v)} type="number" />
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <label className="text-xs font-medium text-gray-600 block mb-1">Observaciones</label>
          <textarea value={form.observaciones || ''} onChange={e => set('observaciones', e.target.value)} rows={3}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-pink-300 outline-none resize-none" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-2">

          <p className="font-semibold text-gray-700 text-sm flex items-center gap-1.5"><MapPin size={15} className="text-pink-500" /> Dirección de retiro y entrega</p>

          <p className="text-xs text-gray-400">Opcional. Ubicar el punto en el mapa evita que el conductor se pierda.</p>

          <MapaDireccion valor={dir} onChange={setDir} alto={200} />

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
