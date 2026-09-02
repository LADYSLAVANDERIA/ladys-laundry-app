// Ladys Laundry API v2 — Supabase Edge Function
// Se conecta a la base con SUPABASE_DB_URL (inyectada por Supabase, sin credenciales manuales)
import postgres from "npm:postgres@3.4.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import * as jose from "npm:jose@5.9.6";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
  types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
});
const SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET") || "ladys_jwt_secret_super_seguro_2024");
const WEBHOOK_KEY = Deno.env.get("WEBHOOK_KEY") || "ladys_webhook_2026";
const CDN = "https://cdn.jsdelivr.net/gh/LADYSLAVANDERIA/ladys-laundry-app@e7acb1e24696400854d47a4e423d03e78ae44c3f/frontend/dist/assets";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-api-key, content-type", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });
const err = (m: string, s = 500) => json({ error: m }, s);

const DIAS = ["DOMINGO","LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const hoyChile = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
const diaSemana = (f: string) => (f ? DIAS[new Date(f + "T12:00:00").getDay()] : "");
const N = (v: unknown) => Number(v || 0);
const estadoPago = (t: number, a: number) => (a <= 0 ? "PENDIENTE" : a >= t ? "PAGADA" : "PARCIAL");
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const normTel = (t: string) => { const d = String(t || "").replace(/\D/g, ""); if (d.startsWith("56") && d.length === 11) return d; if (d.length === 9) return "56" + d; if (d.length === 8) return "569" + d; return d; };
const ESTADOS = ["PRE_ORDEN","EN_PROCESO","LISTA","ENTREGADA","ANULADA"];

const INDEX = `<!doctype html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Ladys Lavandería — Pedidos</title>
<link rel="stylesheet" href="${CDN}/index-Dgy83E0X.css">
<style>body{margin:0;background:#f9fafb}</style></head>
<body><div id="root"></div><script type="module" src="${CDN}/index-DngmzRym.js"></script></body></html>`;

async function firmar(u: Record<string, unknown>) {
  return await new jose.SignJWT(u).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(SECRET);
}
async function usuarioDe(req: Request) {
  const key = req.headers.get("x-api-key");
  if (key && key === WEBHOOK_KEY) return { id: null, local_id: 1, perfil: "WEBHOOK", nombre: "SofIA" };
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
  if (!tok) return null;
  try { const { payload } = await jose.jwtVerify(tok, SECRET); return payload as Record<string, unknown>; } catch { return null; }
}

const DIRSQL = (a: string) => SQL.unsafe(`${a}.calle||' '||COALESCE(${a}.numero::text,'')||COALESCE(', '||NULLIF(${a}.otro,''),'')||COALESCE(' — '||NULLIF(${a}.sector,''),'')||COALESCE(', '||NULLIF(${a}.ciudad,''),'')`);

async function cfg(k: string, d: number) {
  const r = await SQL`SELECT valor FROM configuracion WHERE clave=${k}`;
  return r[0] ? Number(r[0].valor) : d;
}
async function recalcular(t: postgres.TransactionSql, id: number) {
  const [o] = await t`SELECT * FROM ordenes WHERE id=${id}`;
  const [s] = await t`SELECT COALESCE(SUM(subtotal),0) AS st FROM orden_items WHERE orden_id=${id}`;
  const sub = N(s.st), desc = Math.round(sub * N(o.descuento_pct) / 100);
  const total = sub - desc + N(o.monto_delivery), saldo = total - N(o.monto_abonado);
  await t`UPDATE ordenes SET subtotal=${sub}, descuento_monto=${desc}, monto_total=${total}, saldo_pendiente=${saldo}, estado_pago=${estadoPago(total, N(o.monto_abonado))} WHERE id=${id}`;
  return { sub, desc, total, saldo };
}
async function hist(t: postgres.TransactionSql, id: number, estado: string | null, nota: string | null, uid: number | null) {
  await t`INSERT INTO ordenes_historial (orden_id,estado,nota,usuario_id) VALUES (${id},${estado},${nota},${uid})`;
}
async function aplicarPago(t: postgres.TransactionSql, ordenId: number, fp: number | null, monto: number, ref: string | null, uid: number | null) {
  const [o] = await t`SELECT * FROM ordenes WHERE id=${ordenId} FOR UPDATE`;
  if (!o) throw new Error("Orden no encontrada");
  monto = Math.round(monto);
  if (!(monto > 0)) throw new Error("Monto inválido");
  if (monto > N(o.saldo_pendiente) + 1) throw new Error(`El pago excede el saldo pendiente (${clp(N(o.saldo_pendiente))})`);
  await t`INSERT INTO pagos (orden_id,cliente_id,forma_pago_id,monto,referencia,usuario_id) VALUES (${ordenId},${o.cliente_id},${fp},${monto},${ref},${uid})`;
  const ab = N(o.monto_abonado) + monto, sa = N(o.monto_total) - ab, ep = estadoPago(N(o.monto_total), ab);
  await t`UPDATE ordenes SET monto_abonado=${ab}, saldo_pendiente=${sa}, estado_pago=${ep}, pagada_el=CASE WHEN ${ep === "PAGADA"} THEN COALESCE(pagada_el,NOW()) ELSE pagada_el END WHERE id=${ordenId}`;
  return { abonado: ab, saldo: sa, estado_pago: ep };
}
async function insertarItems(t: postgres.TransactionSql, id: number, items: any[]) {
  for (const i of items) {
    const c = N(i.cantidad), p = N(i.precio_unit);
    if (!(c > 0) || !i.nombre) continue;
    await t`INSERT INTO orden_items (orden_id,servicio_id,nombre,cantidad,precio_unit,subtotal,etiqueta)
            VALUES (${id},${i.servicio_id || null},${i.nombre},${c},${p},${Math.round(c * p)},${i.etiqueta || null})`;
  }
}

async function solicitarRetiro(b: any, u: any) {
  const lid = u?.local_id || 1, uid = (u?.id as number) || null;
  if (!b.fecha || (!b.telefono && !b.cliente_id)) return err("fecha y telefono (o cliente_id) son requeridos", 400);
  return await SQL.begin(async (t) => {
    let cli: any = null, nuevo = false;
    if (b.cliente_id) [cli] = await t`SELECT * FROM clientes WHERE id=${b.cliente_id}`;
    if (!cli && b.telefono) {
      const tel = normTel(b.telefono).slice(-8);
      [cli] = await t`SELECT * FROM clientes WHERE local_id=${lid} AND activo=TRUE AND regexp_replace(COALESCE(telefono,''),'\\D','','g') LIKE ${"%" + tel} ORDER BY id LIMIT 1`;
    }
    if (!cli) {
      const p = String(b.nombre || "Cliente WhatsApp").trim().split(/\s+/);
      [cli] = await t`INSERT INTO clientes (local_id,tipo,nombre,apellido,telefono,email,ghl_contact_id)
        VALUES (${lid},'PARTICULAR',${p[0]},${p.slice(1).join(" ") || null},${b.telefono},${b.email || null},${b.ghl_contact_id || null}) RETURNING *`;
      nuevo = true;
    }
    let dir: any = null;
    if (b.dir_id) [dir] = await t`SELECT * FROM direcciones_clientes WHERE id=${b.dir_id} AND cliente_id=${cli.id}`;
    if (!dir && b.calle) {
      [dir] = await t`SELECT * FROM direcciones_clientes WHERE cliente_id=${cli.id} AND LOWER(calle)=LOWER(${b.calle}) LIMIT 1`;
      if (!dir) [dir] = await t`INSERT INTO direcciones_clientes (cliente_id,ciudad,sector,calle,numero,otro,es_principal)
        VALUES (${cli.id},${b.comuna || b.ciudad || "Concón"},${b.sector || null},${b.calle},${b.numero || null},${b.otro || b.depto || null},TRUE) RETURNING *`;
    }
    if (!dir) [dir] = await t`SELECT * FROM direcciones_clientes WHERE cliente_id=${cli.id} ORDER BY es_principal DESC, id DESC LIMIT 1`;
    if (!dir) return err("El cliente no tiene dirección; envía calle y número", 422);
    const dia = diaSemana(b.fecha);
    const [fer] = await t`SELECT motivo FROM dias_inhabiles WHERE local_id=${lid} AND fecha=${b.fecha}`;
    if (fer && !b.forzar) return json({ codigo: "FERIADO", error: `El ${b.fecha} es feriado (${fer.motivo}): no hay ruta` }, 422);
    const rutas = await t`SELECT * FROM rutas WHERE local_id=${lid} AND activo=TRUE AND dia_semana=${dia} AND tipo IN ('RETIROS_Y_ENTREGAS','SOLO_RETIROS') ORDER BY hora_inicio`;
    const ruta = b.ruta_id ? rutas.find((r: any) => r.id === Number(b.ruta_id))
      : b.slot ? rutas.find((r: any) => String(r.hora_inicio).startsWith(String(b.slot).slice(0, 5))) : rutas[0];
    if (!ruta) return json({ codigo: "SIN_RUTA", error: `No hay ruta de retiro el ${dia.toLowerCase()} ${b.fecha}` }, 422);
    const [uc] = await t`SELECT COUNT(*)::int AS n FROM ordenes WHERE local_id=${lid} AND estado<>'ANULADA'
      AND ((fecha_recogida=${b.fecha} AND ruta_recogida_id=${ruta.id}) OR (fecha_entrega=${b.fecha} AND ruta_entrega_id=${ruta.id}))`;
    if (uc.n >= N(ruta.puntos_disp) && !b.forzar) return json({ codigo: "RUTA_LLENA", error: `La ruta ${ruta.nombre} del ${b.fecha} está completa` }, 422);
    const origen = b.origen || (uid ? "DOMICILIO" : "SOFIA");
    const [o] = await t`INSERT INTO ordenes (local_id,cliente_id,usuario_id,estado,estado_pago,origen,tipo_servicio,retiro_domicilio,entrega_domicilio,
        dir_recogida_id,dir_entrega_id,fecha_recogida,ruta_recogida_id,observaciones,es_pre_orden,monto_total,monto_abonado,saldo_pendiente,subtotal)
      VALUES (${lid},${cli.id},${uid},'PRE_ORDEN','PENDIENTE',${origen},${b.express ? "EXPRESS" : "NORMAL"},TRUE,TRUE,
        ${dir.id},${dir.id},${b.fecha},${ruta.id},${b.observaciones || null},TRUE,0,0,0,0) RETURNING *`;
    await hist(t, o.id, "PRE_ORDEN", `Solicitud de retiro vía ${origen === "SOFIA" ? "SofIA/WhatsApp" : "mostrador"} — ${ruta.nombre} del ${b.fecha}`, uid);
    return json({ ok: true, ot: o.id, ot_texto: "#" + String(o.id).padStart(5, "0"), fecha: b.fecha, ruta: ruta.nombre,
      hora: `${String(ruta.hora_inicio).slice(0, 5)}–${String(ruta.hora_fin).slice(0, 5)}`,
      cliente: `${cli.nombre} ${cli.apellido || ""}`.trim(), cliente_nuevo: nuevo,
      direccion: `${dir.calle} ${dir.numero || ""}${dir.otro ? ", " + dir.otro : ""}`.trim() }, 201);
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  let p = url.pathname.replace(/^\/functions\/v1\/ladys/, "").replace(/^\/ladys/, "") || "/";
  const q = url.searchParams;

  if (!p.startsWith("/api")) return new Response(INDEX, { headers: { "content-type": "text/html; charset=utf-8" } });
  p = p.slice(4) || "/";
  const m = req.method;
  const body = ["POST", "PUT"].includes(m) ? await req.json().catch(() => ({})) : {};
  const seg = p.split("/").filter(Boolean);

  try {
    if (p === "/health") return json({ status: "ok", version: "2.0.0", hora_chile: new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" }) });

    if (p === "/auth/login" && m === "POST") {
      const [u] = await SQL`SELECT * FROM usuarios WHERE email=${String(body.email || "").toLowerCase()} AND estado=TRUE`;
      if (!u || !bcrypt.compareSync(String(body.password || ""), u.password_hash)) return err("Credenciales inválidas", 401);
      await SQL`UPDATE usuarios SET ultimo_acceso=NOW() WHERE id=${u.id}`;
      const token = await firmar({ id: u.id, local_id: u.local_id, perfil: u.perfil, nombre: u.nombre });
      return json({ token, usuario: { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, perfil: u.perfil, local_id: u.local_id } });
    }

    const u = await usuarioDe(req);
    if (!u) return err("Token requerido", 401);
    const lid = Number(u.local_id) || 1, uid = (u.id as number) ?? null;

    // ── CATÁLOGO ──
    if (p === "/servicios" && m === "GET")
      return json(await SQL`SELECT s.*, c.nombre AS categoria, c.orden AS cat_orden FROM servicios s LEFT JOIN categorias c ON s.categoria_id=c.id
        WHERE s.local_id=${lid} AND s.activo=TRUE ORDER BY c.orden, s.nombre`);
    if (p === "/categorias" && m === "GET")
      return json(await SQL`SELECT * FROM categorias WHERE local_id=${lid} AND activo=TRUE ORDER BY orden, nombre`);
    if (p === "/formas-pago") return json(await SQL`SELECT * FROM formas_pago WHERE local_id=${lid} AND activo=TRUE ORDER BY id`);
    if (p === "/rutas" && m === "GET") return json(await SQL`SELECT * FROM rutas WHERE local_id=${lid} ORDER BY dia_semana, hora_inicio`);
    if (p === "/dias-inhabiles" && m === "GET") return json(await SQL`SELECT * FROM dias_inhabiles WHERE local_id=${lid} ORDER BY fecha`);
    if (p === "/local" && m === "GET") { const [l] = await SQL`SELECT * FROM locales WHERE id=${lid}`; return json(l || {}); }
    if (p === "/usuarios" && m === "GET") return json(await SQL`SELECT id,nombre,apellido,email,perfil,estado,ultimo_acceso FROM usuarios WHERE local_id=${lid} ORDER BY nombre`);
    if (p === "/config" && m === "GET") {
      const rows = await SQL`SELECT clave, valor, descripcion FROM configuracion ORDER BY clave`;
      const o: Record<string, string> = {}; rows.forEach((r: any) => (o[r.clave] = r.valor));
      return json({ ...o, _lista: rows });
    }
    if (p === "/config" && m === "PUT") {
      for (const [k, v] of Object.entries(body)) if (!k.startsWith("_"))
        await SQL`INSERT INTO configuracion (clave,valor) VALUES (${k},${String(v)}) ON CONFLICT (clave) DO UPDATE SET valor=EXCLUDED.valor`;
      return json({ ok: true });
    }

    // ── CLIENTES ──
    if (p === "/clientes" && m === "GET") {
      const s = q.get("q");
      return json(await SQL`SELECT c.*,
        (SELECT COUNT(*)::int FROM ordenes o WHERE o.cliente_id=c.id AND o.estado<>'ANULADA') AS total_ordenes,
        (SELECT COALESCE(SUM(monto_total),0) FROM ordenes o WHERE o.cliente_id=c.id AND o.estado<>'ANULADA') AS total_gastado,
        (SELECT COALESCE(SUM(saldo_pendiente),0) FROM ordenes o WHERE o.cliente_id=c.id AND o.estado<>'ANULADA') AS saldo_total,
        (SELECT MAX(creado_en) FROM ordenes o WHERE o.cliente_id=c.id) AS ultima_orden,
        EXISTS (SELECT 1 FROM prepagos_cliente pp WHERE pp.cliente_id=c.id AND pp.activo=TRUE) AS tiene_membresia
        FROM clientes c WHERE c.local_id=${lid} AND c.activo=TRUE AND c.es_ladys2=FALSE
        ${s ? SQL`AND (c.nombre ILIKE ${"%" + s + "%"} OR c.apellido ILIKE ${"%" + s + "%"} OR c.telefono ILIKE ${"%" + s + "%"} OR c.razon_social ILIKE ${"%" + s + "%"})` : SQL``}
        ORDER BY c.nombre, c.apellido LIMIT 500`);
    }
    if (seg[0] === "clientes" && seg[1] && seg.length === 2 && m === "GET") {
      const id = Number(seg[1]), hoy = hoyChile();
      const [c] = await SQL`SELECT * FROM clientes WHERE id=${id} AND local_id=${lid}`;
      if (!c) return err("Cliente no encontrado", 404);
      const [dirs, ords, sem, memb, st] = await Promise.all([
        SQL`SELECT * FROM direcciones_clientes WHERE cliente_id=${id} ORDER BY es_principal DESC, id`,
        SQL`SELECT id,estado,estado_pago,monto_total,saldo_pendiente,kilos,creado_en,fecha_entrega,es_membresia,origen,tipo_servicio FROM ordenes WHERE cliente_id=${id} ORDER BY creado_en DESC LIMIT 40`,
        SQL`WITH s AS (SELECT generate_series(date_trunc('week', date_trunc('month', ${hoy}::date)), date_trunc('week', ${hoy}::date), interval '1 week')::date AS ini)
            SELECT s.ini, (s.ini+5)::date AS fin,
              EXISTS (SELECT 1 FROM ordenes o WHERE o.cliente_id=${id} AND o.estado<>'ANULADA'
                AND DATE(o.creado_en) BETWEEN GREATEST(s.ini, date_trunc('month',${hoy}::date)::date) AND LEAST((s.ini+5)::date, ${hoy}::date)) AS con_orden
            FROM s ORDER BY s.ini`,
        SQL`SELECT pc.*, pp.nombre AS plan, pp.precio AS precio_plan FROM prepagos_cliente pc JOIN planes_prepago pp ON pc.plan_id=pp.id WHERE pc.cliente_id=${id} AND pc.activo=TRUE ORDER BY pc.id DESC LIMIT 1`,
        SQL`SELECT COUNT(*)::int AS total_ordenes, COALESCE(SUM(monto_total),0) AS total_gastado, COALESCE(SUM(saldo_pendiente),0) AS saldo_total, MAX(creado_en) AS ultima_orden FROM ordenes WHERE cliente_id=${id} AND estado<>'ANULADA'`,
      ]);
      const semanas = sem.map((w: any) => ({ ...w, vencida: w.fin < hoy, perdida: w.fin < hoy && !w.con_orden }));
      const perdidas = semanas.filter((w: any) => w.perdida).length;
      return json({ ...c, direcciones: dirs, ordenes: ords, membresia: memb[0] || null, stats: st[0],
        continuidad_info: { activa: !!c.continuidad, semanas, semanas_con_orden: semanas.filter((w: any) => w.con_orden).length, semanas_perdidas: perdidas, elegible: !!c.continuidad && perdidas === 0 } });
    }
    if (p === "/clientes" && m === "POST") {
      if (!body.nombre) return err("Nombre requerido", 400);
      const [c] = await SQL`INSERT INTO clientes (local_id,tipo,nombre,apellido,telefono,email,id_fiscal,razon_social,giro,contacto,tipo_doc,plazo_pago,observaciones,continuidad,es_ladys2,ghl_contact_id)
        VALUES (${lid},${body.tipo || "PARTICULAR"},${body.nombre},${body.apellido || null},${body.telefono || null},${body.email || null},${body.id_fiscal || null},
        ${body.razon_social || null},${body.giro || null},${body.contacto || null},${body.tipo_doc || "BOLETA"},${Number(body.plazo_pago || 0)},${body.observaciones || null},
        ${!!body.continuidad},${!!body.es_ladys2},${body.ghl_contact_id || null}) RETURNING *`;
      if (body.direccion?.calle) await SQL`INSERT INTO direcciones_clientes (cliente_id,ciudad,sector,calle,numero,otro,es_principal)
        VALUES (${c.id},${body.direccion.ciudad || "Concón"},${body.direccion.sector || null},${body.direccion.calle},${body.direccion.numero || null},${body.direccion.otro || null},TRUE)`;
      return json(c, 201);
    }
    if (seg[0] === "clientes" && seg.length === 2 && m === "PUT") {
      const campos = ["tipo","nombre","apellido","telefono","email","id_fiscal","razon_social","giro","contacto","tipo_doc","plazo_pago","observaciones","continuidad","es_ladys2","notas_internas","ghl_contact_id","activo"];
      const upd: Record<string, unknown> = {};
      for (const k of campos) if (k in body) upd[k] = body[k] === "" ? null : body[k];
      if (!Object.keys(upd).length) return err("Nada que actualizar", 400);
      const [c] = await SQL`UPDATE clientes SET ${SQL(upd)} WHERE id=${Number(seg[1])} AND local_id=${lid} RETURNING *`;
      return c ? json(c) : err("Cliente no encontrado", 404);
    }
    if (seg[0] === "clientes" && seg.length === 2 && m === "DELETE") {
      await SQL`UPDATE clientes SET activo=FALSE WHERE id=${Number(seg[1])} AND local_id=${lid}`; return json({ ok: true });
    }
    if (seg[0] === "clientes" && seg[2] === "direcciones" && m === "POST") {
      if (!body.calle) return err("Calle requerida", 400);
      const cid = Number(seg[1]);
      if (body.es_principal) await SQL`UPDATE direcciones_clientes SET es_principal=FALSE WHERE cliente_id=${cid}`;
      const [d] = await SQL`INSERT INTO direcciones_clientes (cliente_id,ciudad,sector,calle,numero,otro,es_principal)
        VALUES (${cid},${body.ciudad || "Concón"},${body.sector || null},${body.calle},${body.numero || null},${body.otro || null},${!!body.es_principal}) RETURNING *`;
      return json(d, 201);
    }
    if (seg[0] === "clientes" && seg[2] === "direcciones" && seg[3] && m === "DELETE") {
      const [c] = await SQL`SELECT COUNT(*)::int AS n FROM ordenes WHERE dir_recogida_id=${Number(seg[3])} OR dir_entrega_id=${Number(seg[3])}`;
      if (c.n > 0) return err("La dirección está usada en órdenes; no se puede borrar", 400);
      await SQL`DELETE FROM direcciones_clientes WHERE id=${Number(seg[3])} AND cliente_id=${Number(seg[1])}`;
      return json({ ok: true });
    }

    // ── ÓRDENES ──
    if (p === "/ordenes/resumen") {
      const hoy = q.get("fecha") || hoyChile();
      const [r] = await SQL`SELECT
        COUNT(*) FILTER (WHERE o.estado='PRE_ORDEN')::int AS pre_orden,
        COUNT(*) FILTER (WHERE o.estado='EN_PROCESO')::int AS en_proceso,
        COUNT(*) FILTER (WHERE o.estado='LISTA')::int AS lista,
        COUNT(*) FILTER (WHERE o.estado='ENTREGADA' AND DATE(o.entregada_el)=${hoy})::int AS entregadas_hoy,
        COUNT(*) FILTER (WHERE o.estado='ENTREGADA')::int AS entregadas,
        COUNT(*) FILTER (WHERE o.fecha_recogida=${hoy} AND o.estado='PRE_ORDEN')::int AS retiros_hoy,
        COUNT(*) FILTER (WHERE o.fecha_entrega=${hoy} AND o.estado IN ('EN_PROCESO','LISTA') AND o.entrega_domicilio)::int AS entregas_hoy,
        COUNT(*) FILTER (WHERE o.fecha_entrega<${hoy} AND o.estado IN ('EN_PROCESO','LISTA'))::int AS atrasadas,
        COALESCE(SUM(o.saldo_pendiente) FILTER (WHERE o.estado<>'ANULADA'),0) AS por_cobrar,
        COALESCE(SUM(o.monto_total) FILTER (WHERE DATE(o.creado_en)=${hoy} AND o.estado<>'ANULADA'),0) AS ventas_hoy,
        COALESCE(SUM(o.kilos) FILTER (WHERE DATE(o.creado_en)=${hoy} AND o.estado<>'ANULADA'),0) AS kilos_hoy
        FROM ordenes o JOIN clientes c ON o.cliente_id=c.id WHERE o.local_id=${lid} AND c.es_ladys2=FALSE`;
      return json({ fecha: hoy, ...r });
    }
    if (p === "/ordenes" && m === "GET") {
      const est = q.get("estado"), s = q.get("q"), cid = q.get("cliente_id");
      return json(await SQL`SELECT o.*, c.nombre||' '||COALESCE(c.apellido,'') AS cliente_nombre, c.telefono AS cliente_telefono,
          rr.nombre AS ruta_retiro, re.nombre AS ruta_entrega,
          (SELECT string_agg(i.nombre||' x'||to_char(i.cantidad,'FM999990.##'), ', ') FROM orden_items i WHERE i.orden_id=o.id) AS resumen_items
        FROM ordenes o JOIN clientes c ON o.cliente_id=c.id
        LEFT JOIN rutas rr ON o.ruta_recogida_id=rr.id LEFT JOIN rutas re ON o.ruta_entrega_id=re.id
        WHERE o.local_id=${lid} AND c.es_ladys2=FALSE
        ${est ? SQL`AND o.estado = ANY(${est.split(",")})` : SQL``}
        ${cid ? SQL`AND o.cliente_id=${Number(cid)}` : SQL``}
        ${s ? SQL`AND (c.nombre ILIKE ${"%" + s + "%"} OR c.apellido ILIKE ${"%" + s + "%"} OR c.telefono ILIKE ${"%" + s + "%"} OR CAST(o.id AS TEXT) LIKE ${"%" + s + "%"})` : SQL``}
        ORDER BY o.creado_en DESC LIMIT 300`);
    }
    if (seg[0] === "ordenes" && seg.length === 2 && m === "GET") {
      const id = Number(seg[1]);
      const [o] = await SQL`SELECT o.*, c.nombre||' '||COALESCE(c.apellido,'') AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email,
          c.plazo_pago, c.continuidad AS cliente_continuidad, us.nombre AS usuario_nombre,
          rr.nombre AS ruta_retiro, rr.hora_inicio AS ruta_retiro_hora, re.nombre AS ruta_entrega, re.hora_inicio AS ruta_entrega_hora,
          ${DIRSQL("dr")} AS direccion_retiro, ${DIRSQL("de")} AS direccion_entrega
        FROM ordenes o JOIN clientes c ON o.cliente_id=c.id LEFT JOIN usuarios us ON o.usuario_id=us.id
        LEFT JOIN rutas rr ON o.ruta_recogida_id=rr.id LEFT JOIN rutas re ON o.ruta_entrega_id=re.id
        LEFT JOIN direcciones_clientes dr ON dr.id=o.dir_recogida_id LEFT JOIN direcciones_clientes de ON de.id=o.dir_entrega_id
        WHERE o.id=${id} AND o.local_id=${lid}`;
      if (!o) return err("Orden no encontrada", 404);
      const [items, pagos, h] = await Promise.all([
        SQL`SELECT * FROM orden_items WHERE orden_id=${id} ORDER BY id`,
        SQL`SELECT p.*, f.nombre AS forma_nombre FROM pagos p LEFT JOIN formas_pago f ON p.forma_pago_id=f.id WHERE p.orden_id=${id} ORDER BY p.id`,
        SQL`SELECT hh.*, us.nombre AS usuario_nombre FROM ordenes_historial hh LEFT JOIN usuarios us ON hh.usuario_id=us.id WHERE hh.orden_id=${id} ORDER BY hh.id`,
      ]);
      return json({ ...o, items, pagos, historial: h });
    }
    if (p === "/ordenes" && m === "POST") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!body.cliente_id) return err("Cliente requerido", 400);
      if (!items.length) return err("Agrega kilos o prendas a la orden", 400);
      const minimo = await cfg("minimo_retiro", 20000), pctCont = await cfg("descuento_continuidad", 10);
      const sub = items.reduce((s: number, i: any) => s + Math.round(N(i.cantidad) * N(i.precio_unit)), 0);
      const pct = body.aplicar_descuento ? pctCont : N(body.descuento_pct);
      const desc = Math.round(sub * pct / 100), del = Math.round(N(body.monto_delivery)), total = sub - desc + del;
      if ((body.retiro_domicilio || body.entrega_domicilio) && total < minimo && !body.forzar)
        return json({ codigo: "MINIMO", error: `El mínimo para servicio a domicilio es ${clp(minimo)} (esta orden suma ${clp(total)})` }, 422);
      const estado = ESTADOS.includes(body.estado_inicial) ? body.estado_inicial : (body.retiro_domicilio && !body.ropa_en_local ? "PRE_ORDEN" : "EN_PROCESO");
      const origen = body.origen || (body.retiro_domicilio ? "DOMICILIO" : "LOCAL");
      return await SQL.begin(async (t) => {
        const [o] = await t`INSERT INTO ordenes (local_id,cliente_id,usuario_id,tipo_doc,estado,estado_pago,origen,tipo_servicio,kilos,
            retiro_domicilio,entrega_domicilio,dir_recogida_id,dir_entrega_id,fecha_recogida,ruta_recogida_id,fecha_entrega,ruta_entrega_id,bultos,observaciones,
            descuento_pct,monto_delivery,monto_total,monto_abonado,saldo_pendiente,es_membresia,es_pre_orden,recibida_el)
          VALUES (${lid},${body.cliente_id},${uid},${body.tipo_doc || "BOLETA"},${estado},'PENDIENTE',${origen},${body.tipo_servicio || "NORMAL"},${N(body.kilos)},
            ${!!body.retiro_domicilio},${!!body.entrega_domicilio},${body.dir_recogida_id || null},${body.dir_entrega_id || null},
            ${body.fecha_recogida || null},${body.ruta_recogida_id || null},${body.fecha_entrega || null},${body.ruta_entrega_id || null},
            ${Number(body.bultos || 1)},${body.observaciones || null},${pct},${del},0,0,0,${!!body.es_membresia},
            ${estado === "PRE_ORDEN"},${estado === "EN_PROCESO" ? new Date() : null}) RETURNING id`;
        await insertarItems(t, o.id, items);
        await recalcular(t, o.id);
        await hist(t, o.id, estado, `Orden creada (${origen.toLowerCase()})${pct ? ` · descuento continuidad ${pct}%` : ""}`, uid);
        if (body.pago && N(body.pago.monto) > 0) {
          await aplicarPago(t, o.id, body.pago.forma_pago_id || null, N(body.pago.monto), body.pago.referencia || null, uid);
          await hist(t, o.id, null, `Pago al ingreso ${clp(N(body.pago.monto))}`, uid);
        }
        const [full] = await t`SELECT * FROM ordenes WHERE id=${o.id}`;
        return json(full, 201);
      });
    }
    if (seg[0] === "ordenes" && seg.length === 2 && m === "PUT") {
      const id = Number(seg[1]);
      return await SQL.begin(async (t) => {
        const [o] = await t`SELECT * FROM ordenes WHERE id=${id} AND local_id=${lid} FOR UPDATE`;
        if (!o) return err("Orden no encontrada", 404);
        if (o.estado === "ANULADA") return err("La orden está anulada", 400);
        if (body.aplicar_descuento !== undefined) body.descuento_pct = body.aplicar_descuento ? await cfg("descuento_continuidad", 10) : 0;
        const campos = ["tipo_doc","fecha_recogida","ruta_recogida_id","fecha_entrega","ruta_entrega_id","dir_recogida_id","dir_entrega_id","observaciones","bultos","kilos","tipo_servicio","retiro_domicilio","entrega_domicilio","monto_delivery","descuento_pct","ot_easylaundry"];
        const upd: Record<string, unknown> = {};
        for (const k of campos) if (k in body) upd[k] = body[k] === "" ? null : body[k];
        if (Object.keys(upd).length) await t`UPDATE ordenes SET ${t(upd)} WHERE id=${id}`;
        if (Array.isArray(body.items)) { await t`DELETE FROM orden_items WHERE orden_id=${id}`; await insertarItems(t, id, body.items); }
        const tot = await recalcular(t, id);
        await hist(t, id, null, body.nota || `Orden editada · total ${clp(tot.total)}`, uid);
        const [r] = await t`SELECT * FROM ordenes WHERE id=${id}`;
        return json(r);
      });
    }
    if (seg[0] === "ordenes" && seg[2] === "estado" && m === "PUT") {
      const id = Number(seg[1]), estado = body.estado;
      if (!ESTADOS.includes(estado)) return err("Estado inválido", 400);
      return await SQL.begin(async (t) => {
        const [o] = await t`SELECT * FROM ordenes WHERE id=${id} AND local_id=${lid} FOR UPDATE`;
        if (!o) return err("Orden no encontrada", 404);
        if (o.estado === "ANULADA") return err("La orden ya está anulada", 400);
        const upd: Record<string, unknown> = { estado, es_pre_orden: estado === "PRE_ORDEN" };
        if (estado === "EN_PROCESO" && !o.recibida_el) upd.recibida_el = new Date();
        if (estado === "LISTA" && !o.lista_el) upd.lista_el = new Date();
        if (estado === "ENTREGADA") { if (!o.entregada_el) upd.entregada_el = new Date(); if (!o.fecha_entrega) upd.fecha_entrega = hoyChile(); }
        if (estado === "ANULADA") { upd.motivo_anulacion = body.motivo_anulacion || body.nota || null; upd.anulada_por = uid; }
        const [r] = await t`UPDATE ordenes SET ${t(upd)} WHERE id=${id} RETURNING *`;
        await hist(t, id, estado, body.nota || body.motivo_anulacion || null, uid);
        return json(r);
      });
    }
    if (seg[0] === "ordenes" && seg[2] === "pago" && m === "POST") {
      const id = Number(seg[1]);
      try {
        return await SQL.begin(async (t) => {
          const r = await aplicarPago(t, id, body.forma_pago_id || null, N(body.monto), body.referencia || null, uid);
          await hist(t, id, null, `Pago ${clp(N(body.monto))}`, uid);
          return json(r, 201);
        });
      } catch (e) { return err((e as Error).message, 400); }
    }

    // ── PROGRAMACIÓN Y RETIROS ──
    if (p === "/programacion") {
      const fecha = q.get("fecha") || hoyChile(), dia = diaSemana(fecha);
      const [rutas, ords, fer] = await Promise.all([
        SQL`SELECT * FROM rutas WHERE local_id=${lid} AND activo=TRUE AND dia_semana=${dia} ORDER BY hora_inicio`,
        SQL`SELECT o.id,o.estado,o.estado_pago,o.saldo_pendiente,o.monto_total,o.kilos,o.bultos,o.fecha_recogida,o.fecha_entrega,o.ruta_recogida_id,o.ruta_entrega_id,
              o.observaciones,o.origen,o.tipo_servicio,o.retiro_domicilio,o.entrega_domicilio,
              c.nombre||' '||COALESCE(c.apellido,'') AS cliente, c.telefono, ${DIRSQL("dr")} AS dir_retiro, ${DIRSQL("de")} AS dir_entrega
            FROM ordenes o JOIN clientes c ON o.cliente_id=c.id
            LEFT JOIN direcciones_clientes dr ON dr.id=o.dir_recogida_id LEFT JOIN direcciones_clientes de ON de.id=o.dir_entrega_id
            WHERE o.local_id=${lid} AND o.estado<>'ANULADA' AND c.es_ladys2=FALSE AND (o.fecha_recogida=${fecha} OR o.fecha_entrega=${fecha}) ORDER BY o.id`,
        SQL`SELECT motivo FROM dias_inhabiles WHERE local_id=${lid} AND fecha=${fecha}`,
      ]);
      const out = rutas.map((r: any) => {
        const retiros = ords.filter((o: any) => o.fecha_recogida === fecha && o.ruta_recogida_id === r.id);
        const entregas = ords.filter((o: any) => o.fecha_entrega === fecha && o.ruta_entrega_id === r.id && o.entrega_domicilio);
        return { ...r, retiros, entregas, usados: retiros.length + entregas.length, cupos: Math.max(0, N(r.puntos_disp) - retiros.length - entregas.length) };
      });
      return json({ fecha, dia, feriado: fer[0]?.motivo || null, rutas: out,
        sin_ruta: ords.filter((o: any) => (o.fecha_recogida === fecha && o.retiro_domicilio && !o.ruta_recogida_id) || (o.fecha_entrega === fecha && o.entrega_domicilio && !o.ruta_entrega_id)),
        en_local: ords.filter((o: any) => o.fecha_entrega === fecha && !o.entrega_domicilio && o.estado !== "ENTREGADA") });
    }
    if (p === "/retiros/disponibilidad" || p === "/webhook/disponibilidad") {
      const fecha = q.get("fecha") || hoyChile(), dia = diaSemana(fecha);
      const rows = await SQL`SELECT r.*, (SELECT COUNT(*)::int FROM ordenes o WHERE o.local_id=r.local_id AND o.estado<>'ANULADA'
          AND ((o.fecha_recogida=${fecha} AND o.ruta_recogida_id=r.id) OR (o.fecha_entrega=${fecha} AND o.ruta_entrega_id=r.id))) AS usados
        FROM rutas r WHERE r.local_id=${lid} AND r.activo=TRUE AND r.dia_semana=${dia} ORDER BY r.hora_inicio`;
      const fer = await SQL`SELECT motivo FROM dias_inhabiles WHERE local_id=${lid} AND fecha=${fecha}`;
      return json({ fecha, dia, feriado: fer[0]?.motivo || null, rutas: rows.map((r: any) => ({ ...r, cupos: Math.max(0, N(r.puntos_disp) - N(r.usados)) })) });
    }
    if ((p === "/retiros" || p === "/webhook/retiro") && m === "POST") return await solicitarRetiro(body, u);

    // ── MEMBRESÍAS ──
    if (p === "/prepagos/planes" && m === "GET") return json(await SQL`SELECT * FROM planes_prepago WHERE local_id=${lid} AND activo=TRUE ORDER BY precio`);
    if (p === "/prepagos/saldos")
      return json(await SQL`SELECT pc.*, c.nombre||' '||COALESCE(c.apellido,'') AS cliente, c.telefono, pp.nombre AS plan, pp.precio AS precio_plan
        FROM prepagos_cliente pc JOIN clientes c ON pc.cliente_id=c.id JOIN planes_prepago pp ON pc.plan_id=pp.id
        WHERE c.local_id=${lid} AND pc.activo=TRUE ORDER BY c.nombre`);
    if (seg[0] === "prepagos" && seg[2] === "movimientos")
      return json(await SQL`SELECT pm.*, o.id AS ot_numero FROM prepago_movimientos pm LEFT JOIN ordenes o ON pm.orden_id=o.id
        WHERE pm.prepago_id=${Number(seg[1])} ORDER BY pm.id DESC`);
    if (p === "/prepagos/activar" && m === "POST") {
      const [pl] = await SQL`SELECT * FROM planes_prepago WHERE id=${body.plan_id}`;
      if (!pl) return err("Plan no encontrado", 404);
      const monto = N(body.monto_pagado) || N(pl.precio), ini = body.fecha_inicio || hoyChile();
      return await SQL.begin(async (t) => {
        const [pc] = await t`INSERT INTO prepagos_cliente (cliente_id,plan_id,saldo_inicial,saldo_actual,fecha_inicio,fecha_venc,activo)
          VALUES (${body.cliente_id},${body.plan_id},${monto},${monto},${ini},(${ini}::date + ${Number(pl.duracion || 30)}), TRUE) RETURNING *`;
        await t`INSERT INTO prepago_movimientos (prepago_id,cliente_id,tipo,monto) VALUES (${pc.id},${body.cliente_id},'CARGA',${monto})`;
        return json(pc, 201);
      });
    }
    if (seg[0] === "prepagos" && seg[2] === "recargar" && m === "POST") {
      const id = Number(seg[1]), monto = N(body.monto);
      return await SQL.begin(async (t) => {
        const [pc] = await t`UPDATE prepagos_cliente SET saldo_actual=saldo_actual+${monto} WHERE id=${id} RETURNING *`;
        await t`INSERT INTO prepago_movimientos (prepago_id,cliente_id,tipo,monto) VALUES (${id},${pc.cliente_id},'RECARGA',${monto})`;
        return json(pc);
      });
    }
    if (seg[0] === "prepagos" && seg[2] === "consumir" && m === "POST") {
      const id = Number(seg[1]), monto = N(body.monto), ordenId = body.orden_id || null;
      return await SQL.begin(async (t) => {
        const [pc] = await t`SELECT * FROM prepagos_cliente WHERE id=${id} FOR UPDATE`;
        if (!pc) return err("Membresía no encontrada", 404);
        if (N(pc.saldo_actual) < monto) return err("Saldo insuficiente", 400);
        await t`UPDATE prepagos_cliente SET saldo_actual=saldo_actual-${monto} WHERE id=${id}`;
        await t`INSERT INTO prepago_movimientos (prepago_id,cliente_id,tipo,monto,orden_id) VALUES (${id},${pc.cliente_id},'CONSUMO',${monto},${ordenId})`;
        if (ordenId) {
          const [fp] = await t`SELECT id FROM formas_pago WHERE local_id=${lid} AND nombre='Membresía' LIMIT 1`;
          await t`INSERT INTO pagos (orden_id,cliente_id,forma_pago_id,monto,referencia,usuario_id) VALUES (${ordenId},${pc.cliente_id},${fp?.id || null},${monto},'Membresía',${uid})`;
          await t`UPDATE ordenes SET monto_abonado=monto_total, saldo_pendiente=0, estado_pago='PAGADA', pagada_el=NOW(), es_membresia=TRUE WHERE id=${ordenId}`;
          await hist(t, ordenId, null, `Pagada con membresía ${clp(monto)}`, uid);
        }
        return json({ ok: true, saldo: N(pc.saldo_actual) - monto });
      });
    }

    // ── DASHBOARD ──
    if (p === "/dashboard") {
      const hoy = hoyChile();
      const [kpis, vd, ts, eo, ma] = await Promise.all([
        SQL`SELECT COALESCE(SUM(o.monto_total) FILTER (WHERE DATE(o.creado_en)=${hoy}),0) AS ventas_hoy,
            COALESCE(SUM(o.monto_total) FILTER (WHERE date_trunc('month',o.creado_en)=date_trunc('month',${hoy}::date)),0) AS ventas_mes,
            COUNT(*) FILTER (WHERE DATE(o.creado_en)=${hoy})::int AS ordenes_hoy,
            COUNT(*) FILTER (WHERE date_trunc('month',o.creado_en)=date_trunc('month',${hoy}::date))::int AS ordenes_mes,
            COUNT(*) FILTER (WHERE o.estado='PRE_ORDEN')::int AS pre_ordenes,
            COUNT(*) FILTER (WHERE o.estado='EN_PROCESO')::int AS en_proceso,
            COUNT(*) FILTER (WHERE o.estado='LISTA')::int AS listas,
            COUNT(*) FILTER (WHERE o.estado='ENTREGADA' AND DATE(o.entregada_el)=${hoy})::int AS entregadas_hoy,
            COALESCE(SUM(o.saldo_pendiente),0) AS por_cobrar,
            COALESCE(SUM(o.kilos) FILTER (WHERE date_trunc('month',o.creado_en)=date_trunc('month',${hoy}::date)),0) AS kilos_mes,
            (SELECT COUNT(*)::int FROM clientes WHERE local_id=${lid} AND activo=TRUE AND es_ladys2=FALSE) AS total_clientes
          FROM ordenes o JOIN clientes c ON o.cliente_id=c.id WHERE o.local_id=${lid} AND c.es_ladys2=FALSE AND o.estado<>'ANULADA'`,
        SQL`SELECT DATE(o.creado_en) AS fecha, COALESCE(SUM(o.monto_total),0) AS total, COUNT(*)::int AS ordenes
          FROM ordenes o JOIN clientes c ON o.cliente_id=c.id WHERE o.local_id=${lid} AND c.es_ladys2=FALSE AND o.estado<>'ANULADA'
          AND o.creado_en >= (${hoy}::date - INTERVAL '29 days') GROUP BY 1 ORDER BY 1`,
        SQL`SELECT i.nombre, SUM(i.cantidad) AS cantidad, SUM(i.subtotal) AS total FROM orden_items i
          JOIN ordenes o ON i.orden_id=o.id JOIN clientes c ON o.cliente_id=c.id
          WHERE o.local_id=${lid} AND c.es_ladys2=FALSE AND o.estado<>'ANULADA' AND date_trunc('month',o.creado_en)=date_trunc('month',${hoy}::date)
          GROUP BY i.nombre ORDER BY total DESC LIMIT 8`,
        SQL`SELECT o.estado, COUNT(*)::int AS cantidad FROM ordenes o JOIN clientes c ON o.cliente_id=c.id
          WHERE o.local_id=${lid} AND c.es_ladys2=FALSE AND o.estado<>'ANULADA' GROUP BY o.estado`,
        SQL`SELECT COALESCE(SUM(o.monto_total),0) AS total FROM ordenes o JOIN clientes c ON o.cliente_id=c.id
          WHERE o.local_id=${lid} AND c.es_ladys2=FALSE AND o.estado<>'ANULADA' AND date_trunc('month',o.creado_en)=date_trunc('month',${hoy}::date - INTERVAL '1 month')`,
      ]);
      return json({ fecha: hoy, kpis: kpis[0], ventasDiarias: vd, topServicios: ts, estadoOrdenes: eo, ventasMesAnterior: ma[0].total });
    }

    // ── SECUNDARIOS ──
    if (p === "/caja/estado") return json(null);
    if (p === "/caja/reporte") return json({ movimientos: [], totales: {} });
    if (p === "/compras" && m === "GET") return json(await SQL`SELECT * FROM compras WHERE local_id=${lid} ORDER BY fecha_compra DESC LIMIT 200`);
    if (p === "/compras" && m === "POST") {
      const [c] = await SQL`INSERT INTO compras (local_id,fecha_compra,folio,tipo_doc,tipo_gasto,total,glosa,usuario_id)
        VALUES (${lid},${body.fecha_compra || hoyChile()},${body.folio || null},${body.tipo_doc || "BOLETA"},${body.tipo_gasto || null},${N(body.total)},${body.glosa || null},${uid}) RETURNING *`;
      return json(c, 201);
    }
    if (p === "/reportes/control") {
      const d = q.get("desde") || hoyChile(), h = q.get("hasta") || hoyChile();
      return json(await SQL`SELECT o.id, o.estado, o.estado_pago, o.monto_total, o.monto_abonado, o.saldo_pendiente, o.creado_en,
          c.nombre||' '||COALESCE(c.apellido,'') AS cliente FROM ordenes o JOIN clientes c ON o.cliente_id=c.id
        WHERE o.local_id=${lid} AND c.es_ladys2=FALSE AND DATE(o.creado_en) BETWEEN ${d} AND ${h} ORDER BY o.id DESC`);
    }
    if (p === "/dias-inhabiles" && m === "POST") {
      const [d] = await SQL`INSERT INTO dias_inhabiles (local_id,fecha,motivo) VALUES (${lid},${body.fecha},${body.motivo || null}) RETURNING *`;
      return json(d, 201);
    }

    return err(`Ruta no encontrada: ${m} ${p}`, 404);
  } catch (e) {
    console.error("ERROR", m, p, (e as Error).message);
    return err((e as Error).message);
  }
});
