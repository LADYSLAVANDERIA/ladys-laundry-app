import { useMemo, useState } from 'react'
import { Plus, X, Zap, Scale } from 'lucide-react'
import { fmt } from '../utils'

export type Item = { servicio_id: number | null; nombre: string; cantidad: number; precio_unit: number; subtotal: number; tipo?: 'KILO' | 'PRENDA' }
type Props = { servicios: any[]; kilos: string; setKilos: (v: string) => void; express: boolean; setExpress: (v: boolean) => void; prendas: Item[]; setPrendas: (v: Item[]) => void }

const esKilo = (s: any) => /CARGA 1 KILO/i.test(s?.nombre || '')
export const precioDe = (s: any) => Number(s.precio_lav_planch || s.precio_lav_secado || s.precio_solo_planch || s.precio_productos || 0)
export const kiloServicio = (servicios: any[], express: boolean) =>
  servicios.find(s => (express ? /CARGA 1 KILO EXPRESS/i.test(s.nombre) : /^CARGA 1 KILO$/i.test(s.nombre)))

export function buildItems(servicios: any[], kilos: string, express: boolean, prendas: Item[]): Item[] {
  const k = Number(String(kilos).replace(',', '.') || 0)
  const items: Item[] = []
  if (k > 0) {
    const sv = kiloServicio(servicios, express)
    const pu = sv ? precioDe(sv) : express ? 3700 : 2900
    items.push({ servicio_id: sv?.id ?? null, nombre: express ? 'Lavado por kilo EXPRESS' : 'Lavado por kilo', cantidad: k, precio_unit: pu, subtotal: Math.round(k * pu), tipo: 'KILO' })
  }
  return [...items, ...prendas.filter(p => p.cantidad > 0)]
}

export default function ItemsPicker({ servicios, kilos, setKilos, express, setExpress, prendas, setPrendas }: Props) {
  const cats = useMemo(() => {
    const orden: Record<string, number> = {}
    servicios.forEach(s => { if (!esKilo(s) && s.categoria) orden[s.categoria] = Math.min(orden[s.categoria] ?? 99, Number(s.cat_orden ?? 99)) })
    return Object.keys(orden).sort((a, b) => orden[a] - orden[b] || a.localeCompare(b))
  }, [servicios])
  const [cat, setCat] = useState<string>('')
  const catActual = cat || cats[0] || ''
  const lista = servicios.filter(s => s.categoria === catActual && !esKilo(s))
  const kn = kiloServicio(servicios, false), ke = kiloServicio(servicios, true)
  const k = Number(String(kilos).replace(',', '.') || 0)
  const puKilo = express ? (ke ? precioDe(ke) : 3700) : (kn ? precioDe(kn) : 2900)

  const add = (s: any) => {
    const ex = prendas.find(p => p.servicio_id === s.id)
    if (ex) setPrendas(prendas.map(p => (p.servicio_id === s.id ? { ...p, cantidad: p.cantidad + 1, subtotal: Math.round((p.cantidad + 1) * p.precio_unit) } : p)))
    else setPrendas([...prendas, { servicio_id: s.id, nombre: s.nombre, cantidad: 1, precio_unit: precioDe(s), subtotal: precioDe(s), tipo: 'PRENDA' }])
  }
  const upd = (i: number, cant: number, precio: number) =>
    setPrendas(prendas.map((p, n) => (n === i ? { ...p, cantidad: Math.max(0, cant), precio_unit: Math.max(0, precio), subtotal: Math.round(Math.max(0, cant) * Math.max(0, precio)) } : p)))

  return (
    <div className="space-y-4">
      {/* Kilos */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-700 flex items-center gap-2"><Scale size={16} className="text-pink-500" /> Lavado por kilo</p>
          <div className="flex rounded-xl overflow-hidden border text-xs font-semibold">
            <button type="button" onClick={() => setExpress(false)} className={`px-3 py-1.5 ${!express ? 'bg-pink-500 text-white' : 'bg-white text-gray-500'}`}>Normal {kn ? fmt(precioDe(kn)) : ''}/kg</button>
            <button type="button" onClick={() => setExpress(true)} className={`px-3 py-1.5 flex items-center gap-1 ${express ? 'bg-amber-500 text-white' : 'bg-white text-gray-500'}`}><Zap size={11} /> Express {ke ? fmt(precioDe(ke)) : ''}/kg</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="number" step="0.1" min="0" inputMode="decimal" value={kilos} onChange={e => setKilos(e.target.value)} placeholder="0.0"
            className="w-32 border rounded-xl px-3 py-3 text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-pink-300" />
          <span className="text-gray-500 text-sm">kg</span>
          <div className="flex gap-1.5 flex-wrap">
            {[3, 5, 8, 10, 15].map(v => <button type="button" key={v} onClick={() => setKilos(String(v))} className="px-2.5 py-1 bg-gray-100 hover:bg-pink-100 rounded-lg text-xs">{v} kg</button>)}
          </div>
          {k > 0 && <span className="ml-auto text-lg font-bold text-pink-600">{fmt(k * puKilo)}</span>}
        </div>
      </div>

      {/* Prendas */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <p className="font-semibold text-gray-700 mb-2">Prendas y servicios</p>
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
          {cats.map(c => (
            <button type="button" key={c} onClick={() => setCat(c)} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ${catActual === c ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {lista.map(s => (
            <button type="button" key={s.id} onClick={() => add(s)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border hover:bg-pink-50 hover:border-pink-300 rounded-lg text-xs transition-colors">
              <Plus size={10} className="text-pink-500" /> {s.nombre} <span className="text-gray-400 ml-1">{fmt(precioDe(s))}</span>
            </button>
          ))}
          {!lista.length && <p className="text-xs text-gray-400">Sin servicios en esta categoría</p>}
        </div>
        {prendas.length > 0 && (
          <div className="mt-3 border rounded-xl divide-y">
            {prendas.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <p className="flex-1 text-sm font-medium truncate">{p.nombre}</p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => upd(i, p.cantidad - 1, p.precio_unit)} className="w-6 h-6 bg-gray-200 rounded text-sm font-bold">-</button>
                  <input type="number" min="0" step="1" value={p.cantidad} onChange={e => upd(i, Number(e.target.value), p.precio_unit)} className="w-12 text-center border rounded text-sm py-0.5" />
                  <button type="button" onClick={() => upd(i, p.cantidad + 1, p.precio_unit)} className="w-6 h-6 bg-gray-200 rounded text-sm font-bold">+</button>
                </div>
                <input type="number" value={p.precio_unit} onChange={e => upd(i, p.cantidad, Number(e.target.value))} className="w-20 text-right border rounded text-sm py-0.5 px-1" title="Precio unitario (editable)" />
                <span className="w-20 text-right text-sm font-bold text-pink-600">{fmt(p.subtotal)}</span>
                <button type="button" onClick={() => setPrendas(prendas.filter((_, n) => n !== i))} className="text-red-300 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
