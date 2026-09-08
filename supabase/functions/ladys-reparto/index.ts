// Ladys — reparto del día: paradas, recorrido óptimo y avance del conductor
import postgres from "npm:postgres@3.4.4";
import * as jose from "npm:jose@5.9.6";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
});
const SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET") || "ladys_jwt_secret_super_seguro_2024");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

// ── distancia en km entre dos puntos (Haversine) ──
const rad = (g: number) => (g * Math.PI) / 180;
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// la calle nunca es línea recta: factor de rodeo urbano
const RODEO = 1.35;

// ── arma las paradas del día a partir de las órdenes ──
async function sincronizar(fecha: string) {
  await SQL`
    INSERT INTO reparto_paradas (fecha, orden_id, tipo, ruta_id, direccion_id, lat, lng)
    SELECT ${fecha}::date, o.id, 'RETIRO', o.ruta_recogida_id, d.id, d.lat, d.lng
    FROM ordenes o
    LEFT JOIN LATERAL (
      SELECT dc.id, dc.lat, dc.lng FROM direcciones_clientes dc
      WHERE dc.id = o.dir_recogida_id
      UNION ALL
      SELECT dc.id, dc.lat, dc.lng FROM direcciones_clientes dc
      WHERE o.dir_recogida_id IS NULL AND dc.cliente_id = o.cliente_id AND dc.es_principal
      LIMIT 1
    ) d ON TRUE
    WHERE o.fecha_recogida = ${fecha}::date AND o.retiro_domicilio AND o.estado <> 'ANULADA'
      AND o.recibida_el IS NULL AND o.retirada_el IS NULL
    ON CONFLICT (fecha, orden_id, tipo) DO UPDATE
      SET direccion_id = EXCLUDED.direccion_id, lat = EXCLUDED.lat, lng = EXCLUDED.lng
      WHERE reparto_paradas.estado = 'PENDIENTE'`;

  await SQL`
    INSERT INTO reparto_paradas (fecha, orden_id, tipo, ruta_id, direccion_id, lat, lng)
    SELECT ${fecha}::date, o.id, 'ENTREGA', o.ruta_entrega_id, d.id, d.lat, d.lng
    FROM ordenes o
    LEFT JOIN LATERAL (
      SELECT dc.id, dc.lat, dc.lng FROM direcciones_clientes dc
      WHERE dc.id = o.dir_entrega_id
      UNION ALL
      SELECT dc.id, dc.lat, dc.lng FROM direcciones_clientes dc
      WHERE o.dir_entrega_id IS NULL AND dc.cliente_id = o.cliente_id AND dc.es_principal
      LIMIT 1
    ) d ON TRUE
    WHERE o.fecha_entrega = ${fecha}::date AND o.entrega_domicilio AND o.estado <> 'ANULADA'
      AND o.entregada_el IS NULL
    ON CONFLICT (fecha, orden_id, tipo) DO UPDATE
      SET direccion_id = EXCLUDED.direccion_id, lat = EXCLUDED.lat, lng = EXCLUDED.lng
      WHERE reparto_paradas.estado = 'PENDIENTE'`;

  // paradas que ya no corresponden (orden anulada o reprogramada) y que nadie tocó
  await SQL`
    DELETE FROM reparto_paradas p
    WHERE p.fecha = ${fecha}::date AND p.estado = 'PENDIENTE'
      AND NOT EXISTS (
        SELECT 1 FROM ordenes o WHERE o.id = p.orden_id AND o.estado <> 'ANULADA'
          AND ((p.tipo = 'RETIRO'  AND o.fecha_recogida = ${fecha}::date AND o.retiro_domicilio
                                    AND o.recibida_el IS NULL AND o.retirada_el IS NULL)
            OR (p.tipo = 'ENTREGA' AND o.fecha_entrega  = ${fecha}::date AND o.entrega_domicilio
                                    AND o.entregada_el IS NULL)))`;
}

// ── paradas del día con todo lo que el conductor necesita ver ──
async function traerDia(fecha: string) {
  return await SQL`
    SELECT p.id, p.orden_id, p.tipo, p.secuencia, p.estado, p.nota,
           p.hora_estimada, p.llegada_real, p.km_tramo, p.min_tramo,
           p.lat, p.lng, p.direccion_id, p.ruta_id,
           r.nombre AS ruta_nombre, r.hora_inicio AS ruta_inicio, r.hora_fin AS ruta_fin,
           o.nro_doc_tributario, o.bultos, o.kilos, o.observaciones,
           o.saldo_pendiente, o.monto_total, o.monto_abonado, o.estado AS estado_orden,
           o.ot_easylaundry, o.token_publico,
           c.id AS cliente_id, c.nombre, c.apellido, c.razon_social, c.telefono, c.es_empresa,
           TRIM(CONCAT_WS(' ', d.calle, d.numero)) AS calle,
           d.otro AS depto, d.sector, d.ciudad, d.geo_precision
    FROM reparto_paradas p
    JOIN ordenes o  ON o.id = p.orden_id
    JOIN clientes c ON c.id = o.cliente_id
    LEFT JOIN direcciones_clientes d ON d.id = p.direccion_id
    LEFT JOIN rutas r ON r.id = p.ruta_id
    WHERE p.fecha = ${fecha}::date
    ORDER BY r.hora_inicio NULLS LAST, (p.secuencia = 0), p.secuencia, p.id`;
}

// ── recorrido óptimo: vecino más cercano desde el local + mejora 2-opt ──
function optimizar(puntos: any[], base: { lat: number; lng: number }) {
  const rest = [...puntos];
  const ruta: any[] = [];
  let act = base;
  while (rest.length) {
    let mejor = 0, mejorD = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const d = km(act.lat, act.lng, rest[i].lat, rest[i].lng);
      if (d < mejorD) { mejorD = d; mejor = i; }
    }
    const p = rest.splice(mejor, 1)[0];
    ruta.push(p); act = p;
  }
  // 2-opt: deshace los cruces que deja el vecino más cercano
  const largo = (r: any[]) => {
    let t = km(base.lat, base.lng, r[0].lat, r[0].lng);
    for (let i = 0; i < r.length - 1; i++) t += km(r[i].lat, r[i].lng, r[i + 1].lat, r[i + 1].lng);
    return t + km(r[r.length - 1].lat, r[r.length - 1].lng, base.lat, base.lng);
  };
  let mejora = true, vueltas = 0;
  while (mejora && vueltas++ < 60) {
    mejora = false;
    for (let i = 0; i < ruta.length - 1; i++) {
      for (let j = i + 1; j < ruta.length; j++) {
        const cand = [...ruta.slice(0, i), ...ruta.slice(i, j + 1).reverse(), ...ruta.slice(j + 1)];
        if (largo(cand) < largo(ruta) - 0.001) { ruta.splice(0, ruta.length, ...cand); mejora = true; }
      }
    }
  }
  return ruta;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-reparto/, "").replace(/\/$/, "") || "/";

  try {
    const h = req.headers.get("authorization") || "";
    const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
    try { await jose.jwtVerify(tok, SECRET); }
    catch { return json({ error: "Token requerido" }, 401); }

    const [cfg] = await SQL`SELECT * FROM reparto_config WHERE id = 1`;

    // GET /dia?fecha=  → paradas del día, ya sincronizadas
    if (req.method === "GET" && (ruta === "/dia" || ruta === "/")) {
      const fecha = url.searchParams.get("fecha");
      if (!fecha) return json({ error: "Falta la fecha" }, 400);
      await sincronizar(fecha);
      const paradas = await traerDia(fecha);
      const hechas = paradas.filter((p: any) => p.estado === "COMPLETADA").length;
      const sinUbicar = paradas.filter((p: any) => p.lat === null).length;
      return json({
        fecha, base: { lat: cfg.lat, lng: cfg.lng, direccion: cfg.direccion },
        total: paradas.length, completadas: hechas, sin_ubicar: sinUbicar, paradas,
      });
    }

    // POST /optimizar { fecha, inicio?, ruta_id? }
    //
    // Se optimiza UNA RUTA A LA VEZ, no el dia completo. Las rutas tienen
    // ventanas distintas -la Intermedia sale 13:30, la Tarde 19:00- y mezclarlas
    // en un solo recorrido le daba a una parada de las 13:30 una hora estimada
    // de las 19:20. Cada ruta arranca del local a su propia hora.
    if (req.method === "POST" && ruta === "/optimizar") {
      const b = await req.json();
      const fecha = b.fecha;
      if (!fecha) return json({ error: "Falta la fecha" }, 400);
      await sincronizar(fecha);
      const todas = await traerDia(fecha);
      const soloRuta = b.ruta_id ? Number(b.ruta_id) : null;

      const candidatas = todas.filter((p: any) =>
        p.lat !== null && p.estado !== "COMPLETADA" &&
        (soloRuta === null || Number(p.ruta_id) === soloRuta));
      if (!candidatas.length) return json({ ok: true, ordenadas: 0, mensaje: "No hay paradas ubicadas que ordenar" });

      // Agrupadas por ruta y en orden de salida
      const grupos = new Map<string, any[]>();
      for (const p of candidatas) {
        const k = String(p.ruta_id ?? "sin");
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k)!.push(p);
      }
      const claves = [...grupos.keys()].sort((a, b2) => {
        const ha = String(grupos.get(a)![0].ruta_inicio || "99:99");
        const hb = String(grupos.get(b2)![0].ruta_inicio || "99:99");
        return ha < hb ? -1 : ha > hb ? 1 : 0;
      });

      const base = { lat: Number(cfg.lat), lng: Number(cfg.lng) };
      // La secuencia sigue siendo unica en el dia, para que el conductor vea una
      // numeracion corrida, pero respeta el orden de las rutas.
      let n = 0, kmDia = 0, minDia = 0;
      const detalle: any[] = [];

      for (const k of claves) {
        const grupo = grupos.get(k)!;
        // Hora de salida: la de la ruta. El campo manual solo manda cuando se
        // esta ordenando una sola ruta a proposito.
        const arranque = (soloRuta !== null && b.inicio)
          ? String(b.inicio)
          : String(grupo[0].ruta_inicio || b.inicio || "16:00").slice(0, 5);
        const [hh, mm] = arranque.split(":").map(Number);
        let reloj = hh * 60 + mm;
        let ant = base, kmRuta = 0;

        const orden = optimizar(grupo.map((p: any) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) })), base);

        await SQL.begin(async (t: any) => {
          for (const p of orden) {
            const d = km(ant.lat, ant.lng, p.lat, p.lng) * RODEO;
            const min = Math.max(2, Math.round((d / cfg.vel_kmh) * 60));
            reloj += min;
            const hora = `${String(Math.floor(reloj / 60) % 24).padStart(2, "0")}:${String(reloj % 60).padStart(2, "0")}`;
            n += 1;
            await t`UPDATE reparto_paradas SET secuencia=${n}, hora_estimada=${hora}::time,
                      km_tramo=${Number(d.toFixed(2))}, min_tramo=${min} WHERE id=${p.id}`;
            await t`UPDATE ordenes SET orden_ruta=${n} WHERE id=${p.orden_id}`;
            reloj += cfg.min_por_parada;
            kmRuta += d;
            ant = p;
          }
        });

        const regreso = km(ant.lat, ant.lng, base.lat, base.lng) * RODEO;
        const minRuta = Math.round(reloj - (hh * 60 + mm) + (regreso / cfg.vel_kmh) * 60);
        kmDia += kmRuta + regreso;
        minDia += minRuta;
        detalle.push({
          ruta_id: grupo[0].ruta_id, ruta: grupo[0].ruta_nombre || "Sin ruta",
          salida: arranque, paradas: orden.length,
          km: Number((kmRuta + regreso).toFixed(1)), min: minRuta,
          termina: `${String(Math.floor((reloj + (regreso / cfg.vel_kmh) * 60) / 60) % 24).padStart(2, "0")}:${String(Math.round(reloj + (regreso / cfg.vel_kmh) * 60) % 60).padStart(2, "0")}`,
        });
      }

      return json({
        ok: true, ordenadas: n, rutas: detalle,
        km_total: Number(kmDia.toFixed(1)), min_total: minDia,
        sin_ubicar: todas.filter((p: any) => p.lat === null).length,
      });
    }

    // POST /parada { id, estado, nota }  → avance del conductor
    if (req.method === "POST" && ruta === "/parada") {
      const b = await req.json();
      if (!b.id || !b.estado) return json({ error: "Faltan datos de la parada" }, 400);
      const ok = ["PENDIENTE", "COMPLETADA", "FALLIDA", "REPROGRAMADA"];
      if (!ok.includes(b.estado)) return json({ error: "Estado inválido" }, 400);
      const [p] = await SQL`UPDATE reparto_paradas
        SET estado=${b.estado},
            nota=COALESCE(${b.nota ?? null}, nota),
            llegada_real=${b.estado === "COMPLETADA" ? SQL`NOW()` : null}
        WHERE id=${b.id} RETURNING *`;
      if (!p) return json({ error: "Parada no encontrada" }, 404);
      if (b.estado === "COMPLETADA") {
        if (p.tipo === "ENTREGA") {
          await SQL`UPDATE ordenes SET estado='ENTREGADA', etapa='ENTREGADO', entregada_el=NOW()
                    WHERE id=${p.orden_id} AND estado <> 'ANULADA'`;
        } else {
          // Retiro cumplido: la ropa salio de la casa del cliente y va en la
          // camioneta. NO esta recepcionada: recepcionar significa que entro por
          // mostrador, se le cargaron los servicios y paso a produccion. Eso lo
          // hace despues el trigger, cuando alguien le carga los items.
          //
          // Se guarda ademas lo que el conductor anota en la puerta: los bultos
          // que recibio y lo que pidio el cliente. Eso se pierde si no queda
          // escrito en el momento, y es justo lo que el taller necesita saber
          // antes de tocar la ropa.
          const nb = Number(b.bultos);
          const bultos = Number.isFinite(nb) && nb > 0 ? Math.round(nb) : null;
          const dicho = String(b.nota_cliente || "").trim();
          const linea = dicho ? `Al retiro: ${dicho}` : null;

          await SQL`UPDATE ordenes
                       SET etapa = CASE WHEN etapa = 'AGENDADO' THEN 'RETIRADO' ELSE etapa END,
                           retirada_el = COALESCE(retirada_el, NOW()),
                           bultos = COALESCE(${bultos}, bultos),
                           observaciones = CASE
                             WHEN ${linea}::text IS NULL THEN observaciones
                             ELSE TRIM(BOTH E'\n' FROM COALESCE(observaciones,'') || E'\n' || ${linea})
                           END,
                           actualizado_en = NOW()
                     WHERE id=${p.orden_id} AND estado <> 'ANULADA'`;

          const resumen = [
            bultos ? `${bultos} bulto${bultos > 1 ? "s" : ""}` : null,
            dicho || null,
          ].filter(Boolean).join(" \u00b7 ");
          await SQL`INSERT INTO ordenes_historial (orden_id, estado, nota)
                    VALUES (${p.orden_id}, 'RETIRADO',
                            ${resumen ? `Retirada en el domicilio. ${resumen}` : "Retirada en el domicilio."})`;
        }
      }
      return json({ ok: true, parada: p });
    }

    // POST /reordenar { fecha, ids }  → orden manual desde la oficina
    if (req.method === "POST" && ruta === "/reordenar") {
      const b = await req.json();
      const ids: number[] = Array.isArray(b.ids) ? b.ids.map(Number).filter(Boolean) : [];
      if (!ids.length) return json({ error: "Sin paradas que ordenar" }, 400);
      await SQL.begin(async (t: any) => {
        for (let i = 0; i < ids.length; i++) {
          await t`UPDATE reparto_paradas SET secuencia=${i + 1} WHERE id=${ids[i]}`;
        }
      });
      return json({ ok: true, ordenadas: ids.length });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
