import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' })

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) { useAuthStore.getState().logout(); window.location.href = '/login' }
  return Promise.reject(err)
})

const FOTOS_URL = (import.meta.env.VITE_API_URL || '').replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-fotos') || 'http://localhost:3001/fotos'
const fotosApi = axios.create({ baseURL: FOTOS_URL })
fotosApi.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const authApi = { login: (d: object) => api.post('/auth/login', d) }
export const clientesApi = {
  getAll: (q?: string, params: object = {}) => api.get('/clientes', { params: { q, ...params } }),
  getById: (id: number | string) => api.get(`/clientes/${id}`),
  create: (d: object) => api.post('/clientes', d),
  update: (id: number | string, d: object) => api.put(`/clientes/${id}`, d),
  remove: (id: number | string) => api.delete(`/clientes/${id}`),
  addDireccion: (id: number | string, d: object) => api.post(`/clientes/${id}/direcciones`, d),
  removeDireccion: (id: number | string, dirId: number | string) => api.delete(`/clientes/${id}/direcciones/${dirId}`),
}
export const ordenesApi = {
  getAll: (params?: object) => api.get('/ordenes', { params }),
  resumen: (fecha?: string) => api.get('/ordenes/resumen', { params: { fecha } }),
  getById: (id: number | string) => api.get(`/ordenes/${id}`),
  create: (d: object) => api.post('/ordenes', d),
  update: (id: number | string, d: object) => api.put(`/ordenes/${id}`, d),
  cambiarEstado: (id: number | string, d: object) => api.put(`/ordenes/${id}/estado`, d),
  pagar: (id: number | string, d: object) => api.post(`/ordenes/${id}/pago`, d),
  fotos: (id: number | string) => api.get(`/ordenes/${id}/fotos`),
  subirFotos: (id: number | string, d: object) => fotosApi.post(`/${id}`, d),
  borrarFoto: (fotoId: number) => fotosApi.delete(`/${fotoId}`),
  aviso: (id: number | string, d: object) => api.post(`/ordenes/${id}/aviso`, d),
}
export const programacionApi = { get: (fecha: string) => api.get('/programacion', { params: { fecha } }) }
export const retirosApi = {
  disponibilidad: (fecha: string) => api.get('/retiros/disponibilidad', { params: { fecha } }),
  create: (d: object) => api.post('/retiros', d),
}
const RUTA_URL = (import.meta.env.VITE_API_URL || '').replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-ruta') || 'http://localhost:3001/ruta'
const rutaOrdenApi = axios.create({ baseURL: RUTA_URL })
rutaOrdenApi.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const ordenRutaApi = {
  get: (fecha: string) => rutaOrdenApi.get('', { params: { fecha } }),
  set: (ids: number[]) => rutaOrdenApi.post('', { ids }),
}
const CLUB_URL = (import.meta.env.VITE_API_URL || '').replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-club') || 'http://localhost:3001/club'
const clubHttp = axios.create({ baseURL: CLUB_URL })
clubHttp.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const clubApi = {
  estado: () => clubHttp.get('/estado'),
  activar: (d: object) => clubHttp.post('/activar', d),
  consumir: (id: number, d: object) => clubHttp.post(`/${id}/consumir`, d),
  renovar: (id: number, d: object) => clubHttp.post(`/${id}/renovar`, d),
  cancelar: (id: number) => clubHttp.post(`/${id}/cancelar`, {}),
  movimientos: (id: number) => clubHttp.get(`/${id}/movimientos`),
}
export const configApi = { get: () => api.get('/config'), set: (d: object) => api.put('/config', d) }
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
export const dashboardApi  = { get: () => api.get('/dashboard') }

export default api
