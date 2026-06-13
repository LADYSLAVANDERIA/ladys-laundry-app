const router = require('express').Router();
const { auth, adminOnly } = require('../middleware/auth');
const authCtrl     = require('../controllers/authController');
const clientesCtrl = require('../controllers/clientesController');
const ordenesCtrl  = require('../controllers/ordenesController');
const dashCtrl     = require('../controllers/dashboardController');
const db           = require('../config/db');
const bcrypt       = require('bcryptjs');

// AUTH
router.post('/auth/login', authCtrl.login);

// DASHBOARD
router.get('/dashboard', auth, dashCtrl.getDashboard);

// CLIENTES
router.get   ('/clientes',                         auth, clientesCtrl.getAll);
router.get   ('/clientes/:id',                     auth, clientesCtrl.getById);
router.post  ('/clientes',                         auth, clientesCtrl.create);
router.put   ('/clientes/:id',                     auth, clientesCtrl.update);
router.delete('/clientes/:id',                     auth, adminOnly, clientesCtrl.remove);
router.post  ('/clientes/:cliente_id/direcciones', auth, clientesCtrl.addDireccion);

// ORDENES
router.get ('/ordenes',            auth, ordenesCtrl.getOrdenesByEstado);
router.get ('/ordenes/:id',        auth, ordenesCtrl.getOrdenById);
router.post('/ordenes',            auth, ordenesCtrl.createOrden);
router.put ('/ordenes/:id/estado', auth, ordenesCtrl.cambiarEstado);
router.post('/ordenes/:id/pago',   auth, ordenesCtrl.registrarPago);

// SERVICIOS
router.get('/servicios', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT s.*, c.nombre as categoria FROM servicios s LEFT JOIN categorias c ON s.categoria_id=c.id WHERE s.local_id=$1 AND s.activo=TRUE ORDER BY c.nombre, s.nombre',
      [req.user.local_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/servicios', auth, adminOnly, async (req, res) => {
  try {
    const { categoria_id, nombre, precio_lav_planch, precio_lav_secado, precio_productos, precio_solo_planch } = req.body;
    const { rows } = await db.query(
      'INSERT INTO servicios (local_id,categoria_id,nombre,precio_lav_planch,precio_lav_secado,precio_productos,precio_solo_planch) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.user.local_id, categoria_id, nombre, precio_lav_planch||0, precio_lav_secado||0, precio_productos||0, precio_solo_planch||0]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/servicios/:id', auth, adminOnly, async (req, res) => {
  try {
    const { nombre, precio_lav_planch, precio_lav_secado, precio_productos, precio_solo_planch } = req.body;
    const { rows } = await db.query(
      'UPDATE servicios SET nombre=$2,precio_lav_planch=$3,precio_lav_secado=$4,precio_productos=$5,precio_solo_planch=$6 WHERE id=$1 RETURNING *',
      [req.params.id, nombre, precio_lav_planch, precio_lav_secado, precio_productos, precio_solo_planch]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/servicios/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.query('UPDATE servicios SET activo=FALSE WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CATEGORIAS
router.get('/categorias', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM categorias WHERE local_id=$1 AND activo=TRUE ORDER BY orden', [req.user.local_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// RUTAS DE DELIVERY
router.get('/rutas', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM rutas WHERE local_id=$1 AND activo=TRUE ORDER BY dia_semana, hora_inicio', [req.user.local_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/rutas', auth, adminOnly, async (req, res) => {
  try {
    const { nombre, tipo, dia_semana, hora_inicio, hora_fin, hrs_anticipacion, puntos_disp } = req.body;
    const { rows } = await db.query(
      'INSERT INTO rutas (local_id,nombre,tipo,dia_semana,hora_inicio,hora_fin,hrs_anticipacion,puntos_disp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.user.local_id, nombre, tipo||'RETIROS_Y_ENTREGAS', dia_semana, hora_inicio, hora_fin, hrs_anticipacion||24, puntos_disp||4]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/rutas/:id', auth, adminOnly, async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields);
    const sets = keys.map((k, i) => k + '=$' + (i + 2)).join(', ');
    const { rows } = await db.query('UPDATE rutas SET ' + sets + ' WHERE id=$1 RETURNING *', [req.params.id, ...Object.values(fields)]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CAJA
router.get('/caja/estado', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM cajas WHERE local_id=$1 AND usuario_id=$2 AND estado='ABIERTA' ORDER BY id DESC LIMIT 1",
      [req.user.local_id, req.user.id]);
    res.json(rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/caja/abrir', auth, async (req, res) => {
  try {
    const { apertura_efect } = req.body;
    const { rows } = await db.query(
      "INSERT INTO cajas (local_id,usuario_id,hora_apertura,apertura_efect) VALUES ($1,$2,NOW()::TIME,$3) RETURNING *",
      [req.user.local_id, req.user.id, apertura_efect||0]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/caja/cerrar/:id', auth, async (req, res) => {
  try {
    const { cierre_efect } = req.body;
    const { rows } = await db.query(
      "UPDATE cajas SET estado='CERRADA',fecha_cierre=NOW(),hora_cierre=NOW()::TIME,cierre_efect=$2 WHERE id=$1 RETURNING *",
      [req.params.id, cierre_efect||0]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/caja/reporte', auth, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { rows } = await db.query(
      "SELECT c.*, u.nombre||' '||COALESCE(u.apellido,'') as usuario_nombre FROM cajas c LEFT JOIN usuarios u ON c.usuario_id=u.id WHERE c.local_id=$1 AND DATE(c.fecha_apertura) BETWEEN $2 AND $3 ORDER BY c.id DESC",
      [req.user.local_id, desde, hasta]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// COMPRAS / GASTOS
router.get('/compras', auth, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { rows } = await db.query('SELECT * FROM compras WHERE local_id=$1 AND fecha_compra BETWEEN $2 AND $3 ORDER BY fecha_compra DESC', [req.user.local_id, desde, hasta]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/compras', auth, async (req, res) => {
  try {
    const { fecha_compra, folio, tipo_doc, tipo_gasto, total, glosa } = req.body;
    const { rows } = await db.query(
      'INSERT INTO compras (local_id,fecha_compra,folio,tipo_doc,tipo_gasto,total,glosa,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.user.local_id, fecha_compra, folio, tipo_doc||'BOLETA', tipo_gasto, total, glosa, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/compras/:id', auth, adminOnly, async (req, res) => {
  try { await db.query('DELETE FROM compras WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// USUARIOS
router.get('/usuarios', auth, adminOnly, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id,nombre,apellido,telefono,email,perfil,imagen_url,app_conduccion,estado,ultimo_acceso FROM usuarios WHERE local_id=$1 ORDER BY nombre', [req.user.local_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/usuarios', auth, adminOnly, async (req, res) => {
  try {
    const { nombre, apellido, telefono, email, password, perfil, app_conduccion } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO usuarios (local_id,nombre,apellido,telefono,email,password_hash,perfil,app_conduccion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,nombre,apellido,email,perfil',
      [req.user.local_id, nombre, apellido, telefono, email, hash, perfil||'ASISTENTE', app_conduccion||'GOOGLE_MAPS']);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/usuarios/:id', auth, adminOnly, async (req, res) => {
  try {
    const { nombre, apellido, telefono, perfil, estado, app_conduccion } = req.body;
    const { rows } = await db.query(
      'UPDATE usuarios SET nombre=$2,apellido=$3,telefono=$4,perfil=$5,estado=$6,app_conduccion=$7 WHERE id=$1 RETURNING id,nombre,apellido,email,perfil,estado',
      [req.params.id, nombre, apellido, telefono, perfil, estado, app_conduccion]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DIAS INHABILES
router.get('/dias-inhabiles', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM dias_inhabiles WHERE local_id=$1 ORDER BY fecha', [req.user.local_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/dias-inhabiles', auth, async (req, res) => {
  try {
    const { fecha, motivo } = req.body;
    const { rows } = await db.query('INSERT INTO dias_inhabiles (local_id,fecha,motivo) VALUES ($1,$2,$3) RETURNING *', [req.user.local_id, fecha, motivo]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/dias-inhabiles/:fecha', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM dias_inhabiles WHERE local_id=$1 AND fecha=$2', [req.user.local_id, req.params.fecha]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// REPORTES
router.get('/reportes/control', auth, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { rows } = await db.query(
      `SELECT l.nombre as local,
        COUNT(o.id) FILTER (WHERE o.estado!='ANULADA') as ordenes,
        COUNT(o.id) FILTER (WHERE o.estado='ANULADA') as anuladas,
        COALESCE(SUM(o.monto_total) FILTER (WHERE o.estado!='ANULADA'),0) as ventas,
        COALESCE(SUM(o.monto_abonado) FILTER (WHERE o.estado!='ANULADA'),0) as ingresos,
        COALESCE(SUM(p.monto) FILTER (WHERE f.nombre='Efectivo'),0) as efectivo,
        COALESCE(SUM(p.monto) FILTER (WHERE f.nombre='POS Redcompra'),0) as pos,
        COALESCE(SUM(p.monto) FILTER (WHERE f.nombre='Transferencia'),0) as transferencia
       FROM ordenes o JOIN locales l ON o.local_id=l.id
       LEFT JOIN pagos p ON p.orden_id=o.id
       LEFT JOIN formas_pago f ON p.forma_pago_id=f.id
       WHERE o.local_id=$1 AND DATE(o.creado_en) BETWEEN $2 AND $3
       GROUP BY l.nombre`,
      [req.user.local_id, desde, hasta]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CONFIG LOCAL
router.get('/local', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM locales WHERE id=$1', [req.user.local_id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/local', auth, adminOnly, async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields);
    const sets = keys.map((k, i) => k + '=$' + (i + 2)).join(', ');
    const { rows } = await db.query('UPDATE locales SET ' + sets + ' WHERE id=$1 RETURNING *', [req.user.local_id, ...Object.values(fields)]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PREPAGOS
router.get('/prepagos/planes', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM planes_prepago WHERE local_id=$1 AND activo=TRUE', [req.user.local_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/prepagos/saldos', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT pc.*, c.nombre||' '||COALESCE(c.apellido,'') as cliente, c.telefono, pp.nombre as plan FROM prepagos_cliente pc JOIN clientes c ON pc.cliente_id=c.id JOIN planes_prepago pp ON pc.plan_id=pp.id WHERE c.local_id=$1 AND pc.activo=TRUE ORDER BY c.nombre",
      [req.user.local_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// FORMAS DE PAGO
router.get('/formas-pago', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM formas_pago WHERE local_id=$1 AND activo=TRUE', [req.user.local_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
