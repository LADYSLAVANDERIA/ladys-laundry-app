import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { indicadoresApi } from '../services/api'
import { DollarSign, Bell, Flag, Hourglass, Landmark } from 'lucide-react'

const plata = (v: any) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CL')

export default function BarraIndicadores() {
  const [d, setD] = useState<any>(null)

  const cargar = () => indicadoresApi.get().then(r => setD(r.data)).catch(() => {})
  useEffect(() => {
    cargar()
    // Cada 2 minutos: son números que cambian con el trabajo del día, no en
    // tiempo real. Consultar más seguido no aporta y gasta.
    const t = setInterval(cargar, 120000)
    return () => clearInterval(t)
  }, [])

  if (!d) return null

  // Pastilla: ícono y número juntos dentro de la misma caja. La versión con el
  // número flotando encima se salía del borde de la cabecera en el celular.
  const items = [
    {
      icono: DollarSign, a: '/caja', siempre: true,
      valor: d.caja.abierta ? 'Abierta' : 'Cerrada',
      clase: d.caja.abierta
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-red-50 text-red-700 border-red-200',
      titulo: d.caja.abierta ? 'Caja abierta' : 'Caja cerrada',
    },
    {
      icono: Bell, a: '/programacion', valor: d.agendadas,
      clase: 'bg-amber-50 text-amber-700 border-amber-200',
      titulo: `${d.agendadas} retiros agendados sin orden creada`,
    },
    {
      icono: Flag, a: '/ordenes?estado=LISTA', valor: d.por_entregar,
      clase: 'bg-blue-50 text-blue-700 border-blue-200',
      titulo: `${d.por_entregar} pedidos listos esperando entrega`,
    },
    {
      icono: Hourglass, a: '/por-cobrar', valor: d.sin_pago,
      clase: 'bg-red-50 text-red-700 border-red-200',
      titulo: `${d.sin_pago} entregados sin pago · ${plata(d.monto_sin_pago)}`,
    },
    {
      icono: Landmark, a: '/por-cobrar', valor: d.credito_vencido,
      clase: 'bg-red-50 text-red-700 border-red-200',
      titulo: `${d.credito_vencido} facturas con el plazo vencido · ${plata(d.monto_credito_vencido)}`,
    },
  ].filter(i => i.siempre || Number(i.valor) > 0)

  return (
    <div className="flex items-center gap-2">
      {items.map(({ icono: Icon, a, valor, clase, titulo }, i) => (
        <Link key={i} to={a} title={titulo}
              className={`flex items-center gap-1.5 border rounded-full pl-2 pr-2.5 py-1 shrink-0 ${clase}`}>
          <Icon size={15} />
          <span className="text-xs font-bold leading-none">{valor}</span>
        </Link>
      ))}
    </div>
  )
}
