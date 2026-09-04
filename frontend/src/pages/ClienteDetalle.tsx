import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clientesApi, fichaApi, serviciosApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, MessageCircle, Plus, X, MapPin, Save, Percent, CreditCard, Package, Trash2, CheckCircle2, Circle, Building2, Tag, Pencil, Loader2 } from 'lucide-react'
import { fmt, ot, fechaCorta, fechaHora, waLink, ESTADO_COLOR, ESTADO_LABEL } from '../utils'

const inp = 'w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300'

export default function ClienteDetalle() {
  const { id } = useParams(); const navigate = useNavigate()
  const [c, setC] = useState<any>(null); const [modal, setModal] = useState<string | null>(null)
  const [dir, setDir] = useState<any>({ ciudad: 'Concón' }); const [edit, setEdit] = useState<any>(null)
  const [precios, setPrecios] = useState<any[]>([]); const [servicios, setServicios] = useState<any[]>([])
  const [nuevoPrecio, setNuevoPrecio] = useState<any>({}); const [guardando, setGuardando] = useState(false)

  const load = async () => { try { const { data } = await clientesApi.getById(id!); setC(data); } catch { toast.error('Cliente no encontrado'); navigate('/clientes') } }
  const cargarPrecios = async () => { try { const { data } = await fichaApi.precios(id!); setPrecios(data) } catch { /* sin convenio */ } }
  useEffect(() => { load(); cargarPrecios(); serviciosApi.getAll().then(r => setServicios(r.data)).catch(() => {}) }, [id])
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
    if (!edit.nombre?.trim()) return toast.error('El nombre es obligatorio')
    setGuardando(true)
    try { await fichaApi.guardar(c.id, edit); toast.success('Ficha actualizada'); setModal(null); setEdit(null); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') } finally { setGuardando(false) }
  }
  const abrirFicha = () => {
    setEdit({ nombre: c.nombre || '', apellido: c.apellido || '', telefono: c.telefono || '', email: c.email || '',
      tipo: c.tipo || 'PARTICULAR', razon_social: c.razon_social || '', id_fiscal: c.id_fiscal || '', giro: c.giro || '',
      contacto: c.contacto || '', direccion_comercial: c.direccion_comercial || '', comuna_comercial: c.comuna_comercial || '',
      email_facturacion: c.email_facturacion || '', tipo_doc: c.tipo_doc || 'BOLETA', plazo_pago: c.plazo_pago || 0,
      descuento_pct: c.descuento_pct || 0, notas_internas: c.notas_internas || '', es_ladys2: !!c.es_ladys2 })
    setModal('ficha')
  }
  const agregarPrecio = async () => {
    if (!nuevoPrecio.servicio_id || !(Number(nuevoPrecio.precio) >= 0)) return toast.error('Elige servicio y precio')
    try { await fichaApi.ponerPrecio(c.id, { servicio_id: Number(nuevoPrecio.servicio_id), precio: Number(nuevoPrecio.precio), nota: nuevoPrecio.nota })
      toast.success('Precio guardado'); setNuevoPrecio({}); cargarPrecios() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  const aplicarDescuento = async () => {
    const pct = Number(prompt('¿Cuántos puntos porcentuales bajo la lista? (ej: 15)') || 0)
    if (!(pct > 0 && pct < 100)) return
    if (!confirm(`Se creará un convenio con TODOS los servicios a ${pct}% bajo la lista. ¿Continuar?`)) return
    try { const { data } = await fichaApi.precioLote(c.id, { descuento_pct: pct }); toast.success(`${data.guardados} precios cargados`); cargarPrecios() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  const borrarPrecio = async (pid: number) => {
    try { await fichaApi.borrarPrecio(c.id, pid); cargarPrecios() } catch { toast.error('Error') }
  }
  const cont = c.continuidad_info

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{c.nombre} {c.apellido}</h1>
          <p className="text-sm text-gray-500">{c.telefono || 'sin teléfono'} · {c.tipo}{c.plazo_pago > 0 && ` · crédito ${c.plazo_pago} días`}</p>
          {c.tipo === 'EMPRESA' && <p className="text-xs text-gray-400">{[c.razon_social, c.id_fiscal, c.giro].filter(Boolean).join(' · ') || 'sin datos fiscales'}</p>}
        </div>
        <button onClick={abrirFicha} className="p-2.5 border rounded-xl text-gray-500 hover:bg-gray-50" title="Editar ficha"><Pencil size={16} /></button>
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

      {c.tipo === 'EMPRESA' && (
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-700 flex items-center gap-1.5"><Building2 size={15} className="text-blue-500" /> Datos comerciales</p>
            <button onClick={abrirFicha} className="text-xs text-pink-600 font-medium">Editar</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[['Razón social', c.razon_social], ['RUT', c.id_fiscal], ['Giro', c.giro], ['Contacto', c.contacto],
              ['Dirección comercial', [c.direccion_comercial, c.comuna_comercial].filter(Boolean).join(', ')],
              ['Correo facturación', c.email_facturacion],
              ['Documento', c.tipo_doc], ['Plazo de pago', c.plazo_pago > 0 ? `${c.plazo_pago} días` : 'contado']].map(([l, v], i) => (
              <div key={i} className="flex justify-between border-b border-dashed py-1">
                <span className="text-gray-400 text-xs">{l}</span>
                <span className={`text-right ${v ? 'text-gray-700' : 'text-gray-300'}`}>{v || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Convenio de precios */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-700 flex items-center gap-1.5"><Tag size={15} className="text-amber-500" /> Precios de convenio</p>
          <div className="flex gap-2">
            <button onClick={aplicarDescuento} className="text-xs text-amber-600 font-medium">% sobre la lista</button>
            {precios.length > 0 && <button onClick={async () => { if (confirm('¿Borrar todo el convenio?')) { await fichaApi.borrarTodos(c.id); cargarPrecios() } }} className="text-xs text-red-500">Borrar todo</button>}
          </div>
        </div>
        {precios.length > 0 ? (
          <div className="border rounded-xl divide-y mb-3 max-h-72 overflow-y-auto">
            {precios.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{p.servicio}</p>
                  <p className="text-[11px] text-gray-400">{p.categoria} · lista {fmt(p.precio_lista)}{p.ahorro_pct > 0 ? ` · ${p.ahorro_pct}% menos` : ''}</p>
                </div>
                <span className="font-bold text-amber-600 mr-2">{fmt(p.precio)}</span>
                <button onClick={() => borrarPrecio(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400 mb-3">Sin convenio: paga precio de lista.</p>}
        <div className="grid grid-cols-12 gap-2">
          <select value={nuevoPrecio.servicio_id || ''} onChange={e => setNuevoPrecio({ ...nuevoPrecio, servicio_id: e.target.value })} className={inp + ' col-span-7'}>
            <option value="">Servicio…</option>
            {servicios.map((s: any) => <option key={s.id} value={s.id}>{s.categoria} · {s.nombre}</option>)}
          </select>
          <input type="number" value={nuevoPrecio.precio || ''} onChange={e => setNuevoPrecio({ ...nuevoPrecio, precio: e.target.value })} placeholder="Precio" className={inp + ' col-span-3'} />
          <button onClick={agregarPrecio} className="col-span-2 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}><Plus size={15} className="inline" /></button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Estos precios se aplican solos al crear una orden para este cliente.</p>
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
          <button onClick={abrirFicha} className="text-xs text-pink-600 font-medium">Editar</button>
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

      {modal === 'ficha' && edit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Ficha del cliente</h2>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="flex rounded-xl overflow-hidden border text-sm">
              {['PARTICULAR', 'EMPRESA'].map(t => (
                <button key={t} onClick={() => setEdit({ ...edit, tipo: t, tipo_doc: t === 'EMPRESA' ? 'FACTURA' : 'BOLETA' })}
                  className={`flex-1 py-2 font-medium ${edit.tipo === t ? 'text-white' : 'text-gray-500'}`}
                  style={edit.tipo === t ? { background: 'linear-gradient(135deg,#E8177A,#A87BC8)' } : {}}>
                  {t === 'EMPRESA' ? 'Empresa' : 'Particular'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">Nombre *</label><input value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} className={inp} /></div>
              <div><label className="text-xs text-gray-500">Apellido</label><input value={edit.apellido} onChange={e => setEdit({ ...edit, apellido: e.target.value })} className={inp} /></div>
              <div><label className="text-xs text-gray-500">Teléfono</label><input value={edit.telefono} onChange={e => setEdit({ ...edit, telefono: e.target.value })} placeholder="+56 9 ..." className={inp} /></div>
              <div><label className="text-xs text-gray-500">Correo</label><input value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} className={inp} /></div>
            </div>

            {edit.tipo === 'EMPRESA' && (
              <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700">DATOS PARA FACTURACIÓN</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2"><label className="text-xs text-gray-500">Razón social</label><input value={edit.razon_social} onChange={e => setEdit({ ...edit, razon_social: e.target.value })} className={inp} /></div>
                  <div><label className="text-xs text-gray-500">RUT</label><input value={edit.id_fiscal} onChange={e => setEdit({ ...edit, id_fiscal: e.target.value })} placeholder="76.123.456-7" className={inp} /></div>
                  <div><label className="text-xs text-gray-500">Giro</label><input value={edit.giro} onChange={e => setEdit({ ...edit, giro: e.target.value })} className={inp} /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Dirección comercial</label><input value={edit.direccion_comercial} onChange={e => setEdit({ ...edit, direccion_comercial: e.target.value })} className={inp} /></div>
                  <div><label className="text-xs text-gray-500">Comuna</label><input value={edit.comuna_comercial} onChange={e => setEdit({ ...edit, comuna_comercial: e.target.value })} className={inp} /></div>
                  <div><label className="text-xs text-gray-500">Contacto</label><input value={edit.contacto} onChange={e => setEdit({ ...edit, contacto: e.target.value })} placeholder="Nombre y cargo" className={inp} /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Correo de facturación</label><input value={edit.email_facturacion} onChange={e => setEdit({ ...edit, email_facturacion: e.target.value })} className={inp} /></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs text-gray-500">Documento</label>
                <select value={edit.tipo_doc} onChange={e => setEdit({ ...edit, tipo_doc: e.target.value })} className={inp}>
                  <option value="BOLETA">Boleta</option><option value="FACTURA">Factura</option><option value="SIN_DOCUMENTO">Sin documento</option>
                </select></div>
              <div><label className="text-xs text-gray-500">Plazo de pago</label>
                <select value={edit.plazo_pago} onChange={e => setEdit({ ...edit, plazo_pago: Number(e.target.value) })} className={inp}>
                  <option value={0}>Contado</option><option value={15}>15 días</option><option value={30}>30 días</option><option value={45}>45 días</option><option value={60}>60 días</option>
                </select></div>
              <div><label className="text-xs text-gray-500">Dcto. general %</label><input type="number" value={edit.descuento_pct} onChange={e => setEdit({ ...edit, descuento_pct: Number(e.target.value) })} className={inp} /></div>
            </div>

            <div><label className="text-xs text-gray-500">Notas internas</label><textarea value={edit.notas_internas} onChange={e => setEdit({ ...edit, notas_internas: e.target.value })} rows={2} className={inp} /></div>
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={!!edit.es_ladys2} onChange={e => setEdit({ ...edit, es_ladys2: e.target.checked })} /> Cliente de Ladys 2 (excluir de métricas)</label>

            <div className="flex gap-2">
              <button onClick={guardar} disabled={guardando} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                {guardando ? <Loader2 size={15} className="inline animate-spin" /> : <Save size={15} className="inline mr-1.5" />} Guardar ficha
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
