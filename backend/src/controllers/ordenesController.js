const db = require('../config/db');

const ESTADOS = ['PRE_ORDEN', 'EN_PROCESO', 'LISTA', 'ENTREGADA', 'ANULADA'];
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const hoyChile = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const diaSemana = f => (f ? DIAS[new Date(f + 'T12:00:00').getDay()] : '');
const estadoPago = (t, a) => (Number(a) <= 0 ? 'PENDIENTE' : Number(a) >= Number(t) ? 'PAGADA' : 'PARCIAL');
const normTel = t => { const d = String(t || '').replace(/\D/g, ''); if (d.startsWith('56') && d.length === 11) return d; if (d.length === 9) return '56' + d; if (d.length === 8) return '569' + d; return d; };
const DIR = a => `${a}.calle||' '||COALESCE(${a}.numero::text,'')||COALESCE(', '||NULLIF(${a}.otro,''),'')||COALESCE(' — '||NULLIF(${a}.sector,''),'')||COALESCE(', '||NULLIF(${a}.ciudad,''),'')`;
const cfg = async (c, k, d) => { const r = await c.query('SELECT valor FROM configuracion WHERE clave=$1', [k]); return r.rows[0] ? Number(r.rows[0].valor) : d; };
const fail = (res, e, code = 500) => res.status(code).json({ error: e.message });
const historial = (c, id, estado, nota, uid) => c.query('INSERT INTO ordenes_historial (orden_id,estado,nota,usuario_id) VALUES ($1,$2,$3,$4)', [id, estado, nota || null, uid || null]);

async function recalcular(c, id) {
  const { rows: [o] } = await c.query('SELECT * FROM ordenes WHERE id=$1', [id]);
  const { rows: [s] } = await c.query('SELECT COALESCE(SUM(subtotal),0) AS st FROM orden_items WHERE orden_id=$1', [id]);
  const subtotal = Number(s.st), descuento = Math.round(subtotal * Number(o.descuento_pct || 0) / 100);
  const total = subtotal - descuento + Number(o.monto_delivery || 0), saldo = total - Number(o.monto_abonado || 0);
  await c.query('UPDATE ordenes SET subtotal=$2, descuento_monto=$3, monto_total=$4, saldo_pendiente=$5, estado_pago=$6 WHERE id=$1',
    [id, subtotal, descuento, total, saldo, estadoPago(total, o.monto_abonado)]);
  return { subtotal, descuento, total, saldo };
}

async function aplicarPago(c, ordenId, formaPagoId, monto, referencia, uid) {
  const { rows: [o] } = await c.query('SELECT * FROM ordenes WHERE id=$1 FOR UPDATE', [ordenId]);
  if (!o) throw new Error('Orden no encontrada');
  monto = Math.round(Number(monto));
  if (!(monto > 0)) throw new Error('Monto inválido');
  if (monto > Number(o.saldo_pendiente) + 1) throw new Error(`El pago excede el saldo pendiente ($${Math.round(o.saldo_pendiente).toLocaleString('es-CL')})`);
  await c.query('INSERT INTO pagos (orden_id,cliente_id,forma_pago_id,monto,referencia,usuario_id) VALUES ($1,$2,$3,$4,$5,$6)',
    [ordenId, o.cliente_id, formaPagoId || null, monto, referencia || null, uid || null]);
  const abonado = Number(o.monto_abonado) + monto, saldo = Number(o.monto_total) - abonado, ep = estadoPago(o.monto_total, abonado);
  await c.query("UPDATE ordenes SET monto_abonado=$2, saldo_pendiente=$3, estado_pago=$4, pagada_el=CASE WHEN $4='PAGADA' THEN COALESCE(pagada_el,NOW()) ELSE pagada_el END WHERE id=$1",
    [ordenId, abonado, saldo, ep]);
  return { abonado, saldo, estado_pago: ep };
}

async function insertarItems(c, ordenId, items) {
  for (const it of items) {
    const cant = Number(it.cantidad), pu = Number(it.precio_unit);
    if (!(cant > 0) || !it.nombre) continue;
    await c.query('INSERT INTO orden_items (orden_id,servicio_id,nombre,cantidad,precio_unit,subtotal,etiqueta) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [ordenId, it.servicio_id || null, it.nombre, cant, pu, Math.round(cant * pu), it.etiqueta || null]);
  }
}

// ── LISTAR ────────────────────────────────────────────────────────────────
const listar = async (req, res) => {
  try {
    const { estado, desde, hasta, q, fecha_retiro, fecha_entrega, ladys2, cliente_id } = req.query;
    let sql = `SELECT o.*, c.nombre||' '||COALESCE(c.apellido,'') AS cliente_nombre, c.telefono AS cliente_telefono, c.tipo AS cliente_tipo,
        rr.nombre AS ruta_retiro, re.nombre AS ruta_entrega,
        (SELECT string_agg(i.nombre||' x'||to_char(i.cantidad,'FM999990.##'), ', ') FROM orden_items i WHERE i.orden_id=o.id) AS resumen_items
      FROM ordenes o JOIN clientes c ON o.cliente_id=c.id
      LEFT JOIN rutas rr ON o.ruta_recogida_id=rr.id LEFT JOIN rutas re ON o.ruta_entrega_id=re.id
      WHERE o.local_id=$1`;
    const p = [req.user.local_id];
    const add = (frag, v) => { p.push(v); sql += frag.replace('?', '$' + p.length); };
    if (ladys2 !== '1') sql += ' AND c.es_ladys2=FALSE';
    if (estado) add(' AND o.estado = ANY(?::text[])', String(estado).split(','));
    if (cliente_id) add(' AND o.cliente_id=?', cliente_id);
    if (desde) add(' AND DATE(o.creado_en)>=?', desde);
    if (hasta) add(' AND DATE(o.creado_en)<=?', hasta);
    if (fecha_retiro) add(' AND o.fecha_recogida=?', fecha_retiro);
    if (fecha_entrega) add(' AND o.fecha_entrega=?', fecha_entrega);
    if (q) { p.push(`%${q}%`); const n = '$' + p.length; sql += ` AND (c.nombre ILIKE ${n} OR c.apellido ILIKE ${n} OR c.telefono ILIKE ${n} OR CAST(o.id AS TEXT) LIKE ${n} OR COALESCE(o.ot_easylaundry,'') ILIKE ${n})`; }
    sql += ' ORDER BY o.creado_en DESC LIMIT 300';
    const { rows } = await db.query(sql, p);
    res.json(rows);
  } catch (e) { fail(res, e); }
};

// ── RESUMEN (contadores del día) ──────────────────────────────────────────
const resumen = async (req, res) => {
  try {
    const hoy = req.query.fecha || hoyChile();
    const { rows: [r] } = await db.query(`SELECT
        COUNT(*) FILTER (WHERE o.estado='PRE_ORDEN')  AS pre_orden,
        COUNT(*) FILTER (WHERE o.estado='EN_PROCESO') AS en_proceso,
        COUNT(*) FILTER (WHERE o.estado='LISTA')      AS lista,
        COUNT(*) FILTER (WHERE o.estado='ENTREGADA' AND DATE(o.entregada_el)=$2) AS entregadas_hoy,
        COUNT(*) FILTER (WHERE o.estado='ENTREGADA')  AS entregadas,
        COUNT(*) FILTER (WHERE o.fecha_recogida=$2 AND o.estado='PRE_ORDEN') AS retiros_hoy,
        COUNT(*) FILTER (WHERE o.fecha_entrega=$2 AND o.estado IN ('EN_PROCESO','LISTA') AND o.entrega_domicilio) AS entregas_hoy,
        COUNT(*) FILTER (WHERE o.fecha_entrega<$2 AND o.estado IN ('EN_PROCESO','LISTA')) AS atrasadas,
        COALESCE(SUM(o.saldo_pendiente) FILTER (WHERE o.estado<>'ANULADA'),0) AS por_cobrar,
        COALESCE(SUM(o.monto_total) FILTER (WHERE DATE(o.creado_en)=$2 AND o.estado<>'ANULADA'),0) AS ventas_hoy,
        COALESCE(SUM(o.kilos) FILTER (WHERE DATE(o.creado_en)=$2 AND o.estado<>'ANULADA'),0) AS kilos_hoy
      FROM ordenes o JOIN clientes c ON o.cliente_id=c.id WHERE o.local_id=$1 AND c.es_ladys2=FALSE`, [req.user.local_id, hoy]);
    res.json({ fecha: hoy, ...r });
  } catch (e) { fail(res, e); }
};

// ── OBTENER ───────────────────────────────────────────────────────────────
const obtener = async (req, res) => {
  try {
    const id = req.params.id;
    const { rows } = await db.query(`SELECT o.*, c.nombre||' '||COALESCE(c.apellido,'') AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email,
        c.tipo AS cliente_tipo, c.plazo_pago, c.continuidad AS cliente_continuidad, u.nombre AS usuario_nombre,
        rr.nombre AS ruta_retiro, rr.hora_inicio AS ruta_retiro_hora, re.nombre AS ruta_entrega, re.hora_inicio AS ruta_entrega_hora,
        ${DIR('dr')} AS direccion_retiro, ${DIR('de')} AS direccion_entrega
      FROM ordenes o JOIN clientes c ON o.cliente_id=c.id LEFT JOIN usuarios u ON o.usuario_id=u.id
      LEFT JOIN rutas rr ON o.ruta_recogida_id=rr.id LEFT JOIN rutas re ON o.ruta_entrega_id=re.id
      LEFT JOIN direcciones_clientes dr ON dr.id=o.dir_recogida_id LEFT JOIN direcciones_clientes de ON de.id=o.dir_entrega_id
      WHERE o.id=$1 AND o.local_id=$2`, [id, req.user.local_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' });
    const [items, pagos, hist] = await Promise.all([
      db.query('SELECT * FROM orden_items WHERE orden_id=$1 ORDER BY id', [id]),
      db.query('SELECT p.*, f.nombre AS forma_nombre FROM pagos p LEFT JOIN formas_pago f ON p.forma_pago_id=f.id WHERE p.orden_id=$1 ORDER BY p.id', [id]),
      db.query('SELECT h.*, u.nombre AS usuario_nombre FROM ordenes_historial h LEFT JOIN usuarios u ON h.usuario_id=u.id WHERE h.orden_id=$1 ORDER BY h.id', [id]),
    ]);
    res.json({ ...rows[0], items: items.rows, pagos: pagos.rows, historial: hist.rows });
  } catch (e) { fail(res, e); }
};

// ── CREAR ─────────────────────────────────────────────────────────────────
const crear = async (req, res) => {
  const c = await db.connect();
  try {
    const b = req.body, lid = req.user.local_id, items = Array.isArray(b.items) ? b.items : [];
    if (!b.cliente_id) return res.status(400).json({ error: 'Cliente requerido' });
    if (!items.length) return res.status(400).json({ error: 'Agrega kilos o prendas a la orden' });
    await c.query('BEGIN');
    const minimo = await cfg(c, 'minimo_retiro', 20000), pctCont = await cfg(c, 'descuento_continuidad', 10);
    const subtotal = items.reduce((s, i) => s + Math.round(Number(i.cantidad || 0) * Number(i.precio_unit || 0)), 0);
    const pct = b.aplicar_descuento ? pctCont : Number(b.descuento_pct || 0);
    const descuento = Math.round(subtotal * pct / 100), delivery = Math.round(Number(b.monto_delivery || 0)), total = subtotal - descuento + delivery;
    const domicilio = !!(b.retiro_domicilio || b.entrega_domicilio);
    if (domicilio && total < minimo && !b.forzar) {
      await c.query('ROLLBACK');
      return res.status(422).json({ codigo: 'MINIMO', error: `El mínimo para servicio a domicilio es $${minimo.toLocaleString('es-CL')} (esta orden suma $${total.toLocaleString('es-CL')})` });
    }
    const estado = ESTADOS.includes(b.estado_inicial) ? b.estado_inicial : (b.retiro_domicilio && !b.ropa_en_local ? 'PRE_ORDEN' : 'EN_PROCESO');
    const origen = b.origen || (b.retiro_domicilio ? 'DOMICILIO' : 'LOCAL');
    const { rows: [o] } = await c.query(`INSERT INTO ordenes (local_id,cliente_id,usuario_id,tipo_doc,estado,estado_pago,origen,tipo_servicio,kilos,
        retiro_domicilio,entrega_domicilio,dir_recogida_id,dir_entrega_id,fecha_recogida,ruta_recogida_id,fecha_entrega,ruta_entrega_id,bultos,observaciones,
        descuento_pct,monto_delivery,monto_total,monto_abonado,saldo_pendiente,es_membresia,es_pre_orden,recibida_el)
      VALUES ($1,$2,$3,$4,$5,'PENDIENTE',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,0,0,0,$21,$5='PRE_ORDEN',
              CASE WHEN $5='EN_PROCESO' THEN NOW() ELSE NULL END) RETURNING id`,
      [lid, b.cliente_id, req.user.id, b.tipo_doc || 'BOLETA', estado, origen, b.tipo_servicio || 'NORMAL', Number(b.kilos || 0),
       !!b.retiro_domicilio, !!b.entrega_domicilio, b.dir_recogida_id || null, b.dir_entrega_id || null, b.fecha_recogida || null, b.ruta_recogida_id || null,
       b.fecha_entrega || null, b.ruta_entrega_id || null, Number(b.bultos || 1), b.observaciones || null, pct, delivery, !!b.es_membresia]);
    await insertarItems(c, o.id, items);
    await recalcular(c, o.id);
    await historial(c, o.id, estado, `Orden creada (${origen.toLowerCase()})${pct ? ` · descuento continuidad ${pct}%` : ''}`, req.user.id);
    if (b.pago && Number(b.pago.monto) > 0) {
      await aplicarPago(c, o.id, b.pago.forma_pago_id, b.pago.monto, b.pago.referencia, req.user.id);
      await historial(c, o.id, null, `Pago al ingreso $${Math.round(Number(b.pago.monto)).toLocaleString('es-CL')}`, req.user.id);
    }
    const { rows: [full] } = await c.query('SELECT * FROM ordenes WHERE id=$1', [o.id]);
    await c.query('COMMIT');
    res.status(201).json(full);
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); fail(res, e); } finally { c.release(); }
};

// ── ACTUALIZAR (logística, ítems, descuento) ──────────────────────────────
const actualizar = async (req, res) => {
  const c = await db.connect();
  try {
    const id = req.params.id, b = req.body;
    await c.query('BEGIN');
    const { rows: [o] } = await c.query('SELECT * FROM ordenes WHERE id=$1 AND local_id=$2 FOR UPDATE', [id, req.user.local_id]);
    if (!o) { await c.query('ROLLBACK'); return res.status(404).json({ error: 'Orden no encontrada' }); }
    if (o.estado === 'ANULADA') { await c.query('ROLLBACK'); return res.status(400).json({ error: 'La orden está anulada' }); }
    if (o.estado === 'ENTREGADA' && Array.isArray(b.items)) { await c.query('ROLLBACK'); return res.status(400).json({ error: 'No se pueden editar los ítems de una orden ya entregada' }); }
    if (b.aplicar_descuento !== undefined) b.descuento_pct = b.aplicar_descuento ? await cfg(c, 'descuento_continuidad', 10) : 0;
    const campos = ['tipo_doc','fecha_recogida','ruta_recogida_id','fecha_entrega','ruta_entrega_id','dir_recogida_id','dir_entrega_id','observaciones','bultos','kilos','tipo_servicio','retiro_domicilio','entrega_domicilio','monto_delivery','descuento_pct','origen','ot_easylaundry'];
    const sets = [], vals = [id];
    for (const k of campos) if (k in b) { vals.push(b[k] === '' ? null : b[k]); sets.push(`${k}=$${vals.length}`); }
    if (sets.length) await c.query(`UPDATE ordenes SET ${sets.join(', ')} WHERE id=$1`, vals);
    if (Array.isArray(b.items)) { await c.query('DELETE FROM orden_items WHERE orden_id=$1', [id]); await insertarItems(c, id, b.items); }
    const tot = await recalcular(c, id);
    await historial(c, id, null, b.nota || `Orden editada · total $${tot.total.toLocaleString('es-CL')}`, req.user.id);
    const { rows } = await c.query('SELECT * FROM ordenes WHERE id=$1', [id]);
    await c.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); fail(res, e); } finally { c.release(); }
};

// ── CAMBIAR ESTADO ────────────────────────────────────────────────────────
const cambiarEstado = async (req, res) => {
  const c = await db.connect();
  try {
    const { estado, nota, motivo_anulacion } = req.body, id = req.params.id;
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    await c.query('BEGIN');
    const { rows: [o] } = await c.query('SELECT * FROM ordenes WHERE id=$1 AND local_id=$2 FOR UPDATE', [id, req.user.local_id]);
    if (!o) { await c.query('ROLLBACK'); return res.status(404).json({ error: 'Orden no encontrada' }); }
    if (o.estado === 'ANULADA') { await c.query('ROLLBACK'); return res.status(400).json({ error: 'La orden ya está anulada' }); }
    const ts = { EN_PROCESO: 'recibida_el', LISTA: 'lista_el', ENTREGADA: 'entregada_el' }[estado];
    let sql = 'UPDATE ordenes SET estado=$2' + (ts ? `, ${ts}=COALESCE(${ts},NOW())` : '');
    const vals = [id, estado];
    if (estado === 'ANULADA') { vals.push(motivo_anulacion || nota || null, req.user.id); sql += ', motivo_anulacion=$3, anulada_por=$4'; }
    if (estado === 'ENTREGADA' && !o.fecha_entrega) sql += ', fecha_entrega=CURRENT_DATE';
    if (estado !== 'PRE_ORDEN') sql += ', es_pre_orden=FALSE';
    sql += ' WHERE id=$1 RETURNING *';
    const { rows } = await c.query(sql, vals);
    await historial(c, id, estado, nota || (estado === 'ANULADA' ? motivo_anulacion : null), req.user.id);
    await c.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); fail(res, e); } finally { c.release(); }
};

// ── PAGO ──────────────────────────────────────────────────────────────────
const registrarPago = async (req, res) => {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const r = await aplicarPago(c, req.params.id, req.body.forma_pago_id, req.body.monto, req.body.referencia, req.user.id);
    await historial(c, req.params.id, null, `Pago $${Math.round(Number(req.body.monto)).toLocaleString('es-CL')}`, req.user.id);
    await c.query('COMMIT');
    res.status(201).json(r);
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); fail(res, e, 400); } finally { c.release(); }
};

// ── PROGRAMACIÓN DEL DÍA (retiros y entregas por ruta) ────────────────────
const programacion = async (req, res) => {
  try {
    const fecha = req.query.fecha || hoyChile(), lid = req.user.local_id, dia = diaSemana(fecha);
    const [rutas, ords, fer] = await Promise.all([
      db.query('SELECT * FROM rutas WHERE local_id=$1 AND activo=TRUE AND dia_semana=$2 ORDER BY hora_inicio', [lid, dia]),
      db.query(`SELECT o.id,o.estado,o.estado_pago,o.saldo_pendiente,o.monto_total,o.kilos,o.bultos,o.fecha_recogida,o.fecha_entrega,o.ruta_recogida_id,o.ruta_entrega_id,
          o.observaciones,o.origen,o.tipo_servicio,o.retiro_domicilio,o.entrega_domicilio,
          c.nombre||' '||COALESCE(c.apellido,'') AS cliente, c.telefono, ${DIR('dr')} AS dir_retiro, ${DIR('de')} AS dir_entrega
        FROM ordenes o JOIN clientes c ON o.cliente_id=c.id
        LEFT JOIN direcciones_clientes dr ON dr.id=o.dir_recogida_id LEFT JOIN direcciones_clientes de ON de.id=o.dir_entrega_id
        WHERE o.local_id=$1 AND o.estado<>'ANULADA' AND c.es_ladys2=FALSE AND (o.fecha_recogida=$2 OR o.fecha_entrega=$2) ORDER BY o.id`, [lid, fecha]),
      db.query('SELECT motivo FROM dias_inhabiles WHERE local_id=$1 AND fecha=$2', [lid, fecha]),
    ]);
    const out = rutas.rows.map(r => {
      const retiros = ords.rows.filter(o => o.fecha_recogida === fecha && o.ruta_recogida_id === r.id);
      const entregas = ords.rows.filter(o => o.fecha_entrega === fecha && o.ruta_entrega_id === r.id && o.entrega_domicilio);
      return { ...r, retiros, entregas, usados: retiros.length + entregas.length, cupos: Math.max(0, Number(r.puntos_disp) - retiros.length - entregas.length) };
    });
    const sin_ruta = ords.rows.filter(o => (o.fecha_recogida === fecha && o.retiro_domicilio && !o.ruta_recogida_id) || (o.fecha_entrega === fecha && o.entrega_domicilio && !o.ruta_entrega_id));
    const en_local = ords.rows.filter(o => o.fecha_entrega === fecha && !o.entrega_domicilio && o.estado !== 'ENTREGADA');
    res.json({ fecha, dia, feriado: fer.rows[0]?.motivo || null, rutas: out, sin_ruta, en_local });
  } catch (e) { fail(res, e); }
};

// ── DISPONIBILIDAD DE RUTAS (para el formulario y para SofIA) ─────────────
const disponibilidad = async (req, res) => {
  try {
    const fecha = req.query.fecha || hoyChile(), lid = req.user.local_id, dia = diaSemana(fecha);
    const { rows } = await db.query(`SELECT r.*, (SELECT COUNT(*) FROM ordenes o WHERE o.local_id=r.local_id AND o.estado<>'ANULADA'
        AND ((o.fecha_recogida=$2 AND o.ruta_recogida_id=r.id) OR (o.fecha_entrega=$2 AND o.ruta_entrega_id=r.id))) AS usados
      FROM rutas r WHERE r.local_id=$1 AND r.activo=TRUE AND r.dia_semana=$3 ORDER BY r.hora_inicio`, [lid, fecha, dia]);
    const fer = await db.query('SELECT motivo FROM dias_inhabiles WHERE local_id=$1 AND fecha=$2', [lid, fecha]);
    res.json({ fecha, dia, feriado: fer.rows[0]?.motivo || null, rutas: rows.map(r => ({ ...r, cupos: Math.max(0, Number(r.puntos_disp) - Number(r.usados)) })) });
  } catch (e) { fail(res, e); }
};

// ── SOLICITUD DE RETIRO (mostrador, o SofIA/n8n vía webhook) ──────────────
const solicitarRetiro = async (req, res) => {
  const c = await db.connect();
  try {
    const b = req.body, lid = (req.user && req.user.local_id) || 1, uid = req.user && req.user.id;
    if (!b.fecha || (!b.telefono && !b.cliente_id)) return res.status(400).json({ error: 'fecha y telefono (o cliente_id) son requeridos' });
    await c.query('BEGIN');
    let cli = null, nuevo = false;
    if (b.cliente_id) cli = (await c.query('SELECT * FROM clientes WHERE id=$1', [b.cliente_id])).rows[0];
    if (!cli && b.telefono) cli = (await c.query("SELECT * FROM clientes WHERE local_id=$1 AND activo=TRUE AND regexp_replace(COALESCE(telefono,''),'\\D','','g') LIKE '%'||$2 ORDER BY id LIMIT 1", [lid, normTel(b.telefono).slice(-8)])).rows[0];
    if (!cli) {
      const partes = String(b.nombre || 'Cliente WhatsApp').trim().split(/\s+/);
      cli = (await c.query('INSERT INTO clientes (local_id,tipo,nombre,apellido,telefono,email,ghl_contact_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [lid, 'PARTICULAR', partes[0], partes.slice(1).join(' ') || null, b.telefono, b.email || null, b.ghl_contact_id || null])).rows[0];
      nuevo = true;
    } else if (b.ghl_contact_id && !cli.ghl_contact_id) await c.query('UPDATE clientes SET ghl_contact_id=$2 WHERE id=$1', [cli.id, b.ghl_contact_id]);
    let dir = null;
    if (b.dir_id) dir = (await c.query('SELECT * FROM direcciones_clientes WHERE id=$1 AND cliente_id=$2', [b.dir_id, cli.id])).rows[0];
    if (!dir && b.calle) {
      dir = (await c.query("SELECT * FROM direcciones_clientes WHERE cliente_id=$1 AND LOWER(calle)=LOWER($2) AND COALESCE(numero,'')=$3 LIMIT 1", [cli.id, b.calle, String(b.numero || '')])).rows[0]
         || (await c.query('INSERT INTO direcciones_clientes (cliente_id,ciudad,sector,calle,numero,otro,es_principal) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
              [cli.id, b.comuna || b.ciudad || 'Concón', b.sector || null, b.calle, b.numero || null, b.otro || b.depto || null, true])).rows[0];
    }
    if (!dir) dir = (await c.query('SELECT * FROM direcciones_clientes WHERE cliente_id=$1 ORDER BY es_principal DESC, id DESC LIMIT 1', [cli.id])).rows[0];
    if (!dir) { await c.query('ROLLBACK'); return res.status(422).json({ codigo: 'SIN_DIRECCION', error: 'El cliente no tiene dirección; envía calle y número', cliente_id: cli.id }); }
    const dia = diaSemana(b.fecha);
    const fer = (await c.query('SELECT motivo FROM dias_inhabiles WHERE local_id=$1 AND fecha=$2', [lid, b.fecha])).rows[0];
    if (fer && !b.forzar) { await c.query('ROLLBACK'); return res.status(422).json({ codigo: 'FERIADO', error: `El ${b.fecha} es feriado (${fer.motivo}): no hay ruta` }); }
    const rutas = (await c.query("SELECT * FROM rutas WHERE local_id=$1 AND activo=TRUE AND dia_semana=$2 AND tipo IN ('RETIROS_Y_ENTREGAS','SOLO_RETIROS') ORDER BY hora_inicio", [lid, dia])).rows;
    const ruta = b.ruta_id ? rutas.find(r => r.id === Number(b.ruta_id)) : b.slot ? rutas.find(r => String(r.hora_inicio).startsWith(String(b.slot).slice(0, 5))) : rutas[0];
    if (!ruta) { await c.query('ROLLBACK'); return res.status(422).json({ codigo: 'SIN_RUTA', error: `No hay ruta de retiro el ${dia.toLowerCase()} ${b.fecha}`, rutas: rutas.map(r => r.nombre) }); }
    const { rows: [u] } = await c.query("SELECT COUNT(*) AS n FROM ordenes WHERE local_id=$1 AND estado<>'ANULADA' AND ((fecha_recogida=$2 AND ruta_recogida_id=$3) OR (fecha_entrega=$2 AND ruta_entrega_id=$3))", [lid, b.fecha, ruta.id]);
    if (Number(u.n) >= Number(ruta.puntos_disp) && !b.forzar) { await c.query('ROLLBACK'); return res.status(422).json({ codigo: 'RUTA_LLENA', error: `La ruta ${ruta.nombre} del ${b.fecha} está completa` }); }
    const origen = b.origen || (uid ? 'DOMICILIO' : 'SOFIA');
    const { rows: [o] } = await c.query(`INSERT INTO ordenes (local_id,cliente_id,usuario_id,estado,estado_pago,origen,tipo_servicio,retiro_domicilio,entrega_domicilio,
        dir_recogida_id,dir_entrega_id,fecha_recogida,ruta_recogida_id,observaciones,es_pre_orden,monto_total,monto_abonado,saldo_pendiente,subtotal)
      VALUES ($1,$2,$3,'PRE_ORDEN','PENDIENTE',$4,$5,TRUE,TRUE,$6,$6,$7,$8,$9,TRUE,0,0,0,0) RETURNING *`,
      [lid, cli.id, uid || null, origen, b.express ? 'EXPRESS' : 'NORMAL', dir.id, b.fecha, ruta.id, b.observaciones || null]);
    await historial(c, o.id, 'PRE_ORDEN', `Solicitud de retiro vía ${origen === 'SOFIA' ? 'SofIA/WhatsApp' : 'mostrador'} — ${ruta.nombre} del ${b.fecha}`, uid);
    await c.query('COMMIT');
    res.status(201).json({ ok: true, ot: o.id, ot_texto: '#' + String(o.id).padStart(5, '0'), fecha: b.fecha, ruta: ruta.nombre,
      hora: `${String(ruta.hora_inicio).slice(0, 5)}–${String(ruta.hora_fin).slice(0, 5)}`, cliente: `${cli.nombre} ${cli.apellido || ''}`.trim(),
      cliente_nuevo: nuevo, direccion: `${dir.calle} ${dir.numero || ''}${dir.otro ? ', ' + dir.otro : ''}`.trim() });
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); fail(res, e); } finally { c.release(); }
};

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────
const getConfigAll = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT clave, valor, descripcion FROM configuracion ORDER BY clave');
    const obj = {}; rows.forEach(r => { obj[r.clave] = r.valor; });
    res.json({ ...obj, _lista: rows });
  } catch (e) { fail(res, e); }
};
const setConfig = async (req, res) => {
  try {
    for (const [k, v] of Object.entries(req.body)) if (!k.startsWith('_'))
      await db.query('INSERT INTO configuracion (clave,valor) VALUES ($1,$2) ON CONFLICT (clave) DO UPDATE SET valor=EXCLUDED.valor', [k, String(v)]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
};

module.exports = { listar, resumen, obtener, crear, actualizar, cambiarEstado, registrarPago, programacion, disponibilidad, solicitarRetiro, getConfigAll, setConfig, hoyChile };
