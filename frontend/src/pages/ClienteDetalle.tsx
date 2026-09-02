import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clientesApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, MessageCircle, Plus, X, MapPin, Save, Percent, CreditCard, Package, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { fmt, ot, fechaCorta, fechaHora, waLink, ESTADO_COLOR, ESTADO_LABEL } from '../utils'

const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300'

export default function ClienteDetalle() {
  const { id } = useParams(); const navigate = useNavigate()
  const [c, setC] = useState<any>(null); const [modal, setModal] = useState<string | null>(null)
  const [dir, setDir] = useState<any>({ ciudad: 'Concón' }); const [edit, setEdit] = useState<any>(null)

  const load = async () => { try { const { data } = await clientesApi.getById(id!); setC(data); } catch { toast.error('Cliente no encontrado'); navigate('/clientes') } }
  useEffect(() => { load() }, [id])
  if (!c) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" /></div>

  const guardarDir = async () => {
    if (!dir.calle) return toast.error('Ingresa la calle')
    try { await clientesApi.addDireccion(c.id, dir); toast.success('Dirección agregada'); setModal(null); setDir({ ciudad: 'Concón' }); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  const borrarDir = async (dirId: number) => {
    try { await clientesApi.removeDireccion(c.id, dirId); toast.success('Dirección eliminada'); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo eliminar') }
  }
  const guardar = async () => {
    try { await clientesApi.update(c.id, edit); toast.success('Cliente actualizado'); setModal(null); setEdit(null); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  const cont = c.continuidad_info

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{c.nombre} {c.apellido}</h1>
          <p className="text-sm text-gray-500">{c.telefono || 'sin teléfono'} · {c.tipo}{c.plazo_pago > 0 && ` · crédito ${c.plazo_pago} días`}</p>
        </div>
        {c.telefono && <a href={waLink(c.telefono, `Hola ${c.nombre}, te escribimos de Ladys Lavandería.`)} target="_blank" rel="noreferrer" className="p-2.5 border rounded-xl text-green-600 hover:bg-green-50"><MessageCircle size={16} /></a>}
        <button onClick={() => navigate(`/ordenes/nueva?cliente=${c.id}`)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}><Plus size={15} /> Nueva OT</button>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        {[['Órdenes', c.stats?.total_ordenes || 0], ['Total gastado', fmt(c.stats?.total_gastado)], ['Saldo pendiente', fmt(c.stats?.saldo_total)], ['Última orden', c.stats?.ultima_orden ? fechaCorta(c.stats.ultima_orden) : '—']].map(([l, v], i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border p-4"><p className="text-xs text-gray-400">{l}</p><p className={`text-lg font-bold ${i === 2 && Number(c.stats?.saldo_total) > 0 ? 'text-red-500' : 'text-gray-800'}`}>{v}</p></div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Continuidad */}
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-700 flex items-center gap-1.5"><Percent size={15} className="text-green-500" /> Continuidad</p>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={!!c.continuidad} onChange={async e => { await clientesApi.update(c.id, { continuidad: e.target.checked }); load() }} /> Activa
            </label>
          </div>
          {c.continuidad ? (
            <>
              <p className={`text-sm font-medium mb-2 ${cont.elegible ? 'text-green-600' : 'text-amber-600'}`}>
                {cont.elegible ? '✓ Elegible para 10% de descuento este mes' : `Descuento perdido · ${cont.semanas_perdidas} semana${cont.semanas_perdidas !== 1 ? 's' : ''} sin pedido`}
              </p>
              <div className="space-y-1.5">
                {cont.semanas.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {s.con_orden ? <CheckCircle2 size={13} className="text-green-500" /> : s.vencida ? <X size={13} className="text-red-400" /> : <Circle size={13} className="text-gray-300" />}
                    <span className={s.con_orden ? 'text-gray-700' : s.vencida ? 'text-red-500' : 'text-gray-400'}>Semana del {fechaCorta(s.ini)} — {s.con_orden ? 'con pedido' : s.vencida ? 'sin pedido' : 'en curso'}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-gray-400">Cliente sin continuidad activa. Actívala si pide al menos una vez por semana.</p>}
        </div>

        {/* Membresía */}
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <p className="font-semibold text-gray-700 flex items-center gap-1.5 mb-3"><CreditCard size={15} className="text-purple-500" /> Membresía</p>
          {c.membresia ? (
            <div>
              <p className="text-2xl font-bold text-purple-600">{fmt(c.membresia.saldo_actual)}</p>
              <p className="text-xs text-gray-400">de {fmt(c.membresia.saldo_inicial)} · {c.membresia.plan}</p>
              <p className="text-xs text-gray-400 mt-1">Vence {fechaCorta(c.membresia.fecha_venc)}</p>
              <button onClick={() => navigate('/membresias')} className="mt-3 text-xs text-purple-600 font-medium">Ver movimientos →</button>
            </div>
          ) : <p className="text-sm text-gray-400">Sin membresía activa. <button onClick={() => navigate('/membresias')} className="text-purple-600 font-medium">Activar →</button></p>}
        </div>
      </div>

      {/* Direcciones */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-700 flex items-center gap-1.5"><MapPin size={15} className="text-pink-500" /> Direcciones</p>
          <button onClick={() => setModal('dir')} className="text-xs text-pink-600 font-medium flex items-center gap-1"><Plus size={13} /> Agregar</button>
        </div>
        {c.direcciones?.length ? (
          <div className="space-y-2">
            {c.direcciones.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between border rounded-xl px-3 py-2.5">
                <p className="text-sm text-gray-700">{d.calle} {d.numero}{d.otro ? `, ${d.otro}` : ''}{d.sector ? ` — ${d.sector}` : ''}{d.ciudad ? `, ${d.ciudad}` : ''} {d.es_principal && <span className="ml-1 text-[10px] bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded">principal</span>}</p>
                <button onClick={() => borrarDir(d.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">Sin direcciones registradas</p>}
      </div>

      {/* Notas y flags */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-gray-700">Notas internas</p>
          <button onClick={() => { setEdit({ notas_internas: c.notas_internas || '', plazo_pago: c.plazo_pago, es_ladys2: c.es_ladys2, tipo: c.tipo, telefono: c.telefono || '', email: c.email || '' }); setModal('edit') }} className="text-xs text-pink-600 font-medium">Editar</button>
        </div>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.notas_internas || 'Sin notas'}</p>
        {c.es_ladys2 && <p className="text-xs bg-gray-100 text-gray-600 rounded-lg px-2 py-1 mt-2 inline-block">Cliente de Ladys 2 — excluido de las métricas</p>}
      </div>

      {/* Órdenes */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 text-xs font-semibold text-gray-500 flex items-center gap-1.5"><Package size={12} /> ÚLTIMAS ÓRDENES</div>
        {c.ordenes?.length ? c.ordenes.map((o: any) => (
          <div key={o.id} onClick={() => navigate(`/ordenes/${o.id}`)} className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="text-sm"><strong>{ot(o.id)}</strong> <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${ESTADO_COLOR[o.estado]}`}>{ESTADO_LABEL[o.estado]}</span>{o.es_membresia && <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">membresía</span>}</p>
              <p className="text-xs text-gray-400">{fechaHora(o.creado_en)}{Number(o.kilos) > 0 ? ` · ${Number(o.kilos)} kg` : ''}</p>
            </div>
            <div className="text-right"><p className="text-sm font-bold">{fmt(o.monto_total)}</p>{Number(o.saldo_pendiente) > 0 && <p className="text-xs text-red-500">debe {fmt(o.saldo_pendiente)}</p>}</div>
          </div>
        )) : <p className="text-sm text-gray-400 text-center py-8">Sin órdenes</p>}
      </div>

      {modal === 'dir' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Nueva dirección</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            <div className="grid grid-cols-3 gap-2">
              <input value={dir.calle || ''} onChange={e => setDir({ ...dir, calle: e.target.value })} placeholder="Calle *" className={inp + ' col-span-2'} />
              <input value={dir.numero || ''} onChange={e => setDir({ ...dir, numero: e.target.value })} placeholder="N°" className={inp} />
              <input value={dir.otro || ''} onChange={e => setDir({ ...dir, otro: e.target.value })} placeholder="Depto / casa" className={inp} />
              <select value={dir.ciudad} onChange={e => setDir({ ...dir, ciudad: e.target.value })} className={inp}>{['Concón', 'Reñaca', 'Viña del Mar', 'Valparaíso', 'Quintero'].map(x => <option key={x}>{x}</option>)}</select>
              <input value={dir.sector || ''} onChange={e => setDir({ ...dir, sector: e.target.value })} placeholder="Sector" className={inp} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={!!dir.es_principal} onChange={e => setDir({ ...dir, es_principal: e.target.checked })} /> Marcar como principal</label>
            <div className="flex gap-2"><button onClick={guardarDir} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}><Save size={14} className="inline mr-1" /> Guardar</button><button onClick={() => setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button></div>
          </div>
        </div>
      )}

      {modal === 'edit' && edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Editar cliente</h2><button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">Teléfono</label><input value={edit.telefono} onChange={e => setEdit({ ...edit, telefono: e.target.value })} className={inp} /></div>
              <div><label className="text-xs text-gray-500">Email</label><input value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} className={inp} /></div>
              <div><label className="text-xs text-gray-500">Tipo</label><select value={edit.tipo} onChange={e => setEdit({ ...edit, tipo: e.target.value })} className={inp}><option value="PARTICULAR">Particular</option><option value="EMPRESA">Empresa</option></select></div>
              <div><label className="text-xs text-gray-500">Plazo de pago (días)</label><input type="number" value={edit.plazo_pago} onChange={e => setEdit({ ...edit, plazo_pago: Number(e.target.value) })} className={inp} /></div>
            </div>
            <div><label className="text-xs text-gray-500">Notas internas</label><textarea value={edit.notas_internas} onChange={e => setEdit({ ...edit, notas_internas: e.target.value })} rows={3} className={inp} /></div>
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={!!edit.es_ladys2} onChange={e => setEdit({ ...edit, es_ladys2: e.target.checked })} /> Es cliente de Ladys 2 (excluir de métricas)</label>
            <div className="flex gap-2"><button onClick={guardar} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>Guardar</button><button onClick={() => setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
