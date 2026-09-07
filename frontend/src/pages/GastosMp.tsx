import { useEffect, useState } from 'react'
import { gastosMpApi } from '../services/api'
import toast from 'react-hot-toast'
import { CreditCard, Check, X, RefreshCw, Undo2, Ban } from 'lucide-react'
import { fmt } from '../utils'

// Los cargos de la tarjeta de Mercado Pago entran acá sin explicación. Mientras
// no tengan motivo no son una compra: son plata que salió y nadie sabe por qué.
// Al conciliar se crea la compra en Compras / Gastos con el mismo monto, así que
// el monto nunca se teclea a mano y no puede quedar distinto al del banco.

const TIPOS = ['Insumos', 'Detergentes', 'Mantención', 'Combustible', 'Servicios',
               'Arriendo', 'Sueldos', 'Marketing', 'Oficina', 'Otro']

const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300'

export default function GastosMp() {
  const hoy = new Date().toLocaleDateString('en-CA')
  const [desde, setDesde] = useState(hoy.substring(0, 8) + '01')
  const [hasta, setHasta] = useState(hoy)
  const [d, setD] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [ver, setVer] = useState<'PENDIENTE' | 'TODOS'>('PENDIENTE')
  const [sel, setSel] = useState<any>(null)
  const [form, setForm] = useState<any>({ tipo_doc: 'BOLETA' })
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    setCargando(true)
    gastosMpApi.listar(desde, hasta)
      .then(r => setD(r.data))
      .catch(e => toast.error(e?.response?.data?.error || 'No se pudo consultar Mercado Pago'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, [desde, hasta])

  const abrir = (g: any) => {
    setSel(g)
    setForm({ tipo_doc: 'BOLETA', fecha_compra: String(g.fecha).slice(0, 10), glosa: '', folio: '', tipo_gasto: '' })
  }

  const conciliar = async () => {
    if (!String(form.glosa || '').trim()) return toast.error('Escribe para qué fue esta compra')
    setGuardando(true)
    try {
      await gastosMpApi.conciliar({ mp_payment_id: sel.mp_payment_id, ...form })
      toast.success('Gasto conciliado y registrado en Compras')
      setSel(null); cargar()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo conciliar') }
    finally { setGuardando(false) }
  }

  const descartar = async () => {
    const motivo = String(form.glosa || '').trim()
    if (!motivo) return toast.error('Escribe por qué no es un gasto del negocio')
    try {
      await gastosMpApi.descartar(sel.mp_payment_id, motivo)
      toast.success('Descartado, con el motivo anotado')
      setSel(null); cargar()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo descartar') }
  }

  const reabrir = async (g: any) => {
    if (!confirm('Se deshace la conciliación y se borra la compra asociada. ¿Seguir?')) return
    try { await gastosMpApi.reabrir(g.mp_payment_id); toast.success('Vuelve a pendientes'); cargar() }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo reabrir') }
  }

  const t = d?.totales || {}
  const lista = (d?.gastos || []).filter((g: any) => ver === 'TODOS' || g.estado === 'PENDIENTE')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gastos de Mercado Pago</h1>
          <p className="text-sm text-gray-500">Cargos hechos con la tarjeta. Conciliar deja la compra registrada.</p>
        </div>
        <button onClick={cargar} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm text-gray-600">
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border rounded-xl px-3 py-2 text-sm" />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border rounded-xl px-3 py-2 text-sm" />
        <button onClick={() => setVer(ver === 'PENDIENTE' ? 'TODOS' : 'PENDIENTE')}
                className="px-3 py-2 rounded-xl border text-sm text-gray-600">
          {ver === 'PENDIENTE' ? 'Ver todos' : 'Ver solo pendientes'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400">Por conciliar</p>
          <p className="text-xl font-bold text-purple-700">{fmt(t.monto_pendiente)}</p>
          <p className="text-xs text-gray-400">{t.pendientes || 0} movimientos</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400">Conciliado</p>
          <p className="text-xl font-bold text-green-600">{fmt(t.monto_conciliado)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400">Descartado</p>
          <p className="text-xl font-bold text-gray-400">{fmt(t.monto_descartado)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        {cargando ? (
          <p className="p-6 text-sm text-gray-400">Consultando Mercado Pago…</p>
        ) : lista.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No hay gastos {ver === 'PENDIENTE' ? 'pendientes' : ''} en este rango.</p>
        ) : lista.map((g: any) => (
          <div key={g.mp_payment_id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b last:border-0">
            <CreditCard size={16} className="text-gray-300 shrink-0" />
            <div className="flex-1 min-w-[170px]">
              <p className="font-medium text-gray-800">{g.comercio || 'Cargo sin detalle'}</p>
              <p className="text-xs text-gray-400">
                {g.cuando} · Operación {g.mp_payment_id}
                {g.motivo ? ` · ${g.motivo}` : ''}
              </p>
            </div>
            <span className="font-semibold text-gray-800">{fmt(g.monto)}</span>
            {g.estado === 'PENDIENTE' ? (
              <button onClick={() => abrir(g)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
                      style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                <Check size={14} /> Conciliar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full ${g.estado === 'CONCILIADO' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {g.estado === 'CONCILIADO' ? `Compra #${g.compra_id}` : 'Descartado'}
                </span>
                <button onClick={() => reabrir(g)} title="Deshacer" className="p-1.5 text-gray-400 hover:text-gray-600">
                  <Undo2 size={15} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {sel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setSel(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Conciliar gasto</h2>
              <button onClick={() => setSel(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="rounded-xl bg-gray-50 border p-3">
              <p className="font-medium text-gray-800">{sel.comercio || 'Cargo sin detalle'}</p>
              <p className="text-sm text-gray-500">{fmt(sel.monto)} · {sel.cuando}</p>
              <p className="text-xs text-gray-400">Operación {sel.mp_payment_id}</p>
            </div>

            <textarea value={form.glosa} onChange={e => setForm({ ...form, glosa: e.target.value })}
              placeholder="¿Para qué fue esta compra?" rows={2} className={inp} />
            <select value={form.tipo_gasto} onChange={e => setForm({ ...form, tipo_gasto: e.target.value })} className={inp}>
              <option value="">Tipo de gasto…</option>
              {TIPOS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.tipo_doc} onChange={e => setForm({ ...form, tipo_doc: e.target.value })} className={inp}>
                <option value="BOLETA">Boleta</option>
                <option value="FACTURA">Factura</option>
                <option value="SIN_DOCUMENTO">Sin documento</option>
              </select>
              <input value={form.folio} onChange={e => setForm({ ...form, folio: e.target.value })}
                placeholder="N.° de documento" className={inp} />
            </div>
            <input type="date" value={form.fecha_compra} onChange={e => setForm({ ...form, fecha_compra: e.target.value })} className={inp} />
            <p className="text-xs text-gray-400">El monto lo toma del cargo real ({fmt(sel.monto)}); no se puede editar.</p>

            <div className="flex gap-2 pt-1">
              <button onClick={conciliar} disabled={guardando}
                      className="flex-1 py-3 rounded-xl bg-green-500 text-white font-semibold text-sm disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Conciliar y registrar'}
              </button>
              <button onClick={descartar} title="No es gasto del negocio"
                      className="flex items-center gap-1.5 px-3 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm">
                <Ban size={15} /> No es gasto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
