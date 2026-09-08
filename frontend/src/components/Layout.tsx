import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { usuariosApi } from '../services/api'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import BarraIndicadores from './BarraIndicadores'
import {
  Home, LayoutDashboard, Users, ClipboardList, Plus, Calendar, Scissors,
  DollarSign, ArrowLeftRight, PieChart, FileText, ShoppingCart, UserCog, Truck, BarChart2, Settings, Navigation, ScanLine, Scale,
  LogOut, Menu, X, ChevronRight, ChevronDown, CreditCard, Wallet, KeyRound
} from 'lucide-react'

// Quien ve cada pantalla. ADMINISTRADOR ve todo sin necesidad de listarse.
const TODOS_OPERATIVOS = ['JEFE_LOCAL']
// El menú va agrupado por momento del trabajo, no por orden de construcción:
// primero el día a día, después el dinero, y al final lo que casi nunca se toca.
const menu = [
  { grupo: null, items: [
    { path: '/inicio',          label: 'Inicio',            icon: Home,            ver: [...TODOS_OPERATIVOS, 'ASISTENTE', 'CONDUCTOR'] },
    { path: '/dashboard',       label: 'Dashboard',         icon: LayoutDashboard, ver: TODOS_OPERATIVOS },
  ]},
  { grupo: 'El día', items: [
    { path: '/ordenes/nueva',   label: 'Nueva orden',       icon: Plus,            ver: TODOS_OPERATIVOS },
    { path: '/ordenes',         label: 'Pedidos',           icon: ClipboardList,   ver: [...TODOS_OPERATIVOS, 'ASISTENTE'] },
    { path: '/produccion',      label: 'Producción',        icon: ScanLine,        ver: [...TODOS_OPERATIVOS, 'ASISTENTE'] },
    { path: '/reparto',         label: 'Reparto del día',   icon: Navigation,      ver: [...TODOS_OPERATIVOS, 'CONDUCTOR'] },
    { path: '/programacion',    label: 'Programación',      icon: Calendar,        ver: TODOS_OPERATIVOS },
  ]},
  { grupo: 'Dinero', items: [
    { path: '/caja',            label: 'Caja',              icon: DollarSign,      ver: TODOS_OPERATIVOS },
    { path: '/transferencias',  label: 'Pagos por revisar', icon: ArrowLeftRight,  ver: TODOS_OPERATIVOS },
    { path: '/por-cobrar',      label: 'Por cobrar',        icon: Wallet,          ver: TODOS_OPERATIVOS },
    { path: '/facturacion',     label: 'Facturación',       icon: FileText,        ver: [] },
    { path: '/compras',         label: 'Compras y gastos',  icon: ShoppingCart,    ver: TODOS_OPERATIVOS },
    { path: '/gastos-mp',       label: 'Gastos Mercado Pago', icon: CreditCard,    ver: TODOS_OPERATIVOS },
  ]},
  { grupo: 'Clientes', items: [
    { path: '/clientes',        label: 'Clientes',          icon: Users,           ver: TODOS_OPERATIVOS },
    { path: '/membresias',      label: 'Membresías',        icon: CreditCard,      ver: TODOS_OPERATIVOS },
  ]},
  { grupo: 'Reportes', items: [
    { path: '/analisis',        label: 'Análisis',          icon: PieChart,        ver: [] },
    { path: '/cotejo',          label: 'Cotejo EasyLaundry',icon: Scale,           ver: [] },
  ]},
  { grupo: 'Configuración', items: [
    { path: '/servicios',       label: 'Servicios y precios', icon: Scissors,      ver: TODOS_OPERATIVOS },
    { path: '/rutas',           label: 'Rutas de reparto',    icon: Truck,         ver: TODOS_OPERATIVOS },
    { path: '/usuarios',        label: 'Usuarios',            icon: UserCog,       ver: [] },
    { path: '/config-local',    label: 'Ajustes del local',   icon: Settings,      ver: [] },
  ]},
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [abiertos, setAbiertos] = useState<string[]>([])
  const [clave, setClave] = useState<any>(null)   // { actual, nueva, repetir } cuando el modal está abierto
  const [guardandoClave, setGuardandoClave] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuthStore()

  // Al cambiar de pantalla se despliega el grupo donde está, sin cerrar los que
  // el usuario haya abierto a mano.
  useEffect(() => {
    const suyo = menu.find(g => g.grupo && g.items.some(i =>
      location.pathname === i.path || location.pathname.startsWith(i.path + '/')))
    if (suyo?.grupo) setAbiertos(a => a.includes(suyo.grupo!) ? a : [...a, suyo.grupo!])
  }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }

  const cambiarClave = async () => {
    if (clave.nueva !== clave.repetir) return toast.error('Las dos claves nuevas no coinciden')
    setGuardandoClave(true)
    try {
      await usuariosApi.miClave(clave.actual, clave.nueva)
      toast.success('Clave cambiada')
      setClave(null)
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo cambiar') }
    finally { setGuardandoClave(false) }
  }

  // Una sesión vieja o a medias deja el menú en blanco y sin explicación.
  // Si falta el perfil, se cierra sola y se pide entrar de nuevo.
  useEffect(() => {
    if (!user?.perfil) { logout(); navigate('/login') }
  }, [user?.perfil])

  const NavItem = ({ path, label, icon: Icon, ver }: any) => {
    if (!isAdmin() && !(ver || []).includes(user?.perfil || '')) return null
    // /ordenes es prefijo de /ordenes/nueva: sin exigir el corte en '/', las dos
    // entradas se marcaban activas a la vez.
    const active = location.pathname === path ||
      (path !== '/dashboard' && path !== '/ordenes' && location.pathname.startsWith(path + '/')) ||
      (path === '/ordenes' && /^\/ordenes\/\d+/.test(location.pathname))
    return (
      <Link to={path} onClick={() => setOpen(false)}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
          active ? 'bg-white text-pink-600 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white'
        }`}>
        <Icon size={18} />
        <span>{label}</span>
        {active && <ChevronRight size={14} className="ml-auto text-pink-400" />}
      </Link>
    )
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-white/10">
        <div className="bg-white rounded-xl px-3 py-2.5">
          <img src="/app/logo-ladys.png" alt="Ladys Lavandería" className="w-full max-w-[150px] mx-auto block" />
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {menu.map(({ grupo, items }) => {
          // Un grupo cuyas pantallas no puede ver este perfil no debe dejar el
          // título flotando solo.
          const visibles = items.filter(i => isAdmin() || i.ver.includes(user?.perfil || ''))
          if (!visibles.length) return null

          // El bloque sin título (Inicio, Dashboard) va siempre a la vista.
          if (!grupo) return <div key="inicio">{visibles.map(i => <NavItem key={i.path} {...i} />)}</div>

          const desplegado = abiertos.includes(grupo)
          const aqui = visibles.some(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/'))
          return (
            <div key={grupo} className="mt-1">
              <button
                onClick={() => setAbiertos(a => a.includes(grupo) ? a.filter(x => x !== grupo) : [...a, grupo])}
                className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  aqui && !desplegado ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
                <span className="flex-1 text-left">{grupo}</span>
                {/* Un punto avisa que la pantalla actual está adentro de un grupo cerrado. */}
                {aqui && !desplegado && <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />}
                <ChevronDown size={15} className={`transition-transform ${desplegado ? 'rotate-180' : ''}`} />
              </button>
              {desplegado && (
                <div className="mt-0.5 ml-2 pl-2 border-l border-white/10 space-y-0.5">
                  {visibles.map(i => <NavItem key={i.path} {...i} />)}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
            {user?.nombre?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.nombre}</p>
            <p className="text-white/50 text-xs truncate">{user?.perfil}</p>
          </div>
        </div>
        <button onClick={() => { setOpen(false); setClave({ actual: '', nueva: '', repetir: '' }) }}
          className="w-full flex items-center gap-2 text-white/70 hover:text-white text-xs py-1.5 px-2 rounded-lg hover:bg-white/10 transition-colors">
          <KeyRound size={14} /> Cambiar mi clave
        </button>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 text-white/70 hover:text-white text-xs py-1.5 px-2 rounded-lg hover:bg-white/10 transition-colors">
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <aside data-print="hide" className="hidden md:flex w-60 flex-shrink-0 flex-col"
        style={{ background: 'linear-gradient(160deg, #E8177A 0%, #A87BC8 100%)' }}>
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col shadow-xl"
            style={{ background: 'linear-gradient(160deg, #E8177A 0%, #A87BC8 100%)' }}>
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-white"><X size={20} /></button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* La barra de indicadores va en el escritorio y en el celular: son los
            números que el equipo mira varias veces al día. */}
        <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="text-gray-600 md:hidden"><Menu size={22} /></button>
          <img src="/app/logo-ladys.png" alt="Ladys" className="h-7 md:hidden" />
          {/* scrollbar-hide para que en el celular se deslice sin barra a la vista */}
          <div className="flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <BarraIndicadores />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {clave && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setClave(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Cambiar mi clave</h2>
              <button onClick={() => setClave(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500">Elige una clave que solo tú sepas. Mínimo 6 caracteres.</p>
            <input type="password" autoComplete="current-password" placeholder="Clave actual"
                   className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                   value={clave.actual} onChange={e => setClave({ ...clave, actual: e.target.value })} />
            <input type="password" autoComplete="new-password" placeholder="Clave nueva"
                   className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                   value={clave.nueva} onChange={e => setClave({ ...clave, nueva: e.target.value })} />
            <input type="password" autoComplete="new-password" placeholder="Repite la clave nueva"
                   className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                   value={clave.repetir} onChange={e => setClave({ ...clave, repetir: e.target.value })} />
            <button onClick={cambiarClave} disabled={guardandoClave || !clave.actual || !clave.nueva}
                    className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#E8177A,#A87BC8)' }}>
              {guardandoClave ? 'Guardando…' : 'Cambiar mi clave'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
