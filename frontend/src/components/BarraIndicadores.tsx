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
    // Se refresca solo cada 2 minutos: son números que cambian con el trabajo
    // del día, no en tiempo real. Consultar más seguido no aporta y gasta.
    const t = setInterval(cargar, 120000)
    return () => clearInterval(t)
  }, [])

  if (!d) return null

  const items = [
    {
      // La caja es el único que se muestra siempre: saber si está abierta o
      // cerrada importa incluso cuando no hay nada pendiente.
      icono: DollarSign, a: '/caja', siempre: true,
      valor: d.caja.abierta ? 'Abierta' : 'Cerrada',
      color: d.caja.abierta ? 'bg-green-500' : 'bg-red-500',
      titulo: d.caja.abierta ? 'Caja abierta' : 'Caja cerrada',
    },
    {
      icono: Bell, a: '/programacion', valor: d.agendadas, color: 'bg-amber-500',
      titulo: `${d.agendadas} retiros agendados sin orden creada`,
    },
    {
      icono: Flag, a: '/ordenes?estado=LISTA', valor: d.por_entregar, color: 'bg-red-500',
      titulo: `${d.por_entregar} pedidos listos esperando entrega`,
    },
    {
      icono: Hourglass, a: '/por-cobrar', valor: d.sin_pago, color: 'bg-red-500',
      titulo: `${d.sin_pago} entregados sin pago · ${plata(d.monto_sin_pago)}`,
    },
    {
      icono: Landmark, a: '/por-cobrar', valor: d.credito_vencido, color: 'bg-red-500',
      titulo: `${d.credito_vencido} facturas con el plazo de pago vencido · ${plata(d.monto_credito_vencido)}`,
    },
  ].filter(i => i.siempre || Number(i.valor) > 0)

  return (
    <div className="flex items-center gap-4 sm:gap-6">
      {items.map(({ icono: Icon, a, valor, color, titulo }, i) => (
        <Link key={i} to={a} title={titulo} className="relative shrink-0">
          <Icon size={21} className="text-gray-500" />
          <span className={`absolute -top-2 -right-2.5 ${color} text-white text-[10px] font-bold
                            leading-none px-1.5 py-1 rounded-md whitespace-nowrap`}>
            {valor}
          </span>
        </Link>
      ))}
    </div>
  )
}
