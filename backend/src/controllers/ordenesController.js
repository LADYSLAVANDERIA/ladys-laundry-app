const db = require('../config/db');

const getOrdenesByEstado = async (req, res) => {
  try {
    const { estado, desde, hasta, q } = req.query;
    let query = `SELECT o.*, 
      c.nombre||' '||COALESCE(c.apellido,'') as cliente_nombre, c.telefono as cliente_telefono,
      u.nombre as usuario_nombre
      FROM ordenes o 
      JOIN clientes c ON o.cliente_id=c.id
      LEFT JOIN usuarios u ON o.usuario_id=u.id
      WHERE o.local_id=$1`;
    const params = [req.user.local_id];
    let idx = 2;
    if (estado) { query += ` AND o.estado=$${idx++}`; params.push(estado); }
    if (desde)  { query += ` AND DATE(o.creado_en)>=$${idx++}`; params.push(desde); }
    if (hasta)  { query += ` AND DATE(o.creado_en)<=$${idx++}`; params.push(hasta); }
    if (q)      { query += ` AND (c.nombre ILIKE $${idx} OR c.apellido ILIKE $${idx} OR CAST(o.id AS TEXT) LIKE $${idx})`; params.push(`%${q}%`); idx++; }
    query += ' ORDER BY o.creado_en DESC LIMIT 200';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getOrdenById = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, c.nombre||' '||COALESCE(c.apellido,'') as cliente_nombre, c.telefono as cliente_telefono,
       c.email as cliente_email, u.nombre as usuario_nombre
       FROM ordenes o JOIN clientes c ON o.cliente_id=c.id LEFT JOIN usuarios u ON o.usuario_id=u.id
       WHERE o.id=$1 AND o.local_id=$2`, [req.params.id, req.user.local_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' });
    const { rows: items } = await db.query('SELECT * FROM orden_items WHERE orden_id=$1', [req.params.id]);
    const { rows: pagos } = await db.query(
      `SELECT p.*, f.nombre as forma_nombre FROM pagos p LEFT JOIN formas_pago f ON p.forma_pago_id=f.id WHERE p.orden_id=$1`, [req.params.id]);
    res.json({ ...rows[0], items, pagos });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const createOrden = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { cliente_id, items, tipo_doc, fecha_recogida, fecha_entrega, ruta_recogida_id, ruta_entrega_id, dir_recogida_id, dir_entrega_id, monto_delivery, observaciones, bultos } = req.body;
    const monto_total = items.reduce((s, i) => s + (i.precio_unit * i.cantidad), 0) + (monto_delivery||0);
    const { rows } = await client.query(
      `INSERT INTO ordenes (local_id,cliente_id,usuario_id,tipo_doc,fecha_recogida,fecha_entrega,ruta_recogida_id,ruta_entrega_id,dir_recogida_id,dir_entrega_id,monto_delivery,monto_total,observaciones,bultos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.local_id, cliente_id, req.user.id, tipo_doc||'BOLETA', fecha_recogida||null, fecha_entrega||null, ruta_recogida_id||null, ruta_entrega_id||null, dir_recogida_id||null, dir_entrega_id||null, monto_delivery||0, monto_total, observaciones, bultos||1]);
    const orden = rows[0];
    for (const item of items) {
      await client.query(
        'INSERT INTO orden_items (orden_id,servicio_id,nombre,cantidad,precio_unit,subtotal,etiqueta) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [orden.id, item.servicio_id||null, item.nombre, item.cantidad, item.precio_unit, item.precio_unit*item.cantidad, item.etiqueta||null]);
    }
    await client.query('COMMIT');
    res.status(201).json(orden);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
};

const cambiarEstado = async (req, res) => {
  try {
    const { estado, motivo_anulacion } = req.body;
    const estados = ['PRE_ORDEN','EN_PROCESO','LISTA','ENTREGADA','PAGADA','ANULADA'];
    if (!estados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    const extra = estado === 'ENTREGADA' ? ', entregada_el=NOW()' : '';
    const { rows } = await db.query(
      `UPDATE ordenes SET estado=$2, motivo_anulacion=$3, anulada_por=CASE WHEN $2='ANULADA' THEN $4 ELSE anulada_por END ${extra} WHERE id=$1 AND local_id=$5 RETURNING *`,
      [req.params.id, estado, motivo_anulacion||null, req.user.id, req.user.local_id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const registrarPago = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { monto, forma_pago_id, referencia } = req.body;
    const { rows: p } = await client.query(
      'INSERT INTO pagos (orden_id,cliente_id,forma_pago_id,monto,referencia,usuario_id) SELECT $1,cliente_id,$2,$3,$4,$5 FROM ordenes WHERE id=$1 RETURNING *',
      [req.params.id, forma_pago_id, monto, referencia||null, req.user.id]);
    await client.query('UPDATE ordenes SET monto_abonado=monto_abonado+$2, saldo_pendiente=saldo_pendiente-$2 WHERE id=$1', [req.params.id, monto]);
    const { rows: o } = await client.query('SELECT monto_total, monto_abonado FROM ordenes WHERE id=$1', [req.params.id]);
    if (o[0].monto_abonado >= o[0].monto_total) {
      await client.query("UPDATE ordenes SET estado='PAGADA' WHERE id=$1", [req.params.id]);
    }
    await client.query('COMMIT');
    res.status(201).json(p[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
};

module.exports = { getOrdenesByEstado, getOrdenById, createOrden, cambiarEstado, registrarPago };
