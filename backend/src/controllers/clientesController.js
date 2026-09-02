const db = require('../config/db');
const hoyChile = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const CAMPOS = ['tipo','nombre','apellido','telefono','email','id_fiscal','razon_social','giro','contacto','tipo_doc','plazo_pago','observaciones','fecha_nacimiento','continuidad','es_ladys2','notas_internas','ghl_contact_id','activo','cc_correo'];
const fail = (res, e, code = 500) => res.status(code).json({ error: e.message });

const getAll = async (req, res) => {
  try {
    const { q, tipo, ladys2 } = req.query;
    let sql = `SELECT c.*, (SELECT COUNT(*) FROM ordenes o WHERE o.cliente_id=c.id AND o.estado<>'ANULADA') AS total_ordenes,
        (SELECT COALESCE(SUM(monto_total),0) FROM ordenes o WHERE o.cliente_id=c.id AND o.estado<>'ANULADA') AS total_gastado,
        (SELECT COALESCE(SUM(saldo_pendiente),0) FROM ordenes o WHERE o.cliente_id=c.id AND o.estado<>'ANULADA') AS saldo_total,
        (SELECT MAX(creado_en) FROM ordenes o WHERE o.cliente_id=c.id) AS ultima_orden,
        EXISTS (SELECT 1 FROM prepagos_cliente p WHERE p.cliente_id=c.id AND p.activo=TRUE) AS tiene_membresia
      FROM clientes c WHERE c.local_id=$1 AND c.activo=TRUE`;
    const p = [req.user.local_id];
    if (ladys2 !== '1') sql += ' AND c.es_ladys2=FALSE';
    if (tipo) { p.push(tipo); sql += ` AND c.tipo=$${p.length}`; }
    if (q) { p.push(`%${q}%`); const n = '$' + p.length; sql += ` AND (c.nombre ILIKE ${n} OR c.apellido ILIKE ${n} OR c.telefono ILIKE ${n} OR c.email ILIKE ${n} OR c.razon_social ILIKE ${n} OR c.id_fiscal ILIKE ${n})`; }
    sql += ' ORDER BY c.nombre, c.apellido LIMIT 500';
    const { rows } = await db.query(sql, p);
    res.json(rows);
  } catch (e) { fail(res, e); }
};

const getById = async (req, res) => {
  try {
    const id = req.params.id, hoy = hoyChile();
    const { rows } = await db.query('SELECT * FROM clientes WHERE id=$1 AND local_id=$2', [id, req.user.local_id]);
    const cli = rows[0];
    if (!cli) return res.status(404).json({ error: 'Cliente no encontrado' });
    const [dirs, ords, sem, memb, st] = await Promise.all([
      db.query('SELECT * FROM direcciones_clientes WHERE cliente_id=$1 ORDER BY es_principal DESC, id', [id]),
      db.query('SELECT id,estado,estado_pago,monto_total,saldo_pendiente,kilos,creado_en,fecha_entrega,es_membresia,origen,tipo_servicio FROM ordenes WHERE cliente_id=$1 ORDER BY creado_en DESC LIMIT 40', [id]),
      db.query(`WITH s AS (SELECT generate_series(date_trunc('week', date_trunc('month', $2::date)), date_trunc('week', $2::date), interval '1 week')::date AS ini)
        SELECT s.ini, (s.ini+5)::date AS fin,
          EXISTS (SELECT 1 FROM ordenes o WHERE o.cliente_id=$1 AND o.estado<>'ANULADA'
                  AND DATE(o.creado_en) BETWEEN GREATEST(s.ini, date_trunc('month',$2::date)::date) AND LEAST((s.ini+5)::date, $2::date)) AS con_orden
        FROM s ORDER BY s.ini`, [id, hoy]),
      db.query('SELECT pc.*, pp.nombre AS plan, pp.precio AS precio_plan FROM prepagos_cliente pc JOIN planes_prepago pp ON pc.plan_id=pp.id WHERE pc.cliente_id=$1 AND pc.activo=TRUE ORDER BY pc.id DESC LIMIT 1', [id]),
      db.query("SELECT COUNT(*) AS total_ordenes, COALESCE(SUM(monto_total),0) AS total_gastado, COALESCE(SUM(saldo_pendiente),0) AS saldo_total, MAX(creado_en) AS ultima_orden FROM ordenes WHERE cliente_id=$1 AND estado<>'ANULADA'", [id]),
    ]);
    const semanas = sem.rows.map(w => ({ ...w, vencida: w.fin < hoy, perdida: w.fin < hoy && !w.con_orden }));
    const perdidas = semanas.filter(w => w.perdida).length;
    res.json({ ...cli, direcciones: dirs.rows, ordenes: ords.rows, membresia: memb.rows[0] || null, stats: st.rows[0],
      continuidad_info: { activa: !!cli.continuidad, semanas, semanas_con_orden: semanas.filter(w => w.con_orden).length, semanas_perdidas: perdidas, elegible: !!cli.continuidad && perdidas === 0 } });
  } catch (e) { fail(res, e); }
};

const create = async (req, res) => {
  try {
    const b = req.body;
    if (!b.nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const { rows } = await db.query(`INSERT INTO clientes (local_id,tipo,nombre,apellido,telefono,email,id_fiscal,razon_social,giro,contacto,tipo_doc,plazo_pago,observaciones,fecha_nacimiento,continuidad,es_ladys2,ghl_contact_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [req.user.local_id, b.tipo || 'PARTICULAR', b.nombre, b.apellido || null, b.telefono || null, b.email || null, b.id_fiscal || null, b.razon_social || null, b.giro || null,
       b.contacto || null, b.tipo_doc || 'BOLETA', Number(b.plazo_pago || 0), b.observaciones || null, b.fecha_nacimiento || null, !!b.continuidad, !!b.es_ladys2, b.ghl_contact_id || null]);
    const cli = rows[0];
    if (b.direccion && b.direccion.calle) await db.query('INSERT INTO direcciones_clientes (cliente_id,ciudad,sector,calle,numero,otro,es_principal) VALUES ($1,$2,$3,$4,$5,$6,TRUE)',
      [cli.id, b.direccion.ciudad || 'Concón', b.direccion.sector || null, b.direccion.calle, b.direccion.numero || null, b.direccion.otro || null]);
    res.status(201).json(cli);
  } catch (e) { fail(res, e); }
};

const update = async (req, res) => {
  try {
    const sets = [], vals = [req.params.id, req.user.local_id];
    for (const k of CAMPOS) if (k in req.body) { vals.push(req.body[k] === '' ? null : req.body[k]); sets.push(`${k}=$${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
    const { rows } = await db.query(`UPDATE clientes SET ${sets.join(', ')} WHERE id=$1 AND local_id=$2 RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (e) { fail(res, e); }
};

const remove = async (req, res) => {
  try { await db.query('UPDATE clientes SET activo=FALSE WHERE id=$1 AND local_id=$2', [req.params.id, req.user.local_id]); res.json({ ok: true }); }
  catch (e) { fail(res, e); }
};

const addDireccion = async (req, res) => {
  try {
    const b = req.body, cid = req.params.cliente_id;
    if (!b.calle) return res.status(400).json({ error: 'Calle requerida' });
    if (b.es_principal) await db.query('UPDATE direcciones_clientes SET es_principal=FALSE WHERE cliente_id=$1', [cid]);
    const { rows } = await db.query('INSERT INTO direcciones_clientes (cliente_id,ciudad,sector,calle,numero,otro,lat,lng,es_principal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [cid, b.ciudad || 'Concón', b.sector || null, b.calle, b.numero || null, b.otro || null, b.lat || null, b.lng || null, !!b.es_principal]);
    res.status(201).json(rows[0]);
  } catch (e) { fail(res, e); }
};

const removeDireccion = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT COUNT(*) AS n FROM ordenes WHERE dir_recogida_id=$1 OR dir_entrega_id=$1', [req.params.id]);
    if (Number(rows[0].n) > 0) return res.status(400).json({ error: 'La dirección está usada en órdenes; no se puede borrar' });
    await db.query('DELETE FROM direcciones_clientes WHERE id=$1 AND cliente_id=$2', [req.params.id, req.params.cliente_id]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
};

module.exports = { getAll, getById, create, update, remove, addDireccion, removeDireccion };
