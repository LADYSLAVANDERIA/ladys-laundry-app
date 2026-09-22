import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Layers, Droplets, Wind, Check, RefreshCw, Plus, X, AlertTriangle, PlayCircle } from 'lucide-react'
import { preparacionApi } from '../services/api'
import { ot } from '../utils'

// Preparacion y medicion por CARGA (bitacora #115, #117).
//
// La maquina trabaja en cargas, no en pedidos: 3 cobertores son 3 cargas y la 1
// puede estar secando mientras la 2 se lava. Aca Catalina:
//   1. empieza la preparacion (revisa manchas, separa blancos, colores y desmanchado),
//   2. crea las cargas definitivas con su tipo,
//   3. marca cada carga: a lavadora -> a secadora -> secado listo.
// La etapa del pedido se calcula sola a partir de sus cargas. Embolsar NO es
// automatico: se sigue haciendo en Produccion, revisando que este todo.

const TIPO: Record<string, { txt: string; color: string }> = {
  BLANCO:      { txt: 'Blanco',      color: '#64748b' },
  COLOR:       { txt: 'Color',       color: '#E8177A' },
  DESMANCHADO: { txt: 'Desmanchado', color: '#d97706' },
  UNIDAD:      { txt: 'Por unidad',  color: '#4AAEE0' },
}
const ESTADO: Record<string, { txt: string; color: string }> = {
  LISTA:   { txt: 'Lista para lavar',  color: '#64748b' },
  LAVANDO: { txt: 'Lavando',           color: '#4AAEE0' },
  MOJADA:  { txt: 'Lavada, esperando secadora', color: '#d97706' },
  SECANDO: { txt: 'Secando',           color: '#A87BC8' },
  SECA:    { txt: 'Seca',              color: '#16a34a' },
}

function cuando(d: number | null) {
  if (d === null) return { txt: 'sin fecha', rojo: false }
  if (d < 0) return { txt: `atrasado ${-d} día(s)`, rojo: true }
  if (d === 0) return { txt: 'sale hoy', rojo: true }
  if (d === 1) return { txt: 'sale mañana', rojo: false }
  return { txt: `en ${d} días`, rojo: false }
}

export default function Preparacion() {
  const [t, setT] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  const [elegir, setElegir] = useState<null | { carga: any; maquina: 'LAVADORA' | 'SECADORA' }>(null)
  const [verTodos, setVerTodos] = useState(false)

  const cargar = () => {
    setCargando(true)
    return preparacionApi.tablero()
      .then(r => setT(r.data))
      .catch(e => toast.error(e?.response?.data?.error || 'No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar(); const i = setInterval(cargar, 30000); return () => clearInterval(i) }, [])

  // Toda accion recarga el tablero despues: lo que se ve es lo que quedo guardado
  const hacer = async (p: Promise<any>, ok: string) => {
    try { await p; toast.success(ok) }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo guardar') }
    await cargar()
  }

  const maquinas = elegir ? (elegir.maquina === 'LAVADORA' ? t?.lavadoras : t?.secadoras) || [] : []
  const porPreparar = (t?.por_preparar || []) as any[]
  const urgentes = porPreparar.filter(p => p.dias === null || p.dias <= 1)
  const mostrarPrep = verTodos || urgentes.length === 0 ? porPreparar : urgentes

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Layers size={22} /> Preparación y cargas</h1>
        <button onClick={cargar} className="p-2 rounded-xl border text-gray-500" title="Actualizar">
          <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Las maquinas, de un vistazo ── */}
      {t && (
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><Droplets size={13} /> Lavadoras</p>
            <div className="grid grid-cols-3 gap-2">
              {t.lavadoras.map((m: any) => (
                <div key={m.n} className="rounded-xl border p-2 text-xs"
                     style={m.carga ? { background: '#EFF8FD', borderColor: '#4AAEE0' } : {}}>
                  <p className="font-bold text-gray-700">L{m.n}</p>
                  {m.carga ? (
                    <>
                      <p className="truncate">{ot(m.carga.orden_id)} c{m.carga.numero}</p>
                      <p className={m.carga.minutos >= m.carga.ciclo ? 'text-amber-700 font-semibold' : 'text-gray-500'}>
                        {m.carga.minutos >= m.carga.ciclo ? `terminó hace ${m.carga.minutos - m.carga.ciclo} min` : `faltan ${m.carga.ciclo - m.carga.minutos} min`}
                      </p>
                    </>
                  ) : <p className="text-green-700">Libre</p>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><Wind size={13} /> Secadoras</p>
            <div className="grid grid-cols-5 gap-1.5">
              {t.secadoras.map((m: any) => (
                <div key={m.n} className="rounded-xl border p-1.5 text-[11px]"
                     style={m.carga ? { background: '#F6F0FA', borderColor: '#A87BC8' } : {}}>
                  <p className="font-bold text-gray-700">S{m.n}</p>
                  {m.carga ? (
                    <>
                      <p className="truncate">{ot(m.carga.orden_id)} c{m.carga.numero}</p>
                      <p className="text-gray-500">{m.carga.minutos} min</p>
                    </>
                  ) : <p className="text-green-700">Libre</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Pedidos con cargas ── */}
      {t?.pedidos?.map((p: any) => {
        const cu = cuando(p.dias)
        const secas = p.cargas.filter((c: any) => c.estado === 'SECA').length
        return (
          <div key={p.id} className="bg-white rounded-2xl border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/ordenes/${p.id}`} className="font-semibold text-gray-800">{ot(p.id)} · {p.cliente}</Link>
                <p className="text-xs text-gray-500 truncate">{p.detalle}</p>
                {p.observaciones && <p className="text-xs text-gray-700 mt-1">📝 {p.observaciones}</p>}
              </div>
              <span className={`text-[11px] font-bold whitespace-nowrap ${cu.rojo ? 'text-red-700' : 'text-gray-500'}`}>{cu.txt}</span>
            </div>

            <p className="text-xs text-gray-500">
              Previsto: {p.cargas_previstas ?? '—'} carga(s) {p.prevision_firme === false ? '(estimado por kilos)' : p.prevision_firme ? '(firme)' : ''}
              {' · '}Definidas: <b>{p.cargas.length}</b>
            </p>

            {p.cargas.map((c: any) => {
              const tp = TIPO[c.tipo] || TIPO.COLOR
              const es = ESTADO[c.estado]
              return (
                <div key={c.id} className="rounded-xl border p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800">
                      Carga {c.numero} <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white ml-1" style={{ background: tp.color }}>{tp.txt}</span>
                    </p>
                    <p className="text-xs" style={{ color: es.color }}>
                      {es.txt}{c.estado === 'LAVANDO' && ` en L${c.lavadora} · ${c.min_lavando} min`}
                      {c.estado === 'MOJADA' && ` (salió de L${c.lavadora})`}
                      {c.estado === 'SECANDO' && ` en S${c.secadora} · ${c.min_secando} min`}
                    </p>
                  </div>
                  {c.estado === 'LISTA' && (
                    <>
                      <button onClick={() => { if (confirm(`¿Quitar la carga ${c.numero}?`)) hacer(preparacionApi.anular(c.id), 'Carga quitada') }}
                              className="p-2 rounded-lg text-gray-400" title="Quitar"><X size={16} /></button>
                      <button onClick={() => setElegir({ carga: c, maquina: 'LAVADORA' })}
                              className="px-3 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-1.5" style={{ background: '#4AAEE0' }}>
                        <Droplets size={15} /> A lavadora
                      </button>
                    </>
                  )}
                  {(c.estado === 'LAVANDO' || c.estado === 'MOJADA') && (
                    <button onClick={() => setElegir({ carga: c, maquina: 'SECADORA' })}
                            className="px-3 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-1.5" style={{ background: '#A87BC8' }}>
                      <Wind size={15} /> A secadora
                    </button>
                  )}
                  {c.estado === 'SECANDO' && (
                    <button onClick={() => hacer(preparacionApi.seco(c.id), `Carga ${c.numero} seca`)}
                            className="px-3 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-1.5" style={{ background: '#16a34a' }}>
                      <Check size={15} /> Secado listo
                    </button>
                  )}
                  {c.estado === 'SECA' && <Check size={18} className="text-green-600" />}
                </div>
              )
            })}

            {/* Nuevas cargas: el tipo lo decide Catalina al separar */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Agregar carga</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(TIPO).map(([k, v]) => (
                  <button key={k} onClick={() => hacer(preparacionApi.carga(p.id, k), `Carga ${v.txt.toLowerCase()} agregada`)}
                          className="py-2.5 rounded-xl border-2 text-xs font-semibold flex items-center justify-center gap-1"
                          style={{ borderColor: v.color, color: v.color }}>
                    <Plus size={13} /> {v.txt}
                  </button>
                ))}
              </div>
            </div>

            {p.cargas.length > 0 && secas === p.cargas.length && (
              <p className="text-sm font-semibold text-green-700 bg-green-50 rounded-xl p-3">
                Todas las cargas secas. Revisa que esté todo y embólsalo en Producción.
              </p>
            )}
          </div>
        )
      })}

      {/* ── Por preparar ── */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Por preparar <span className="text-gray-400 font-normal">({porPreparar.length})</span></p>
          {urgentes.length > 0 && urgentes.length < porPreparar.length && (
            <button onClick={() => setVerTodos(v => !v)} className="text-xs text-pink-600">
              {verTodos ? 'Ver solo hoy y mañana' : `Ver los ${porPreparar.length}`}
            </button>
          )}
        </div>
        {porPreparar.length === 0 && <p className="p-4 text-sm text-gray-400">No hay pedidos esperando preparación.</p>}
        <div className="divide-y">
          {mostrarPrep.map((p: any) => {
            const cu = cuando(p.dias)
            return (
              <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{ot(p.id)} · {p.cliente}</p>
                  <p className="text-xs text-gray-500 truncate">{p.detalle || 'sin ítems cargados'}</p>
                  <p className="text-xs">
                    <span className={cu.rojo ? 'text-red-700 font-semibold' : 'text-gray-500'}>{cu.txt}</span>
                    <span className="text-gray-400"> · previsto {p.previstas} carga(s){p.firme ? '' : ' aprox.'}</span>
                    {p.trabajo && p.trabajo !== 'LAVA' && <span className="text-amber-700 font-semibold"> · {p.trabajo}</span>}
                  </p>
                </div>
                <button onClick={() => hacer(preparacionApi.preparar(p.id), `${ot(p.id)} en preparación`)}
                        className="px-3 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-1.5 shrink-0"
                        style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
                  <PlayCircle size={15} /> Preparar
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Elegir maquina ── */}
      {elegir && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setElegir(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-800">
              Carga {elegir.carga.numero}: ¿a qué {elegir.maquina === 'LAVADORA' ? 'lavadora' : 'secadora'}?
            </p>
            <div className={`grid gap-2 ${elegir.maquina === 'LAVADORA' ? 'grid-cols-3' : 'grid-cols-5'}`}>
              {maquinas.map((m: any) => (
                <button key={m.n} disabled={!!m.carga}
                        onClick={() => {
                          const c = elegir.carga, maq = elegir.maquina
                          setElegir(null)
                          hacer(maq === 'LAVADORA' ? preparacionApi.lavadora(c.id, m.n) : preparacionApi.secadora(c.id, m.n),
                                `Carga ${c.numero} a ${maq === 'LAVADORA' ? 'L' : 'S'}${m.n}`)
                        }}
                        className="py-4 rounded-xl border-2 text-lg font-bold disabled:opacity-40"
                        style={!m.carga ? { borderColor: elegir.maquina === 'LAVADORA' ? '#4AAEE0' : '#A87BC8' } : {}}>
                  {elegir.maquina === 'LAVADORA' ? 'L' : 'S'}{m.n}
                </button>
              ))}
            </div>
            {maquinas.some((m: any) => m.carga) && (
              <div className="text-xs text-gray-500 space-y-1.5 pt-1">
                <p className="flex items-center gap-1"><AlertTriangle size={12} /> Las grises figuran ocupadas. Si ya sacaste esa ropa:</p>
                {maquinas.filter((m: any) => m.carga).map((m: any) => (
                  <button key={m.n}
                          onClick={() => hacer(preparacionApi.liberar(elegir.maquina, m.n), `${elegir.maquina === 'LAVADORA' ? 'L' : 'S'}${m.n} liberada`)}
                          className="block w-full text-left px-3 py-2 rounded-lg border text-gray-600">
                    Liberar {elegir.maquina === 'LAVADORA' ? 'L' : 'S'}{m.n} (tenía {ot(m.carga.orden_id)} carga {m.carga.numero})
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setElegir(null)} className="w-full py-2.5 rounded-xl border text-sm text-gray-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
