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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-seguimiento/, "").replace(/\/$/, "") || "/";

  try {
    // ── PÚBLICO: el cliente sigue su pedido con el token de la orden ──
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

      // cuántas paradas faltan antes de esta
      const [antes] = await SQL`SELECT COUNT(*)::int AS n FROM reparto_paradas x
        WHERE x.fecha = (SELECT fecha FROM reparto_paradas WHERE id = ${p.id})
          AND x.estado IN ('PENDIENTE','EN_CAMINO')
          AND x.secuencia > 0 AND x.secuencia < ${p.secuencia || 999}`;

      let etaMin: number | null = null, seg = null;
      if (t && p.lat && p.lng && p.estado !== "COMPLETADA") {
        const d = km(Number(t.lat), Number(t.lng), Number(p.lat), Number(p.lng)) * RODEO;
        const [cfg] = await SQL`SELECT vel_kmh, min_por_parada FROM reparto_config WHERE id = 1`;
        etaMin = Math.max(1, Math.round((d / Number(cfg.vel_kmh)) * 60)
                 + (antes.n * Number(cfg.min_por_parada)));
        seg = { lat: Number(t.lat), lng: Number(t.lng), actualizado: t.actualizado };
      }

      return json({
        estado: p.estado, tipo: p.tipo,
        direccion: [p.calle, p.numero, p.otro, p.sector, p.ciudad].filter(Boolean).join(" "),
        destino: p.lat ? { lat: Number(p.lat), lng: Number(p.lng) } : null,
        conductor: seg, eta_min: etaMin, paradas_antes: antes.n,
        hora_estimada: p.hora_estimada, completada_el: p.llegada_real,
      });
    }

    // ── de aquí en adelante, con sesión ──
    const u = await auth(req);
    if (!u) return json({ error: "Token requerido" }, 401);

    // el conductor reporta su posición
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

    // inicia el trayecto hacia una parada y arma el aviso para el cliente
    if (req.method === "POST" && ruta === "/iniciar") {
      const b = await req.json();
      if (!b.parada_id) return json({ error: "Falta la parada" }, 400);

      const [p] = await SQL`UPDATE reparto_paradas
        SET estado = 'EN_CAMINO', inicio_trayecto = NOW()
        WHERE id = ${b.parada_id} AND estado = 'PENDIENTE' RETURNING *`;
      if (!p) return json({ error: "La parada ya no está pendiente" }, 409);

      // las demás en camino vuelven a pendientes: solo un trayecto a la vez
      await SQL`UPDATE reparto_paradas SET estado = 'PENDIENTE', inicio_trayecto = NULL
                WHERE fecha = (SELECT fecha FROM reparto_paradas WHERE id = ${p.id})
                  AND estado = 'EN_CAMINO' AND id <> ${p.id}`;

      const [o] = await SQL`SELECT o.id, o.token_publico, c.nombre, c.telefono
                            FROM ordenes o JOIN clientes c ON c.id = o.cliente_id
                            WHERE o.id = ${p.orden_id}`;
      const [cfg] = await SQL`SELECT valor FROM configuracion WHERE clave = 'url_app'`;
      const base = (cfg?.valor || "https://ladyslavanderia.cl/app").replace(/\/$/, "");
      const enlace = `${base}/#/seguir/${o.id}/${o.token_publico}`;

      const accion = p.tipo === "RETIRO" ? "a retirar tu ropa" : "con tu pedido";
      const texto = `Hola ${(o.nombre || "").split(" ")[0]}, vamos en camino ${accion}. ` +
        `Puedes seguir al conductor en el mapa aquí: ${enlace}`;

      await SQL`UPDATE reparto_paradas SET aviso_enviado = NOW() WHERE id = ${p.id}`;
      const tel = String(o.telefono || "").replace(/[^\d]/g, "");
      return json({
        ok: true, parada: p, enlace, texto,
        whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null,
      });
    }

    // la oficina mira dónde va el conductor
    if (req.method === "GET" && ruta === "/donde") {
      const f = url.searchParams.get("fecha") || hoy();
      const rows = await SQL`SELECT lat, lng, actualizado, parada_id, exactitud_m
                             FROM reparto_tracking WHERE fecha = ${f}::date`;
      return json({ fecha: f, conductores: rows });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
