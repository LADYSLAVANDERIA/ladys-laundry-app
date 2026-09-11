// Ladys — Marketing: recuperar clientes que dejaron de venir.
//
// La lista se calcula en vivo desde las órdenes de los últimos 12 meses:
//   riesgo    → 3+ pedidos, último hace 30 a 70 días  (el más fácil de recuperar)
//   perdido   → 3+ pedidos, último hace más de 70 días
//   ocasional → 2 pedidos, último hace 30+ días
// Quedan fuera empresas, Ladys 2, Ultratug e inactivos. Un teléfono repetido en
// dos fichas aparece una sola vez (la de más gasto).
//
// El envío es manual: la app abre WhatsApp con el texto listo y aquí solo se
// registra que se mandó, para no repetirlo y para medir quién volvió.
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
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

const SEGMENTOS = ["riesgo", "perdido", "ocasional", "conversacion"];
const EXCLUIDOS = [1925, 1003, 2004];

async function conf(clave: string) {
  const [r] = await SQL`SELECT valor FROM configuracion WHERE clave = ${clave}`;
  return r?.valor || "";
}

async function lista(campana: string) {
  let z = { lat_min: -32.980, lat_max: -32.905, lng_min: -71.565, lng_max: -71.5069 };
  try { const c = await conf("domicilio_zona_sin_minimo"); if (c) z = { ...z, ...JSON.parse(c) }; } catch { /* respaldo */ }
  return await SQL`
    WITH o AS (
      SELECT cliente_id, count(*)::int AS pedidos, round(sum(monto_total))::int AS gasto,
             max(coalesce(fecha_recogida, recibida_el::date, creado_en::date)) AS ultima
      FROM ordenes
      WHERE coalesce(estado,'') NOT ILIKE 'anul%' AND coalesce(estado,'') <> 'PRE_ORDEN'
        AND coalesce(fecha_recogida, recibida_el::date, creado_en::date) >= current_date - 365
      GROUP BY 1),
    c AS (
      SELECT o.*, (current_date - o.ultima)::int AS dias, cl.nombre, cl.apellido, cl.telefono,
             regexp_replace(coalesce(cl.telefono,''), '\\D', '', 'g') AS tel
      FROM o JOIN clientes cl ON cl.id = o.cliente_id
      LEFT JOIN LATERAL (SELECT lat, lng FROM direcciones_clientes d WHERE d.cliente_id = cl.id
                         ORDER BY d.es_principal DESC NULLS LAST, d.id DESC LIMIT 1) dir ON TRUE
      WHERE coalesce(cl.activo, true) AND NOT coalesce(cl.es_empresa, false)
        -- El mensaje ofrece domicilio sin mínimo en Concón y Reñaca: quien tiene
        -- su dirección ubicada fuera de esa zona no entra. Sin dirección, sí.
        AND (dir.lat IS NULL OR (dir.lat BETWEEN ${z.lat_min} AND ${z.lat_max}
                                 AND dir.lng BETWEEN ${z.lng_min} AND ${z.lng_max}))
        AND NOT coalesce(cl.es_ladys2, false) AND cl.id <> ALL(${EXCLUIDOS}::int[])),
    s AS (
      SELECT c.*, CASE
          WHEN pedidos >= 3 AND dias BETWEEN 30 AND 70 THEN 'riesgo'
          WHEN pedidos >= 3 AND dias > 70 THEN 'perdido'
          WHEN pedidos = 2 AND dias >= 30 THEN 'ocasional' END AS seg_calc
      FROM c),
    e AS (SELECT * FROM marketing_envios WHERE campana = ${campana}),
    base AS (
      SELECT s.*, coalesce(e.segmento, s.seg_calc) AS segmento,
             e.estado AS envio, e.creado_en AS enviado_en, e.mensaje AS mensaje_enviado
      FROM s LEFT JOIN e ON e.cliente_id = s.cliente_id
      WHERE (s.seg_calc IS NOT NULL OR e.id IS NOT NULL) AND length(s.tel) >= 8),
    uno AS (
      SELECT DISTINCT ON (right(tel, 8)) * FROM base
      ORDER BY right(tel, 8), (envio IS NOT NULL) DESC, gasto DESC)
    SELECT uno.cliente_id, uno.nombre, uno.apellido, uno.telefono, uno.pedidos, uno.gasto,
           uno.ultima, uno.dias, uno.segmento, uno.envio, uno.enviado_en, uno.mensaje_enviado,
           (SELECT min(creado_en) FROM ordenes x WHERE x.cliente_id = uno.cliente_id
              AND uno.enviado_en IS NOT NULL AND x.creado_en > uno.enviado_en
              AND coalesce(x.estado,'') NOT ILIKE 'anul%') AS volvio_en
    FROM uno
    ORDER BY array_position(ARRAY['riesgo','perdido','ocasional'], uno.segmento), uno.gasto DESC`;
}


// ── Conversaciones perdidas ─────────────────────────────────────────────────
// Gente que escribió por WhatsApp queriendo un retiro y no terminó agendando:
// casi siempre porque no llegaba al pedido mínimo. Son los más recuperables de
// todos: ya querían el servicio. El escaneo lee GHL y guarda lo encontrado.

const GHL = "https://services.leadconnectorhq.com";

// Lo que dice el cliente cuando quiere un retiro
const QUIERE = ["retiro", "retirar", "pasar a buscar", "pasen a buscar", "a domicilio",
  "domicilio", "agendar", "agenda", "puedan venir", "vengan a buscar", "recoger"];
// Lo que aparece cuando el pedido mínimo frena la conversación
const MINIMO = ["minimo", "mínimo", "20.000", "25.000", "20000", "25000",
  "no alcanza", "completar", "diferencia"];

const sinTildes = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function escanear(dias: number) {
  const pit = await conf("ghl_pit");
  const loc = (await conf("ghl_location_id")) || "o1V9sCKjH5Ywd9PRURj0";
  if (!pit) return { error: "falta ghl_pit en configuracion" };

  const H = { Authorization: `Bearer ${pit}`, Version: "2021-07-28", Accept: "application/json" };
  const corte = Date.now() - dias * 86400000;

  const r = await fetch(
    `${GHL}/conversations/search?locationId=${loc}&limit=100&sortBy=last_message_date&sort=desc`,
    { headers: H });
  if (!r.ok) return { error: `GHL ${r.status}` };
  const convs = (await r.json()).conversations ?? [];

  let revisadas = 0, guardadas = 0;
  for (const c of convs) {
    if (revisadas >= 80) break;
    revisadas++;
    const m = await fetch(`${GHL}/conversations/${c.id}/messages?limit=30`, { headers: H });
    if (!m.ok) continue;
    const msgs = (await m.json()).messages?.messages ?? [];

    let quiso: any = null, freno: any = null;
    for (const x of msgs) {
      const t = sinTildes(String(x.body ?? ""));
      if (!t) continue;
      const f = new Date(x.dateAdded ?? 0).getTime();
      if (f < corte) continue;
      if (x.direction === "inbound" && !quiso && QUIERE.some(k => t.includes(sinTildes(k))))
        quiso = x;
      if (MINIMO.some(k => t.includes(sinTildes(k)))) freno = x;
    }
    if (!quiso) continue;

    const tel = String(c.phone ?? "").replace(/\D/g, "");
    if (tel.length < 8) continue;
    const motivo = freno ? "minimo" : "sin_cierre";
    const fecha = new Date(quiso.dateAdded).toISOString();
    const extracto = String(quiso.body ?? "").slice(0, 300);
    const nombre = c.fullName ?? c.contactName ?? "";

    // ¿pidió y después sí compró? entonces no hay nada que recuperar
    const [ya] = await SQL`
      SELECT 1 FROM ordenes o JOIN clientes cl ON cl.id = o.cliente_id
      WHERE right(regexp_replace(coalesce(cl.telefono,''),'\D','','g'), 8) = ${tel.slice(-8)}
        AND coalesce(o.fecha_recogida, o.recibida_el::date, o.creado_en::date) >= ${fecha}::date
        AND coalesce(o.estado,'') NOT ILIKE 'anul%' LIMIT 1`;
    if (ya) continue;

    await SQL`
      INSERT INTO marketing_conversaciones
        (telefono, nombre, contacto_ghl, cliente_id, fecha_conv, motivo, extracto)
      VALUES (${c.phone}, ${nombre}, ${c.contactId ?? null},
        (SELECT id FROM clientes WHERE right(regexp_replace(coalesce(telefono,''),'\D','','g'), 8)
           = ${tel.slice(-8)} ORDER BY id DESC LIMIT 1),
        ${fecha}, ${motivo}, ${extracto})
      ON CONFLICT (tel8, fecha_conv) DO NOTHING`;
    guardadas++;
  }
  return { revisadas, guardadas };
}

async function listaConversaciones() {
  return await SQL`
    SELECT mc.id, mc.telefono, mc.nombre, mc.cliente_id, mc.fecha_conv, mc.motivo,
           mc.extracto, mc.estado, mc.mensaje, mc.enviado_en,
           (current_date - mc.fecha_conv::date)::int AS dias,
           coalesce(o.pedidos, 0) AS pedidos, coalesce(o.gasto, 0) AS gasto,
           (SELECT min(x.creado_en) FROM ordenes x
              WHERE x.cliente_id = mc.cliente_id AND mc.enviado_en IS NOT NULL
                AND x.creado_en > mc.enviado_en
                AND coalesce(x.estado,'') NOT ILIKE 'anul%') AS volvio_en
    FROM marketing_conversaciones mc
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS pedidos, round(sum(monto_total))::int AS gasto
      FROM ordenes WHERE cliente_id = mc.cliente_id
        AND coalesce(estado,'') NOT ILIKE 'anul%') o ON TRUE
    ORDER BY (mc.estado IS NOT NULL), mc.fecha_conv DESC`;
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-marketing/, "").replace(/\/$/, "") || "/";

  try {
    const h = req.headers.get("authorization") || "";
    const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
    let usuario: any;
    try { const { payload } = await jose.jwtVerify(tok, SECRET); usuario = payload; }
    catch { return json({ error: "Token requerido" }, 401); }

    const campana = url.searchParams.get("campana") || await conf("marketing_campana") || "reactivacion";

    // GET /  → lista de la campaña + plantillas
    if (req.method === "GET" && ruta === "/") {
      const clientes = await lista(campana);
      const plantillas: Record<string, string> = {};
      for (const s of SEGMENTOS) plantillas[s] = await conf(`marketing_plantilla_${s}`);
      return json({ campana, clientes, plantillas });
    }

    // POST /enviado { cliente_id, segmento, telefono, mensaje }
    if (req.method === "POST" && (ruta === "/enviado" || ruta === "/descartar")) {
      const b = await req.json();
      if (!b.cliente_id) return json({ error: "Falta el cliente" }, 400);
      const estado = ruta === "/enviado" ? "ENVIADO" : "DESCARTADO";
      const [r] = await SQL`
        INSERT INTO marketing_envios (campana, cliente_id, segmento, telefono, mensaje, estado, usuario_id)
        VALUES (${campana}, ${b.cliente_id}, ${b.segmento || null}, ${b.telefono || null},
                ${b.mensaje || null}, ${estado}, ${usuario?.id || null})
        ON CONFLICT (campana, cliente_id) DO UPDATE
          SET estado = EXCLUDED.estado, mensaje = coalesce(EXCLUDED.mensaje, marketing_envios.mensaje),
              creado_en = now(), usuario_id = EXCLUDED.usuario_id
        RETURNING cliente_id, estado, creado_en`;
      return json({ ok: true, envio: r });
    }

    // DELETE /enviado?cliente_id=  → deshacer (vuelve a pendientes)
    if (req.method === "DELETE" && ruta === "/enviado") {
      const id = Number(url.searchParams.get("cliente_id"));
      if (!id) return json({ error: "Falta el cliente" }, 400);
      await SQL`DELETE FROM marketing_envios WHERE campana = ${campana} AND cliente_id = ${id}`;
      return json({ ok: true });
    }

    // PUT /plantilla { segmento, texto }
    if (req.method === "PUT" && ruta === "/plantilla") {
      const b = await req.json();
      if (!SEGMENTOS.includes(b.segmento) || !String(b.texto || "").trim())
        return json({ error: "Segmento o texto inválido" }, 400);
      await SQL`
        INSERT INTO configuracion (clave, valor) VALUES (${"marketing_plantilla_" + b.segmento}, ${b.texto})
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`;
      return json({ ok: true });
    }


    // GET /conversaciones  → intentos de retiro que no se concretaron
    if (req.method === "GET" && ruta === "/conversaciones") {
      const items = await listaConversaciones();
      return json({ items, plantilla: await conf("marketing_plantilla_conversacion") });
    }

    // POST /conversaciones/escanear?dias=  → releer GHL
    if (req.method === "POST" && ruta === "/conversaciones/escanear") {
      const dias = Number(url.searchParams.get("dias") || 60);
      return json(await escanear(dias));
    }

    // POST /conversaciones/enviado | /conversaciones/descartar  { id, mensaje }
    if (req.method === "POST" &&
        (ruta === "/conversaciones/enviado" || ruta === "/conversaciones/descartar")) {
      const b = await req.json();
      if (!b.id) return json({ error: "Falta el id" }, 400);
      const estado = ruta.endsWith("/enviado") ? "ENVIADO" : "DESCARTADO";
      const [r] = await SQL`
        UPDATE marketing_conversaciones
        SET estado = ${estado}, mensaje = coalesce(${b.mensaje || null}, mensaje),
            enviado_en = now(), usuario_id = ${usuario?.id || null}
        WHERE id = ${b.id} RETURNING id, estado, enviado_en`;
      return json({ ok: true, envio: r });
    }

    // DELETE /conversaciones?id=  → deshacer
    if (req.method === "DELETE" && ruta === "/conversaciones") {
      const id = Number(url.searchParams.get("id"));
      if (!id) return json({ error: "Falta el id" }, 400);
      await SQL`UPDATE marketing_conversaciones
                SET estado = NULL, enviado_en = NULL WHERE id = ${id}`;
      return json({ ok: true });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
