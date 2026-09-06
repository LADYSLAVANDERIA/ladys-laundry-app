import { useEffect, useState } from 'react'
import { retirosApi, clientesApi, ordenesApi } from '../services/api'
import toast from 'react-hot-toast'
import { X, Truck, Search, Loader2 } from 'lucide-react'

// Solicitud de recogida: solo compromete el retiro. Los kilos, las prendas y el
// precio se cargan cuando la ropa llega al local, no antes.

const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300'
const dirTexto = (d: any) =>
  [[d.calle, d.numero].filter(Boolean).join(' '), d.otro, d.sector, d.ciudad].filter(Boolean).join(', ')

export default function SolicitudRecogida({ onCerrar, onListo }: { onCerrar: () => void; onListo?: () => void }) {
  const [busca, setBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<any[]>([])
  const [cliente, setCliente] = useState<any>(null)
  const [dirs, setDirs] = useState<any[]>([])

  const [fecha, setFecha] = useState(hoy())
  const [rutas, setRutas] = useState<any[]>([])
  const [rutaId, setRutaId] = useState('')
  const [recogerEn, setRecogerEn] = useState('')
  const [entregarEn, setEntregarEn] = useState('')
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feriado, setFeriado] = useState<string | null>(null)

  const buscar = async () => {
    if (busca.trim().length < 3) return toast.error('Escribe al menos 3 caracteres')
    setBuscando(true)
    try {
      const { data } = await clientesApi.getAll(busca.trim())
      setResultados(data || [])
      if (!data?.length) toast.error('Ningún cliente con ese dato')
    } catch { toast.error('No se pudo buscar') }
    finally { setBuscando(false) }
  }

  const elegir = async (c: any) => {
    setCliente(c); setResultados([])
    try {
      const { data } = await clientesApi.getById(c.id)
      const ds = data.direcciones || []
      setDirs(ds)
      const prin = ds.find((d: any) => d.es_principal) || ds[0]
      if (prin) { setRecogerEn(String(prin.id)); setEntregarEn(String(prin.id)) }
      if (!ds.length) toast.error('Este cliente no tiene dirección cargada')
    } catch { toast.error('No se pudo cargar el cliente') }
  }

  // Al cambiar la fecha se piden las rutas de ese día con los cupos que quedan.
  useEffect(() => {
    if (!fecha) return
    setRutaId('')
    retirosApi.disponibilidad(fecha)
      .then(({ data }) => {
        setFeriado(data.feriado || null)
        const rs = (data.rutas || []).filter((r: any) => r.tipo !== 'SOLO_ENTREGAS')
        setRutas(rs)
        const libre = rs.find((r: any) => r.cupos > 0)
        if (libre) setRutaId(String(libre.id))
      })
      .catch(() => setRutas([]))
  }, [fecha])

  const generar = async () => {
    if (!cliente) return toast.error('Elige el cliente')
    if (!recogerEn) return toast.error('Elige dónde recoger')
    if (!rutaId) return toast.error('Elige la ruta')
    setEnviando(true)
    try {
      const { data } = await retirosApi.create({
        cliente_id: cliente.id, fecha, ruta_id: Number(rutaId),
        dir_id: Number(recogerEn), observaciones: obs || null, origen: 'LOCAL',
      })
      // El motor deja la misma dirección para retiro y entrega; si el cliente
      // pidió devolverla en otra parte, se corrige acá.
      if (entregarEn && entregarEn !== recogerEn) {
        await ordenesApi.update(data.ot, { dir_entrega_id: Number(entregarEn) })
      }
      toast.success(`Solicitud ${data.ot_texto} · ${data.ruta} ${data.hora}`)
      onListo?.(); onCerrar()
    } catch (e: any) {
      const d = e?.response?.data
      toast.error(d?.error || 'No se pudo generar la solicitud')
    } finally { setEnviando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onCerrar}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3 my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Solicitud de recogida a domicilio</h2>
          <button onClick={onCerrar}><X size={20} className="text-gray-400" /></button>
        </div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Cliente</label>
          {cliente ? (
            <div className="flex items-center justify-between border rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {cliente.razon_social || `${cliente.nombre} ${cliente.apellido || ''}`.trim()}
                </p>
                <p className="text-xs text-gray-500">{cliente.telefono || 'sin teléfono'}</p>
              </div>
              <button onClick={() => { setCliente(null); setDirs([]); setRecogerEn(''); setEntregarEn('') }}
                      className="text-xs text-gray-500 underline shrink-0 ml-2">cambiar</button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input className={inp} placeholder="Teléfono o nombre para buscar" value={busca}
                       onChange={e => setBusca(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && buscar()} />
                <button onClick={buscar} disabled={buscando} className="px-3 border rounded-xl text-gray-500">
                  {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>
              {resultados.length > 0 && (
                <div className="mt-2 border rounded-xl divide-y max-h-52 overflow-y-auto">
                  {resultados.slice(0, 25).map(c => (
                    <button key={c.id} onClick={() => elegir(c)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50">
                      <p className="text-sm text-gray-800">
                        {c.razon_social || `${c.nombre} ${c.apellido || ''}`.trim()}
                      </p>
                      <p className="text-xs text-gray-500">{c.telefono || 'sin teléfono'}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">F. Recogida</label>
            <input type="date" className={inp} value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Rt. Recogida</label>
            <select className={inp} value={rutaId} onChange={e => setRutaId(e.target.value)}>
              <option value="">Elige la ruta…</option>
              {rutas.map(r => (
                <option key={r.id} value={r.id} disabled={r.cupos <= 0}>
                  {String(r.hora_inicio).slice(0, 5)}–{String(r.hora_fin).slice(0, 5)} · {r.cupos > 0 ? `${r.cupos} cupos` : 'sin cupos'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {feriado && (
          <p className="text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200">
            Ese día es feriado ({feriado}): no hay ruta.
          </p>
        )}
        {!feriado && !rutas.length && (
          <p className="text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200">
            No hay ruta de retiro ese día.
          </p>
        )}

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Recoger en</label>
          <select className={inp} value={recogerEn} onChange={e => setRecogerEn(e.target.value)} disabled={!dirs.length}>
            <option value="">{dirs.length ? 'Elige la dirección…' : 'Primero elige el cliente'}</option>
            {dirs.map(d => <option key={d.id} value={d.id}>{dirTexto(d)}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Entregar en</label>
          <select className={inp} value={entregarEn} onChange={e => setEntregarEn(e.target.value)} disabled={!dirs.length}>
            <option value="">Igual que la de recogida</option>
            {dirs.map(d => <option key={d.id} value={d.id}>{dirTexto(d)}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Obs</label>
          <textarea className={inp} rows={2} value={obs} onChange={e => setObs(e.target.value)}
                    placeholder="Timbre malo, dejar con conserje, llamar antes…" />
        </div>

        <button onClick={generar} disabled={enviando}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm disabled:opacity-50">
          <Truck size={17} /> {enviando ? 'Generando…' : 'Generar solicitud'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Los kilos y el precio se cargan cuando la ropa llegue al local.
        </p>
      </div>
    </div>
  )
}
