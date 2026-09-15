import { useEffect, useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from 'recharts'
import { AlertTriangle, RefreshCw, Package, Clock, Truck, Factory } from 'lucide-react'
import { kpisApi } from '../services/api'

// KPI de producción. Todo lo que dice "horas" acá son HORAS DE TALLER ABIERTO,
// no de calendario: la primera medición dio 46 h de espera en recepción y era
// mentira, contaba noches, domingos y feriados. Con el reloj corregido son 11.
// Si alguna vez se ve un número enorme, lo primero es revisar que no se haya
// colado el reloj de pared.

const ROSA = '#E8177A', MORADO = '#A87BC8', AZUL = '#4AAEE0'
const num = (v: any) => Number(v) || 0
const pesos = (n: any) => '$' + Math.round(num(n)).toLocaleString('es-CL')
const dia = (f: any) => {
  const t = String(f || '').slice(0, 10)
  const d = new Date(t + 'T12:00:00')
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function Tarjeta({ icono, titulo, valor, pie, color }: any) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">{icono}{titulo}</div>
      <p className="text-2xl font-bold mt-1" style={{ color: color || '#1f2937' }}>{valor}</p>
      {pie && <p className="text-[11px] text-gray-400 mt-0.5">{pie}</p>}
    </div>
  )
}

function Caja({ titulo, sub, children }: any) {
  return (
    <section className="rounded-2xl border bg-white p-4">
      <h2 className="font-semibold text-gray-800 text-sm">{titulo}</h2>
      {sub && <p className="text-xs text-gray-500 mt-0.5 mb-3">{sub}</p>}
      {children}
    </section>
  )
}

export default function Kpis() {
  const [d, setD] = useState<any>(null)
  const [cargando, setCargando] = useState(true)

  const traer = () => {
    setCargando(true)
    kpisApi.produccion().then(r => setD(r.data)).catch(() => {}).finally(() => setCargando(false))
  }
  useEffect(() => { traer(); const t = setInterval(traer, 300000); return () => clearInterval(t) }, [])

  if (!d) return <p className="py-10 text-center text-sm text-gray-400">Cargando los indicadores…</p>

  const carga = (d.carga || []).map((c: any) => ({
    dia: dia(c.sale),
    lavadora: num(c.uso_lavadora_pct),
    persona: num(c.uso_persona_pct),
    veredicto: c.veredicto,
    pedidos: num(c.pedidos),
  }))
  const salidas = (d.salidas || []).map((s: any) => ({
    dia: dia(s.dia), entregados: num(s.entregados), lavados: num(s.entraron_a_lavar),
  }))
  const esperas = (d.esperas || []).map((e: any) => ({
    etapa: String(e.etapa).replace('_', ' ').toLowerCase(),
    horas: num(e.espera_mediana_h), peor: num(e.peor_10_pct_h),
    calendario: num(e.calendario_mediana_h), veces: num(e.veces),
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Producción</h1>
          <p className="text-sm text-gray-500">Cómo viene el taller hoy</p>
        </div>
        <button onClick={traer} className="p-2.5 rounded-xl border text-gray-500">
          <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {(d.advertencias || []).length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-1">
          {d.advertencias.map((a: string, i: number) => (
            <p key={i} className="text-xs text-amber-900 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />{a}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta icono={<Factory size={13} />} titulo="Con ropa en el local"
                 valor={d.hoy.en_taller} pie={`${Math.round(num(d.hoy.kilos))} kg`} />
        <Tarjeta icono={<AlertTriangle size={13} />} titulo="Atrasados"
                 valor={d.hoy.atrasados} color={d.hoy.atrasados > 0 ? '#DC2626' : undefined}
                 pie="pasó la fecha comprometida" />
        <Tarjeta icono={<Package size={13} />} titulo="Salen hoy" valor={d.hoy.salen_hoy}
                 color={ROSA} pie={`${d.hoy.salen_manana} mañana`} />
        <Tarjeta icono={<Clock size={13} />} titulo="Lo más detenido"
                 valor={`${Math.max(...(d.cola || []).map((c: any) => num(c.mas_viejo_h)), 0)} h`}
                 pie="horas de taller sin moverse" />
      </div>

      <Caja titulo="Lo comprometido contra lo que cabe"
            sub="Porcentaje de la capacidad del día que ocupa lo prometido para esa fecha. Sobre 100 no alcanza.">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={carga} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} unit="%" />
            <Tooltip formatter={(v: any, n: any) => [`${v}%`, n === 'lavadora' ? 'Lavadora' : 'Persona']} />
            <ReferenceLine y={100} stroke="#DC2626" strokeDasharray="4 4" />
            <ReferenceLine y={85} stroke="#F59E0B" strokeDasharray="2 4" />
            <Bar dataKey="lavadora" radius={[4, 4, 0, 0]}>
              {carga.map((c: any, i: number) => (
                <Cell key={i} fill={c.veredicto === 'NO ALCANZA' ? '#DC2626'
                                 : c.veredicto === 'JUSTO' ? '#F59E0B'
                                 : c.veredicto === 'YA ATRASADO' ? '#9CA3AF' : ROSA} />
              ))}
            </Bar>
            <Bar dataKey="persona" fill={MORADO} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-gray-400 mt-2">
          Capacidad del día: {num(d.capacidad?.min_lavadora)} min de lavadora ({d.capacidad?.lavadoras} máquinas)
          y {num(d.capacidad?.min_persona)} min de persona ({d.capacidad?.personas} personas × {d.capacidad?.horas_dia} h).
        </p>
      </Caja>

      <Caja titulo="Dónde espera la ropa"
            sub="Mediana en horas de taller abierto. La columna de calendario es la misma espera con reloj de pared: la diferencia era solo que el local estaba cerrado.">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={esperas} layout="vertical" margin={{ top: 0, right: 15, left: 55, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 10 }} unit=" h" />
            <YAxis type="category" dataKey="etapa" tick={{ fontSize: 10 }} width={80} />
            <Tooltip formatter={(v: any) => [`${v} h`, 'Espera mediana']} />
            <Bar dataKey="horas" fill={AZUL} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs">
            <thead><tr className="text-gray-400 text-left">
              <th className="py-1">Etapa</th><th>Casos</th><th>Mediana</th><th>Peor 10%</th><th>Calendario</th>
            </tr></thead>
            <tbody>
              {esperas.map((e: any) => (
                <tr key={e.etapa} className="border-t">
                  <td className="py-1.5 capitalize">{e.etapa}</td>
                  <td className="text-gray-500">{e.veces}</td>
                  <td className="font-semibold">{e.horas} h</td>
                  <td className="text-gray-500">{e.peor} h</td>
                  <td className="text-gray-300">{e.calendario} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Caja>

      <Caja titulo="El pulso de la planta" sub="Cuántos pedidos entraron a lavar y cuántos salieron entregados, por día.">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={salidas} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip formatter={(v: any, n: any) => [v, n === 'lavados' ? 'Entraron a lavar' : 'Entregados']} />
            <Area type="monotone" dataKey="lavados" stroke={AZUL} fill={AZUL} fillOpacity={0.15} />
            <Area type="monotone" dataKey="entregados" stroke={ROSA} fill={ROSA} fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </Caja>

      <Caja titulo="La cola ahora" sub="Cuántos pedidos hay en cada etapa y cuánto lleva detenido el más viejo.">
        <div className="space-y-2">
          {(d.cola || []).map((c: any) => (
            <div key={c.etapa} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
              <span className="capitalize text-gray-700">{String(c.etapa).replace('_', ' ').toLowerCase()}</span>
              <span className="flex items-center gap-3">
                <span className="font-semibold">{c.pedidos}</span>
                <span className={`text-xs ${num(c.mas_viejo_h) > 24 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                  el más viejo, {num(c.mas_viejo_h)} h
                </span>
              </span>
            </div>
          ))}
        </div>
      </Caja>

      <Caja titulo="Rutas de los últimos 14 días"
            sub={d.rutas?.costo?.confirmado
              ? 'Margen por tramo, con el costo real de la camioneta.'
              : 'OJO: el costo de la camioneta es una estimación sin confirmar. El margen es referencial.'}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <Tarjeta icono={<Truck size={13} />} titulo="Paradas" valor={num(d.rutas?.total?.paradas)}
                   pie={`${num(d.rutas?.total?.km)} km`} />
          <Tarjeta icono={<Truck size={13} />} titulo="Km por parada" valor={num(d.rutas?.total?.km_parada)} />
          <Tarjeta icono={<Truck size={13} />} titulo="Costo por parada"
                   valor={pesos(d.rutas?.total?.costo_parada)} />
          <Tarjeta icono={<Truck size={13} />} titulo="Margen" valor={pesos(d.rutas?.total?.margen)}
                   color={MORADO} pie={`sobre ${pesos(d.rutas?.total?.ingreso)}`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-gray-400 text-left">
              <th className="py-1">Día</th><th>Tramo</th><th>Paradas</th><th>Km</th>
              <th>Ingreso</th><th>Costo</th><th>Margen</th>
            </tr></thead>
            <tbody>
              {(d.rutas?.dias || []).map((r: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="py-1.5">{dia(r.fecha)}</td>
                  <td className="text-gray-500">{r.tramo || '—'}</td>
                  <td>{r.paradas} <span className="text-gray-300">({r.retiros}R/{r.entregas}E)</span></td>
                  <td className={num(r.km) / Math.max(num(r.paradas), 1) > 3 ? 'text-amber-700 font-semibold' : ''}>
                    {r.km}
                  </td>
                  <td>{pesos(r.ingreso)}</td>
                  <td className="text-gray-500">{pesos(r.costo)}</td>
                  <td className="font-semibold">{r.margen_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Los kilómetros en ámbar son rutas con más de 3 km por parada: ahí es donde se come el margen,
          no en los kilómetros totales.
        </p>
      </Caja>
    </div>
  )
}
