const db = require('../config/db');
const hoyChile = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

const getDashboard = async (req, res) => {
  try {
    const lid = req.user.local_id, hoy = hoyChile();
    const BASE = "FROM ordenes o JOIN clientes c ON o.cliente_id=c.id WHERE o.local_id=$1 AND c.es_ladys2=FALSE AND o.estado<>'ANULADA'";
    const [kpis, ventasDiarias, topServicios, estadoOrdenes, mesAnt] = await Promise.all([
      db.query(`SELECT
          COALESCE(SUM(o.monto_total) FILTER (WHERE DATE(o.creado_en)=$2),0) AS ventas_hoy,
          COALESCE(SUM(o.monto_total) FILTER (WHERE date_trunc('month',o.creado_en)=date_trunc('month',$2::date)),0) AS ventas_mes,
          COUNT(*) FILTER (WHERE DATE(o.creado_en)=$2) AS ordenes_hoy,
          COUNT(*) FILTER (WHERE date_trunc('month',o.creado_en)=date_trunc('month',$2::date)) AS ordenes_mes,
          COUNT(*) FILTER (WHERE o.estado='PRE_ORDEN') AS pre_ordenes,
          COUNT(*) FILTER (WHERE o.estado='EN_PROCESO') AS en_proceso,
          COUNT(*) FILTER (WHERE o.estado='LISTA') AS listas,
          COUNT(*) FILTER (WHERE o.estado='ENTREGADA' AND DATE(o.entregada_el)=$2) AS entregadas_hoy,
          COALESCE(SUM(o.saldo_pendiente),0) AS por_cobrar,
          COALESCE(SUM(o.kilos) FILTER (WHERE date_trunc('month',o.creado_en)=date_trunc('month',$2::date)),0) AS kilos_mes,
          (SELECT COUNT(*) FROM clientes WHERE local_id=$1 AND activo=TRUE AND es_ladys2=FALSE) AS total_clientes
        ${BASE}`, [lid, hoy]),
      db.query(`SELECT DATE(o.creado_en) AS fecha, COALESCE(SUM(o.monto_total),0) AS total, COUNT(*) AS ordenes
        ${BASE} AND o.creado_en >= ($2::date - INTERVAL '29 days') GROUP BY 1 ORDER BY 1`, [lid, hoy]),
      db.query(`SELECT i.nombre, SUM(i.cantidad) AS cantidad, SUM(i.subtotal) AS total
        FROM orden_items i JOIN ordenes o ON i.orden_id=o.id JOIN clientes c ON o.cliente_id=c.id
        WHERE o.local_id=$1 AND c.es_ladys2=FALSE AND o.estado<>'ANULADA' AND date_trunc('month',o.creado_en)=date_trunc('month',$2::date)
        GROUP BY i.nombre ORDER BY total DESC LIMIT 8`, [lid, hoy]),
      db.query(`SELECT o.estado, COUNT(*) AS cantidad ${BASE} GROUP BY o.estado`, [lid]),
      db.query(`SELECT COALESCE(SUM(o.monto_total),0) AS total ${BASE} AND date_trunc('month',o.creado_en)=date_trunc('month',$2::date - INTERVAL '1 month')`, [lid, hoy]),
    ]);
    res.json({ fecha: hoy, kpis: kpis.rows[0], ventasDiarias: ventasDiarias.rows, topServicios: topServicios.rows, estadoOrdenes: estadoOrdenes.rows, ventasMesAnterior: mesAnt.rows[0].total });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getDashboard };
