-- 002: Sistema de pedidos v2 — Ladys Lavandería Concón (idempotente)

-- Zona horaria de la BD: Chile
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Santiago'); END $$;

-- ── Parámetros del negocio ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracion (clave VARCHAR(60) PRIMARY KEY, valor TEXT, descripcion TEXT);
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('minimo_retiro',        '20000', 'Monto mínimo para retiro/entrega a domicilio'),
  ('minimo_kg_local',      '5',     'Kilos mínimos para atención en el local'),
  ('precio_kilo',          '2900',  'Precio por kilo lavado normal (respaldo; manda el catálogo)'),
  ('precio_kilo_express',  '3700',  'Precio por kilo express (respaldo; manda el catálogo)'),
  ('descuento_continuidad','10',    '% de descuento por continuidad semanal'),
  ('delivery_vina',        '2500',  'Recargo delivery Viña centro / sector rural'),
  ('whatsapp_local',       '56975410232', 'WhatsApp del local'),
  ('direccion_local',      'Av. Concón Reñaca 102, Locales 5 y 6, Concón', 'Dirección del local')
ON CONFLICT (clave) DO NOTHING;

-- ── Órdenes: estado logístico + estado de pago separados ───────────────
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS estado_pago      VARCHAR(12) DEFAULT 'PENDIENTE';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS kilos            NUMERIC(8,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS tipo_servicio    VARCHAR(10) DEFAULT 'NORMAL';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS origen           VARCHAR(12) DEFAULT 'LOCAL';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS subtotal         NUMERIC(12,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS descuento_pct    NUMERIC(5,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS descuento_monto  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS es_membresia     BOOLEAN DEFAULT FALSE;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS retiro_domicilio BOOLEAN DEFAULT FALSE;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS entrega_domicilio BOOLEAN DEFAULT FALSE;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS recibida_el      TIMESTAMP;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS lista_el         TIMESTAMP;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS pagada_el        TIMESTAMP;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS ot_easylaundry   VARCHAR(20);
ALTER TABLE orden_items ALTER COLUMN cantidad TYPE NUMERIC(10,2);

-- Corregir datos existentes
UPDATE ordenes SET estado='ENTREGADA' WHERE estado='PAGADA';
UPDATE ordenes SET saldo_pendiente = monto_total - monto_abonado WHERE saldo_pendiente <> monto_total - monto_abonado;
UPDATE ordenes SET subtotal = monto_total - COALESCE(monto_delivery,0) WHERE subtotal = 0 AND monto_total > 0;
UPDATE ordenes SET estado_pago = CASE WHEN monto_abonado >= monto_total AND monto_total > 0 THEN 'PAGADA'
                                      WHEN monto_abonado > 0 THEN 'PARCIAL' ELSE 'PENDIENTE' END;
UPDATE ordenes SET recibida_el = COALESCE(recibida_el, creado_en) WHERE estado IN ('EN_PROCESO','LISTA','ENTREGADA');
UPDATE ordenes SET retiro_domicilio = TRUE WHERE ruta_recogida_id IS NOT NULL AND retiro_domicilio = FALSE;
UPDATE ordenes SET entrega_domicilio = TRUE WHERE ruta_entrega_id IS NOT NULL AND entrega_domicilio = FALSE;

CREATE TABLE IF NOT EXISTS ordenes_historial (
  id         SERIAL PRIMARY KEY,
  orden_id   INT REFERENCES ordenes(id) ON DELETE CASCADE,
  estado     VARCHAR(20),
  nota       TEXT,
  usuario_id INT,
  creado_en  TIMESTAMP DEFAULT NOW()
);
INSERT INTO ordenes_historial (orden_id, estado, nota, usuario_id, creado_en)
  SELECT o.id, o.estado, 'Estado inicial (migración v2)', o.usuario_id, o.creado_en
  FROM ordenes o WHERE NOT EXISTS (SELECT 1 FROM ordenes_historial h WHERE h.orden_id = o.id);

CREATE INDEX IF NOT EXISTS idx_ordenes_fecha_entrega ON ordenes(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado_pago   ON ordenes(estado_pago);
CREATE INDEX IF NOT EXISTS idx_hist_orden            ON ordenes_historial(orden_id);

-- ── Clientes ───────────────────────────────────────────────────────────
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ghl_contact_id VARCHAR(40);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS continuidad    BOOLEAN DEFAULT FALSE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS es_ladys2      BOOLEAN DEFAULT FALSE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS notas_internas TEXT;
UPDATE clientes SET es_ladys2 = TRUE
  WHERE LOWER(nombre||' '||COALESCE(apellido,'')) LIKE '%ladys%2%'
     OR LOWER(COALESCE(razon_social,'')) LIKE '%concon 2%';

-- ── Catálogo: eliminar duplicados que dejó el seed antiguo ─────────────
UPDATE servicios s SET categoria_id = k.min_id
  FROM (SELECT nombre, local_id, MIN(id) AS min_id FROM categorias GROUP BY nombre, local_id) k
  JOIN categorias c ON c.nombre = k.nombre AND c.local_id = k.local_id
  WHERE s.categoria_id = c.id AND c.id <> k.min_id;
DELETE FROM categorias WHERE id NOT IN (SELECT MIN(id) FROM categorias GROUP BY nombre, local_id);
DELETE FROM servicios s
  WHERE s.id NOT IN (SELECT MIN(id) FROM servicios GROUP BY local_id, categoria_id, nombre,
                     precio_lav_planch, precio_lav_secado, precio_productos, precio_solo_planch)
    AND NOT EXISTS (SELECT 1 FROM orden_items i WHERE i.servicio_id = s.id);
UPDATE categorias SET orden = CASE nombre WHEN 'CARGAS' THEN 1 WHEN 'DORMITORIO' THEN 2 WHEN 'VESTIR' THEN 3
  WHEN 'ACCESORIOS' THEN 4 WHEN 'TINTORERIA' THEN 5 WHEN 'ESPECIALES' THEN 6 WHEN 'ALFOMBRAS' THEN 7
  WHEN 'CORTINAS' THEN 8 WHEN 'MASCOTAS' THEN 9 WHEN 'LAVANDERIA' THEN 10 WHEN 'PRODUCTOS E INSUMOS' THEN 11
  WHEN 'HOGAR' THEN 12 WHEN 'REPARACIONES - MODISTA' THEN 13 WHEN 'SERVICIOS DE LIMPIEZA' THEN 14 ELSE 20 END;

-- ── Rutas reales de Ladys (L-V dos ventanas, sábado solo entregas) ─────
UPDATE rutas SET activo = FALSE WHERE local_id = 1
  AND nombre NOT IN ('Intermedia 13:30-14:30','Tarde 17:00-18:00','Sábado 14:00-15:00');
INSERT INTO rutas (local_id, nombre, tipo, dia_semana, hora_inicio, hora_fin, hrs_anticipacion, puntos_disp, activo)
SELECT 1, r.nombre, r.tipo, r.dia, r.ini::time, r.fin::time, 4, 12, TRUE
FROM (VALUES
  ('Intermedia 13:30-14:30','RETIROS_Y_ENTREGAS','LUNES','13:30','14:30'),
  ('Intermedia 13:30-14:30','RETIROS_Y_ENTREGAS','MARTES','13:30','14:30'),
  ('Intermedia 13:30-14:30','RETIROS_Y_ENTREGAS','MIERCOLES','13:30','14:30'),
  ('Intermedia 13:30-14:30','RETIROS_Y_ENTREGAS','JUEVES','13:30','14:30'),
  ('Intermedia 13:30-14:30','RETIROS_Y_ENTREGAS','VIERNES','13:30','14:30'),
  ('Tarde 17:00-18:00','RETIROS_Y_ENTREGAS','LUNES','17:00','18:00'),
  ('Tarde 17:00-18:00','RETIROS_Y_ENTREGAS','MARTES','17:00','18:00'),
  ('Tarde 17:00-18:00','RETIROS_Y_ENTREGAS','MIERCOLES','17:00','18:00'),
  ('Tarde 17:00-18:00','RETIROS_Y_ENTREGAS','JUEVES','17:00','18:00'),
  ('Tarde 17:00-18:00','RETIROS_Y_ENTREGAS','VIERNES','17:00','18:00'),
  ('Sábado 14:00-15:00','SOLO_ENTREGAS','SABADO','14:00','15:00')
) AS r(nombre, tipo, dia, ini, fin)
WHERE NOT EXISTS (SELECT 1 FROM rutas x WHERE x.local_id = 1 AND x.nombre = r.nombre AND x.dia_semana = r.dia);
UPDATE rutas SET activo = TRUE, puntos_disp = GREATEST(puntos_disp, 12)
  WHERE local_id = 1 AND nombre IN ('Intermedia 13:30-14:30','Tarde 17:00-18:00','Sábado 14:00-15:00');

-- ── Formas de pago ─────────────────────────────────────────────────────
INSERT INTO formas_pago (local_id, nombre, activo)
SELECT 1, v.n, TRUE FROM (VALUES ('Efectivo'),('POS Redcompra'),('Transferencia'),('Membresía'),('Crédito 30 días')) v(n)
WHERE NOT EXISTS (SELECT 1 FROM formas_pago f WHERE f.local_id = 1 AND f.nombre = v.n);

-- ── Feriados 2026 (días sin ruta) ──────────────────────────────────────
INSERT INTO dias_inhabiles (local_id, fecha, motivo)
SELECT 1, v.d::date, v.m FROM (VALUES
  ('2026-09-18','Fiestas Patrias'),('2026-09-19','Glorias del Ejército'),('2026-10-12','Encuentro de Dos Mundos'),
  ('2026-10-31','Iglesias Evangélicas'),('2026-12-08','Inmaculada Concepción'),('2026-12-25','Navidad')) v(d, m)
WHERE NOT EXISTS (SELECT 1 FROM dias_inhabiles x WHERE x.local_id = 1 AND x.fecha = v.d::date);

-- ── Datos del local ────────────────────────────────────────────────────
UPDATE locales SET
  nombre = 'Ladys Lavandería Concón', razon_social = 'Ladys Lavandería Concón SpA', id_fiscal = '78.035.214-0',
  telefono = '+56 9 7541 0232', whatsapp = '56975410232', email = 'contacto@ladyslavanderia.cl',
  dir_salida = 'Av. Concón Reñaca 102, Locales 5 y 6, Concón',
  horario = 'Lun-Vie 10:00-13:30 y 14:30-18:30 · Sáb 10:00-13:30 · Ruta L-V 13:30-14:30 y 17:00-18:00 · Sáb 14:00-15:00 solo entregas',
  min_delivery = 20000
WHERE id = 1;

-- ── Membresías (por si la BD es anterior al módulo) ────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='planes_prepago' AND column_name='kilos_incluidos') THEN
    ALTER TABLE planes_prepago ADD COLUMN kilos_incluidos NUMERIC(10,2) DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='planes_prepago' AND column_name='servicios_incluidos') THEN
    ALTER TABLE planes_prepago ADD COLUMN servicios_incluidos TEXT DEFAULT ''; END IF;
END $$;
INSERT INTO planes_prepago (local_id, nombre, duracion, precio, kilos_incluidos, servicios_incluidos)
SELECT 1, 'Membresía Mensual', 30, 200000, 0, 'Lavado, Planchado, Delivery'
WHERE NOT EXISTS (SELECT 1 FROM planes_prepago WHERE nombre = 'Membresía Mensual');
UPDATE planes_prepago SET precio = 200000 WHERE nombre = 'Membresía Mensual' AND precio <> 200000;

INSERT INTO clientes (local_id, tipo, nombre, apellido, tipo_doc)
SELECT 1, 'PARTICULAR', 'Alejandra', 'Mora', 'BOLETA'
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE nombre ILIKE 'Alejandra' AND apellido ILIKE 'Mora');
INSERT INTO clientes (local_id, tipo, nombre, apellido, tipo_doc)
SELECT 1, 'PARTICULAR', 'Joana', 'Sela', 'BOLETA'
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE nombre ILIKE 'Joana' AND apellido ILIKE 'Sela');
-- Dirección de Alejandra Mora (sacada de la programación de EasyLaundry)
INSERT INTO direcciones_clientes (cliente_id, ciudad, sector, calle, numero, otro, es_principal)
SELECT c.id, 'Concón', 'Concón', 'Calle del Sol', '85', 'Depto 281', TRUE
FROM clientes c WHERE c.nombre ILIKE 'Alejandra' AND c.apellido ILIKE 'Mora'
  AND NOT EXISTS (SELECT 1 FROM direcciones_clientes d WHERE d.cliente_id = c.id);

-- ── Numeración: las OT de Ladys App parten en 10001 (EasyLaundry va en ~6.400) ─
SELECT setval('ordenes_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM ordenes), 10000), true);
