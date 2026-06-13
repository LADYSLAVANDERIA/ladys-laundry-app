const db = require('../config/db');

const getAll = async (req, res) => {
  try {
    const { q } = req.query;
    let query = `SELECT c.*, 
      (SELECT COUNT(*) FROM ordenes o WHERE o.cliente_id=c.id AND o.estado!='ANULADA') as total_ordenes,
      (SELECT COALESCE(SUM(monto_total),0) FROM ordenes o WHERE o.cliente_id=c.id AND o.estado!='ANULADA') as total_gastado
      FROM clientes c WHERE c.local_id=$1 AND c.activo=TRUE`;
    const params = [req.user.local_id];
    if (q) { query += ` AND (c.nombre ILIKE $2 OR c.apellido ILIKE $2 OR c.telefono ILIKE $2 OR c.email ILIKE $2)`; params.push(`%${q}%`); }
    query += ' ORDER BY c.nombre';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getById = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM clientes WHERE id=$1 AND local_id=$2', [req.params.id, req.user.local_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    const { rows: dirs } = await db.query('SELECT * FROM direcciones_clientes WHERE cliente_id=$1 ORDER BY es_principal DESC', [req.params.id]);
    const { rows: ordenes } = await db.query(
      `SELECT o.*, u.nombre as atendido_por FROM ordenes o LEFT JOIN usuarios u ON o.usuario_id=u.id 
       WHERE o.cliente_id=$1 ORDER BY o.creado_en DESC LIMIT 20`, [req.params.id]);
    res.json({ ...rows[0], direcciones: dirs, ordenes });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const create = async (req, res) => {
  try {
    const { tipo, nombre, apellido, telefono, email, id_fiscal, razon_social, giro, contacto, tipo_doc, plazo_pago, observaciones, fecha_nacimiento } = req.body;
    const { rows } = await db.query(
      `INSERT INTO clientes (local_id,tipo,nombre,apellido,telefono,email,id_fiscal,razon_social,giro,contacto,tipo_doc,plazo_pago,observaciones,fecha_nacimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.local_id, tipo||'PARTICULAR', nombre, apellido, telefono, email, id_fiscal, razon_social, giro, contacto, tipo_doc||'BOLETA', plazo_pago||0, observaciones, fecha_nacimiento||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const update = async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields).filter(k => k !== 'id');
    const sets = keys.map((k, i) => `${k}=$${i+2}`).join(', ');
    const { rows } = await db.query(`UPDATE clientes SET ${sets} WHERE id=$1 AND local_id=${req.user.local_id} RETURNING *`,
      [req.params.id, ...keys.map(k => fields[k])]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const remove = async (req, res) => {
  try {
    await db.query('UPDATE clientes SET activo=FALSE WHERE id=$1 AND local_id=$2', [req.params.id, req.user.local_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const addDireccion = async (req, res) => {
  try {
    const { ciudad, sector, calle, numero, otro, lat, lng, es_principal } = req.body;
    if (es_principal) await db.query('UPDATE direcciones_clientes SET es_principal=FALSE WHERE cliente_id=$1', [req.params.cliente_id]);
    const { rows } = await db.query(
      'INSERT INTO direcciones_clientes (cliente_id,ciudad,sector,calle,numero,otro,lat,lng,es_principal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [req.params.cliente_id, ciudad, sector, calle, numero, otro, lat, lng, es_principal||false]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getAll, getById, create, update, remove, addDireccion };
