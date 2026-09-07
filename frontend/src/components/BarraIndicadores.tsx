import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { indicadoresApi } from '../services/api'
import { DollarSign, Bell, Flag, Truck, Hourglass, Landmark, CreditCard } from 'lucide-react'

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
      icono: Flag, a: '/por-cobrar?tipo=listos', valor: d.por_entregar,
      clase: 'bg-blue-50 text-blue-700 border-blue-200',
      titulo: `${d.por_entregar} pedidos listos esperando entrega`,
    },
    {
      // Se quedaron en el camión: su fecha de entrega pasó y siguen sin salir.
      icono: Truck, a: '/por-cobrar?tipo=despacho', valor: d.despachos_vencidos,
      clase: 'bg-orange-50 text-orange-700 border-orange-200',
      titulo: `${d.despachos_vencidos} despachos quedaron pendientes de entrega`,
    },
    {
      // Particulares sin crédito que se llevaron la ropa sin pagar.
      icono: Hourglass, a: '/por-cobrar?tipo=particular', valor: d.sin_pago,
      clase: 'bg-red-50 text-red-700 border-red-200',
      titulo: `${d.sin_pago} particulares se llevaron el pedido sin pagar · ${plata(d.monto_sin_pago)}`,
    },
    {
      // Empresas en mora: con crédito vencido, o sin crédito ya entregadas.
      icono: Landmark, a: '/por-cobrar?tipo=empresa', valor: d.empresas_mora,
      clase: 'bg-red-50 text-red-700 border-red-200',
      titulo: `${d.empresas_mora} pedidos de empresas en mora · ${plata(d.monto_empresas_mora)}`,
    },
    {
      // Cargos a la tarjeta de Mercado Pago que nadie ha explicado todavía.
      icono: CreditCard, a: '/gastos-mp', valor: d.gastos_por_conciliar,
      clase: 'bg-purple-50 text-purple-700 border-purple-200',
      titulo: `${d.gastos_por_conciliar} gastos de Mercado Pago sin conciliar · ${plata(d.monto_gastos_por_conciliar)}`,
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
