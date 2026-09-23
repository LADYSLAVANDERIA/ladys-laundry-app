import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Camera, CameraOff, Check, Droplets, Wind, Package, Layers, Plus, X,
  AlertTriangle, PlayCircle, RefreshCw, Search, Send, Store, MessageCircle, Undo2,
} from 'lucide-react'
import { preparacionApi, etapasApi, ordenesApi } from '../services/api'
import { ot, waLink, mensajeSegunEtapa, linkOT, tipoAviso } from '../utils'

// PRODUCCION: una sola pantalla para todo lo que pasa con la ropa dentro del
// local (bitacora #115, #117, #119 y la fusion pedida por Lufi el 22-sep).
//
// Antes habia dos: "Produccion" escaneaba un QR y marcaba una etapa fija, y
// "Preparacion y cargas" manejaba las cargas. Catalina tenia que saber a cual
// entrar. Ahora se busca el pedido — escrito o pistoleando el QR — y la pantalla
// muestra el boton que corresponde a su estado: preparar, mover cargas, embolsar
// o entregar. Abajo sigue el tablero de maquinas y las listas de siempre.
//
// El modo estacion (/estacion) NO se toca: sirve para escanear muchos pedidos
// seguidos con una etapa fija, que es otro trabajo.
//
// Toda accion pasa por un OK de confirmacion: un toque al hacer scroll marco una
// carga como seca sin querer (OT 6573, 22-sep).

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
const ETAPA_TXT: Record<string, string> = {
  RECEPCIONADO: 'Recepcionado', PREPARACION: 'En preparación', EN_LAVADO: 'En lavado',
  EN_SECADO: 'En secado', EMBOLSADO: 'Embolsado', LISTO_RETIRO: 'Listo para retiro',
  ASIGNADO_RUTA: 'En ruta', EN_CAMINO: 'En camino', ENTREGADO: 'Entregado',
  RETIRADO: 'Retirado, en camino al local', AGENDADO: 'Agendado',
}

// A donde vuelve cada paso si se marco de mas. Se muestra solo dentro de la hora
// siguiente a la marca: mas alla, corregir historia vieja es peor que el error.
const ATRAS: Record<string, string> = {
  SECA:    'vuelve a la secadora',
  SECANDO: 'sale de la secadora',
  MOJADA:  'sale de la lavadora',
  LAVANDO: 'sale de la lavadora',
}

function cuando(d: number | null) {
  if (d === null) return { txt: 'sin fecha', rojo: false }
  if (d < 0) return { txt: `atrasado ${-d} día(s)`, rojo: true }
  if (d === 0) return { txt: 'sale hoy', rojo: true }
  if (d === 1) return { txt: 'sale mañana', rojo: false }
  return { txt: `en ${d} días`, rojo: false }
}

declare global { interface Window { Html5Qrcode: any } }
function cargarLector(): Promise<any> {
  if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode)
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
    s.onload = () => res(window.Html5Qrcode); s.onerror = rej
    document.head.appendChild(s)
  })
}
// Acepta el numero escrito, el id, o la URL completa del QR
function leerCodigo(txt: string) {
  const t = String(txt || '').trim()
  const url = t.match(/\/ot\/(\d+)\//)
  if (url) return url[1]
  const num = t.replace(/[^\d]/g, '')
  return num || t
}

export default function Produccion() {
  const [t, setT] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  const [elegir, setElegir] = useState<null | { carga: any; maquina: 'LAVADORA' | 'SECADORA'; orden: number }>(null)
  const [verTodos, setVerTodos] = useState(false)
  const [pedir, setPedir] = useState<null | { titulo: string; detalle?: string; color: string; accion: () => void }>(null)
  const [okListo, setOkListo] = useState(false)
  // Buscador y camara
  const [q, setQ] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<any[] | null>(null)
  const [foco, setFoco] = useState<any>(null)
  const [camara, setCamara] = useState(false)
  const lector = useRef<any>(null)
  const ultimo = useRef<{ cod: string; t: number }>({ cod: '', t: 0 })
  // Embolsado: bultos y aviso, igual que en la pantalla vieja
  const [emb, setEmb] = useState<any>(null)
  // 23-sep (Lufi): al pasar una carga de etapa la pantalla saltaba arriba. Se guarda
  // la posicion del contenedor que hace scroll y se vuelve a ella al recargar.
  const raiz = useRef<HTMLDivElement>(null)
  const contenedor = () => (raiz.current?.closest('.overflow-y-auto') as HTMLElement | null)
    || (document.scrollingElement as HTMLElement | null)
  const volverA = (y: number | undefined) => {
    if (y === undefined) return
    const c = contenedor()
    if (!c) return
    requestAnimationFrame(() => { c.scrollTop = y; requestAnimationFrame(() => { c.scrollTop = y }) })
  }

  useEffect(() => {
    if (!pedir) return
    setOkListo(false)
    const i = setTimeout(() => setOkListo(true), 400) // evita que el mismo toque acepte
    return () => clearTimeout(i)
  }, [pedir])

  const cargar = () => {
    setCargando(true)
    const y = contenedor()?.scrollTop
    return preparacionApi.tablero()
      .then(r => { setT(r.data); volverA(y) })
      .catch(e => toast.error(e?.response?.data?.error || 'No se pudo cargar'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar(); const i = setInterval(cargar, 30000); return () => clearInterval(i) }, [])

  // El pedido en foco se relee siempre del servidor: nunca se arma en pantalla
  const refrescarFoco = async (id?: number) => {
    const n = id ?? foco?.id
    if (!n) return
    try {
      const r = await preparacionApi.buscar(String(n))
      const p = (r.data.pedidos || []).find((x: any) => x.id === n)
      setFoco(p || null)
    } catch { /* si falla, el tablero de abajo sigue siendo la verdad */ }
  }

  // Toda accion recarga: lo que se ve es lo que quedo guardado
  const hacer = async (p: Promise<any>, ok: string) => {
    const y = contenedor()?.scrollTop
    try { await p; toast.success(ok) }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo guardar') }
    await Promise.all([cargar(), refrescarFoco()])
    volverA(y)
  }

  const buscar = async (texto: string, abrirSolo = false) => {
    const v = texto.trim()
    if (!v) { setResultados(null); return }
    setBuscando(true)
    try {
      const r = await preparacionApi.buscar(v)
      const lista = r.data.pedidos || []
      setResultados(lista)
      if (lista.length === 1 || abrirSolo) { setFoco(lista[0] || null); if (!lista.length) toast.error(`No encontré ${v}`) }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo buscar')
    } finally { setBuscando(false) }
  }

  const abrirCamara = async () => {
    try {
      const H = await cargarLector()
      lector.current = new H('lector')
      await lector.current.start({ facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (txt: string) => {
          const cod = leerCodigo(txt)
          const ahora = Date.now()
          if (cod === ultimo.current.cod && ahora - ultimo.current.t < 3000) return
          ultimo.current = { cod, t: ahora }
          if (navigator.vibrate) navigator.vibrate(60)
          setQ(cod); buscar(cod, true)
        }, () => {})
      setCamara(true)
    } catch { toast.error('No pudimos abrir la cámara. Revisa el permiso.') }
  }
  const cerrarCamara = async () => {
    try { await lector.current?.stop(); lector.current?.clear() } catch { /* ya estaba cerrada */ }
    setCamara(false)
  }
  useEffect(() => () => { try { lector.current?.stop() } catch { /* al salir */ } }, [])

  // ── Embolsar: pide bultos y ofrece el aviso, como la pantalla vieja ──
  const embolsar = (p: any) => {
    const sinSecar = (p.cargas || []).filter((c: any) => c.estado !== 'SECA').length
    setPedir({
      titulo: `¿Embolsar ${ot(p.id)}?`,
      detalle: sinSecar ? `Ojo: ${sinSecar} carga(s) sin terminar de secar` : p.cliente,
      color: '#E8177A',
      accion: async () => {
        try {
          const { data } = await etapasApi.marcar({ orden_id: p.id, etapa: 'EMBOLSADO' })
          if (data.aviso) toast(data.aviso, { icon: '⚠️' })
          setEmb({ ...p, ...data })
          await cargar()
        } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo embolsar') }
      },
    })
  }
  const avisar = (p: any) => {
    const msg = mensajeSegunEtapa({ ...p, cliente_nombre: p.cliente, etapa: 'EMBOLSADO' }, linkOT(p.id, p.token_publico))
    // La ventana se abre ANTES del await o el navegador la bloquea como popup
    window.open(waLink(p.cliente_telefono, msg), '_blank')
    ordenesApi.aviso(p.id, { tipo: tipoAviso({ ...p, etapa: 'EMBOLSADO' }), mensaje: msg })
      .then(() => toast.success('Avisado y anotado en la OT'))
      .catch(() => toast.error('Se abrió WhatsApp, pero no se pudo dejar el registro en la OT'))
  }
  // Los bultos se guardan al elegirlos: la ventana puede cerrarse sin apretar
  // nada mas y el conductor tiene que cargar el numero correcto.
  const guardarBultos = (n: number) =>
    etapasApi.marcar({ orden_id: emb.id ?? emb.orden_id, etapa: 'EMBOLSADO', bultos: n })
      .then(() => { setEmb({ ...emb, n }); toast.success(`${n} bulto(s)`) })
      .catch(() => toast.error('No se pudo guardar los bultos'))

  const entregar = (p: any) => setPedir({
    titulo: `¿Entregar ${ot(p.id)} en el local?`, detalle: p.cliente, color: '#16a34a',
    accion: () => hacer(etapasApi.marcar({ orden_id: p.id, etapa: 'ENTREGADO' }), `${ot(p.id)} entregado`),
  })

  const maquinas = elegir ? (elegir.maquina === 'LAVADORA' ? t?.lavadoras : t?.secadoras) || [] : []
  const porPreparar = (t?.por_preparar || []) as any[]
  const urgentes = porPreparar.filter(p => p.dias === null || p.dias <= 1)
  const mostrarPrep = verTodos || urgentes.length === 0 ? porPreparar : urgentes

  // ── La tarjeta de un pedido: cargas + el boton que toca segun su estado ──
  // Se LLAMA como funcion, no como <Tarjeta/>: definida aqui adentro, como
  // componente React la veia nueva en cada render y rearmaba todas las tarjetas
  // (la pantalla saltaba arriba al tocar cualquier boton). No usa hooks.
  const Tarjeta = ({ p, foco: enFoco = false }: { p: any; foco?: boolean }) => {
    const cu = cuando(p.dias)
    const cargas = p.cargas || []
    const secas = cargas.filter((c: any) => c.estado === 'SECA').length
    const todasSecas = cargas.length > 0 && secas === cargas.length
    const enMaquinas = ['PREPARACION', 'EN_LAVADO', 'EN_SECADO'].includes(p.etapa)
    const listo = ['EMBOLSADO', 'LISTO_RETIRO'].includes(p.etapa)
    return (
      <div className={`bg-white rounded-2xl border p-4 space-y-3 ${enFoco ? 'border-2' : ''}`}
           style={enFoco ? { borderColor: '#E8177A' } : {}}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/ordenes/${p.id}`} className="font-semibold text-gray-800">{ot(p.id)} · {p.cliente}</Link>
            <p className="text-xs text-gray-500 truncate">{p.detalle || 'sin ítems cargados'}</p>
            {p.observaciones && <p className="text-xs text-gray-700 mt-1">📝 {p.observaciones}</p>}
            <p className="text-xs text-gray-400 mt-0.5">
              {ETAPA_TXT[p.etapa] || p.etapa}
              {p.entrega_domicilio ? ' · a domicilio' : ' · retira en local'}
              {Number(p.bultos) > 0 ? ` · ${p.bultos} bulto(s)` : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className={`text-[11px] font-bold whitespace-nowrap ${cu.rojo ? 'text-red-700' : 'text-gray-500'}`}>{cu.txt}</span>
            {enFoco && <button onClick={() => { setFoco(null); setResultados(null); setQ('') }}
                               className="block ml-auto mt-1 text-xs text-gray-400">cerrar</button>}
          </div>
        </div>

        {/* Recepcionado: empezar la preparacion */}
        {p.etapa === 'RECEPCIONADO' && (
          <>
            <p className="text-xs text-gray-500">
              Previsto: {p.previstas ?? p.cargas_previstas ?? '—'} carga(s){p.firme === false ? ' (estimado por kilos)' : p.firme ? ' (firme)' : ''}
              {p.trabajo && p.trabajo !== 'LAVA' && <span className="text-amber-700 font-semibold"> · {p.trabajo}</span>}
            </p>
            <button onClick={() => setPedir({ titulo: `¿Empezar a preparar ${ot(p.id)}?`, detalle: p.cliente, color: '#E8177A',
                                              accion: () => hacer(preparacionApi.preparar(p.id), `${ot(p.id)} en preparación`) })}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              <PlayCircle size={15} /> Preparar
            </button>
          </>
        )}

        {/* En maquinas: las cargas */}
        {enMaquinas && (
          <>
            <p className="text-xs text-gray-500">
              Previsto: {p.cargas_previstas ?? p.previstas ?? '—'} carga(s) {p.prevision_firme === false ? '(estimado por kilos)' : p.prevision_firme ? '(firme)' : ''}
              {' · '}Definidas: <b>{cargas.length}</b>
            </p>

            {cargas.map((c: any) => {
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
                      <button onClick={() => setPedir({ titulo: `¿Quitar la carga ${c.numero}?`, detalle: ot(p.id), color: '#dc2626',
                                                        accion: () => hacer(preparacionApi.anular(c.id), 'Carga quitada') })}
                              className="p-2 rounded-lg text-gray-400" title="Quitar"><X size={16} /></button>
                      <button onClick={() => setElegir({ carga: c, maquina: 'LAVADORA', orden: p.id })}
                              className="px-3 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-1.5" style={{ background: '#4AAEE0' }}>
                        <Droplets size={15} /> A lavadora
                      </button>
                    </>
                  )}
                  {(c.estado === 'LAVANDO' || c.estado === 'MOJADA') && (
                    <button onClick={() => setElegir({ carga: c, maquina: 'SECADORA', orden: p.id })}
                            className="px-3 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-1.5" style={{ background: '#A87BC8' }}>
                      <Wind size={15} /> A secadora
                    </button>
                  )}
                  {c.estado === 'SECANDO' && (
                    <button onClick={() => setPedir({ titulo: `¿Carga ${c.numero} secado listo?`, detalle: `${ot(p.id)} · sale de S${c.secadora}`, color: '#16a34a',
                                                      accion: () => hacer(preparacionApi.seco(c.id), `Carga ${c.numero} seca`) })}
                            className="px-3 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-1.5" style={{ background: '#16a34a' }}>
                      <Check size={15} /> Secado listo
                    </button>
                  )}
                  {c.estado === 'SECA' && <Check size={18} className="text-green-600" />}
                  {c.estado !== 'LISTA' && c.min_ultima_marca != null && c.min_ultima_marca <= 60 && (
                    <button onClick={() => setPedir({ titulo: `¿Deshacer la carga ${c.numero}?`, detalle: `${ot(p.id)} · ${ATRAS[c.estado]}`, color: '#64748b',
                                                      accion: () => hacer(preparacionApi.deshacer(c.id), `Carga ${c.numero}: ${ATRAS[c.estado]}`) })}
                            className="p-2 rounded-lg text-gray-400" title="Deshacer"><Undo2 size={16} /></button>
                  )}
                </div>
              )
            })}

            <div>
              <p className="text-xs text-gray-500 mb-1.5">Agregar carga</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(TIPO).map(([k, v]) => (
                  <button key={k} onClick={() => setPedir({ titulo: `¿Agregar carga ${v.txt.toLowerCase()}?`, detalle: ot(p.id), color: v.color,
                                                          accion: () => hacer(preparacionApi.carga(p.id, k), `Carga ${v.txt.toLowerCase()} agregada`) })}
                          className="py-2.5 rounded-xl border-2 text-xs font-semibold flex items-center justify-center gap-1"
                          style={{ borderColor: v.color, color: v.color }}>
                    <Plus size={13} /> {v.txt}
                  </button>
                ))}
              </div>
            </div>

            {todasSecas && (
              <p className="text-sm font-semibold text-green-700 bg-green-50 rounded-xl p-3">
                Todas las cargas secas. Revisa que esté todo y embólsalo.
              </p>
            )}
            <button onClick={() => embolsar(p)}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: todasSecas ? '#E8177A' : '#cbd5e1' }}>
              <Package size={15} /> Doblado y embalado
            </button>
          </>
        )}

        {/* Ya embolsado: avisar y entregar en local */}
        {listo && (
          <div className="space-y-2">
            {p.cliente_telefono && (
              <button onClick={() => avisar(p)}
                      className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                      style={{ background: '#16a34a' }}>
                <Send size={15} /> Avisar por WhatsApp
              </button>
            )}
            {p.entrega_domicilio ? (
              <p className="text-xs text-gray-500 text-center">Va a domicilio: lo entrega el conductor en la ruta.</p>
            ) : (
              <button onClick={() => entregar(p)}
                      className="w-full py-3 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-1.5"
                      style={{ borderColor: '#16a34a', color: '#16a34a' }}>
                <Store size={15} /> Entregar en el local
              </button>
            )}
          </div>
        )}

        {['ENTREGADO', 'ASIGNADO_RUTA', 'EN_CAMINO', 'RETIRADO', 'AGENDADO'].includes(p.etapa) && (
          <p className="text-xs text-gray-500">Este pedido ya no se trabaja en el local.</p>
        )}
      </div>
    )
  }

  return (
    <div ref={raiz} className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Layers size={22} /> Producción</h1>
        <div className="flex items-center gap-2">
          <a href="#/estacion" className="text-xs px-3 py-2 rounded-xl text-white"
             style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>Modo estación</a>
          <button onClick={cargar} className="p-2 rounded-xl border text-gray-500" title="Actualizar">
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Buscar o pistolear ── */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-3 flex gap-2">
          <div className="flex-1 flex items-center gap-2 border rounded-xl px-3">
            <Search size={15} className="text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') buscar(q) }}
                   placeholder="N° de pedido o nombre del cliente"
                   className="flex-1 py-2.5 text-sm outline-none" />
            {!!q && <button onClick={() => { setQ(''); setResultados(null); setFoco(null) }} className="text-gray-400"><X size={15} /></button>}
          </div>
          <button onClick={() => buscar(q)} className="px-4 rounded-xl text-white text-sm" style={{ background: '#E8177A' }}>
            {buscando ? '...' : 'Buscar'}
          </button>
          <button onClick={() => (camara ? cerrarCamara() : abrirCamara())}
                  className="px-3 rounded-xl text-white" style={{ background: camara ? '#dc2626' : '#4AAEE0' }}
                  title={camara ? 'Cerrar cámara' : 'Pistolear el QR'}>
            {camara ? <CameraOff size={16} /> : <Camera size={16} />}
          </button>
        </div>

        <div id="lector" style={{ display: camara ? 'block' : 'none' }} />

        {resultados && resultados.length > 1 && (
          <div className="divide-y border-t max-h-72 overflow-y-auto">
            {resultados.map(r => (
              <button key={r.id} onClick={() => setFoco(r)} className="w-full text-left px-4 py-2.5">
                <p className="text-sm font-semibold text-gray-800">{ot(r.id)} · {r.cliente}</p>
                <p className="text-xs text-gray-500">{ETAPA_TXT[r.etapa] || r.etapa} · {r.detalle || 'sin ítems'}</p>
              </button>
            ))}
          </div>
        )}
        {resultados && resultados.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-400 border-t">No encontré ningún pedido con eso.</p>
        )}
      </div>

      {/* ── El pedido buscado, con su acción ── */}
      {foco && <Fragment key={'foco-' + foco.id}>{Tarjeta({ p: foco, foco: true })}</Fragment>}

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
      {t?.pedidos?.filter((p: any) => p.id !== foco?.id).map((p: any) => <Fragment key={p.id}>{Tarjeta({ p })}</Fragment>)}

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
                <button onClick={() => setPedir({ titulo: `¿Empezar a preparar ${ot(p.id)}?`, detalle: p.cliente, color: '#E8177A',
                                                  accion: () => hacer(preparacionApi.preparar(p.id), `${ot(p.id)} en preparación`) })}
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
                          const c = elegir.carga, maq = elegir.maquina, o = elegir.orden, l = maq === 'LAVADORA' ? 'L' : 'S'
                          setElegir(null)
                          setPedir({ titulo: `¿Carga ${c.numero} a ${l}${m.n}?`, detalle: ot(o),
                                     color: maq === 'LAVADORA' ? '#4AAEE0' : '#A87BC8',
                                     accion: () => hacer(maq === 'LAVADORA' ? preparacionApi.lavadora(c.id, m.n) : preparacionApi.secadora(c.id, m.n),
                                                         `Carga ${c.numero} a ${l}${m.n}`) })
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
                          onClick={() => { const maq = elegir.maquina, l = maq === 'LAVADORA' ? 'L' : 'S'
                                            setElegir(null)
                                            setPedir({ titulo: `¿Liberar ${l}${m.n}?`, detalle: `Tenía ${ot(m.carga.orden_id)} carga ${m.carga.numero}`, color: '#64748b',
                                                       accion: () => hacer(preparacionApi.liberar(maq, m.n), `${l}${m.n} liberada`) }) }}
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

      {/* ── Al embolsar: bultos y aviso ── */}
      {emb && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div>
              <p className="font-semibold text-gray-800">{ot(emb.id ?? emb.orden_id)} embolsado</p>
              <p className="text-sm text-gray-500">{emb.cliente}</p>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">¿Cuántos bultos?</label>
              <div className="grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <button key={n} onClick={() => guardarBultos(n)}
                          className={`py-3 rounded-xl border text-sm font-medium ${emb.n === n ? 'text-white' : 'text-gray-600'}`}
                          style={emb.n === n ? { background: '#E8177A', borderColor: '#E8177A' } : {}}>
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={() => {
                        const v = window.prompt('¿Cuántos bultos?', String(emb.n || ''))
                        const n = Number(v)
                        if (v !== null && Number.isInteger(n) && n > 0 && n <= 99) guardarBultos(n)
                        else if (v !== null) toast.error('Escribe un número entre 1 y 99')
                      }}
                      className="mt-2 w-full py-2 rounded-xl border text-xs text-gray-500">
                {emb.n && emb.n > 12 ? `${emb.n} bultos · cambiar` : 'Son más de 12'}
              </button>
            </div>
            {emb.cliente_telefono ? (
              <button onClick={() => avisar(emb)}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold"
                      style={{ background: '#16a34a' }}>
                <Send size={15} /> Avisarle al cliente por WhatsApp
              </button>
            ) : (
              <Link to={`/ordenes/${emb.id ?? emb.orden_id}`}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border text-sm text-gray-600">
                <MessageCircle size={15} /> Sin teléfono: abrir el pedido
              </Link>
            )}
            <button onClick={() => { setEmb(null); cargar(); refrescarFoco() }}
                    className="w-full py-3 rounded-xl text-white text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              Listo
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmar ── */}
      {pedir && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setPedir(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-lg font-bold text-gray-800">{pedir.titulo}</p>
              {pedir.detalle && <p className="text-sm text-gray-500 mt-0.5">{pedir.detalle}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPedir(null)} className="py-3.5 rounded-xl border-2 text-base font-semibold text-gray-600">Cancelar</button>
              <button disabled={!okListo}
                      onClick={() => { const a = pedir.accion; setPedir(null); a() }}
                      className="py-3.5 rounded-xl text-white text-base font-bold disabled:opacity-50" style={{ background: pedir.color }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
