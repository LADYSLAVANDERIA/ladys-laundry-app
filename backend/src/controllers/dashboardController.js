const db = require('../config/db');

const getDashboard = async (req, res) => {
  try {
    const lid = req.user.local_id;
    const hoy = new Date().toISOString().split('T')[0];
    const inicioMes = hoy.substring(0,8) + '01';
    const mesAnt = new Date(); mesAnt.setMonth(mesAnt.getMonth()-1);
    const inicioMesAnt = mesAnt.toISOString().substring(0,8) + '01';
    const finMesAnt = new Date(mesAnt.getFullYear(), mesAnt.getMonth()+1, 0).toISOString().split('T')[0];

    const [kpis, ventasDia, topServicios, estadosHoy, ventasMesAnt] = await Promise.all([
      db.query(`SELECT
        (SELECT COUNT(*) FROM clientes WHERE local_id=$1 AND activo=TRUE) as total_clientes,
        (SELECT COUNT(*) FROM ordenes WHERE local_id=$1 AND estado!='ANULADA' AND DATE(creado_en)=$2) as ordenes_hoy,
        (SELECT COALESCE(SUM(monto_total),0) FROM ordenes WHERE local_id=$1 AND estado!='ANULADA' AND DATE(creado_en) BETWEEN $3 AND $2) as ventas_mes,
        (SELECT COUNT(*) FROM ordenes WHERE local_id=$1 AND estado='EN_PROCESO') as en_proceso,
        (SELECT COUNT(*) FROM ordenes WHERE local_id=$1 AND estado='LISTA') as listas,
        (SELECT COUNT(*) FROM ordenes WHERE local_id=$1 AND estado='PRE_ORDEN') as pre_ordenes`, [lid, hoy, inicioMes]),
      db.query(`SELECT DATE(creado_en) as fecha, COALESCE(SUM(monto_total),0) as ventas, COUNT(*) as ordenes
        FROM ordenes WHERE local_id=$1 AND estado!='ANULADA' AND DATE(creado_en) BETWEEN $2 AND $3
        GROUP BY DATE(creado_en) ORDER BY fecha`, [lid, inicioMes, hoy]),
      db.query(`SELECT oi.nombre, COUNT(*) as cantidad, SUM(oi.subtotal) as total
        FROM orden_items oi JOIN ordenes o ON oi.orden_id=o.id
        WHERE o.local_id=$1 AND o.estado!='ANULADA' AND DATE(o.creado_en) BETWEEN $2 AND $3
        GROUP BY oi.nombre ORDER BY cantidad DESC LIMIT 8`, [lid, inicioMes, hoy]),
      db.query(`SELECT estado, COUNT(*) as cantidad FROM ordenes WHERE local_id=$1 AND estado!='ANULADA' GROUP BY estado`, [lid]),
      db.query(`SELECT DATE(creado_en) as fecha, COALESCE(SUM(monto_total),0) as ventas
        FROM ordenes WHERE local_id=$1 AND estado!='ANULADA' AND DATE(creado_en) BETWEEN $2 AND $3
        GROUP BY DATE(creado_en) ORDER BY fecha`, [lid, inicioMesAnt, finMesAnt]),
    ]);

    res.json({
      kpis: kpis.rows[0],
      ventasDiarias: ventasDia.rows,
      topServicios: topServicios.rows,
      estadoOrdenes: estadosHoy.rows,
      ventasMesAnterior: ventasMesAnt.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getDashboard };
