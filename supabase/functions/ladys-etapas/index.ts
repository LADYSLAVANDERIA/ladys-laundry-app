// Ladys — etapas de producción: avance por escaneo y tiempos por pedido
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

// El recorrido normal de un pedido. El orden importa: nunca se retrocede solo.
const ETAPAS = ["RECEPCIONADO", "EN_LAVADO", "EN_SECADO", "EMBOLSADO",
                "LISTO_RETIRO", "ASIGNADO_RUTA", "EN_CAMINO", "ENTREGADO"];

// Cómo se refleja cada etapa en el estado que ya usaba el sistema
const ESTADO_DE: Record<string, string> = {
  RECEPCIONADO: "EN_PROCESO", EN_LAVADO: "EN_PROCESO", EN_SECADO: "EN_PROCESO",
  EMBOLSADO: "LISTA", LISTO_RETIRO: "LISTA", ASIGNADO_RUTA: "LISTA",
  EN_CAMINO: "LISTA", ENTREGADO: "ENTREGADA",
};

async function auth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
  try { const { payload } = await jose.jwtVerify(tok, SECRET); return payload as any; }
  catch { return null; }
}

// Acepta el número de OT, el id, o la URL completa del QR
function leerCodigo(txt: string) {
  const t = String(txt || "").trim();
  const url = t.match(/\/ot\/(\d+)\//);
  if (url) return Number(url[1]);
  const num = t.replace(/[^\d]/g, "");
  return num ? Number(num) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-etapas/, "").replace(/\/$/, "") || "/";

  try {
    const u = await auth(req);
    if (!u) return json({ error: "Token requerido" }, 401);

    // POST /marcar { codigo, etapa, bultos }
    if (req.method === "POST" && ruta === "/marcar") {
      const b = await req.json();
      const etapa = String(b.etapa || "").toUpperCase();
      if (!ETAPAS.includes(etapa)) return json({ error: "Etapa desconocida" }, 400);

      const id = b.orden_id ? Number(b.orden_id) : leerCodigo(b.codigo);
      if (!id) return json({ error: "No pude leer el código" }, 400);

      const [o] = await SQL`SELECT o.id, o.etapa, o.estado, o.entrega_domicilio, o.bultos,
                                   c.nombre, c.apellido, c.razon_social, c.telefono
                            FROM ordenes o JOIN clientes c ON c.id = o.cliente_id
                            WHERE o.id = ${id}`;
      if (!o) return json({ error: `No existe el pedido ${id}` }, 404);
      if (o.estado === "ANULADA") return json({ error: `El pedido ${id} está anulado` }, 409);

      const antes = ETAPAS.indexOf(o.etapa || "RECEPCIONADO");
      const ahora = ETAPAS.indexOf(etapa);
      const retrocede = ahora < antes;
      const repetida = ahora === antes;

      if (!repetida) {
        await SQL`UPDATE ordenes SET etapa = ${etapa}, etapa_en = NOW(),
                    estado = ${ESTADO_DE[etapa]},
                    bultos = COALESCE(${b.bultos ?? null}, bultos),
                    entregada_el = CASE WHEN ${etapa} = 'ENTREGADO' THEN NOW() ELSE entregada_el END
                  WHERE id = ${id}`;
        await SQL`INSERT INTO orden_etapas (orden_id, etapa, usuario_id, bultos, nota)
                  VALUES (${id}, ${etapa}, ${Number(u.id) || null}, ${b.bultos ?? null}, ${b.nota ?? null})`;
      }

      const cliente = o.razon_social || [o.nombre, o.apellido].filter(Boolean).join(" ");
      return json({
        ok: true, orden_id: id, cliente, etapa_anterior: o.etapa, etapa,
        repetida, retrocede, entrega_domicilio: o.entrega_domicilio,
        aviso: repetida ? `El pedido ${id} ya estaba en esta etapa`
             : retrocede ? `Ojo: el pedido ${id} retrocedió de etapa` : null,
      });
    }

    // GET /orden/:id → ficha con la línea de tiempo
    const m = ruta.match(/^\/orden\/(\d+)$/);
    if (req.method === "GET" && m) {
      const id = Number(m[1]);
      const [o] = await SQL`SELECT o.id, o.etapa, o.etapa_en, o.estado, o.bultos, o.kilos,
                                   o.entrega_domicilio, o.fecha_entrega,
                                   c.nombre, c.apellido, c.razon_social, c.telefono
                            FROM ordenes o JOIN clientes c ON c.id = o.cliente_id WHERE o.id = ${id}`;
      if (!o) return json({ error: "No existe" }, 404);
      const pasos = await SQL`SELECT e.etapa, e.en, e.bultos, u.nombre AS usuario
                              FROM orden_etapas e LEFT JOIN usuarios u ON u.id = e.usuario_id
                              WHERE e.orden_id = ${id} ORDER BY e.en`;
      return json({ orden: o, pasos });
    }

    // GET /tablero → cuántos hay en cada etapa y cuáles llevan más tiempo detenidos
    if (req.method === "GET" && ruta === "/tablero") {
      const conteo = await SQL`SELECT etapa, COUNT(*)::int AS n FROM ordenes
        WHERE estado NOT IN ('ANULADA','ENTREGADA') GROUP BY etapa`;
      const detenidos = await SQL`SELECT o.id, o.etapa, o.etapa_en,
          ROUND(EXTRACT(EPOCH FROM (NOW() - o.etapa_en)) / 3600)::int AS horas,
          COALESCE(NULLIF(c.razon_social,''), c.nombre) AS cliente
        FROM ordenes o JOIN clientes c ON c.id = o.cliente_id
        WHERE o.estado NOT IN ('ANULADA','ENTREGADA')
          AND o.etapa_en < NOW() - INTERVAL '24 hours'
        ORDER BY o.etapa_en LIMIT 15`;
      return json({ conteo, detenidos });
    }

    // GET /tiempos → cuánto demora cada etapa, medido de verdad
    if (req.method === "GET" && ruta === "/tiempos") {
      const filas = await SQL`
        WITH pasos AS (
          SELECT orden_id, etapa, en,
                 LEAD(en) OVER (PARTITION BY orden_id ORDER BY en) AS siguiente
          FROM orden_etapas WHERE en > NOW() - INTERVAL '60 days')
        SELECT etapa, COUNT(*)::int AS casos,
               ROUND(AVG(EXTRACT(EPOCH FROM (siguiente - en)) / 3600)::numeric, 1) AS horas_promedio
        FROM pasos WHERE siguiente IS NOT NULL GROUP BY etapa`;
      return json({ etapas: filas });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
