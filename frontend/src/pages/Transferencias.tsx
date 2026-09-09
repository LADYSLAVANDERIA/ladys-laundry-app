import { useEffect, useState } from 'react'
import { transferenciasApi, cobrosApi, conciliarApi } from '../services/api'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { Check, X, RefreshCw, Landmark, FileText, Link2, CreditCard, MessageSquare, ShieldCheck, AlertTriangle, Image } from 'lucide-react'

const plata = (n: any) => `$${Number(n || 0).toLocaleString('es-CL')}`
const dia = (f: any) => f ? new Date(String(f) + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'

export default function Transferencias() {
  const [datos, setDatos] = useState<any>({ por_confirmar: [], sin_asignar: [], candidatos: [] })
  const [cargando, setCargando] = useState(true)
  const [asignando, setAsignando] = useState<number | null>(null)
  const [destino, setDestino] = useState<Record<number, string>>({})

  const [pos, setPos] = useState<any>({ pendientes: [], candidatos: [], fecha: '' })
  const [posDestino, setPosDestino] = useState<Record<string, string>>({})
  const [posAsignando, setPosAsignando] = useState<string | null>(null)
  const [posCargando, setPosCargando] = useState(true)

  // Comprobantes que llegaron por WhatsApp + transferencias de Mercado Pago
  // que entraron sin que nadie mandara comprobante.
  const [mp, setMp] = useState<any>({ comprobantes: [], transferencias: [], ordenes_con_saldo: [] })
  const [mpCargando, setMpCargando] = useState(true)
  const [mpDestino, setMpDestino] = useState<Record<string, string>>({})
  const [mpAsignando, setMpAsignando] = useState<string | null>(null)

  const cargarMp = () => {
    setMpCargando(true)
    conciliarApi.pendientes()
      .then(({ data }) => setMp(data))
      .catch(() => {})
      .finally(() => setMpCargando(false))
  }

  const cargar = () => {
    setCargando(true)
    transferenciasApi.pendientes()
      .then(({ data }) => setDatos(data))
      .catch(() => toast.error('No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  const cargarPos = () => {
    setPosCargando(true)
    cobrosApi.pos()
      .then(({ data }) => setPos(data))
      .catch(() => {})
      .finally(() => setPosCargando(false))
  }
  useEffect(() => { cargar(); cargarPos(); cargarMp() }, [])

  const imputarMp = async (mpId: string) => {
    const orden = Number(mpDestino[mpId])
    if (!orden) { toast.error('Elige a qué pedido va'); return }
    setMpAsignando(mpId)
    try {
      await conciliarApi.imputar(mpId, orden)
      toast.success('Transferencia imputada al pedido')
      cargarMp()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo imputar') }
    finally { setMpAsignando(null) }
  }

  const descartarMp = async (mpId: string) => {
    const nota = window.prompt('¿Por qué no corresponde a un pedido?', 'No es de un cliente')
    if (nota === null) return
    try { await conciliarApi.descartar(mpId, nota); toast.success('Descartada'); cargarMp() }
    catch { toast.error('No se pudo descartar') }
  }

  // Devolver la deuda: el comprobante era falso o estaba equivocado.
  const anularComprobante = async (id: number, orden: number) => {
    const motivo = window.prompt(`Anular el comprobante del pedido ${orden}. La deuda vuelve a quedar pendiente.\n¿Motivo?`, 'La plata nunca llegó')
    if (motivo === null) return
    try { await conciliarApi.anular(id, motivo); toast.success('Anulado, el pedido volvió a quedar con saldo'); cargarMp() }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo anular') }
  }

  const asignarPos = async (mpId: string) => {
    const orden = Number(posDestino[mpId])
    if (!orden) { toast.error('Elige a qué pedido va'); return }
    setPosAsignando(mpId)
    try {
      await cobrosApi.posAsignar(mpId, orden)
      toast.success('Venta del POS asignada')
      cargarPos()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo asignar') }
    finally { setPosAsignando(null) }
  }

  const marcar = async (id: number, estado: string) => {
    try {
      await transferenciasApi.marcar(id, estado)
      toast.success(estado === 'CONFIRMADA' ? 'Confirmada' : 'Marcada como no llegó')
      cargar()
    } catch { toast.error('No se pudo actualizar') }
  }

  const asignar = async (id: number) => {
    const orden = Number(destino[id])
    if (!orden) { toast.error('Elige a qué pedido va'); return }
    setAsignando(id)
    try {
      await transferenciasApi.asignar(id, orden)
      toast.success('Abono asignado al pedido')
      cargar()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo asignar') }
    finally { setAsignando(null) }
  }

  if (cargando) return <div className="py-20 text-center text-gray-400">Cargando…</div>

  const { por_confirmar = [], sin_asignar = [], candidatos = [] } = datos

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Pagos por revisar</h1>
        <button onClick={() => { cargar(); cargarPos(); cargarMp() }} className="flex items-center gap-1.5 text-sm" style={{ color: '#E8177A' }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {/* Comprobantes que manda el cliente por WhatsApp.
          SofIA los lee y abona sola: acá no se asigna nada, solo se mira si la
          plata aparecio en Mercado Pago. Lo unico que pide acción es lo que
          quedo SIN RESPALDO. */}
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={17} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Comprobantes por WhatsApp</h2>
          {!mpCargando && (mp.sin_respaldo > 0
            ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{mp.sin_respaldo} sin respaldo</span>
            : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{mp.por_verificar || 0} por verificar</span>)}
        </div>
        <p className="text-sm text-gray-600">
          SofIA lee el comprobante y abona el pedido al momento. Después el sistema busca
          ese monto en Mercado Pago: si aparece, queda verificado solo. Lo que hay que mirar
          acá es lo que quedó <b>sin respaldo</b>, o sea que pasaron 24 horas y esa plata nunca entró.
        </p>

        {mpCargando ? (
          <p className="text-sm text-gray-400 py-2">Revisando Mercado Pago…</p>
        ) : (mp.comprobantes || []).length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Todavía no llega ningún comprobante por WhatsApp.</p>
        ) : (
          <div className="divide-y">
            {mp.comprobantes.map((c: any) => (
              <div key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium text-gray-800">
                    {plata(c.monto_declarado)}
                    {Number(c.monto_abonado) !== Number(c.monto_declarado) &&
                      <span className="text-xs text-gray-400 font-normal"> · abonado {plata(c.monto_abonado)}</span>}
                  </div>
                  <div className="text-sm text-gray-500">
                    {c.cliente || 'Sin nombre'}
                    {c.orden_id && <> · <Link to={`/ordenes/${c.orden_id}`} className="underline" style={{ color: '#E8177A' }}>Pedido {c.orden_id}</Link></>}
                  </div>
                  <div className="text-xs text-gray-400">
                    {dia(c.fecha_transfer)}{c.hora ? ` ${c.hora}` : ''}
                    {c.banco_origen ? ` · ${c.banco_origen}` : ''}
                    {c.operacion ? ` · operación ${c.operacion}` : ''}
                  </div>
                  {c.nota && <div className="text-xs text-red-500 mt-0.5">{c.nota}</div>}
                </div>

                {c.imagen_url && (
                  <a href={c.imagen_url} target="_blank" rel="noreferrer"
                     className="flex items-center gap-1 text-sm underline text-gray-500">
                    <Image size={14} /> ver
                  </a>
                )}

                {c.estado === 'VERIFICADO' && (
                  <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                    <ShieldCheck size={15} /> La plata llegó
                  </span>
                )}
                {c.estado === 'POR_VERIFICAR' && (
                  <span className="text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
                    Esperando que aparezca en Mercado Pago
                  </span>
                )}
                {c.estado === 'SIN_RESPALDO' && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
                      <AlertTriangle size={15} /> No llegó
                    </span>
                    <button onClick={() => anularComprobante(c.id, c.orden_id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border text-gray-600">
                      <X size={15} /> Devolver la deuda
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* La excepción: plata que entró y nadie reclamó con un comprobante.
          Mercado Pago no entrega el nombre de quien transfiere, así que esto
          sí se asigna a mano. */}
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center gap-2">
          <Landmark size={17} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Transferencias a Mercado Pago sin dueño</h2>
          {!mpCargando && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {(mp.transferencias || []).length}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Entró plata a la cuenta y nadie mandó el comprobante. Mercado Pago no dice quién
          transfirió, así que la sugerencia es solo por monto: confirma antes de imputar.
        </p>

        {mpCargando ? (
          <p className="text-sm text-gray-400 py-2">Consultando Mercado Pago…</p>
        ) : (mp.transferencias || []).length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No hay transferencias sueltas.</p>
        ) : (
          <div className="divide-y">
            {mp.transferencias.map((t: any) => (
              <div key={t.mp_id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-gray-800">{plata(t.monto)}</div>
                  <div className="text-xs text-gray-400">
                    {t.acreditado ? new Date(t.acreditado).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    {` · operación ${t.mp_id}`}
                  </div>
                  {t.sugerida && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      Calza con el pedido {t.sugerida.id} de {t.sugerida.cliente}
                    </div>
                  )}
                </div>
                <select className="border rounded-lg px-3 py-2 text-sm max-w-[240px]"
                        value={mpDestino[t.mp_id] ?? (t.sugerida ? String(t.sugerida.id) : '')}
                        onChange={e => setMpDestino({ ...mpDestino, [t.mp_id]: e.target.value })}>
                  <option value="">¿A qué pedido va?</option>
                  {(mp.ordenes_con_saldo || []).map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.id} · {o.cliente} · debe {plata(o.saldo_pendiente)}
                    </option>
                  ))}
                </select>
                <button onClick={() => imputarMp(t.mp_id)} disabled={mpAsignando === t.mp_id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  <Link2 size={15} /> {mpAsignando === t.mp_id ? 'Imputando…' : 'Imputar'}
                </button>
                <button onClick={() => descartarMp(t.mp_id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border text-gray-600">
                  <X size={15} /> No es de un pedido
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={17} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Comprobantes registrados en el local</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{por_confirmar.length}</span>
        </div>
        <p className="text-sm text-gray-600">
          Los que alguien del equipo cargó a mano en el pedido. Se entregó la ropa pero
          todavía nadie verificó que la plata llegó a la cuenta: revisa la cartola y
          confirma o descarta.
        </p>

        {por_confirmar.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Nada pendiente. Todo cuadrado.</p>
        ) : (
          <div className="divide-y">
            {por_confirmar.map((t: any) => (
              <div key={t.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-gray-800">{plata(t.monto)}</div>
                  <div className="text-sm text-gray-500">
                    {t.cliente || t.nombre_origen || 'Sin nombre'}
                    {t.orden_id && <> · <Link to={`/ordenes/${t.orden_id}`} className="underline" style={{ color: '#E8177A' }}>Pedido {t.orden_id}</Link></>}
                  </div>
                  <div className="text-xs text-gray-400">
                    {dia(t.fecha_mov)}{t.registro ? ` · registró ${t.registro}` : ''}
                  </div>
                </div>
                {t.comprobante_url && (
                  <a href={t.comprobante_url} target="_blank" rel="noreferrer"
                     className="text-sm underline text-gray-500">ver comprobante</a>
                )}
                <div className="flex gap-2">
                  <button onClick={() => marcar(t.id, 'CONFIRMADA')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white">
                    <Check size={15} /> Llegó
                  </button>
                  <button onClick={() => marcar(t.id, 'NO_LLEGO')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border text-gray-600">
                    <X size={15} /> No llegó
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center gap-2">
          <Landmark size={17} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Abonos del banco sin asignar</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{sin_asignar.length}</span>
        </div>
        <p className="text-sm text-gray-600">
          Plata que entró a la cuenta y no calzó con ningún comprobante. Dile a qué pedido corresponde.
        </p>

        {sin_asignar.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No hay abonos sueltos.</p>
        ) : (
          <div className="divide-y">
            {sin_asignar.map((t: any) => (
              <div key={t.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-gray-800">{plata(t.monto)}</div>
                  <div className="text-sm text-gray-500">{t.nombre_origen || 'Sin nombre'}</div>
                  <div className="text-xs text-gray-400">{dia(t.fecha_mov)}{t.rut_origen ? ` · RUT ${t.rut_origen}` : ''}</div>
                </div>
                <select className="border rounded-lg px-3 py-2 text-sm max-w-[240px]"
                        value={destino[t.id] || ''}
                        onChange={e => setDestino({ ...destino, [t.id]: e.target.value })}>
                  <option value="">¿A qué pedido va?</option>
                  {candidatos.map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.id} · {o.cliente} · debe {plata(o.saldo_pendiente)}
                    </option>
                  ))}
                </select>
                <button onClick={() => asignar(t.id)} disabled={asignando === t.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  <Link2 size={15} /> {asignando === t.id ? 'Asignando…' : 'Asignar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard size={17} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Ventas del POS por conciliar</h2>
          {!posCargando && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              {(pos.pendientes || []).filter((p: any) => !p.orden_id).length}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Pagos con tarjeta en la máquina de Mercado Pago. La máquina no sabe a qué pedido
          corresponde cada uno, así que hay que decírselo.
        </p>

        {posCargando ? (
          <p className="text-sm text-gray-400 py-2">Consultando Mercado Pago…</p>
        ) : (pos.pendientes || []).length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No hay ventas del POS hoy.</p>
        ) : (
          <div className="divide-y">
            {pos.pendientes.map((p: any) => (
              <div key={p.mp_payment_id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[160px]">
                  <div className="font-medium text-gray-800">{plata(p.monto)}</div>
                  <div className="text-xs text-gray-400">{p.hora}{p.detalle ? ` · ${p.detalle}` : ''}</div>
                </div>
                {p.orden_id ? (
                  <span className="text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                    Asignada al pedido {p.orden_id}
                  </span>
                ) : (
                  <>
                    <select className="border rounded-lg px-3 py-2 text-sm max-w-[240px]"
                            value={posDestino[p.mp_payment_id] || ''}
                            onChange={e => setPosDestino({ ...posDestino, [p.mp_payment_id]: e.target.value })}>
                      <option value="">¿A qué pedido va?</option>
                      {(pos.candidatos || []).map((o: any) => (
                        <option key={o.id} value={o.id}>
                          {o.id} · {o.cliente} · debe {plata(o.saldo_pendiente)}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => asignarPos(p.mp_payment_id)} disabled={posAsignando === p.mp_payment_id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                      <Link2 size={15} /> {posAsignando === p.mp_payment_id ? 'Asignando…' : 'Asignar'}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
