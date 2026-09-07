// Ladys — gastos de la cuenta de Mercado Pago
//
// Los cargos hechos CON la tarjeta de Mercado Pago no salen en el buscador de
// cobros: ahí uno figura como collector. Aparecen filtrando por payer.id con
// nuestro propio user_id, que es como Mercado Pago marca "yo pagué esto".
// Cada gasto queda pendiente hasta que alguien le pone motivo y documento; ahí
// se transforma en una compra de verdad en ladys.compras.
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

const hoyChile = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
const restarDias = (f: string, n: number) => {
  const d = new Date(f + "T12:00:00Z"); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

async function conf(clave: string) {
  const [r] = await SQL`SELECT valor FROM configuracion WHERE clave = ${clave}`;
  return r?.valor || "";
}
async function auth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
  try { const { payload } = await jose.jwtVerify(tok, SECRET); return payload as any; }
  catch { return null; }
}

// Trae de Mercado Pago los cargos del rango y guarda los que no conocíamos.
// Nunca pisa un gasto ya conciliado: ON CONFLICT DO NOTHING.
async function sincronizar(desde: string, hasta: string) {
  const token = await conf("mp_access_token");
  const userId = await conf("mp_user_id");
  if (!token || !userId) return { nuevos: 0, error: "Falta el token o el user id de Mercado Pago" };

  let nuevos = 0;
  for (let offset = 0; offset < 500; offset += 50) {
    const q = `https://api.mercadopago.com/v1/payments/search?payer.id=${userId}` +
      `&sort=date_created&criteria=desc&range=date_created` +
      `&begin_date=${desde}T00:00:00.000-04:00&end_date=${hasta}T23:59:59.999-04:00` +
      `&limit=50&offset=${offset}`;
    const r = await fetch(q, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) break;
    const d = await r.json();
    const filas = d?.results || [];
    for (const p of filas) {
      // authorized = cargo tomado por el comercio; approved = ya liquidado.
      // Los rechazados y devueltos no son gasto.
      if (!["approved", "authorized"].includes(String(p.status))) continue;
      const monto = Math.round(Number(p.transaction_amount) || 0);
      if (monto <= 0) continue;
      const res = await SQL`
        INSERT INTO gastos_mp (mp_payment_id, monto, pagado_en, comercio, medio)
        VALUES (${String(p.id)}, ${monto}, ${p.date_approved || p.date_created},
                ${p.description || p.statement_descriptor || null},
                ${p.payment_method_id || p.payment_type_id || null})
        ON CONFLICT (mp_payment_id) DO NOTHING
        RETURNING mp_payment_id`;
      if (res.length) nuevos++;
    }
    if (filas.length < 50) break;
  }
  return { nuevos };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-gastos/, "").replace(/\/$/, "") || "/";

  try {
    const u = await auth(req);
    if (!u) return json({ error: "Token requerido" }, 401);

    // GET / → sincroniza y devuelve la lista
    if (req.method === "GET" && ruta === "/") {
      const hasta = url.searchParams.get("hasta") || hoyChile();
      const desde = url.searchParams.get("desde") || restarDias(hasta, 30);
      const sync = await sincronizar(desde, hasta);

      const gastos = await SQL`
        SELECT g.mp_payment_id, g.monto, g.comercio, g.medio, g.estado, g.motivo,
               g.compra_id, c.folio, c.tipo_doc, c.tipo_gasto,
               to_char(g.pagado_en AT TIME ZONE 'America/Santiago','DD/MM HH24:MI') AS cuando,
               (g.pagado_en AT TIME ZONE 'America/Santiago')::date AS fecha
          FROM gastos_mp g LEFT JOIN compras c ON c.id = g.compra_id
         WHERE (g.pagado_en AT TIME ZONE 'America/Santiago')::date BETWEEN ${desde}::date AND ${hasta}::date
         ORDER BY g.pagado_en DESC`;

      const [tot] = await SQL`
        SELECT COUNT(*) FILTER (WHERE estado = 'PENDIENTE')   AS pendientes,
               COALESCE(SUM(monto) FILTER (WHERE estado = 'PENDIENTE'), 0)   AS monto_pendiente,
               COALESCE(SUM(monto) FILTER (WHERE estado = 'CONCILIADO'), 0)  AS monto_conciliado,
               COALESCE(SUM(monto) FILTER (WHERE estado = 'DESCARTADO'), 0)  AS monto_descartado
          FROM gastos_mp
         WHERE (pagado_en AT TIME ZONE 'America/Santiago')::date BETWEEN ${desde}::date AND ${hasta}::date`;

      return json({ desde, hasta, nuevos: sync.nuevos, totales: tot, gastos });
    }

    // POST /conciliar → crea la compra y amarra el gasto
    if (req.method === "POST" && ruta === "/conciliar") {
      const b = await req.json();
      const id = String(b.mp_payment_id || "");
      const [g] = await SQL`SELECT * FROM gastos_mp WHERE mp_payment_id = ${id}`;
      if (!g) return json({ error: "No encuentro ese gasto" }, 404);
      if (g.estado === "CONCILIADO") return json({ error: "Ese gasto ya está conciliado", compra_id: g.compra_id }, 409);

      const glosa = String(b.glosa || "").trim();
      if (!glosa) return json({ error: "Escribe para qué fue la compra" }, 400);

      const [compra] = await SQL`
        INSERT INTO compras (local_id, fecha_compra, folio, tipo_doc, tipo_gasto, total, glosa, usuario_id)
        VALUES (${Number(u.local_id) || 1},
                ${b.fecha_compra || null}::date,
                ${b.folio || null}, ${b.tipo_doc || 'BOLETA'}, ${b.tipo_gasto || null},
                ${Number(g.monto)}, ${glosa}, ${Number(u.id) || null})
        RETURNING id`;

      await SQL`UPDATE gastos_mp
                   SET estado = 'CONCILIADO', compra_id = ${compra.id}, motivo = ${glosa},
                       usuario_id = ${Number(u.id) || null}, conciliado_en = NOW()
                 WHERE mp_payment_id = ${id}`;
      return json({ ok: true, compra_id: compra.id });
    }

    // POST /descartar → no es gasto del negocio, pero queda el motivo
    if (req.method === "POST" && ruta === "/descartar") {
      const b = await req.json();
      const motivo = String(b.motivo || "").trim();
      if (!motivo) return json({ error: "Escribe por qué se descarta" }, 400);
      const r = await SQL`UPDATE gastos_mp
                             SET estado = 'DESCARTADO', motivo = ${motivo},
                                 usuario_id = ${Number(u.id) || null}, conciliado_en = NOW()
                           WHERE mp_payment_id = ${String(b.mp_payment_id)} AND estado <> 'CONCILIADO'
                           RETURNING mp_payment_id`;
      if (!r.length) return json({ error: "No se puede descartar: o no existe o ya está conciliado" }, 409);
      return json({ ok: true });
    }

    // POST /reabrir → deshace, y si había compra la borra para no dejarla huérfana
    if (req.method === "POST" && ruta === "/reabrir") {
      const b = await req.json();
      const [g] = await SQL`SELECT * FROM gastos_mp WHERE mp_payment_id = ${String(b.mp_payment_id)}`;
      if (!g) return json({ error: "No encuentro ese gasto" }, 404);
      if (g.compra_id) await SQL`DELETE FROM compras WHERE id = ${g.compra_id}`;
      await SQL`UPDATE gastos_mp SET estado='PENDIENTE', compra_id=NULL, motivo=NULL, conciliado_en=NULL
                 WHERE mp_payment_id = ${String(b.mp_payment_id)}`;
      return json({ ok: true });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
