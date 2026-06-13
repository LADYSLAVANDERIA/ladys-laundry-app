import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
})

api.interceptors.request.use(cfg => {
  const token = useAuthStore.getState().token
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi    = { login: (d: object) => api.post('/auth/login', d) }
export const clientesApi = {
  getAll:       (q?: string) => api.get('/clientes', { params: { q } }),
  getById:      (id: number) => api.get(`/clientes/${id}`),
  create:       (d: object)  => api.post('/clientes', d),
  update:       (id: number, d: object) => api.put(`/clientes/${id}`, d),
  remove:       (id: number) => api.delete(`/clientes/${id}`),
  addDireccion: (clienteId: number, d: object) => api.post(`/clientes/${clienteId}/direcciones`, d),
}
export const ordenesApi = {
  getAll:       (p?: object) => api.get('/ordenes', { params: p }),
  getById:      (id: number) => api.get(`/ordenes/${id}`),
  create:       (d: object)  => api.post('/ordenes', d),
  cambiarEstado:(id: number, d: object) => api.put(`/ordenes/${id}/estado`, d),
  pagar:        (id: number, d: object) => api.post(`/ordenes/${id}/pago`, d),
}
export const dashboardApi  = { get: () => api.get('/dashboard') }
export const serviciosApi  = {
  getAll:  () => api.get('/servicios'),
  create:  (d: object) => api.post('/servicios', d),
  update:  (id: number, d: object) => api.put(`/servicios/${id}`, d),
  remove:  (id: number) => api.delete(`/servicios/${id}`),
}
export const categoriasApi = { getAll: () => api.get('/categorias') }
export const rutasApi      = {
  getAll:  () => api.get('/rutas'),
  create:  (d: object) => api.post('/rutas', d),
  update:  (id: number, d: object) => api.put(`/rutas/${id}`, d),
}
export const cajaApi = {
  estado: () => api.get('/caja/estado'),
  abrir:  (d: object) => api.post('/caja/abrir', d),
  cerrar: (id: number, d: object) => api.post(`/caja/cerrar/${id}`, d),
  reporte:(p: object) => api.get('/caja/reporte', { params: p }),
}
export const comprasApi = {
  getAll:  (p: object) => api.get('/compras', { params: p }),
  create:  (d: object) => api.post('/compras', d),
  remove:  (id: number) => api.delete(`/compras/${id}`),
}
export const usuariosApi = {
  getAll:  () => api.get('/usuarios'),
  create:  (d: object) => api.post('/usuarios', d),
  update:  (id: number, d: object) => api.put(`/usuarios/${id}`, d),
}
export const diasInhabilesApi = {
  getAll: () => api.get('/dias-inhabiles'),
  create: (d: object) => api.post('/dias-inhabiles', d),
  remove: (fecha: string) => api.delete(`/dias-inhabiles/${fecha}`),
}
export const reportesApi  = { control: (p: object) => api.get('/reportes/control', { params: p }) }
export const localApi     = { get: () => api.get('/local'), update: (d: object) => api.put('/local', d) }
export const prepagosApi  = { planes: () => api.get('/prepagos/planes'), saldos: () => api.get('/prepagos/saldos') }
export const formasPagoApi = { getAll: () => api.get('/formas-pago') }

export default api
