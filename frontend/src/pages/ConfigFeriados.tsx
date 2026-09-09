import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarOff, Check, Plus, Trash2 } from 'lucide-react'
import { feriadosApi } from '../services/api'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// El feriado nunca se borra al decidir trabajarlo: se marca. Si se borrara, el
// año siguiente nadie recordaría que ese día era feriado.
function comoSeLee(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

export default function ConfigFeriados() {
  const [anio, setAnio] = useState<number>(new Date().getFullYear())
  const [anios, setAnios] = useState<number[]>([])
  const [feriados, setFeriados] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState({ fecha: '', motivo: '' })

  const cargar = (a = anio) => {
    setCargando(true)
    feriadosApi.getAll(a)
      .then(r => { setFeriados(r.data.feriados || []); setAnios(r.data.anios || []) })
      .catch(() => toast.error('No pude cargar los feriados'))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar(anio) }, [anio])

  const alternar = async (f: any) => {
    const abrir = !f.trabajamos
    let nota = f.nota || ''
    if (abrir) {
      const r = window.prompt(
        `Vas a trabajar el ${comoSeLee(f.fecha)} (${f.motivo}).\n\n` +
        `Ese día habrá ruta y SofIA podrá agendar retiros.\n\n¿Por qué se abre? (opcional)`)
      if (r === null) return
      nota = r
    }
    try {
      await feriadosApi.trabajar(f.fecha, abrir, nota)
      toast.success(abrir ? 'Ese día queda abierto' : 'Vuelve a ser feriado cerrado')
      cargar()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo guardar') }
  }

  const agregar = async () => {
    if (!nuevo.fecha || !nuevo.motivo.trim()) return toast.error('Falta la fecha o el motivo')
    try {
      await feriadosApi.crear(nuevo.fecha, nuevo.motivo.trim())
      toast.success('Día cerrado agregado'); setNuevo({ fecha: '', motivo: '' }); cargar()
    } catch (e: any) { toast.error(e.response?.data?.error || 'No se pudo agregar') }
  }

  const borrar = async (f: any) => {
    if (!window.confirm(`¿Borrar ${comoSeLee(f.fecha)} (${f.motivo}) de la lista?`)) return
    try { await feriadosApi.borrar(f.fecha); toast.success('Borrado'); cargar() }
    catch { toast.error('No se pudo borrar') }
  }

  const abiertos = feriados.filter(f => f.trabajamos).length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-bold text-gray-800">Feriados</h2>
          <p className="text-sm text-gray-500">
            En feriado no se trabaja: no hay ruta y SofIA no agenda.
            Si van a abrir un día en particular, márcalo acá.
          </p>
        </div>
        <select value={anio} onChange={e => setAnio(Number(e.target.value))}
                className="border rounded-xl px-3 py-2 text-sm">
          {(anios.length ? anios : [anio]).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {abiertos > 0 && (
        <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2">
          {abiertos === 1 ? 'Hay 1 feriado abierto' : `Hay ${abiertos} feriados abiertos`} este año:
          esos días la ruta opera normalmente.
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p>
      ) : (
        <div className="bg-white border rounded-2xl divide-y">
          {feriados.map(f => (
            <div key={f.fecha}
                 className={`flex items-center gap-3 px-4 py-3 ${f.ya_paso ? 'opacity-45' : ''}`}>
              <CalendarOff size={16} className={f.trabajamos ? 'text-green-600' : 'text-gray-400'} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 capitalize">{comoSeLee(f.fecha)}</p>
                <p className="text-xs text-gray-500 truncate">
                  {f.motivo}{f.nota ? ` · ${f.nota}` : ''}
                </p>
              </div>
              <button onClick={() => alternar(f)} disabled={f.ya_paso}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border whitespace-nowrap ${
                        f.trabajamos
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600'} disabled:opacity-50`}>
                {f.trabajamos ? <><Check size={12} className="inline mr-1" />Trabajamos</> : 'Cerrado'}
              </button>
              <button onClick={() => borrar(f)} className="text-gray-300 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!feriados.length && (
            <p className="text-sm text-gray-400 py-6 text-center">No hay feriados cargados en {anio}</p>
          )}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-4 space-y-2">
        <p className="text-sm font-medium text-gray-700">Cerrar otro día</p>
        <p className="text-xs text-gray-500">
          Para vacaciones, mantención o cualquier día en que no van a operar aunque no sea feriado.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input type="date" value={nuevo.fecha} onChange={e => setNuevo({ ...nuevo, fecha: e.target.value })}
                 className="border rounded-xl px-3 py-2 text-sm" />
          <input value={nuevo.motivo} onChange={e => setNuevo({ ...nuevo, motivo: e.target.value })}
                 placeholder="Motivo, por ejemplo: mantención de máquinas"
                 className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-[200px]" />
          <button onClick={agregar}
                  className="px-4 py-2 rounded-xl text-white text-sm font-semibold flex items-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
            <Plus size={15} /> Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
