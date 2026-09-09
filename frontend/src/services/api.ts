import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// respaldo de produccion: si falta el .env, el build igual apunta al servidor real
const API_PROD = 'https://vhjsizkbmabznupkfzji.supabase.co/functions/v1/ladys/api'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || API_PROD })

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) { useAuthStore.getState().logout(); window.location.href = '/login' }
  return Promise.reject(err)
})

const FOTOS_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-fotos') || 'http://localhost:3001/fotos'
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
const RUTA_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-ruta') || 'http://localhost:3001/ruta'
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
const CLUB_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-club') || 'http://localhost:3001/club'
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
const PRECIOS_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-precios') || 'http://localhost:3001/precios'
const preciosHttp = axios.create({ baseURL: PRECIOS_URL })
preciosHttp.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const fichaApi = {
  guardar:      (id: number | string, d: object) => preciosHttp.put(`/${id}/ficha`, d),
  precios:      (id: number | string) => preciosHttp.get(`/${id}/precios`),
  analitica:    (id: number | string) => preciosHttp.get(`/${id}/analitica`),
  ponerPrecio:  (id: number | string, d: object) => preciosHttp.post(`/${id}/precios`, d),
  precioLote:   (id: number | string, d: object) => preciosHttp.post(`/${id}/precios-lote`, d),
  borrarPrecio: (id: number | string, pid: number) => preciosHttp.delete(`/${id}/precios/${pid}`),
  borrarTodos:  (id: number | string) => preciosHttp.delete(`/${id}/precios`),
}
const DIR_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-direcciones') || 'http://localhost:3001/dir'
const dirHttp = axios.create({ baseURL: DIR_URL })
dirHttp.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const dirApi = {
  buscar:     (texto: string) => dirHttp.post('/buscar', { texto }),
  desdePunto: (d: object) => dirHttp.post('/desde-punto', d),
  crear:      (cid: number | string, d: object) => dirHttp.post(`/${cid}/direcciones`, d),
  actualizar: (id: number, d: object) => dirHttp.put(`/direccion/${id}`, d),
  listar:     (cid: number | string) => dirHttp.get(`/${cid}/direcciones`),
  coordenadas:(fecha: string) => dirHttp.get('/coordenadas', { params: { fecha } }),
}
export const configApi = { get: () => api.get('/config'), set: (d: object) => api.put('/config', d) }
export const serviciosApi  = {
  getAll:  () => api.get('/servicios'),
  create:  (d: object) => preciosHttp.post('/catalogo/servicios', d),
  update:  (id: number, d: object) => preciosHttp.put(`/catalogo/servicios/${id}`, d),
  remove:  (id: number) => preciosHttp.delete(`/catalogo/servicios/${id}`),
}
export const categoriasApi = {
  getAll: () => api.get('/categorias'),
  create: (d: object) => preciosHttp.post('/catalogo/categorias', d),
  update: (id: number, d: object) => preciosHttp.put(`/catalogo/categorias/${id}`, d),
}
export const rutasApi      = {
  getAll:  () => api.get('/rutas'),
  create:  (d: object) => preciosHttp.post('/catalogo/rutas', d),
  update:  (id: number, d: object) => preciosHttp.put(`/catalogo/rutas/${id}`, d),
  remove:  (id: number) => preciosHttp.delete(`/catalogo/rutas/${id}`),
}
const CAJA_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-caja')
const cajaAx = axios.create({ baseURL: CAJA_URL })
cajaAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const cajaApi = {
  estado:     () => cajaAx.get('/estado'),
  abrir:      (d: object) => cajaAx.post('/abrir', d),
  movimiento: (d: object) => cajaAx.post('/movimiento', d),
  cerrar:     (d: object) => cajaAx.post('/cerrar', d),
  historial:  () => cajaAx.get('/historial'),
  detalle:    (id: number) => cajaAx.get(`/${id}`),
}
export const comprasApi = {
  getAll:  (p: object) => api.get('/compras', { params: p }),
  create:  (d: object) => api.post('/compras', d),
  remove:  (id: number) => api.delete(`/compras/${id}`),
}
const USR_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-usuarios')
const usrAx = axios.create({ baseURL: USR_URL })
usrAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const usuariosApi = {
  getAll:  () => usrAx.get('/'),
  create:  (d: object) => usrAx.post('/', d),
  update:  (id: number, d: object) => usrAx.put(`/${id}`, d),
  miClave: (actual: string, nueva: string) => usrAx.post('/mi-clave', { actual, nueva }),
}
export const diasInhabilesApi = {
  getAll: () => api.get('/dias-inhabiles'),
  create: (d: object) => api.post('/dias-inhabiles', d),
  remove: (fecha: string) => api.delete(`/dias-inhabiles/${fecha}`),
}
// Los feriados se administran aparte: esta es la unica via que ve tambien los
// dias marcados como "trabajamos", que la vista dias_inhabiles oculta a proposito.
const FER_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-feriados')
const ferAx = axios.create({ baseURL: FER_URL })
ferAx.interceptors.request.use(cfg => {
  const t = localStorage.getItem('ladys_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
export const feriadosApi = {
  getAll:   (anio: number) => ferAx.get('/', { params: { anio } }),
  trabajar: (fecha: string, trabajamos: boolean, nota?: string) =>
              ferAx.put('/trabajar', { fecha, trabajamos, nota }),
  crear:    (fecha: string, motivo: string) => ferAx.post('/', { fecha, motivo }),
  borrar:   (fecha: string) => ferAx.delete('/', { params: { fecha } }),
}

// El pedido completo cuando se dividio por plazos: hermanas y total a cobrar.
const GRU_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-grupo')
const gruAx = axios.create({ baseURL: GRU_URL })
gruAx.interceptors.request.use(cfg => {
  const t = useAuthStore.getState().token
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
export const grupoApi = { get: (orden_id: number) => gruAx.get('/', { params: { orden_id } }) }

// La cola de trabajo del taller: que hay, en que etapa y que urge.
const TAL_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-taller')
const talAx = axios.create({ baseURL: TAL_URL })
talAx.interceptors.request.use(cfg => {
  const t = useAuthStore.getState().token
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
export const tallerApi = { cola: () => talAx.get('/') }

export const reportesApi  = { control: (p: object) => api.get('/reportes/control', { params: p }) }
export const localApi     = { get: () => api.get('/local'), update: (d: object) => api.put('/local', d) }
export const prepagosApi  = { planes: () => api.get('/prepagos/planes'), saldos: () => api.get('/prepagos/saldos') }
export const formasPagoApi = { getAll: () => api.get('/formas-pago') }
export const dashboardApi  = { get: () => api.get('/dashboard') }

export default api

const REPARTO_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-reparto') || 'http://localhost:3001/reparto'
const repartoAx = axios.create({ baseURL: REPARTO_URL })
repartoAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const repartoApi = {
  dia: (fecha: string) => repartoAx.get('/dia', { params: { fecha } }),
  optimizar: (fecha: string, inicio?: string) => repartoAx.post('/optimizar', { fecha, inicio }),
  parada: (id: number, estado: string, nota?: string, extra?: { bultos?: number; nota_cliente?: string }) =>
    repartoAx.post('/parada', { id, estado, nota, ...(extra || {}) }),
  reordenar: (ids: number[]) => repartoAx.post('/reordenar', { ids }),
}

const SEG_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-seguimiento')
const segAx = axios.create({ baseURL: SEG_URL })
segAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const seguimientoApi = {
  seguir: (id: string, token: string) => axios.get(`${SEG_URL}/seguir/${id}/${token}`),
  posicion: (d: object) => segAx.post('/pos', d),
  iniciar: (parada_id: number) => segAx.post('/iniciar', { parada_id }),
  donde: (fecha?: string) => segAx.get('/donde', { params: { fecha } }),
}

const ETAPAS_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-etapas')
const etapasAx = axios.create({ baseURL: ETAPAS_URL })
etapasAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const etapasApi = {
  marcar: (d: object) => etapasAx.post('/marcar', d),
  orden: (id: number | string) => etapasAx.get(`/orden/${id}`),
  tablero: () => etapasAx.get('/tablero'),
  tiempos: () => etapasAx.get('/tiempos'),
}

const COTEJO_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-cotejo')
const cotejoAx = axios.create({ baseURL: COTEJO_URL })
cotejoAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const cotejoApi = {
  comparar: (fecha: string, filas: any[]) => cotejoAx.post('/comparar', { fecha, filas }),
  historial: () => cotejoAx.get('/historial'),
}

const TRANSF_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-transferencias')
const transfAx = axios.create({ baseURL: TRANSF_URL })
transfAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const transferenciasApi = {
  comprobante: (d: object) => transfAx.post('/comprobante', d),
  pendientes: () => transfAx.get('/pendientes'),
  asignar: (id: number, orden_id: number) => transfAx.post('/asignar', { id, orden_id }),
  marcar: (id: number, estado: string, nota?: string) => transfAx.post('/marcar', { id, estado, nota }),
  suscribir: () => transfAx.post('/bci/suscribir', {}),
  ultimos: () => transfAx.get('/bci/ultimos'),
}

const COBROS_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-cobros')
const cobrosAx = axios.create({ baseURL: COBROS_URL })
cobrosAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const cobrosApi = {
  link: (orden_id: number, monto?: number) => cobrosAx.post('/link', { orden_id, monto }),
  links: (orden_id: number) => cobrosAx.get(`/links/${orden_id}`),
  pos: (fecha?: string) => cobrosAx.get('/pos', { params: { fecha } }),
  posAsignar: (mp_payment_id: string, orden_id: number) => cobrosAx.post('/pos/asignar', { mp_payment_id, orden_id }),
  terminales: () => cobrosAx.get('/pos/terminales'),
  cobrarPos: (orden_id: number, monto?: number) => cobrosAx.post('/pos/cobrar', { orden_id, monto }),
  estadoPos: (mp_order_id: string) => cobrosAx.get(`/pos/cobro/${mp_order_id}`),
  cancelarPos: (mp_order_id: string) => cobrosAx.post('/pos/cancelar', { mp_order_id }),
}

const TABLERO_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-tablero')
const tabAx = axios.create({ baseURL: TABLERO_URL })
tabAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const tableroApi = {
  resumen: (desde?: string, hasta?: string) => tabAx.get('/resumen', { params: { desde, hasta } }),
}

const FACT_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-facturacion')
const factAx = axios.create({ baseURL: FACT_URL })
factAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
type Filtro = { anio?: number; mes?: number; cliente_id?: number | '' }
export const facturacionApi = {
  clientes:     () => factAx.get('/clientes'),
  porFacturar:  (f: Filtro) => factAx.get('/ordenes-por-facturar', { params: f }),
  porCobrar:    (f: Filtro) => factAx.get('/ordenes-por-cobrar', { params: f }),
  porPrenda:    (f: Filtro) => factAx.get('/por-prenda', { params: f }),
  consolidado:  (f: Filtro) => factAx.get('/consolidado', { params: f }),
  emitidos:     () => factAx.get('/emitidos'),
  empresas:     () => factAx.get('/empresas'),
  guardar:      (id: number, datos: any) => factAx.put(`/empresa/${id}`, datos),
  crearDoc:     (datos: any) => factAx.post('/documento', datos),
  borrarDoc:    (id: number) => factAx.delete(`/documento/${id}`),
}

const CIERRE_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-cierre')
const cierreAx = axios.create({ baseURL: CIERRE_URL })
cierreAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const cierreApi = { get: (desde: string, hasta: string) => cierreAx.get('', { params: { desde, hasta } }) }

const IND_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-indicadores')
const indAx = axios.create({ baseURL: IND_URL })
indAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const indicadoresApi = {
  get: () => indAx.get(''),
  pendientes: (tipo?: string) => indAx.get('/pendientes', { params: { tipo } }),
}

const NOTA_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-item-nota')
const notaAx = axios.create({ baseURL: NOTA_URL })
notaAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const itemNotaApi = { guardar: (itemId: number, nota: string) => notaAx.put(`/${itemId}`, { nota }) }

const GASTOS_URL = (import.meta.env.VITE_API_URL || API_PROD).replace(/\/functions\/v1\/ladys\/api$/, '/functions/v1/ladys-gastos')
const gastosAx = axios.create({ baseURL: GASTOS_URL })
gastosAx.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export const gastosMpApi = {
  listar:    (desde?: string, hasta?: string) => gastosAx.get('', { params: { desde, hasta } }),
  conciliar: (d: object) => gastosAx.post('/conciliar', d),
  descartar: (mp_payment_id: string, motivo: string) => gastosAx.post('/descartar', { mp_payment_id, motivo }),
  reabrir:   (mp_payment_id: string) => gastosAx.post('/reabrir', { mp_payment_id }),
}
