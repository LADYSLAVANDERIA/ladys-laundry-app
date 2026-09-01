-- CATEGORÍAS
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'ACCESORIOS', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'ALFOMBRAS', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'CARGAS', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'CORTINAS', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'DORMITORIO', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'ESPECIALES', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'HOGAR', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'LAVANDERIA', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'MASCOTAS', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'OTROS', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'PRODUCTOS E INSUMOS', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'REPARACIONES - MODISTA', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'SERVICIOS DE LIMPIEZA', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'TINTORERIA', 1) ON CONFLICT DO NOTHING;
INSERT INTO categorias (local_id, nombre, orden) VALUES (1, 'VESTIR', 1) ON CONFLICT DO NOTHING;

-- SERVICIOS CON PRECIOS REALES DE EASYLAUNDRY
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'ABRIGO, CHAQUETA LIMPIEZA A VAPOR', 12990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'ALFOMBRA M (=4,5 M²)', 50000
FROM categorias c WHERE c.local_id=1 AND c.nombre='ALFOMBRAS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'ALFOMBRA S (=3,7 M²)', 45000
FROM categorias c WHERE c.local_id=1 AND c.nombre='ALFOMBRAS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'ALFOMBRAS L (=6 M²)', 55000
FROM categorias c WHERE c.local_id=1 AND c.nombre='ALFOMBRAS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'ALMOHADA', 9990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'BLANQUEADO X PRENDA', 1990
FROM categorias c WHERE c.local_id=1 AND c.nombre='ESPECIALES'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'CAFÉ', 1500
FROM categorias c WHERE c.local_id=1 AND c.nombre='OTROS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CALIENTA CAMAS / ESCALDAZONO 2 PLZ', 19990
FROM categorias c WHERE c.local_id=1 AND c.nombre='ESPECIALES'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CAMA DE PERRO', 19990
FROM categorias c WHERE c.local_id=1 AND c.nombre='MASCOTAS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'CAMISA', 5990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'CAMISA EXPRESS', 8990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_solo_planch)
SELECT 1, c.id, 'CAMISA SOLO PLANCHADO', 2500
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CARGA 1 KILO', 2900
FROM categorias c WHERE c.local_id=1 AND c.nombre='CARGAS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CARGA 1 KILO EXPRESS', 3700
FROM categorias c WHERE c.local_id=1 AND c.nombre='CARGAS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CARGA KILO ROPA DE TRABAJO', 5990
FROM categorias c WHERE c.local_id=1 AND c.nombre='LAVANDERIA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'CASACA / PARKA SINTETICA', 8990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'CHAQUETA MEZCLILLA DELICADO', 8990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT 1 PLAZA', 8990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT 1 PLAZA ~EXPRESS~', 18990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT 1,5 PLAZAS', 9990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT 1.5 PLAZA ~EXPRESS~', 19990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT 2 PLAZAS', 19990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT 2 PLAZAS ~EXPRESS~', 29990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT KING', 24990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT KING ~EXPRESS~', 34990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT SUPER KING', 29990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'COBERTOR/CUBRECAMAS/QUILT SUPER KING ~EXPRESS~', 39990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'CORBATA', 2990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CORTINA BLACKOUT X PAÑO', 19990
FROM categorias c WHERE c.local_id=1 AND c.nombre='CORTINAS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'CORTINA DE BAÑO', 10980
FROM categorias c WHERE c.local_id=1 AND c.nombre='LAVANDERIA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CORTINA DE BAÑO', 6990
FROM categorias c WHERE c.local_id=1 AND c.nombre='LAVANDERIA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'COSTURA-REPACIONES-ARREGLOS', 1
FROM categorias c WHERE c.local_id=1 AND c.nombre='REPARACIONES - MODISTA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CUBRE COLCHON 1 PLAZAS', 5990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CUBRE COLCHON 1,5 PLAZAS', 7990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CUBRE COLCHON 2 PLAZAS', 13990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'CUBRE COLCHON KING', 18990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_solo_planch)
SELECT 1, c.id, 'CUBRE PLUMON', 4990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'DELIVERY', 2500
FROM categorias c WHERE c.local_id=1 AND c.nombre='PRODUCTOS E INSUMOS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'DELIVERY VIÑA CENTRO', 2500
FROM categorias c WHERE c.local_id=1 AND c.nombre='OTROS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'DESMANCHADO X PRENDA', 1990
FROM categorias c WHERE c.local_id=1 AND c.nombre='ESPECIALES'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'DESMANCHADO COBERTOR', 2990
FROM categorias c WHERE c.local_id=1 AND c.nombre='TINTORERIA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'DESMUGRE X PRENDA', 1990
FROM categorias c WHERE c.local_id=1 AND c.nombre='ESPECIALES'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'DESPACHO SECTOR RURAL', 2500
FROM categorias c WHERE c.local_id=1 AND c.nombre='OTROS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'DETERGENTE + SUAVIZANTE', 10990
FROM categorias c WHERE c.local_id=1 AND c.nombre='PRODUCTOS E INSUMOS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'DETERGENTE 3 LITROS LADYS', 5990
FROM categorias c WHERE c.local_id=1 AND c.nombre='PRODUCTOS E INSUMOS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'EXPRESS 1D-1B', 30000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'EXPRESS 2D-1B', 42000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'EXPRESS 2D-2B', 52000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'EXPRESS 3D-2B', 65000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'GORRO LANA', 2990
FROM categorias c WHERE c.local_id=1 AND c.nombre='LAVANDERIA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'HORNO / MICROONDAS (ADICIONAL)', 8000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_solo_planch)
SELECT 1, c.id, 'JUEGO DE SABANAS 2 PLAZAS', 4990
FROM categorias c WHERE c.local_id=1 AND c.nombre='DORMITORIO'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'LAVADO Y SECADO DE ZAPATILLAS', 9990
FROM categorias c WHERE c.local_id=1 AND c.nombre='ACCESORIOS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'LINO POR KILO', 5990
FROM categorias c WHERE c.local_id=1 AND c.nombre='LAVANDERIA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'PANTALON DE VESTIR', 6990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'PARRILLA (ADICIONAL)', 12000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_solo_planch)
SELECT 1, c.id, 'PLANCHADO POR UNIDAD', 1990
FROM categorias c WHERE c.local_id=1 AND c.nombre='ESPECIALES'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'POLERA DELICADO', 5990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'POLERA DELICADO', 4990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'POLERON DELICADO', 7990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'PROFUNDO 1D-1B', 60000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'PROFUNDO 2D-1B', 80000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'PROFUNDO 2D-2B', 100000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'PROFUNDO 3D-2B', 130000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'QUITAR MOTAS', 1990
FROM categorias c WHERE c.local_id=1 AND c.nombre='SERVICIOS DE LIMPIEZA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'REFRIGERADOR INTERIOR (ADICIONAL)', 8000
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'ROPA BOUCLE', 1
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'SECADO DE ROPA', 2700
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'SERVICIO DE LIMPIEZA ESPECIAL', 2000000
FROM categorias c WHERE c.local_id=1 AND c.nombre='ACCESORIOS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'SERVICIO ESPECIAL', 5000
FROM categorias c WHERE c.local_id=1 AND c.nombre='REPARACIONES - MODISTA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'SUAVIZANTE 3 L.', 5990
FROM categorias c WHERE c.local_id=1 AND c.nombre='PRODUCTOS E INSUMOS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'TRAJE / AMBO / TERNO', 19990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'VENTA DE BOLSOS REUTILIZABLE', 2000
FROM categorias c WHERE c.local_id=1 AND c.nombre='PRODUCTOS E INSUMOS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'VENTA MORRAL REUTILIZABLE', 1000
FROM categorias c WHERE c.local_id=1 AND c.nombre='PRODUCTOS E INSUMOS'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'VESTIDO', 9990
FROM categorias c WHERE c.local_id=1 AND c.nombre='ESPECIALES'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'VESTIDO DE FIESTA', 12990
FROM categorias c WHERE c.local_id=1 AND c.nombre='VESTIR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_planch)
SELECT 1, c.id, 'VESTIDO DE NOVIA', 80000
FROM categorias c WHERE c.local_id=1 AND c.nombre='TINTORERIA'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_productos)
SELECT 1, c.id, 'VIDRIOS C/U (ADICIONAL)', 3500
FROM categorias c WHERE c.local_id=1 AND c.nombre='HOGAR'
ON CONFLICT DO NOTHING;
INSERT INTO servicios (local_id, categoria_id, nombre, precio_lav_secado)
SELECT 1, c.id, 'XL (=12 M²)', 70000
FROM categorias c WHERE c.local_id=1 AND c.nombre='ALFOMBRAS'
ON CONFLICT DO NOTHING;
