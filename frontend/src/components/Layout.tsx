import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard, Users, ClipboardList, Plus, Calendar, Scissors,
  DollarSign, ShoppingCart, UserCog, Truck, BarChart2, Settings,
  LogOut, Menu, X, ChevronRight, CreditCard, Shirt
} from 'lucide-react'

const menu = [
  { path: '/dashboard',       label: 'Dashboard',        icon: LayoutDashboard },
  { path: '/clientes',        label: 'Clientes',         icon: Users },
  { path: '/ordenes',         label: 'Órdenes',          icon: ClipboardList },
  { path: '/ordenes/nueva',   label: 'Nueva Orden',      icon: Plus },
  { path: '/agenda',          label: 'Agenda',           icon: Calendar },
  { path: '/servicios',       label: 'Servicios',        icon: Scissors },
  { path: '/caja',            label: 'Caja',             icon: DollarSign },
  { path: '/compras',         label: 'Compras/Gastos',   icon: ShoppingCart },
  { path: '/rutas',           label: 'Rutas Delivery',   icon: Truck },
  { path: '/reporte-control', label: 'Reporte Control',  icon: BarChart2 },
  { path: '/prepagos',        label: 'Prepagos',         icon: CreditCard },
  { path: '/usuarios',        label: 'Usuarios',         icon: UserCog, adminOnly: true },
  { path: '/config-local',    label: 'Configuración',    icon: Settings, adminOnly: true },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuthStore()

  const handleLogout = () => { logout(); navigate('/login') }

  const NavItem = ({ path, label, icon: Icon, adminOnly }: typeof menu[0]) => {
    if (adminOnly && !isAdmin()) return null
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
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col"
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
    </div>
  )
}
