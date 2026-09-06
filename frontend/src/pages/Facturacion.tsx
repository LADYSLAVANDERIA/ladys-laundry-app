import { useEffect, useState } from 'react'
import { facturacionApi } from '../services/api'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { FileText, Building2, AlertCircle, Check, X, Copy, RefreshCw } from 'lucide-react'

const plata = (n: any) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')
const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const mesLargo = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
// La fecha llega como instante UTC; se recorta antes de leerla o en Chile
// se corre un día hacia atrás.
const dia = (f: any) => {
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}
const inp = 'w-full border rounded-xl px-3 py-2 text-sm'

export default function Facturacion() {
  const [tab, setTab] = useState<'borradores' | 'empresas'>('borradores')
  const [periodo, setPeriodo] = useState(hoy().slice(0, 7))
  const [bor, setBor] = useState<any>(null)
  const [empresas, setEmpresas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<any>(null)
  const [ver, setVer] = useState<any>(null)

  const cargar = (p = periodo) => {
    setCargando(true)
    Promise.all([facturacionApi.borradores(p), facturacionApi.empresas()])
      .then(([b, e]) => { setBor(b.data); setEmpresas(e.data.empresas) })
      .catch(() => toast.error('No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, [])

  const guardar = async () => {
    try {
      const { data } = await facturacionApi.guardar(editando.id, editando)
      toast.success(data.cliente.listo ? 'Guardado, ya puede facturar' : 'Guardado')
      setEditando(null); cargar()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo guardar')
    }
  }

  // Texto listo para pegar en el portal del SII mientras la emisión sea manual.
  const copiar = (b: any) => {
    const c = empresas.find((x) => x.id === b.cliente_id) || {}
    const txt = [
      `RUT: ${c.id_fiscal || '—'}`,
      `Razón social: ${c.razon_social || b.cliente}`,
      `Giro: ${c.giro || '—'}`,
      `Dirección: ${c.direccion_comercial || '—'}, ${c.comuna_comercial || '—'}`,
      ``,
      `Servicio de lavandería — ${mesLargo(bor.periodo)}`,
      `Pedidos: ${b.ordenes.map((o: any) => '#' + o.id).join(', ')}`,
      ``,
      `Neto: ${plata(b.neto)}`,
      `IVA: ${plata(b.iva)}`,
      `Total: ${plata(b.total)}`,
    ].join('\n')
    navigator.clipboard.writeText(txt)
      .then(() => toast.success('Copiado, pégalo en el portal del SII'))
      .catch(() => toast.error('No se pudo copiar'))
  }

  if (cargando || !bor) return <div className="py-20 text-center text-gray-400">Cargando…</div>

  const sinDatos = empresas.filter((e) => !e.listo).length

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Facturación a empresas</h1>
        <button onClick={() => cargar()} className="p-2.5 rounded-xl border text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {sinDatos > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <b>{sinDatos} de {empresas.length} empresas no pueden facturar todavía.</b> Les falta RUT,
            giro, dirección o comuna. Sin esos datos el SII rechaza el documento.
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['borradores', 'empresas'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 ${
              tab === t ? 'text-white' : 'border text-gray-600'}`}
            style={tab === t ? { background: 'linear-gradient(135deg,#E8177A,#A87BC8)' } : {}}>
            {t === 'borradores' ? <FileText size={15} /> : <Building2 size={15} />}
            {t === 'borradores' ? 'Borradores del mes' : `Datos (${empresas.length})`}
          </button>
        ))}
      </div>

      {tab === 'borradores' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="border rounded-xl px-3 py-2 text-sm" />
            <button onClick={() => cargar(periodo)} className="px-4 py-2 rounded-xl border text-sm text-gray-600">Ver período</button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500">Documentos</p>
              <p className="text-xl font-bold text-gray-800">{bor.documentos}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500">Pedidos</p>
              <p className="text-xl font-bold text-gray-800">{bor.ordenes_incluidas}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-800">{plata(bor.total)}</p>
            </div>
          </div>

          {bor.borradores.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-sm text-gray-400">
              No hay pedidos de empresas sin facturar en {mesLargo(bor.periodo)}.
            </div>
          ) : bor.borradores.map((b: any) => (
            <div key={b.clave} className="bg-white rounded-xl border p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <Link to={`/clientes/${b.cliente_id}`} className="font-semibold text-gray-800 hover:underline">
                    {b.cliente}
                  </Link>
                  <p className="text-xs text-gray-400">
                    {b.modo === 'POR_PEDIDO' ? 'Factura por pedido' : 'Factura mensual consolidada'}
                    {' · '}{b.ordenes.length} {b.ordenes.length === 1 ? 'pedido' : 'pedidos'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{plata(b.total)}</p>
                  <p className="text-xs text-gray-400">neto {plata(b.neto)} · IVA {plata(b.iva)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {b.ordenes.map((o: any) => (
                  <Link key={o.id} to={`/ordenes/${o.id}`}
                        className="text-xs bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1 text-gray-600">
                    #{o.id} <span className="text-gray-400">{dia(o.fecha)}</span> {plata(o.monto)}
                  </Link>
                ))}
              </div>

              {b.puede_emitir ? (
                <button onClick={() => copiar(b)}
                        className="w-full py-2.5 rounded-xl border text-sm font-medium text-gray-700 flex items-center justify-center gap-2">
                  <Copy size={15} /> Copiar datos para el portal del SII
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    Falta {b.falta.join(', ')}.{' '}
                    <button onClick={() => { setTab('empresas'); setEditando(empresas.find((e) => e.id === b.cliente_id)) }}
                            className="underline font-medium">Completar ahora</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'empresas' && (
        <div className="bg-white rounded-xl border divide-y">
          {empresas.map((e) => (
            <div key={e.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">{e.nombre_completo}</p>
                <p className="text-xs text-gray-400">
                  {plata(e.facturado)} · {e.ordenes} pedidos ·{' '}
                  {e.modo_facturacion === 'POR_PEDIDO' ? 'por pedido' : 'mensual'}
                </p>
                {!e.listo && <p className="text-xs text-red-600 mt-0.5">falta {e.falta.join(', ')}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {e.listo
                  ? <Check size={18} className="text-green-600" />
                  : <AlertCircle size={18} className="text-amber-500" />}
                <button onClick={() => setEditando(e)} className="px-3 py-1.5 rounded-lg border text-xs text-gray-600">
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
             onClick={() => setEditando(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[92vh] overflow-y-auto"
               onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Datos para facturar</h2>
              <button onClick={() => setEditando(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500">{editando.nombre_completo}</p>

            <div>
              <label className="text-xs text-gray-500">RUT</label>
              <input value={editando.id_fiscal || ''} placeholder="76.123.456-7"
                     onChange={(ev) => setEditando({ ...editando, id_fiscal: ev.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Razón social</label>
              <input value={editando.razon_social || ''}
                     onChange={(ev) => setEditando({ ...editando, razon_social: ev.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Giro</label>
              <input value={editando.giro || ''} placeholder="Hotelería, restaurante, etc."
                     onChange={(ev) => setEditando({ ...editando, giro: ev.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Dirección</label>
              <input value={editando.direccion_comercial || ''}
                     onChange={(ev) => setEditando({ ...editando, direccion_comercial: ev.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Comuna</label>
              <input value={editando.comuna_comercial || ''} placeholder="Concón"
                     onChange={(ev) => setEditando({ ...editando, comuna_comercial: ev.target.value })} className={inp} />
              <p className="text-[11px] text-gray-400 mt-1">Va en campo aparte: dentro de la dirección el SII la rechaza.</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">Correo para enviar la factura</label>
              <input value={editando.email_facturacion || ''} type="email"
                     onChange={(ev) => setEditando({ ...editando, email_facturacion: ev.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Cómo se factura</label>
              <select value={editando.modo_facturacion || 'MENSUAL'}
                      onChange={(ev) => setEditando({ ...editando, modo_facturacion: ev.target.value })} className={inp}>
                <option value="MENSUAL">Una factura al cierre del mes</option>
                <option value="POR_PEDIDO">Una factura por cada pedido</option>
              </select>
            </div>

            <button onClick={guardar} className="w-full py-3 rounded-xl text-white font-medium"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
