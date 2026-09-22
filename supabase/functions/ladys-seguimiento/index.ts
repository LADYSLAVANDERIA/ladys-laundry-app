// Ladys — seguimiento del reparto en vivo
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
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

const rad = (g: number) => (g * Math.PI) / 180;
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const RODEO = 1.35;
const hoy = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });

async function auth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
  try { const { payload } = await jose.jwtVerify(tok, SECRET); return payload as any; }
  catch { return null; }
}

// ── Ruta con tráfico para el cliente ──
// Se guarda en seguimiento_ruta y se reusa: varios clientes miran cada 15 s y
// Routes API se cobra por consulta. Se vuelve a pedir si la camioneta avanzó
// más de 200 m o pasaron más de 60 s (así el tiempo refleja los tacos), y
// nunca más de una vez cada 20 s por parada. Si la señal de la camioneta
// tiene más de 15 min, no se pide nada nuevo: se muestra lo último.
const RECALC_M = 200, RECALC_S = 60, MIN_S = 20, SENAL_VIEJA_MIN = 15;
const segDe = (d: any) => Number(String(d || "0s").replace("s", "")) || 0;
const ll = (lat: number, lng: number) => ({ location: { latLng: { latitude: lat, longitude: lng } } });

async function rutaConTrafico(p: any, cam: { lat: number; lng: number; actualizado: any }, nAntes: number) {
  const [c] = await SQL`SELECT *, EXTRACT(EPOCH FROM (NOW() - calculado))::int AS edad
                          FROM seguimiento_ruta WHERE parada_id = ${p.id}`;
  const movido = c ? km(c.origen_lat, c.origen_lng, cam.lat, cam.lng) * 1000 : Infinity;
  const vieja = (Date.now() - new Date(cam.actualizado).getTime()) / 60000 > SENAL_VIEJA_MIN;
  const toca = !c || (!vieja && c.edad >= MIN_S && (movido > RECALC_M || c.edad >= RECALC_S || c.paradas_intermedias !== nAntes));
  if (!toca) return c?.ok ? c : null;

  // las paradas que la camioneta hace antes, en su orden (sin mostrarlas al cliente)
  const inter = nAntes > 0 ? await SQL`SELECT lat, lng FROM reparto_paradas x
      WHERE x.fecha = (SELECT fecha FROM reparto_paradas WHERE id = ${p.id})
        AND x.estado IN ('PENDIENTE','EN_CAMINO') AND x.secuencia > 0 AND x.secuencia < ${p.secuencia || 999}
        AND x.lat IS NOT NULL AND x.lng IS NOT NULL
      ORDER BY x.secuencia LIMIT 20` : [];

  const [k] = await SQL`SELECT valor FROM configuracion WHERE clave = 'google_maps_api_key'`;
  const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "content-type": "application/json", "X-Goog-Api-Key": String(k?.valor ?? ""),
      "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({
      origin: ll(cam.lat, cam.lng),
      destination: ll(Number(p.lat), Number(p.lng)),
      intermediates: inter.map((x: any) => ll(Number(x.lat), Number(x.lng))),
      travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", languageCode: "es-CL", units: "METRIC",
    }),
  });
  const d = await r.json().catch(() => ({}));
  const rt = d?.routes?.[0];
  const ok = r.ok && !!rt?.polyline?.encodedPolyline;
  const err = ok ? null : `Google ${r.status}: ${String(d?.error?.message || "sin ruta").slice(0, 200)}`;
  if (!ok) console.error("routes seguimiento", err);
  const [g] = await SQL`INSERT INTO seguimiento_ruta
      (parada_id, origen_lat, origen_lng, polyline, metros, segundos, paradas_intermedias, ok, error, calculado)
    VALUES (${p.id}, ${cam.lat}, ${cam.lng}, ${ok ? rt.polyline.encodedPolyline : c?.polyline ?? null},
            ${ok ? Number(rt.distanceMeters) || 0 : c?.metros ?? null}, ${ok ? segDe(rt.duration) : c?.segundos ?? null},
            ${nAntes}, ${ok}, ${err}, NOW())
    ON CONFLICT (parada_id) DO UPDATE SET
      origen_lat = EXCLUDED.origen_lat, origen_lng = EXCLUDED.origen_lng, polyline = EXCLUDED.polyline,
      metros = EXCLUDED.metros, segundos = EXCLUDED.segundos, paradas_intermedias = EXCLUDED.paradas_intermedias,
      ok = EXCLUDED.ok, error = EXCLUDED.error, calculado = NOW()
    RETURNING *`;
  // si Google falló pero había una ruta anterior buena, se sigue mostrando esa
  return g?.polyline ? g : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-seguimiento/, "").replace(/\/$/, "") || "/";

  try {
    const pub = ruta.match(/^\/seguir\/(\d+)\/([A-Za-z0-9]+)$/);
    if (req.method === "GET" && pub) {
      const ordenId = Number(pub[1]), token = pub[2];
      const [o] = await SQL`SELECT id, token_publico, cliente_id FROM ordenes
                            WHERE id = ${ordenId} AND token_publico = ${token}`;
      if (!o) return json({ error: "Enlace no válido" }, 404);

      const [p] = await SQL`SELECT p.*, d.calle, d.numero, d.otro, d.sector, d.ciudad
        FROM reparto_paradas p
        LEFT JOIN direcciones_clientes d ON d.id = p.direccion_id
        WHERE p.orden_id = ${ordenId} AND p.fecha >= CURRENT_DATE - 1
        ORDER BY p.fecha DESC, p.id DESC LIMIT 1`;
      if (!p) return json({ estado: "SIN_RUTA", mensaje: "Tu pedido aún no está en ruta" });

      // la fecha se compara dentro de la base: si viaja a JS se corre un dia por zona horaria
      const [t] = await SQL`SELECT t.lat, t.lng, t.actualizado FROM reparto_tracking t
        WHERE t.fecha = (SELECT fecha FROM reparto_paradas WHERE id = ${p.id})
        ORDER BY t.actualizado DESC LIMIT 1`;

      const [antes] = await SQL`SELECT COUNT(*)::int AS n FROM reparto_paradas x
        WHERE x.fecha = (SELECT fecha FROM reparto_paradas WHERE id = ${p.id})
          AND x.estado IN ('PENDIENTE','EN_CAMINO')
          AND x.secuencia > 0 AND x.secuencia < ${p.secuencia || 999}`;

      let etaMin: number | null = null;
      let seg: any = null;
      let rutaViva: any = null;
      let etaFuente = "estimado";
      if (t && p.lat && p.lng && p.estado !== "COMPLETADA") {
        seg = { lat: Number(t.lat), lng: Number(t.lng), actualizado: t.actualizado };
        const [cfg] = await SQL`SELECT vel_kmh, min_por_parada FROM reparto_config WHERE id = 1`;
        const minParada = Number(cfg?.min_por_parada) || 5;

        // RUTA REAL CON TRÁFICO (22-sep-2026). Antes el navegador del cliente
        // pedía la ruta a Google con una API que la clave no tiene habilitada,
        // fallaba callado y se dibujaba una línea recta punteada. Ahora la
        // calcula el servidor con Routes API (TRAFFIC_AWARE), pasando por las
        // paradas que la camioneta hace antes, y el tiempo sale de ahí.
        try {
          rutaViva = await rutaConTrafico(p, seg, antes.n);
        } catch (e) { console.error("ruta seguimiento", (e as Error).message); }

        if (rutaViva?.segundos != null) {
          etaMin = Math.max(1, Math.round(rutaViva.segundos / 60 + antes.n * minParada));
          etaFuente = "trafico";
        } else {
          const d = km(Number(t.lat), Number(t.lng), Number(p.lat), Number(p.lng)) * RODEO;
          etaMin = Math.max(1, Math.round((d / Number(cfg.vel_kmh)) * 60) + (antes.n * minParada));
        }
      }

      return json({
        estado: p.estado, tipo: p.tipo,
        direccion: [p.calle, p.numero, p.otro, p.sector, p.ciudad].filter(Boolean).join(" "),
        destino: p.lat ? { lat: Number(p.lat), lng: Number(p.lng) } : null,
        conductor: seg, eta_min: etaMin, eta_fuente: etaFuente, paradas_antes: antes.n,
        llegada: etaMin != null ? new Date(Date.now() + etaMin * 60000).toISOString() : null,
        ruta: rutaViva ? { polyline: rutaViva.polyline, metros: rutaViva.metros, calculado: rutaViva.calculado,
                           desde: { lat: rutaViva.origen_lat, lng: rutaViva.origen_lng } } : null,
        hora_estimada: p.hora_estimada, completada_el: p.llegada_real,
      });
    }

    const u = await auth(req);
    if (!u) return json({ error: "Token requerido" }, 401);

    if (req.method === "POST" && ruta === "/pos") {
      const b = await req.json();
      if (typeof b.lat !== "number" || typeof b.lng !== "number") return json({ error: "Sin coordenadas" }, 400);
      const f = b.fecha || hoy();
      const uid = Number(u.id) || 0;
      await SQL`INSERT INTO reparto_tracking (fecha, usuario_id, lat, lng, exactitud_m, velocidad, parada_id, actualizado)
        VALUES (${f}::date, ${uid}, ${b.lat}, ${b.lng}, ${b.exactitud ?? null}, ${b.velocidad ?? null}, ${b.parada_id ?? null}, NOW())
        ON CONFLICT (fecha, usuario_id) DO UPDATE
        SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, exactitud_m = EXCLUDED.exactitud_m,
            velocidad = EXCLUDED.velocidad, parada_id = EXCLUDED.parada_id, actualizado = NOW()`;
      return json({ ok: true });
    }

    if (req.method === "POST" && ruta === "/iniciar") {
      const b = await req.json();
      if (!b.parada_id) return json({ error: "Falta la parada" }, 400);

      const [p] = await SQL`UPDATE reparto_paradas
        SET estado = 'EN_CAMINO', inicio_trayecto = NOW()
        WHERE id = ${b.parada_id} AND estado = 'PENDIENTE' RETURNING *`;
      if (!p) return json({ error: "La parada ya no está pendiente" }, 409);

      await SQL`UPDATE reparto_paradas SET estado = 'PENDIENTE', inicio_trayecto = NULL
                WHERE fecha = (SELECT fecha FROM reparto_paradas WHERE id = ${p.id})
                  AND estado = 'EN_CAMINO' AND id <> ${p.id}`;

      const [o] = await SQL`SELECT o.id, o.token_publico, c.id AS cliente_id,
                                   c.nombre, c.telefono, c.token_portal
                            FROM ordenes o JOIN clientes c ON c.id = o.cliente_id
                            WHERE o.id = ${p.orden_id}`;
      const [cfg] = await SQL`SELECT valor FROM configuracion WHERE clave = 'url_app'`;
      const base = (cfg?.valor || "https://ladyslavanderia.cl/app").replace(/\/$/, "");
      // el cliente entra a su portal de siempre; ahi ve el pedido en camino y despliega el mapa
      const enlace = o.token_portal
        ? `${base}/#/mi/${o.cliente_id}/${o.token_portal}`
        : `${base}/#/seguir/${o.id}/${o.token_publico}`;

      const accion = p.tipo === "RETIRO" ? "a retirar tu ropa" : "con tu pedido";
      const texto = `Hola ${(o.nombre || "").split(" ")[0]}, vamos en camino ${accion}. ` +
        `Puedes seguir al conductor en vivo desde tu cuenta: ${enlace}`;

      await SQL`UPDATE reparto_paradas SET aviso_enviado = NOW() WHERE id = ${p.id}`;
      const tel = String(o.telefono || "").replace(/[^\d]/g, "");
      return json({
        ok: true, parada: p, enlace, texto,
        whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null,
      });
    }

    if (req.method === "GET" && ruta === "/donde") {
      const f = url.searchParams.get("fecha") || hoy();
      const rows = await SQL`SELECT lat, lng, actualizado, parada_id, exactitud_m
                             FROM reparto_tracking WHERE fecha = ${f}::date`;
      return json({ fecha: f, conductores: rows });
    }

    // LA RUTA EN VIVO QUE SE MIRA DESDE EL LOCAL (bitacora #84).
    // Devuelve todo junto y ya calculado para que la pantalla solo dibuje:
    // donde esta la camioneta ahora, por donde anduvo hoy, las paradas con su
    // estado, y el resumen del dia (salida, kilometros, cuanto lleva detenida).
    // OJO: la posicion solo se reporta MIENTRAS la pantalla del conductor esta
    // abierta. Por eso viaja min_sin_reportar: si el conductor la cierra, el
    // punto queda quieto y hay que decir "sin senal", no fingir que sigue ahi.
    if (req.method === "GET" && ruta === "/recorrido") {
      const f = url.searchParams.get("fecha") || hoy();

      const conductores = await SQL`
        SELECT t.usuario_id,
               COALESCE(NULLIF(TRIM(concat_ws(' ', u.nombre, u.apellido)), ''), 'Conductor') AS conductor,
               t.lat, t.lng, t.velocidad, t.exactitud_m, t.parada_id, t.actualizado,
               ROUND(EXTRACT(EPOCH FROM (NOW() - t.actualizado)) / 60)::int AS min_sin_reportar
          FROM reparto_tracking t
          LEFT JOIN usuarios u ON u.id = t.usuario_id
         WHERE t.fecha = ${f}::date
         ORDER BY t.actualizado DESC`;

      const rastro = await SQL`
        SELECT usuario_id, lat, lng, velocidad, momento
          FROM reparto_recorrido
         WHERE fecha = ${f}::date
         ORDER BY usuario_id, momento`;

      const [resumen] = await SQL`
        WITH p AS (
          SELECT usuario_id, lat, lng, momento,
                 lag(lat) OVER w AS plat, lag(lng) OVER w AS plng
            FROM reparto_recorrido
           WHERE fecha = ${f}::date
          WINDOW w AS (PARTITION BY usuario_id ORDER BY momento)
        ), mov AS (
          SELECT MAX(momento) AS desde FROM p WHERE km_entre(plat, plng, lat, lng) > 0.04
        )
        SELECT MIN(p.momento) AS salida, MAX(p.momento) AS ultimo_punto,
               COUNT(*)::int AS puntos,
               ROUND(COALESCE(SUM(km_entre(p.plat, p.plng, p.lat, p.lng)), 0)::numeric, 1) AS km,
               (SELECT desde FROM mov) AS ultimo_movimiento
          FROM p`;

      const paradas = await SQL`
        SELECT p.id, p.orden_id, p.tipo, p.estado, p.secuencia, p.hora_estimada,
               p.llegada_real, p.inicio_trayecto, p.lat, p.lng, p.nota,
               COALESCE(NULLIF(c.razon_social, ''),
                        NULLIF(TRIM(concat_ws(' ', c.nombre, c.apellido)), ''),
                        'Sin nombre') AS cliente,
               TRIM(CONCAT_WS(' ', d.calle, d.numero, d.otro)) AS direccion,
               COALESCE(NULLIF(d.comuna_geo, ''), d.ciudad) AS comuna,
               r.nombre AS tramo, r.hora_inicio, r.hora_fin
          FROM reparto_paradas p
          LEFT JOIN ordenes o ON o.id = p.orden_id
          LEFT JOIN clientes c ON c.id = o.cliente_id
          LEFT JOIN direcciones_clientes d ON d.id = p.direccion_id
          LEFT JOIN rutas r ON r.id = p.ruta_id
         WHERE p.fecha = ${f}::date
         ORDER BY COALESCE(NULLIF(p.secuencia, 0), 999), p.id`;

      const [base] = await SQL`SELECT lat, lng, direccion FROM reparto_config WHERE id = 1`;

      const cuenta = (e: string) => paradas.filter((x: any) => String(x.estado) === e).length;
      return json({
        fecha: f, es_hoy: f === hoy(), ahora: new Date().toISOString(),
        base: base ? { lat: Number(base.lat), lng: Number(base.lng), direccion: base.direccion } : null,
        conductores, rastro, paradas,
        resumen: {
          salida: resumen?.salida ?? null,
          ultimo_punto: resumen?.ultimo_punto ?? null,
          ultimo_movimiento: resumen?.ultimo_movimiento ?? null,
          puntos: Number(resumen?.puntos) || 0,
          km: Number(resumen?.km) || 0,
          paradas_total: paradas.length,
          hechas: cuenta("COMPLETADA"),
          fallidas: cuenta("FALLIDA"),
          en_camino: cuenta("EN_CAMINO"),
          pendientes: cuenta("PENDIENTE"),
        },
      });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
