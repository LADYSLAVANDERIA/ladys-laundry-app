import { useEffect, useState } from 'react'
import { clientesApi, prepagosApi, serviciosApi, ordenesApi } from '../services/api'
import api from '../services/api'
import toast from 'react-hot-toast'
import { CreditCard, Plus, TrendingDown, TrendingUp, X, Save, Package, ChevronRight, AlertCircle, Gift, BarChart2, Printer } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

const fmt  = (n: number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)
const hoy  = () => new Date().toISOString().split('T')[0]

export default function Membresias() {
  const [saldos,    setSaldos]    = useState<any[]>([])
  const [planes,    setPlanes]    = useState<any[]>([])
  const [clientes,  setClientes]  = useState<any[]>([])
  const [servicios, setServicios] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<string|null>(null)
  const [selMemb,   setSelMemb]   = useState<any>(null)
  const [movs,      setMovs]      = useState<any[]>([])
  const [form,      setForm]      = useState<any>({})
  const [resumen,   setResumen]   = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [s,p,c,sv] = await Promise.all([
        prepagosApi.saldos(), prepagosApi.planes(),
        clientesApi.getAll(), serviciosApi.getAll()
      ])
      setSaldos(s.data); setPlanes(p.data)
      setClientes(c.data); setServicios(sv.data)
    } finally { setLoading(false) }
  }
  useEffect(()=>{ load() },[])

  const abrirDetalle = async (m: any) => {
    setSelMemb(m)
    const { data } = await api.get(`/prepagos/${m.id}/movimientos`)
    setMovs(data)
    setModal('detalle')
  }

  const verResumen = async (m: any) => {
    setSelMemb(m)
    // Obtener OTs del mes actual vinculadas a esta membresía
    const ini = format(startOfMonth(new Date()),'yyyy-MM-dd')
    const fin = format(endOfMonth(new Date()),'yyyy-MM-dd')
    const { data: movData } = await api.get(`/prepagos/${m.id}/movimientos`)
    // Filtrar consumos del mes
    const consumosMes = movData.filter((mv: any) => {
      const fecha = new Date(mv.creado_en)
      return mv.tipo === 'CONSUMO' && fecha >= new Date(ini) && fecha <= new Date(fin)
    })
    const totalConsumido = consumosMes.reduce((s: number, mv: any) => s + Number(mv.monto), 0)
    const ahorro = totalConsumido - Number(m.precio_plan || 200000)
    setResumen({
      cliente: m.cliente,
      plan: m.plan,
      mes: format(new Date(), 'MMMM yyyy', {locale: es}),
      precio_membresia: Number(m.precio_plan || 200000),
      total_precio_lista: totalConsumido,
      ahorro: Math.max(0, ahorro),
      consumos: consumosMes,
      ordenes_mes: consumosMes.length,
    })
    setModal('resumen')
  }

  const activar = async () => {
    if (!form.cliente_id||!form.plan_id||!form.monto_pagado) return toast.error('Completa cliente, plan y monto')
    try {
      await api.post('/prepagos/activar',{
        cliente_id: Number(form.cliente_id),
        plan_id: Number(form.plan_id),
        fecha_inicio: form.fecha_inicio||hoy(),
        monto_pagado: Number(form.monto_pagado)
      })
      toast.success('Membresía activada'); setModal(null); setForm({}); load()
    } catch(e:any){ toast.error(e.response?.data?.error||'Error') }
  }

  const recargar = async () => {
    if (!form.monto) return toast.error('Ingresa el monto')
    try {
      await api.post(`/prepagos/${selMemb.id}/recargar`,{monto:Number(form.monto)})
      toast.success('Saldo recargado'); setModal(null); setForm({})
      await abrirDetalle(selMemb); load()
    } catch(e:any){ toast.error(e.response?.data?.error||'Error') }
  }

  const crearOT = async () => {
    const items = form.items||[]
    if (!items.length) return toast.error('Agrega al menos un servicio')
    const total = items.reduce((s:number,i:any)=>s+i.subtotal,0)
    if (total > selMemb.saldo_actual) return toast.error('Saldo insuficiente')
    try {
      const { data: orden } = await ordenesApi.create({
        cliente_id: selMemb.cliente_id,
        items, tipo_doc:'BOLETA',
        observaciones: form.observaciones||'Orden membresía',
        monto_delivery: 0
      })
      await api.post(`/prepagos/${selMemb.id}/consumir`,{monto:total,orden_id:orden.id})
      toast.success(`OT #${String(orden.id).padStart(5,'0')} creada — ${fmt(total)} descontado`)
      setModal(null); setForm({}); load()
    } catch(e:any){ toast.error(e.response?.data?.error||'Error') }
  }

  const addItem = (serv:any) => {
    const items = form.items||[]
    const ex = items.find((i:any)=>i.servicio_id===serv.id)
    if (ex) {
      setForm({...form, items: items.map((i:any)=>i.servicio_id===serv.id
        ?{...i,cantidad:i.cantidad+1,subtotal:(i.cantidad+1)*i.precio_unit}:i)})
    } else {
      setForm({...form, items:[...items,{
        servicio_id:serv.id, nombre:serv.nombre,
        cantidad:1, precio_unit:serv.precio_lav_planch||serv.precio_lav_secado||0,
        subtotal:serv.precio_lav_planch||serv.precio_lav_secado||0
      }]})
    }
  }

  const pct = (m:any) => m.saldo_inicial>0?Math.round(m.saldo_actual/m.saldo_inicial*100):0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Membresías</h1>
          <p className="text-gray-500 text-sm">{saldos.length} activas · Membresía $200.000/mes</p>
        </div>
        <button onClick={()=>{setForm({fecha_inicio:hoy(),monto_pagado:200000});setModal('nueva')}}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium"
          style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
          <Plus size={16}/> Nueva membresía
        </button>
      </div>

      {loading
        ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"/></div>
        : <div className="grid gap-4">
            {saldos.map(m=>{
              const p=pct(m); const venc=m.fecha_venc<hoy()
              const pronto=!venc&&Math.ceil((new Date(m.fecha_venc).getTime()-Date.now())/86400000)<=7
              return (
                <div key={m.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  {/* Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl"
                          style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
                          {m.cliente?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-lg">{m.cliente}</p>
                          <p className="text-xs text-gray-500">{m.plan}</p>
                          {venc&&<span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Vencida</span>}
                          {pronto&&!venc&&<span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit mt-0.5"><AlertCircle size={10}/>Vence en {Math.ceil((new Date(m.fecha_venc).getTime()-Date.now())/86400000)} días</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-pink-600">{fmt(m.saldo_actual)}</p>
                        <p className="text-xs text-gray-400">saldo disponible</p>
                        <p className="text-xs text-gray-400">de {fmt(m.saldo_inicial)}</p>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full mb-1">
                      <div className="h-3 rounded-full" style={{
                        width:`${Math.max(p,1)}%`,
                        background:p>40?'linear-gradient(90deg,#E8177A,#A87BC8)':p>15?'#f59e0b':'#ef4444'
                      }}/>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span className={p>40?'text-pink-600 font-medium':p>15?'text-yellow-600 font-medium':'text-red-500 font-medium'}>{p}% disponible</span>
                      <span>Vence {format(new Date(m.fecha_venc+'T12:00:00'),'d MMM yyyy',{locale:es})}</span>
                    </div>
                  </div>
                  {/* Acciones */}
                  <div className="grid grid-cols-3 border-t divide-x">
                    <button onClick={()=>{setSelMemb(m);setForm({items:[]});setModal('nueva-orden')}}
                      className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-pink-600 hover:bg-pink-50 transition-colors">
                      <Package size={14}/> Nueva OT
                    </button>
                    <button onClick={()=>{abrirDetalle(m)}}
                      className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                      <BarChart2 size={14}/> Historial
                    </button>
                    <button onClick={()=>verResumen(m)}
                      className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors">
                      <Gift size={14}/> Resumen mes
                    </button>
                  </div>
                </div>
              )
            })}
            {saldos.length===0&&(
              <div className="text-center py-20 text-gray-400">
                <CreditCard size={48} className="mx-auto mb-3 opacity-20"/>
                <p className="font-medium">No hay membresías activas</p>
              </div>
            )}
          </div>
      }

      {/* ── MODAL NUEVA OT ── */}
      {modal==='nueva-orden'&&selMemb&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-gray-800">Nueva OT — {selMemb.cliente}</h2>
                <p className="text-xs text-green-600 font-semibold">Saldo disponible: {fmt(selMemb.saldo_actual)}</p>
              </div>
              <button onClick={()=>setModal(null)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Servicios por categoría */}
              {['CARGAS','DORMITORIO','VESTIR','ACCESORIOS','TINTORERIA','ESPECIALES','ALFOMBRAS'].map(cat=>{
                const items = servicios.filter(s=>s.categoria===cat&&(s.precio_lav_planch||s.precio_lav_secado)>0)
                if (!items.length) return null
                return (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-gray-400 mb-2">{cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {items.map(s=>(
                        <button key={s.id} onClick={()=>addItem(s)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-pink-100 hover:text-pink-700 rounded-lg text-xs transition-colors">
                          <Plus size={10}/> {s.nombre}
                          <span className="text-gray-400 ml-1">{fmt(s.precio_lav_planch||s.precio_lav_secado)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Items seleccionados */}
              {(form.items||[]).length>0&&(
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">ITEMS SELECCIONADOS</div>
                  {(form.items||[]).map((item:any,idx:number)=>(
                    <div key={idx} className="flex items-center px-4 py-2.5 border-b last:border-0">
                      <p className="flex-1 text-sm font-medium">{item.nombre}</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <button onClick={()=>setForm({...form,items:form.items.map((i:any,n:number)=>n===idx?{...i,cantidad:Math.max(1,i.cantidad-1),subtotal:Math.max(1,i.cantidad-1)*i.precio_unit}:i)})}
                            className="w-6 h-6 bg-gray-200 rounded text-sm font-bold hover:bg-gray-300">-</button>
                          <span className="w-6 text-center text-sm">{item.cantidad}</span>
                          <button onClick={()=>setForm({...form,items:form.items.map((i:any,n:number)=>n===idx?{...i,cantidad:i.cantidad+1,subtotal:(i.cantidad+1)*i.precio_unit}:i)})}
                            className="w-6 h-6 bg-gray-200 rounded text-sm font-bold hover:bg-gray-300">+</button>
                        </div>
                        <p className="text-sm font-bold text-pink-600 w-20 text-right">{fmt(item.subtotal)}</p>
                        <button onClick={()=>setForm({...form,items:form.items.filter((_:any,i:number)=>i!==idx)})}
                          className="text-red-300 hover:text-red-500"><X size={14}/></button>
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                    <span className="text-sm font-semibold">Total a descontar</span>
                    <span className="text-lg font-bold text-pink-600">
                      {fmt((form.items||[]).reduce((s:number,i:any)=>s+i.subtotal,0))}
                    </span>
                  </div>
                  {(form.items||[]).reduce((s:number,i:any)=>s+i.subtotal,0)>selMemb.saldo_actual&&(
                    <div className="px-4 py-2 bg-red-50 flex items-center gap-2 text-red-600 text-xs">
                      <AlertCircle size={12}/> Saldo insuficiente — recarga antes de proceder
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
                <input value={form.observaciones||''} onChange={e=>setForm({...form,observaciones:e.target.value})}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
              </div>

              <div className="flex gap-2">
                <button onClick={crearOT}
                  disabled={!(form.items||[]).length||(form.items||[]).reduce((s:number,i:any)=>s+i.subtotal,0)>selMemb.saldo_actual}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                  style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
                  <Save size={15}/> Crear OT y descontar saldo
                </button>
                <button onClick={()=>setModal(null)} className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HISTORIAL ── */}
      {modal==='detalle'&&selMemb&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b sticky top-0 bg-white flex items-center justify-between">
              <div>
                <h2 className="font-bold">{selMemb.cliente}</h2>
                <p className="text-xs text-gray-500">Historial de movimientos</p>
              </div>
              <button onClick={()=>setModal(null)}><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="p-4 border-b bg-gray-50 flex justify-between">
              <div>
                <p className="text-xs text-gray-500">Saldo actual</p>
                <p className="text-xl font-bold text-pink-600">{fmt(selMemb.saldo_actual)}</p>
              </div>
              <button onClick={()=>{setForm({});setModal('recargar')}}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium self-center">
                <TrendingUp size={14}/> Recargar
              </button>
            </div>
            <div className="p-5">
              {movs.length===0
                ? <p className="text-center text-gray-400 py-8">Sin movimientos</p>
                : <div className="space-y-2">
                    {movs.map(mv=>(
                      <div key={mv.id} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${mv.tipo==='CONSUMO'?'bg-red-50':'bg-green-50'}`}>
                          {mv.tipo==='CONSUMO'?<TrendingDown size={15} className="text-red-400"/>:<TrendingUp size={15} className="text-green-500"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {mv.tipo==='CONSUMO'?`OT #${String(mv.ot_numero||'').padStart(5,'0')}`:mv.tipo==='CARGA'?'Activación membresía':'Recarga'}
                          </p>
                          <p className="text-xs text-gray-400">{format(new Date(mv.creado_en),'d MMM yyyy HH:mm',{locale:es})}</p>
                        </div>
                        <p className={`font-bold text-sm ${mv.tipo==='CONSUMO'?'text-red-500':'text-green-600'}`}>
                          {mv.tipo==='CONSUMO'?'-':'+'}{fmt(mv.monto)}
                        </p>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RECARGAR ── */}
      {modal==='recargar'&&selMemb&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Recargar membresía</h2>
              <button onClick={()=>setModal('detalle')}><X size={18} className="text-gray-400"/></button>
            </div>
            <p className="text-sm text-gray-500 mb-1">{selMemb.cliente}</p>
            <p className="text-xs text-gray-400 mb-4">Saldo actual: <strong className="text-pink-600">{fmt(selMemb.saldo_actual)}</strong></p>
            <div className="space-y-3">
              <input type="number" value={form.monto||''} onChange={e=>setForm({...form,monto:e.target.value})}
                placeholder="Monto a recargar" className="w-full border rounded-xl px-3 py-3 text-lg font-bold outline-none focus:ring-2 focus:ring-green-300"/>
              <div className="flex flex-wrap gap-2">
                {[50000,100000,150000,200000].map(v=>(
                  <button key={v} onClick={()=>setForm({...form,monto:v})}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-green-100 hover:text-green-700 rounded-lg text-xs">
                    {fmt(v)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={recargar}
                  className="flex-1 py-3 rounded-xl text-white font-semibold text-sm" style={{background:'linear-gradient(135deg,#22c55e,#16a34a)'}}>
                  <TrendingUp size={14} className="inline mr-1.5"/> Confirmar recarga
                </button>
                <button onClick={()=>setModal('detalle')} className="px-4 py-3 rounded-xl bg-gray-100 text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RESUMEN MENSUAL ── */}
      {modal==='resumen'&&resumen&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header gradiente */}
            <div className="p-6 text-white" style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm opacity-80">Resumen membresía</p>
                <button onClick={()=>setModal(null)}><X size={18} className="opacity-70 hover:opacity-100"/></button>
              </div>
              <h2 className="text-2xl font-bold">{resumen.cliente}</h2>
              <p className="text-sm opacity-80 capitalize">{resumen.mes}</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Comparativa */}
              <div className="bg-purple-50 rounded-2xl p-5 text-center">
                <p className="text-xs text-purple-600 font-semibold mb-1">SI PAGARAS PRECIO NORMAL</p>
                <p className="text-3xl font-bold text-purple-700">{fmt(resumen.total_precio_lista)}</p>
                <p className="text-xs text-purple-500 mt-1">{resumen.ordenes_mes} órdenes al precio de lista</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-pink-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-pink-600 font-semibold mb-1">PAGASTE</p>
                  <p className="text-xl font-bold text-pink-700">{fmt(resumen.precio_membresia)}</p>
                  <p className="text-xs text-pink-400">membresía mensual</p>
                </div>
                <div className={`rounded-xl p-4 text-center ${resumen.ahorro>0?'bg-green-50':'bg-gray-50'}`}>
                  <p className={`text-xs font-semibold mb-1 ${resumen.ahorro>0?'text-green-600':'text-gray-500'}`}>
                    {resumen.ahorro>0?'AHORRASTE':'AÚN RENTABILIZANDO'}
                  </p>
                  <p className={`text-xl font-bold ${resumen.ahorro>0?'text-green-700':'text-gray-500'}`}>
                    {fmt(resumen.ahorro)}
                  </p>
                  <p className={`text-xs ${resumen.ahorro>0?'text-green-400':'text-gray-400'}`}>
                    {resumen.ahorro>0?'con tu membresía':'sigue usando tu membresía'}
                  </p>
                </div>
              </div>

              {resumen.ahorro>0&&(
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-sm font-bold text-green-700">🎉 ¡Tu membresía te ahorró {fmt(resumen.ahorro)} este mes!</p>
                  <p className="text-xs text-green-600 mt-1">Comparado con pagar precio de lista en cada servicio</p>
                </div>
              )}

              {/* Detalle de consumos */}
              {resumen.consumos.length>0&&(
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">SERVICIOS USADOS ESTE MES</p>
                  <div className="space-y-1.5">
                    {resumen.consumos.map((mv:any,i:number)=>(
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600">OT #{String(mv.ot_numero||'').padStart(5,'0')}</span>
                        <span className="font-medium">{fmt(mv.monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resumen.consumos.length===0&&(
                <div className="text-center py-4 text-gray-400">
                  <p className="text-sm">Aún no hay órdenes registradas este mes</p>
                  <p className="text-xs mt-1">Crea la primera OT con el botón "Nueva OT"</p>
                </div>
              )}

              <button onClick={()=>window.print()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
                <Printer size={14}/> Imprimir resumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA MEMBRESÍA ── */}
      {modal==='nueva'&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">Activar membresía</h2>
              <button onClick={()=>setModal(null)}><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cliente</label>
                <select value={form.cliente_id||''} onChange={e=>setForm({...form,cliente_id:e.target.value})}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none">
                  <option value="">Seleccionar cliente</option>
                  {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Plan</label>
                <select value={form.plan_id||''} onChange={e=>{
                  const pl=planes.find(x=>x.id===Number(e.target.value))
                  setForm({...form,plan_id:e.target.value,monto_pagado:pl?.precio||200000})
                }} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none">
                  <option value="">Seleccionar plan</option>
                  {planes.map(p=><option key={p.id} value={p.id}>{p.nombre} — {fmt(p.precio)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Monto pagado</label>
                  <input type="number" value={form.monto_pagado||''} onChange={e=>setForm({...form,monto_pagado:e.target.value})}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fecha inicio</label>
                  <input type="date" value={form.fecha_inicio||hoy()} onChange={e=>setForm({...form,fecha_inicio:e.target.value})}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"/>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={activar}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
                  style={{background:'linear-gradient(135deg,#E8177A,#A87BC8)'}}>
                  <Save size={14}/> Activar
                </button>
                <button onClick={()=>setModal(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
