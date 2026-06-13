import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import NuevoCliente from './pages/NuevoCliente'
import Ordenes from './pages/Ordenes'
import NuevaOrden from './pages/NuevaOrden'
import OrdenDetalle from './pages/OrdenDetalle'
import Servicios from './pages/Servicios'
import Caja from './pages/Caja'
import Compras from './pages/Compras'
import Rutas from './pages/Rutas'
import Usuarios from './pages/Usuarios'
import Agenda from './pages/Agenda'
import ReporteControl from './pages/ReporteControl'
import ConfigLocal from './pages/ConfigLocal'
import Prepagos from './pages/Prepagos'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"       element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/clientes"        element={<PrivateRoute><Clientes /></PrivateRoute>} />
        <Route path="/clientes/nuevo"  element={<PrivateRoute><NuevoCliente /></PrivateRoute>} />
        <Route path="/ordenes"         element={<PrivateRoute><Ordenes /></PrivateRoute>} />
        <Route path="/ordenes/nueva"   element={<PrivateRoute><NuevaOrden /></PrivateRoute>} />
        <Route path="/ordenes/:id"     element={<PrivateRoute><OrdenDetalle /></PrivateRoute>} />
        <Route path="/servicios"       element={<PrivateRoute><Servicios /></PrivateRoute>} />
        <Route path="/caja"            element={<PrivateRoute><Caja /></PrivateRoute>} />
        <Route path="/compras"         element={<PrivateRoute><Compras /></PrivateRoute>} />
        <Route path="/rutas"           element={<PrivateRoute><Rutas /></PrivateRoute>} />
        <Route path="/usuarios"        element={<PrivateRoute><Usuarios /></PrivateRoute>} />
        <Route path="/agenda"          element={<PrivateRoute><Agenda /></PrivateRoute>} />
        <Route path="/reporte-control" element={<PrivateRoute><ReporteControl /></PrivateRoute>} />
        <Route path="/config-local"    element={<PrivateRoute><ConfigLocal /></PrivateRoute>} />
        <Route path="/prepagos"        element={<PrivateRoute><Prepagos /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
