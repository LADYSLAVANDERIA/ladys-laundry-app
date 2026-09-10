import { useEffect, useState } from 'react'
import { factturaApi } from '../services/api'
import toast from 'react-hot-toast'
import { Save, FileText, ShieldCheck, AlertTriangle, Check, Power, Plug, ExternalLink } from 'lucide-react'

const inp = 'w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300'
const plata = (v: any) => Math.round(Number(v) || 0).toLocaleString('es-CL')

export default function ConfigFacttura() {
  const [d, setD] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [clave, setClave] = useState('')

  const cargar = () => {
    factturaApi.estado()
      .then(({ data }) => setD(data))
      .catch(() => toast.error('No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, [])

  const guardarConfig = async (cambios: any) => {
    setGuardando(true)
    try { await factturaApi.config(cambios); toast.success('Guardado'); cargar() }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo guardar') }
    finally { setGuardando(false) }
  }

  const guardarClave = async () => {
    if (clave.trim().length < 20) return toast.error('Esa clave se ve muy corta')
    setGuardando(true)
    try {
      await factturaApi.token({ ambiente: d.ambiente, token: clave.trim() })
      toast.success('Clave guardada en la bóveda')
      setClave(''); cargar()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo guardar') }
    finally { setGuardando(false) }
  }

  const probar = async () => {
    setProbando(true)
    try {
      const { data } = await factturaApi.probar()
      if (data.ok) toast.success('Conectado con Facttura')
      else toast.error(`Facttura respondió ${data.status || ''}`)
      console.log('Facttura:', data)
    } catch { toast.error('No se pudo probar') }
    finally { setProbando(false) }
  }

  if (cargando) return <div className="py-16 text-center text-gray-400">Cargando…</div>
  if (!d) return null

  const produccion = d.ambiente === 'produccion'
  const listo = d.token?.cargado && d.desde

  return (
    <div className="space-y-5">

      {/* Estado */}
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileText size={17} className="text-gray-400" /> Facturación electrónica
          </h2>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            d.activa ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {d.activa ? 'Emisión automática encendida' : 'Emisión automática apagada'}
          </span>
        </div>

        <p className="text-sm text-gray-500">
          Emite <b>solo facturas</b>. Las boletas siguen saliendo por Mercado Pago y el SII;
          este módulo no las toca.
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">Ambiente</label>
            <select className={inp} value={d.ambiente}
                    onChange={e => guardarConfig({ ambiente: e.target.value })}>
              <option value="sandbox">Pruebas (demo)</option>
              <option value="produccion">Producción</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Emitir desde</label>
            <input type="date" className={inp} value={(d.desde || '').slice(0, 10)}
                   onChange={e => guardarConfig({ desde: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Servidor</label>
            <input className={`${inp} bg-gray-50 text-gray-500`} value={d.base || ''} readOnly />
          </div>
        </div>

        <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Las órdenes retiradas <b>antes</b> de esa fecha nunca se facturan desde acá.
          Protege lo que ya emitiste a mano en MiPyme.
        </div>

        <button onClick={() => guardarConfig({ activa: !d.activa })} disabled={guardando || (!listo && !d.activa)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 ${
            d.activa ? 'bg-gray-700' : ''}`}
          style={!d.activa ? { background: 'linear-gradient(135deg,#E8177A,#A87BC8)' } : {}}>
          <Power size={15} /> {d.activa ? 'Apagar emisión automática' : 'Encender emisión automática'}
        </button>
        {!listo && !d.activa &&
          <p className="text-xs text-gray-400">Falta cargar la clave para poder encenderla.</p>}
      </div>

      {/* Clave */}
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <ShieldCheck size={17} className="text-gray-400" /> Clave de API — {produccion ? 'producción' : 'pruebas'}
        </h2>

        {d.token?.cargado ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Check size={15} /> Cargada, termina en <b>{d.token.termina_en}</b>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle size={15} /> Sin clave para este ambiente
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input className={`${inp} flex-1 min-w-[260px] font-mono`} type="password" value={clave}
                 placeholder="Pegar la clave de Facttura"
                 onChange={e => setClave(e.target.value)} />
          <button onClick={guardarClave} disabled={guardando || !clave.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            <Save size={15} /> Guardar
          </button>
          <button onClick={probar} disabled={probando || !d.token?.cargado}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border text-gray-600 disabled:opacity-40">
            <Plug size={15} /> {probando ? 'Probando…' : 'Probar conexión'}
          </button>
        </div>

        <p className="text-xs text-gray-400">
          Se guarda cifrada. Ni esta pantalla ni nadie puede volver a leerla completa: solo reemplazarla.
        </p>
      </div>

      {/* Bloqueadas */}
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle size={17} className="text-gray-400" /> Órdenes que no se pueden facturar
          </h2>
          <span className="text-sm text-gray-500">{d.listas} listas para emitir</span>
        </div>

        {!d.bloqueadas?.length ? (
          <p className="text-sm text-gray-400">Ninguna bloqueada.</p>
        ) : (
          <div className="divide-y">
            {d.bloqueadas.map((b: any) => (
              <div key={b.ordenes.join('-')} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700">OT {b.ordenes.join(', ')}</span>
                <span className="text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  {b.motivo}
                </span>
                <span className="text-gray-500 tabular-nums">${plata(b.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emitidos */}
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-3">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <FileText size={17} className="text-gray-400" /> Documentos emitidos por el sistema
        </h2>
        {!d.emitidos?.length ? (
          <p className="text-sm text-gray-400">Todavía no se ha emitido ninguno.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 text-left">
                <tr><th className="py-1.5">Folio</th><th>Cliente</th><th>Fecha</th>
                    <th className="text-right">Total</th><th>Estado</th><th>SII</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {d.emitidos.map((f: any) => (
                  <tr key={f.id}>
                    <td className="py-2 font-medium">{f.folio || '—'}</td>
                    <td className="text-gray-600">{f.cliente}</td>
                    <td className="text-gray-500">{String(f.periodo || '').slice(0, 10)}</td>
                    <td className="text-right tabular-nums">${plata(f.total)}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        f.estado === 'EMITIDO' ? 'bg-green-50 text-green-700'
                        : f.estado === 'ERROR' ? 'bg-red-50 text-red-700'
                        : 'bg-gray-100 text-gray-500'}`} title={f.ultimo_error || ''}>
                        {f.estado}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500">{f.sii_estado || '—'}</td>
                    <td>{f.pdf_url &&
                      <a href={f.pdf_url} target="_blank" rel="noreferrer"
                         className="text-pink-600 inline-flex items-center gap-1 text-xs">
                        PDF <ExternalLink size={12} />
                      </a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
