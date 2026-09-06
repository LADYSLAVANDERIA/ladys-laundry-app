import { useEffect, useState } from 'react'
import { facturacionApi } from '../services/api'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { Download, AlertCircle, Check, X, FileText } from 'lucide-react'

const plata = (v: any) => Math.round(Number(v) || 0).toLocaleString('es-CL')
const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
// La fecha llega como instante UTC: se recorta el texto antes de leerla o en
// Chile se corre un día hacia atrás.
const fecha = (f: any) => {
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00')
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}
const inp = 'w-full border rounded-xl px-3 py-2 text-sm'

const VISTAS = [
  { id: 'facturar',    label: 'Órdenes por facturar' },
  { id: 'cobrar',      label: 'Órdenes por cobrar' },
  { id: 'consolidado', label: 'Consolidado' },
  { id: 'prenda',      label: 'Por prenda' },
  { id: 'emitidos',    label: 'Documentos emitidos' },
  { id: 'datos',       label: 'Datos de clientes' },
] as const
type Vista = typeof VISTAS[number]['id']

export default function Facturacion() {
  const [vista, setVista] = useState<Vista>('facturar')
  const [anio, setAnio] = useState(Number(hoy().slice(0, 4)))
  const [mes, setMes] = useState(Number(hoy().slice(5, 7)))
  const [clienteId, setClienteId] = useState<number | ''>('')
  const [clientes, setClientes] = useState<any[]>([])
  const [datos, setDatos] = useState<any>(null)
  const [sel, setSel] = useState<number[]>([])
  const [cargando, setCargando] = useState(false)
  const [editando, setEditando] = useState<any>(null)

  useEffect(() => { facturacionApi.clientes().then(r => setClientes(r.data.clientes)).catch(() => {}) }, [])

  const consultar = async (v: Vista = vista) => {
    setCargando(true); setSel([])
    const f = { anio, mes, cliente_id: clienteId || undefined }
    try {
      const r = v === 'facturar'    ? await facturacionApi.porFacturar(f)
              : v === 'cobrar'      ? await facturacionApi.porCobrar(f)
              : v === 'consolidado' ? await facturacionApi.consolidado(f)
              : v === 'prenda'      ? await facturacionApi.porPrenda(f)
              : v === 'emitidos'    ? await facturacionApi.emitidos()
              :                       await facturacionApi.empresas()
      setDatos(r.data)
    } catch { toast.error('No se pudo consultar') }
    finally { setCargando(false) }
  }
  useEffect(() => { consultar(vista) }, [vista])

  const filas: any[] = datos?.ordenes || datos?.clientes || datos?.items || datos?.dtes || datos?.empresas || []
  const todo = () => setSel(sel.length === filas.length ? [] : filas.map((f: any) => f.id))

  const exportar = () => {
    if (!filas.length) return toast.error('No hay nada que exportar')
    const cols = Object.keys(filas[0]).filter(k => !Array.isArray(filas[0][k]) && typeof filas[0][k] !== 'object')
    const csv = [cols.join(';'), ...filas.map((f: any) => cols.map(c => String(f[c] ?? '')).join(';'))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `${vista}_${anio}_${String(mes).padStart(2, '0')}.csv`
    a.click()
  }

  const generar = async () => {
    const elegidas = filas.filter((f: any) => sel.includes(f.id))
    const clientesDistintos = [...new Set(elegidas.map((f: any) => f.cliente_id))]
    if (clientesDistintos.length > 1) return toast.error('Selecciona órdenes de un solo cliente')
    const conFalta = elegidas.find((f: any) => f.falta?.length)
    if (conFalta) return toast.error(`A ${conFalta.cliente} le falta ${conFalta.falta.join(', ')}`)
    try {
      const { data } = await facturacionApi.crearDoc({ orden_ids: sel, tipo_dte: 33 })
      toast.success(`Documento borrador creado con ${data.ordenes} órdenes`)
      consultar()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo crear') }
  }

  const guardar = async () => {
    try {
      const { data } = await facturacionApi.guardar(editando.id, editando)
      toast.success(data.cliente.listo ? 'Guardado, ya puede facturar' : 'Guardado')
      setEditando(null); consultar()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo guardar') }
  }

  const T = datos?.totales
  const selTotal = filas.filter((f: any) => sel.includes(f.id)).reduce((s: number, f: any) => s + (f.total || 0), 0)

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Facturación</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {VISTAS.map(v => (
          <button key={v.id} onClick={() => setVista(v.id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
              vista === v.id ? 'text-white' : 'border text-gray-600'}`}
            style={vista === v.id ? { background: 'linear-gradient(135deg,#E8177A,#A87BC8)' } : {}}>
            {v.label}
          </button>
        ))}
      </div>

      {['facturar', 'consolidado', 'prenda', 'cobrar'].includes(vista) && (
        <div className="bg-white rounded-xl border p-4 flex flex-wrap items-end gap-2">
          {vista !== 'cobrar' && <>
            <div>
              <label className="text-xs text-gray-500">Año</label>
              <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={inp}>
                {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Mes</label>
              <select value={mes} onChange={e => setMes(Number(e.target.value))} className={inp}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </>}
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500">Cliente</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value ? Number(e.target.value) : '')} className={inp}>
              <option value="">Todos</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <button onClick={() => consultar()} className="px-5 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            Consultar
          </button>
          <button onClick={exportar} className="px-4 py-2 rounded-xl border text-sm text-gray-600 flex items-center gap-1.5">
            <Download size={15} /> Exportar
          </button>
        </div>
      )}

      {cargando ? <div className="py-16 text-center text-gray-400">Consultando…</div>
      : filas.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-sm text-gray-400">Sin resultados.</div>
      : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          {vista === 'facturar' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-2"><input type="checkbox" checked={sel.length === filas.length} onChange={todo} /></th>
                  <th className="p-2 text-left">Cliente</th><th className="p-2">Fecha</th><th className="p-2">OT</th>
                  <th className="p-2 text-right">Neto</th><th className="p-2 text-right">IVA</th>
                  <th className="p-2 text-right">Total</th><th className="p-2 text-right">Abono</th>
                  <th className="p-2 text-right">Pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.map((o: any) => (
                  <tr key={o.id} className={sel.includes(o.id) ? 'bg-pink-50' : ''}>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={sel.includes(o.id)}
                             onChange={() => setSel(s => s.includes(o.id) ? s.filter(x => x !== o.id) : [...s, o.id])} />
                    </td>
                    <td className="p-2">
                      <span className="text-gray-800">{o.cliente}</span>
                      {o.falta?.length > 0 && <span className="ml-1.5 text-[10px] text-red-600">falta {o.falta.join(', ')}</span>}
                    </td>
                    <td className="p-2 text-center text-gray-500">{fecha(o.fecha)}</td>
                    <td className="p-2 text-center"><Link to={`/ordenes/${o.id}`} className="text-blue-600 hover:underline">{o.id}</Link></td>
                    <td className="p-2 text-right">{plata(o.neto)}</td>
                    <td className="p-2 text-right">{plata(o.iva)}</td>
                    <td className="p-2 text-right font-medium">{plata(o.total)}</td>
                    <td className="p-2 text-right text-green-700">{plata(o.abono)}</td>
                    <td className="p-2 text-right text-gray-700">{plata(o.pendiente)}</td>
                  </tr>
                ))}
              </tbody>
              {T && (
                <tfoot className="bg-gray-50 font-semibold text-gray-800">
                  <tr>
                    <td colSpan={4} className="p-2 text-right">Totales</td>
                    <td className="p-2 text-right">{plata(T.neto)}</td>
                    <td className="p-2 text-right">{plata(T.iva)}</td>
                    <td className="p-2 text-right">{plata(T.total)}</td>
                    <td className="p-2 text-right">{plata(T.abono)}</td>
                    <td className="p-2 text-right">{plata(T.pendiente)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {vista === 'cobrar' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600"><tr>
                <th className="p-2 text-left">Cliente</th><th className="p-2">Fecha</th><th className="p-2">OT</th>
                <th className="p-2 text-right">Total</th><th className="p-2 text-right">Abono</th>
                <th className="p-2 text-right">Pendiente</th><th className="p-2">Días</th>
              </tr></thead>
              <tbody className="divide-y">
                {filas.map((o: any) => (
                  <tr key={o.id} className={o.vencida ? 'bg-red-50' : ''}>
                    <td className="p-2">{o.cliente}</td>
                    <td className="p-2 text-center text-gray-500">{fecha(o.fecha)}</td>
                    <td className="p-2 text-center"><Link to={`/ordenes/${o.id}`} className="text-blue-600 hover:underline">{o.id}</Link></td>
                    <td className="p-2 text-right">{plata(o.total)}</td>
                    <td className="p-2 text-right text-green-700">{plata(o.abono)}</td>
                    <td className="p-2 text-right font-medium">{plata(o.pendiente)}</td>
                    <td className={`p-2 text-center ${o.vencida ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{o.dias}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold"><tr>
                <td colSpan={5} className="p-2 text-right">Total pendiente</td>
                <td className="p-2 text-right">{plata(datos.total_pendiente)}</td><td />
              </tr></tfoot>
            </table>
          )}

          {vista === 'consolidado' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600"><tr>
                <th className="p-2 text-left">Cliente</th><th className="p-2">RUT</th><th className="p-2">Modo</th>
                <th className="p-2">Órdenes</th><th className="p-2 text-right">Neto</th>
                <th className="p-2 text-right">IVA</th><th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Pendiente</th>
              </tr></thead>
              <tbody className="divide-y">
                {filas.map((c: any) => (
                  <tr key={c.cliente_id}>
                    <td className="p-2"><Link to={`/clientes/${c.cliente_id}`} className="hover:underline">{c.cliente}</Link></td>
                    <td className="p-2 text-center text-gray-500">{c.id_fiscal || <span className="text-red-500">sin RUT</span>}</td>
                    <td className="p-2 text-center text-xs text-gray-500">{c.modo_facturacion === 'POR_PEDIDO' ? 'por pedido' : 'mensual'}</td>
                    <td className="p-2 text-center">{c.ordenes}</td>
                    <td className="p-2 text-right">{plata(c.neto)}</td>
                    <td className="p-2 text-right">{plata(c.iva)}</td>
                    <td className="p-2 text-right font-medium">{plata(c.total)}</td>
                    <td className="p-2 text-right">{plata(c.pendiente)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {vista === 'prenda' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600"><tr>
                <th className="p-2 text-left">Servicio</th><th className="p-2">Cantidad</th>
                <th className="p-2">Órdenes</th><th className="p-2 text-right">Total</th>
              </tr></thead>
              <tbody className="divide-y">
                {filas.map((i: any) => (
                  <tr key={i.nombre}>
                    <td className="p-2">{i.nombre}</td>
                    <td className="p-2 text-center">{i.cantidad}</td>
                    <td className="p-2 text-center text-gray-500">{i.ordenes}</td>
                    <td className="p-2 text-right font-medium">{plata(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {vista === 'emitidos' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600"><tr>
                <th className="p-2">Tipo</th><th className="p-2">Folio</th><th className="p-2 text-left">Cliente</th>
                <th className="p-2">Órdenes</th><th className="p-2 text-right">Total</th><th className="p-2">Estado</th>
              </tr></thead>
              <tbody className="divide-y">
                {filas.map((d: any) => (
                  <tr key={d.id}>
                    <td className="p-2 text-center">{d.tipo_dte}</td>
                    <td className="p-2 text-center">{d.folio || <span className="text-gray-400">—</span>}</td>
                    <td className="p-2">{d.cliente}</td>
                    <td className="p-2 text-center text-gray-500">{d.ordenes}</td>
                    <td className="p-2 text-right font-medium">{plata(d.total)}</td>
                    <td className="p-2 text-center text-xs">{d.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {vista === 'datos' && (
            <div className="divide-y">
              {filas.map((e: any) => (
                <div key={e.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{e.nombre_completo}</p>
                    <p className="text-xs text-gray-400">
                      {e.id_fiscal || 'sin RUT'} · ${plata(e.facturado)} · {e.ordenes} pedidos
                    </p>
                    {!e.listo && <p className="text-xs text-red-600 mt-0.5">falta {e.falta.join(', ')}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {e.listo ? <Check size={18} className="text-green-600" /> : <AlertCircle size={18} className="text-amber-500" />}
                    <button onClick={() => setEditando(e)} className="px-3 py-1.5 rounded-lg border text-xs text-gray-600">Editar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {vista === 'facturar' && sel.length > 0 && (
        <div className="sticky bottom-4 bg-white rounded-xl border shadow-lg p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <b>{sel.length}</b> {sel.length === 1 ? 'orden' : 'órdenes'} · ${plata(selTotal)}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSel([])} className="px-4 py-2 rounded-xl border text-sm text-gray-600">Limpiar</button>
            <button onClick={generar} className="px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-1.5"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              <FileText size={15} /> Generar documento
            </button>
          </div>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
             onClick={() => setEditando(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[92vh] overflow-y-auto"
               onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Datos para facturar</h2>
              <button onClick={() => setEditando(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500">{editando.nombre_completo}</p>
            {[
              ['id_fiscal', 'RUT', '76.123.456-7'],
              ['razon_social', 'Razón social', ''],
              ['giro', 'Giro', 'Hotelería, restaurante, etc.'],
              ['direccion_comercial', 'Dirección comercial', ''],
              ['comuna_comercial', 'Comuna', 'Concón'],
              ['email_facturacion', 'Correo de facturación', ''],
            ].map(([k, label, ph]) => (
              <div key={k}>
                <label className="text-xs text-gray-500">{label}</label>
                <input value={editando[k] || ''} placeholder={ph}
                       onChange={ev => setEditando({ ...editando, [k]: ev.target.value })} className={inp} />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500">Cómo se factura</label>
              <select value={editando.modo_facturacion || 'MENSUAL'}
                      onChange={ev => setEditando({ ...editando, modo_facturacion: ev.target.value })} className={inp}>
                <option value="MENSUAL">Una factura al cierre del mes</option>
                <option value="POR_PEDIDO">Una factura por cada pedido</option>
              </select>
            </div>
            <button onClick={guardar} className="w-full py-3 rounded-xl text-white font-medium"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  )
}
