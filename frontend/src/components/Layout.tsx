import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { usuariosApi } from '../services/api'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard, Users, ClipboardList, Plus, Calendar, Scissors,
  DollarSign, ArrowLeftRight, ShoppingCart, UserCog, Truck, BarChart2, Settings, Navigation, ScanLine, Scale,
  LogOut, Menu, X, ChevronRight, CreditCard, Shirt, Wallet, KeyRound
} from 'lucide-react'

// Quien ve cada pantalla. ADMINISTRADOR ve todo sin necesidad de listarse.
const TODOS_OPERATIVOS = ['JEFE_LOCAL']
const menu = [
  { path: '/dashboard',       label: 'Dashboard',        icon: LayoutDashboard, ver: TODOS_OPERATIVOS },
  { path: '/ordenes',         label: 'Pedidos',          icon: ClipboardList,   ver: [...TODOS_OPERATIVOS, 'ASISTENTE'] },
  { path: '/ordenes/nueva',   label: 'Nueva Orden',      icon: Plus,            ver: TODOS_OPERATIVOS },
  { path: '/produccion',      label: 'Producción',       icon: ScanLine,        ver: [...TODOS_OPERATIVOS, 'ASISTENTE'] },
  { path: '/programacion',    label: 'Programación',     icon: Calendar,        ver: TODOS_OPERATIVOS },
  { path: '/por-cobrar',      label: 'Por cobrar',       icon: Wallet,          ver: TODOS_OPERATIVOS },
  { path: '/clientes',        label: 'Clientes',         icon: Users,           ver: TODOS_OPERATIVOS },
  { path: '/membresias',      label: 'Membresías',       icon: CreditCard,      ver: TODOS_OPERATIVOS },
  { path: '/servicios',       label: 'Servicios',        icon: Scissors,        ver: TODOS_OPERATIVOS },
  { path: '/caja',            label: 'Caja',             icon: DollarSign,      ver: TODOS_OPERATIVOS },
  { path: '/transferencias',  label: 'Pagos por revisar',icon: ArrowLeftRight,  ver: TODOS_OPERATIVOS },
  { path: '/compras',         label: 'Compras/Gastos',   icon: ShoppingCart,    ver: TODOS_OPERATIVOS },
  { path: '/reparto',         label: 'Reparto del día',  icon: Navigation,      ver: [...TODOS_OPERATIVOS, 'CONDUCTOR'] },
  { path: '/rutas',           label: 'Rutas Delivery',   icon: Truck,           ver: TODOS_OPERATIVOS },
  { path: '/reporte-control', label: 'Reporte Control',  icon: BarChart2,       ver: TODOS_OPERATIVOS },
  { path: '/cotejo',          label: 'Cotejo EasyLaundry', icon: Scale,         ver: [] },
  { path: '/usuarios',        label: 'Usuarios',         icon: UserCog,         ver: [] },
  { path: '/config-local',    label: 'Configuración',    icon: Settings,        ver: [] },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [clave, setClave] = useState<any>(null)   // { actual, nueva, repetir } cuando el modal está abierto
  const [guardandoClave, setGuardandoClave] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuthStore()

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

  const NavItem = ({ path, label, icon: Icon, ver }: typeof menu[0]) => {
    if (!isAdmin() && !(ver || []).includes(user?.perfil || '')) return null
    const active = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path))
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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center">
            <Shirt size={20} className="text-pink-600" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Ladys</p>
            <p className="text-xs text-white/60">Lavandería</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {menu.map(item => <NavItem key={item.path} {...item} />)}
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
        <header className="md:hidden bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="text-gray-600"><Menu size={22} /></button>
          <span className="font-bold text-pink-600">Ladys Lavandería</span>
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
