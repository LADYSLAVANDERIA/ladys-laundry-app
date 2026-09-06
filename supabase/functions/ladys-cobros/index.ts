// Ladys — cobros por Mercado Pago: link por OT y conciliación del POS
// El webhook de membresías (ladys-mercadopago) NO se toca: cada link trae su
// propia dirección de aviso, así los dos flujos viven separados.
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

const BASE = "https://vhjsizkbmabznupkfzji.supabase.co/functions/v1/ladys-cobros";
const FORMA_LINK = 6;   // Link de pago
const FORMA_POS  = 3;   // POS Mercado Pago

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

// Registra el pago en la OT y, si hay caja abierta, queda dentro de ella
async function abonar(ordenId: number, monto: number, formaId: number, referencia: string, usuarioId: number | null) {
  const [o] = await SQL`SELECT id FROM ordenes WHERE id = ${ordenId}`;
  if (!o) return false;
  const [ya] = await SQL`SELECT id FROM pagos WHERE referencia = ${referencia}`;
  if (ya) return true;   // el aviso de Mercado Pago puede llegar dos veces
  await SQL`INSERT INTO pagos (orden_id, cliente_id, forma_pago_id, monto, referencia, usuario_id)
            SELECT ${ordenId}, cliente_id, ${formaId}, ${monto}, ${referencia}, ${usuarioId}
            FROM ordenes WHERE id = ${ordenId}`;
  await SQL`UPDATE ordenes
              SET monto_abonado = COALESCE(monto_abonado,0) + ${monto},
                  saldo_pendiente = GREATEST(COALESCE(monto_total,0) - (COALESCE(monto_abonado,0) + ${monto}), 0)
            WHERE id = ${ordenId}`;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-cobros/, "").replace(/\/$/, "") || "/";

  try {
    // ── PÚBLICO: aviso de Mercado Pago para los links que emitimos ──
    if (req.method === "POST" && ruta === "/webhook") {
      const body = await req.json().catch(() => ({}));
      const tipo = body.type || body.topic;
      const pagoId = String(body?.data?.id || body?.resource || "").split("/").pop();
      if (tipo !== "payment" || !pagoId) return json({ ok: true, ignorado: true });

      const token = await conf("mp_access_token");
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${pagoId}`,
        { headers: { Authorization: `Bearer ${token}` } });
      const p = await r.json();
      if (p.status !== "approved") return json({ ok: true, estado: p.status });

      const ref = String(p.external_reference || "");
      const m = ref.match(/^OT-(\d+)$/);
      if (!m) return json({ ok: true, sin_referencia: true });

      const ordenId = Number(m[1]);
      const monto = Math.round(Number(p.transaction_amount) || 0);
      await abonar(ordenId, monto, FORMA_LINK, `MP-${pagoId}`, null);
      await SQL`UPDATE cobros_link SET estado = 'PAGADO', mp_payment_id = ${String(pagoId)}, pagado_en = NOW()
                WHERE orden_id = ${ordenId} AND estado = 'PENDIENTE'`;
      return json({ ok: true, orden_id: ordenId, monto });
    }

    // ── de aquí en adelante, con sesión ──
    const u = await auth(req);
    if (!u) return json({ error: "Token requerido" }, 401);

    // POST /link { orden_id, monto? } → genera el link de cobro
    if (req.method === "POST" && ruta === "/link") {
      const b = await req.json();
      const ordenId = Number(b.orden_id);
      if (!ordenId) return json({ error: "Falta el pedido" }, 400);

      const [o] = await SQL`SELECT o.id, o.monto_total, o.monto_abonado, o.saldo_pendiente, o.cliente_id,
                                   COALESCE(NULLIF(c.razon_social,''), CONCAT_WS(' ', c.nombre, c.apellido)) AS cliente,
                                   c.email, c.telefono
                            FROM ordenes o JOIN clientes c ON c.id = o.cliente_id WHERE o.id = ${ordenId}`;
      if (!o) return json({ error: "No existe el pedido" }, 404);

      const monto = Math.round(Number(b.monto) || Number(o.saldo_pendiente) || 0);
      if (monto <= 0) return json({ error: "Este pedido no tiene saldo por cobrar" }, 400);

      const token = await conf("mp_access_token");
      if (!token) return json({ error: "Falta el token de Mercado Pago en Configuración" }, 400);

      const pref: Record<string, unknown> = {
        items: [{ title: `Ladys Lavandería - Pedido ${ordenId}`, quantity: 1,
                  unit_price: monto, currency_id: "CLP" }],
        external_reference: `OT-${ordenId}`,
        notification_url: `${BASE}/webhook`,
        back_urls: { success: (await conf("url_app")) || "https://ladyslavanderia.cl" },
      };
      if (o.email) pref.payer = { email: o.email };

      const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(pref),
      });
      const data = await r.json();
      if (!r.ok || !data.init_point) {
        return json({ error: data?.message || "Mercado Pago rechazó la solicitud", detalle: data }, 400);
      }

      await SQL`INSERT INTO cobros_link (orden_id, cliente_id, monto, preference_id, url, usuario_id)
                VALUES (${ordenId}, ${o.cliente_id}, ${monto}, ${data.id}, ${data.init_point}, ${Number(u.id) || null})`;

      const nombre = String(o.cliente || "").split(" ")[0];
      const texto = `Hola ${nombre}, aquí puedes pagar tu pedido ${ordenId} por $${monto.toLocaleString("es-CL")}: ${data.init_point}`;
      const tel = String(o.telefono || "").replace(/[^\d]/g, "");
      return json({ ok: true, url: data.init_point, monto, texto,
                    whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null });
    }

    // GET /links/:orden_id
    const ml = ruta.match(/^\/links\/(\d+)$/);
    if (req.method === "GET" && ml) {
      const filas = await SQL`SELECT id, monto, url, estado, pagado_en, creado_en
                              FROM cobros_link WHERE orden_id = ${Number(ml[1])} ORDER BY id DESC`;
      return json({ links: filas });
    }

    // ── COBRO EN LA MÁQUINA (Point integrado) ──
    // La máquina en modo PDV no deja teclear montos: la orden se le manda desde acá.

    // GET /pos/terminales → cuáles hay y en qué modo están
    if (req.method === "GET" && ruta === "/pos/terminales") {
      const token = await conf("mp_access_token");
      const r = await fetch("https://api.mercadopago.com/terminals/v1/list?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      const elegida = await conf("mp_terminal_id");
      return json({ terminales: d?.data?.terminals || [], elegida });
    }

    // POST /pos/cobrar { orden_id, monto? } → aparece el monto en la máquina
    if (req.method === "POST" && ruta === "/pos/cobrar") {
      const b = await req.json();
      const ordenId = Number(b.orden_id);
      if (!ordenId) return json({ error: "Falta el pedido" }, 400);

      const [o] = await SQL`SELECT id, cliente_id, saldo_pendiente FROM ordenes WHERE id = ${ordenId}`;
      if (!o) return json({ error: "No existe el pedido" }, 404);

      const monto = Math.round(Number(b.monto) || Number(o.saldo_pendiente) || 0);
      if (monto <= 0) return json({ error: "Este pedido no tiene saldo por cobrar" }, 400);

      const token = await conf("mp_access_token");
      const terminal = String(b.terminal_id || (await conf("mp_terminal_id")) || "");
      if (!token) return json({ error: "Falta el token de Mercado Pago en Configuración" }, 400);
      if (!terminal) return json({ error: "No hay máquina elegida en Configuración" }, 400);

      // No dejamos dos cobros vivos sobre el mismo pedido: confunde al cajero.
      const [viva] = await SQL`SELECT mp_order_id FROM cobros_pos
        WHERE orden_id = ${ordenId} AND estado IN ('CREADA','EN_MAQUINA')
          AND creado_en > NOW() - INTERVAL '20 minutes'`;
      if (viva) return json({ error: "Ya hay un cobro esperando en la máquina para este pedido", mp_order_id: viva.mp_order_id }, 409);

      const r = await fetch("https://api.mercadopago.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          type: "point",
          external_reference: `OT-${ordenId}`,
          expiration_time: "PT10M",
          description: `Ladys Lavanderia - Pedido ${ordenId}`,
          // En Chile el monto va como TEXTO y SIN decimales. La documentación de
          // México pide dos decimales ("10.00") y acá eso devuelve 400.
          transactions: { payments: [{ amount: String(monto) }] },
          config: {
            point: { terminal_id: terminal, print_on_terminal: "seller_ticket" },
          },
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.id) {
        return json({ error: d?.message || d?.errors?.[0]?.message || "Mercado Pago rechazó el cobro", detalle: d }, 400);
      }

      await SQL`INSERT INTO cobros_pos (orden_id, cliente_id, monto, terminal_id, mp_order_id, estado, usuario_id)
                VALUES (${ordenId}, ${o.cliente_id}, ${monto}, ${terminal}, ${String(d.id)}, 'CREADA', ${Number(u.id) || null})`;

      return json({ ok: true, mp_order_id: d.id, monto, terminal,
                    aviso: "Pásale la máquina al cliente. Si no aparece el monto, aprieta el botón verde." });
    }

    // GET /pos/cobro/:mp_order_id → cómo va; si se pagó, abona el pedido
    const mp = ruta.match(/^\/pos\/cobro\/([\w-]+)$/);
    if (req.method === "GET" && mp) {
      const [c] = await SQL`SELECT * FROM cobros_pos WHERE mp_order_id = ${mp[1]}`;
      if (!c) return json({ error: "No encuentro ese cobro" }, 404);
      if (c.estado === "PAGADA") return json({ estado: "PAGADA", orden_id: c.orden_id, monto: c.monto });

      const token = await conf("mp_access_token");
      const r = await fetch(`https://api.mercadopago.com/v1/orders/${mp[1]}`,
        { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      const est = String(d.status || "");
      const pago = d?.transactions?.payments?.[0] || {};

      if (est === "processed" || pago.status === "processed" || pago.status === "approved") {
        const pid = String(pago.id || d.id);
        await abonar(c.orden_id, Number(c.monto), FORMA_POS, `MPPOS-${pid}`, c.usuario_id);
        await SQL`UPDATE cobros_pos SET estado='PAGADA', mp_payment_id=${pid}, cerrado_en=NOW()
                  WHERE mp_order_id = ${mp[1]}`;
        // si ya estaba en la lista por conciliar, se marca para que no aparezca dos veces
        await SQL`UPDATE pos_por_conciliar SET orden_id = ${c.orden_id}, conciliado_en = NOW()
                  WHERE mp_payment_id = ${pid} AND orden_id IS NULL`;
        return json({ estado: "PAGADA", orden_id: c.orden_id, monto: c.monto });
      }
      if (["canceled", "expired", "failed"].includes(est)) {
        await SQL`UPDATE cobros_pos SET estado=${est.toUpperCase()}, cerrado_en=NOW() WHERE mp_order_id = ${mp[1]}`;
        return json({ estado: est.toUpperCase() });
      }
      if (est === "at_terminal") {
        await SQL`UPDATE cobros_pos SET estado='EN_MAQUINA' WHERE mp_order_id = ${mp[1]} AND estado='CREADA'`;
      }
      return json({ estado: est || "esperando", detalle: pago.status || null });
    }

    // POST /pos/cancelar { mp_order_id }
    if (req.method === "POST" && ruta === "/pos/cancelar") {
      const b = await req.json();
      const token = await conf("mp_access_token");
      const r = await fetch(`https://api.mercadopago.com/v1/orders/${String(b.mp_order_id)}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json",
                   "X-Idempotency-Key": crypto.randomUUID() },
      });
      const d = await r.json();
      if (r.ok) {
        await SQL`UPDATE cobros_pos SET estado='CANCELADA', cerrado_en=NOW() WHERE mp_order_id = ${String(b.mp_order_id)}`;
        return json({ ok: true });
      }
      // si ya está en la máquina, solo se puede anular desde el aparato
      return json({ error: d?.message || "No se pudo cancelar. Si ya está en la máquina, cancélalo ahí.", detalle: d }, 400);
    }

    // GET /pos?fecha= → trae del POS lo del día y lista lo que falta asignar
    if (req.method === "GET" && ruta === "/pos") {
      const fecha = url.searchParams.get("fecha") ||
        new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });
      const token = await conf("mp_access_token");
      if (token) {
        const q = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc` +
          `&range=date_created&begin_date=${fecha}T00:00:00.000-04:00&end_date=${fecha}T23:59:59.999-04:00&limit=100`;
        const r = await fetch(q, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        for (const p of (d.results || [])) {
          if (p.status !== "approved") continue;
          const esPos = p.point_of_interaction?.type === "POINT" ||
                        String(p.operation_type || "") === "pos_payment";
          if (!esPos) continue;
          // los cobrados desde la app quedan amarrados por el JOIN de más abajo
          await SQL`INSERT INTO pos_por_conciliar (mp_payment_id, monto, pagado_en, detalle)
                    VALUES (${String(p.id)}, ${Math.round(Number(p.transaction_amount) || 0)},
                            ${p.date_approved || p.date_created}, ${p.description || null})
                    ON CONFLICT (mp_payment_id) DO NOTHING`;
        }
      }
      const pend = await SQL`SELECT p.mp_payment_id, p.monto, p.detalle,
                                    COALESCE(p.orden_id, cp.orden_id) AS orden_id,
                                    to_char(p.pagado_en AT TIME ZONE 'America/Santiago','HH24:MI') AS hora
                             FROM pos_por_conciliar p
                             LEFT JOIN cobros_pos cp ON cp.mp_payment_id = p.mp_payment_id
                             WHERE p.pagado_en::date = ${fecha}::date
                             ORDER BY p.pagado_en DESC`;
      const candidatos = await SQL`SELECT o.id, o.saldo_pendiente,
            COALESCE(NULLIF(c.razon_social,''), CONCAT_WS(' ', c.nombre, c.apellido)) AS cliente
          FROM ordenes o JOIN clientes c ON c.id = o.cliente_id
          WHERE o.saldo_pendiente > 0 AND o.estado <> 'ANULADA'
          ORDER BY o.creado_en DESC LIMIT 60`;
      return json({ fecha, pendientes: pend, candidatos });
    }

    // POST /pos/asignar { mp_payment_id, orden_id }
    if (req.method === "POST" && ruta === "/pos/asignar") {
      const b = await req.json();
      const [p] = await SQL`SELECT * FROM pos_por_conciliar WHERE mp_payment_id = ${String(b.mp_payment_id)}`;
      if (!p) return json({ error: "No encuentro ese pago" }, 404);
      if (p.orden_id) return json({ error: "Ese pago ya está asignado" }, 409);
      const ok = await abonar(Number(b.orden_id), Number(p.monto), FORMA_POS,
                             `MPPOS-${p.mp_payment_id}`, Number(u.id) || null);
      if (!ok) return json({ error: "No existe el pedido" }, 404);
      await SQL`UPDATE pos_por_conciliar SET orden_id = ${Number(b.orden_id)},
                  conciliado_en = NOW(), usuario_id = ${Number(u.id) || null}
                WHERE mp_payment_id = ${String(b.mp_payment_id)}`;
      return json({ ok: true });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
