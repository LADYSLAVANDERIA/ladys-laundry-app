-- ============================================================
-- LADYS LAUNDRY APP - Schema PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- LOCALES / SUCURSALES
CREATE TABLE locales (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  slogan        VARCHAR(255),
  telefono      VARCHAR(20),
  whatsapp      VARCHAR(20),
  email         VARCHAR(120),
  email_notif   VARCHAR(120),
  rut_titular   VARCHAR(20),
  razon_social  VARCHAR(150),
  id_fiscal     VARCHAR(20),
  banco         VARCHAR(80),
  tipo_cuenta   VARCHAR(40),
  nro_cuenta    VARCHAR(40),
  titular_cta   VARCHAR(150),
  horario       TEXT,
  min_delivery  NUMERIC(12,2) DEFAULT 0,
  min_local     NUMERIC(12,2) DEFAULT 0,
  mins_x_punto  INT DEFAULT 10,
  valor_dolar   NUMERIC(10,2) DEFAULT 1,
  tipo_servicio VARCHAR(30) DEFAULT 'local_y_delivery',
  dir_salida    VARCHAR(255),
  logo_url      VARCHAR(255),
  condiciones   TEXT,
  boton_pagar   BOOLEAN DEFAULT TRUE,
  envio_correos BOOLEAN DEFAULT TRUE,
  autopistas    BOOLEAN DEFAULT FALSE,
  activo        BOOLEAN DEFAULT TRUE,
  creado_en     TIMESTAMP DEFAULT NOW()
);

-- USUARIOS
CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  local_id      INT REFERENCES locales(id),
  nombre        VARCHAR(100) NOT NULL,
  apellido      VARCHAR(100),
  telefono      VARCHAR(20),
  email         VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  perfil        VARCHAR(30) DEFAULT 'ASISTENTE',
  imagen_url    VARCHAR(255),
  app_conduccion VARCHAR(20) DEFAULT 'GOOGLE_MAPS',
  estado        BOOLEAN DEFAULT TRUE,
  ultimo_acceso TIMESTAMP,
  creado_por    INT,
  creado_en     TIMESTAMP DEFAULT NOW()
);

-- CATEGORIAS DE SERVICIOS
CREATE TABLE categorias (
  id        SERIAL PRIMARY KEY,
  local_id  INT REFERENCES locales(id),
  nombre    VARCHAR(100) NOT NULL,
  orden     INT DEFAULT 0,
  activo    BOOLEAN DEFAULT TRUE
);

-- SERVICIOS / PRECIOS
CREATE TABLE servicios (
  id                    SERIAL PRIMARY KEY,
  local_id              INT REFERENCES locales(id),
  categoria_id          INT REFERENCES categorias(id),
  nombre                VARCHAR(150) NOT NULL,
  precio_lav_planch     NUMERIC(12,2) DEFAULT 0,
  precio_lav_secado     NUMERIC(12,2) DEFAULT 0,
  precio_productos      NUMERIC(12,2) DEFAULT 0,
  precio_solo_planch    NUMERIC(12,2) DEFAULT 0,
  activo                BOOLEAN DEFAULT TRUE,
  creado_en             TIMESTAMP DEFAULT NOW()
);

-- CLIENTES
CREATE TABLE clientes (
  id               SERIAL PRIMARY KEY,
  local_id         INT REFERENCES locales(id),
  tipo             VARCHAR(20) DEFAULT 'PARTICULAR',
  nombre           VARCHAR(150) NOT NULL,
  apellido         VARCHAR(150),
  telefono         VARCHAR(20),
  email            VARCHAR(120),
  clave_acceso     VARCHAR(50),
  id_fiscal        VARCHAR(20),
  razon_social     VARCHAR(150),
  giro             VARCHAR(150),
  contacto         VARCHAR(150),
  tipo_doc         VARCHAR(20) DEFAULT 'BOLETA',
  plazo_pago       INT DEFAULT 0,
  transporte       NUMERIC(12,2) DEFAULT 0,
  ocultar_precios  BOOLEAN DEFAULT FALSE,
  pre_orden        BOOLEAN DEFAULT FALSE,
  iva              BOOLEAN DEFAULT FALSE,
  cc_correo        VARCHAR(120),
  observaciones    TEXT,
  fecha_nacimiento DATE,
  saldo_prepago    NUMERIC(14,2) DEFAULT 0,
  puntos           INT DEFAULT 0,
  email_confirmacion  BOOLEAN DEFAULT TRUE,
  email_entrega       BOOLEAN DEFAULT TRUE,
  email_anulacion     BOOLEAN DEFAULT TRUE,
  email_pago          BOOLEAN DEFAULT TRUE,
  activo           BOOLEAN DEFAULT TRUE,
  creado_en        TIMESTAMP DEFAULT NOW()
);

-- DIRECCIONES DE CLIENTES
CREATE TABLE direcciones_clientes (
  id          SERIAL PRIMARY KEY,
  cliente_id  INT REFERENCES clientes(id) ON DELETE CASCADE,
  pais        VARCHAR(60) DEFAULT 'Chile',
  ciudad      VARCHAR(100),
  sector      VARCHAR(100),
  calle       VARCHAR(200),
  numero      VARCHAR(20),
  otro        VARCHAR(200),
  lat         NUMERIC(11,8),
  lng         NUMERIC(11,8),
  es_principal BOOLEAN DEFAULT FALSE,
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- RUTAS
CREATE TABLE rutas (
  id               SERIAL PRIMARY KEY,
  local_id         INT REFERENCES locales(id),
  nombre           VARCHAR(100) NOT NULL,
  tipo             VARCHAR(30) DEFAULT 'RETIROS_Y_ENTREGAS',
  dia_semana       VARCHAR(15),
  hora_inicio      TIME,
  hora_fin         TIME,
  hrs_anticipacion INT DEFAULT 24,
  puntos_disp      INT DEFAULT 4,
  activo           BOOLEAN DEFAULT TRUE,
  creado_en        TIMESTAMP DEFAULT NOW()
);

-- RUTA CONDUCTORES
CREATE TABLE ruta_conductores (
  id          SERIAL PRIMARY KEY,
  ruta_id     INT REFERENCES rutas(id),
  usuario_id  INT REFERENCES usuarios(id),
  asignado_en TIMESTAMP DEFAULT NOW()
);

-- DIAS INHABILES
CREATE TABLE dias_inhabiles (
  id        SERIAL PRIMARY KEY,
  local_id  INT REFERENCES locales(id),
  fecha     DATE NOT NULL,
  motivo    VARCHAR(200),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- FORMAS DE PAGO
CREATE TABLE formas_pago (
  id        SERIAL PRIMARY KEY,
  local_id  INT REFERENCES locales(id),
  nombre    VARCHAR(80) NOT NULL,
  activo    BOOLEAN DEFAULT TRUE
);

-- ORDENES DE TRABAJO
CREATE TABLE ordenes (
  id                  SERIAL PRIMARY KEY,
  local_id            INT REFERENCES locales(id),
  cliente_id          INT REFERENCES clientes(id),
  usuario_id          INT REFERENCES usuarios(id),
  tipo_doc            VARCHAR(20) DEFAULT 'BOLETA',
  estado              VARCHAR(30) DEFAULT 'EN_PROCESO',
  fecha_recogida      DATE,
  fecha_entrega       DATE,
  ruta_recogida_id    INT REFERENCES rutas(id),
  ruta_entrega_id     INT REFERENCES rutas(id),
  dir_recogida_id     INT REFERENCES direcciones_clientes(id),
  dir_entrega_id      INT REFERENCES direcciones_clientes(id),
  entrega_y_recogida  BOOLEAN DEFAULT FALSE,
  observaciones       TEXT,
  monto_delivery      NUMERIC(12,2) DEFAULT 0,
  monto_total         NUMERIC(12,2) DEFAULT 0,
  monto_abonado       NUMERIC(12,2) DEFAULT 0,
  uso_saldo_prepago   NUMERIC(12,2) DEFAULT 0,
  saldo_pendiente     NUMERIC(12,2) DEFAULT 0,
  bultos              INT DEFAULT 1,
  es_pre_orden        BOOLEAN DEFAULT FALSE,
  nro_doc_tributario  VARCHAR(50),
  fecha_doc_tributario DATE,
  entregada_el        TIMESTAMP,
  generada_por        INT REFERENCES usuarios(id),
  anulada_por         INT REFERENCES usuarios(id),
  motivo_anulacion    TEXT,
  creado_en           TIMESTAMP DEFAULT NOW(),
  actualizado_en      TIMESTAMP DEFAULT NOW()
);

-- DETALLE DE ORDENES
CREATE TABLE orden_items (
  id           SERIAL PRIMARY KEY,
  orden_id     INT REFERENCES ordenes(id) ON DELETE CASCADE,
  servicio_id  INT REFERENCES servicios(id),
  nombre       VARCHAR(150),
  cantidad     INT DEFAULT 1,
  precio_unit  NUMERIC(12,2),
  subtotal     NUMERIC(12,2),
  etiqueta     VARCHAR(100),
  creado_en    TIMESTAMP DEFAULT NOW()
);

-- PAGOS
CREATE TABLE pagos (
  id             SERIAL PRIMARY KEY,
  orden_id       INT REFERENCES ordenes(id),
  cliente_id     INT REFERENCES clientes(id),
  forma_pago_id  INT REFERENCES formas_pago(id),
  monto          NUMERIC(12,2),
  referencia     VARCHAR(100),
  usuario_id     INT REFERENCES usuarios(id),
  creado_en      TIMESTAMP DEFAULT NOW()
);

-- CAJA
CREATE TABLE cajas (
  id               SERIAL PRIMARY KEY,
  local_id         INT REFERENCES locales(id),
  usuario_id       INT REFERENCES usuarios(id),
  fecha_apertura   TIMESTAMP DEFAULT NOW(),
  hora_apertura    TIME,
  fecha_cierre     TIMESTAMP,
  hora_cierre      TIME,
  apertura_efect   NUMERIC(12,2) DEFAULT 0,
  cierre_efect     NUMERIC(12,2) DEFAULT 0,
  total_egresos    NUMERIC(12,2) DEFAULT 0,
  total_retiros    NUMERIC(12,2) DEFAULT 0,
  estado           VARCHAR(20) DEFAULT 'ABIERTA'
);

-- MOVIMIENTOS DE CAJA
CREATE TABLE caja_movimientos (
  id          SERIAL PRIMARY KEY,
  caja_id     INT REFERENCES cajas(id),
  tipo        VARCHAR(20),
  monto       NUMERIC(12,2),
  concepto    VARCHAR(255),
  referencia  VARCHAR(100),
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- REGISTRO DE COMPRAS
CREATE TABLE compras (
  id            SERIAL PRIMARY KEY,
  local_id      INT REFERENCES locales(id),
  fecha_compra  DATE,
  folio         VARCHAR(50),
  tipo_doc      VARCHAR(30) DEFAULT 'BOLETA',
  tipo_gasto    VARCHAR(60),
  total         NUMERIC(12,2),
  glosa         TEXT,
  usuario_id    INT REFERENCES usuarios(id),
  creado_en     TIMESTAMP DEFAULT NOW()
);

-- PLANES PREPAGO
CREATE TABLE planes_prepago (
  id          SERIAL PRIMARY KEY,
  local_id    INT REFERENCES locales(id),
  nombre      VARCHAR(100),
  duracion    INT,
  precio      NUMERIC(12,2),
  activo      BOOLEAN DEFAULT TRUE,
  creado_en   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plan_servicios (
  id          SERIAL PRIMARY KEY,
  plan_id     INT REFERENCES planes_prepago(id),
  servicio_id INT REFERENCES servicios(id)
);

-- PREPAGOS CLIENTES
CREATE TABLE prepagos_cliente (
  id             SERIAL PRIMARY KEY,
  cliente_id     INT REFERENCES clientes(id),
  plan_id        INT REFERENCES planes_prepago(id),
  saldo_inicial  NUMERIC(14,2),
  saldo_actual   NUMERIC(14,2),
  fecha_inicio   DATE,
  fecha_venc     DATE,
  activo         BOOLEAN DEFAULT TRUE,
  creado_en      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE prepago_movimientos (
  id            SERIAL PRIMARY KEY,
  prepago_id    INT REFERENCES prepagos_cliente(id),
  cliente_id    INT REFERENCES clientes(id),
  tipo          VARCHAR(20),
  monto         NUMERIC(14,2),
  orden_id      INT REFERENCES ordenes(id),
  creado_en     TIMESTAMP DEFAULT NOW()
);

-- NOTIFICACIONES
CREATE TABLE notificaciones (
  id          SERIAL PRIMARY KEY,
  local_id    INT REFERENCES locales(id),
  cliente_id  INT REFERENCES clientes(id),
  orden_id    INT REFERENCES ordenes(id),
  tipo        VARCHAR(40),
  canal       VARCHAR(20) DEFAULT 'EMAIL',
  asunto      VARCHAR(255),
  contenido   TEXT,
  estado      VARCHAR(20) DEFAULT 'PENDIENTE',
  enviado_en  TIMESTAMP,
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- INDICES DE PERFORMANCE
CREATE INDEX idx_ordenes_local ON ordenes(local_id);
CREATE INDEX idx_ordenes_cliente ON ordenes(cliente_id);
CREATE INDEX idx_ordenes_estado ON ordenes(estado);
CREATE INDEX idx_ordenes_fecha ON ordenes(fecha_recogida);
CREATE INDEX idx_clientes_telefono ON clientes(telefono);
CREATE INDEX idx_clientes_nombre ON clientes(nombre);
CREATE INDEX idx_clientes_local ON clientes(local_id);

-- DATOS INICIALES
INSERT INTO locales (nombre, slogan, tipo_servicio) VALUES ('Ladys Lavanderia', 'Lavanderia a domicilio', 'local_y_delivery');
INSERT INTO formas_pago (local_id, nombre) VALUES (1,'Efectivo'),(1,'Transferencia'),(1,'POS Redcompra');
INSERT INTO categorias (local_id, nombre, orden) VALUES (1,'VESTIR',1),(1,'DORMITORIO',2),(1,'ALFOMBRAS',3),(1,'MASCOTAS',4),(1,'ESPECIALES',5),(1,'OTROS',6);
