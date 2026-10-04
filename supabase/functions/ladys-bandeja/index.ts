// ladys-bandeja v1 (03-10-2026) — Bandeja de mensajes de la app (pantalla Mensajes).
//
// Una conversacion = (canal, contacto). Hoy solo WHATSAPP; IG / MESSENGER / TIKTOK
// entran al mismo modelo cuando Meta y TikTok aprueben los permisos.
// Fuente: vista ladys.bandeja_mensajes (sobre wa_eventos): entradas del cliente,
// salidas de SofIA (tipo 'salida'), y lo que el equipo escribe desde el celular
// (smb_message_echoes). Lo que se manda desde aca queda en bandeja_envios y sale
// por ladys-wa /enviar (el UNICO punto de salida: ventana 24 h, registro, sombra).
//
// "Tomo yo": al responder desde la app la conversacion queda tomada por esa
// persona y SofIA no contesta (ladys-wa v8 lo revisa) durante
// configuracion.bandeja_tomo_yo_horas (12 h por defecto) o hasta soltarla.
//
// Rutas (todas con JWT de la app):
//   GET  /conversaciones?q=
//   GET  /hilo?canal=&contacto=
//   POST /enviar {canal, contacto, texto}
//   POST /tomo   {canal, contacto, activo}
//   POST /leido  {canal, contacto}
//   GET  /media?id=&t=<jwt>   (imagen de WhatsApp; el link de Meta exige token y dura 7 dias)
import postgres from "npm:postgres@3.4.4";
import * as jose from "npm:jose@5.9.6";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
});
const SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET") || "ladys_jwt_secret_super_seguro_2024");
const CLAVE_WA = Deno.env.get("WEBHOOK_KEY") || "ladys_webhook_2026";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const GRAPH = "https://graph.facebook.com/v23.0";
const CANALES = ["WHATSAPP"]; // se suman INSTAGRAM, MESSENGER, TIKTOK al habilitarlos

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

async function usuario(tok: string) {
  try { const { payload } = await jose.jwtVerify(tok, SECRET); return payload as any; } catch { return null; }
}
async function config(clave: string) {
  const [r] = await SQL`SELECT valor FROM configuracion WHERE clave = ${clave}`;
  return String(r?.valor || "");
}
async function tokenMeta() {
  const waba = await config("meta_waba_id");
  const [o] = await SQL`SELECT token FROM wa_onboarding
     WHERE ok = TRUE AND token IS NOT NULL AND waba_id = ${waba} ORDER BY id DESC LIMIT 1`;
  return String(o?.token || "") || (await config("meta_token"));
}
const limpio = (c: any) => String(c || "").replace(/[^0-9A-Za-z._:-]/g, "").slice(0, 80);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-bandeja/, "").replace(/\/$/, "") || "/";
  try {
    const h = req.headers.get("authorization") || "";
    const tok = h.startsWith("Bearer ") ? h.slice(7) : (url.searchParams.get("t") || h);
    const yo = await usuario(tok);
    if (!yo) return json({ error: "Token requerido" }, 401);
    const uid = Number(yo.id) || null;

    if (req.method === "GET" && ruta === "/conversaciones") {
      const q = String(url.searchParams.get("q") || "").trim().slice(0, 60);
      const filas = await SQL`SELECT * FROM bandeja_conversaciones(${q || null}, 120)`;
      return json({ canales: CANALES, conversaciones: filas });
    }

    if (req.method === "GET" && ruta === "/hilo") {
      const canal = limpio(url.searchParams.get("canal")).toUpperCase();
      const contacto = limpio(url.searchParams.get("contacto"));
      if (!canal || !contacto) return json({ error: "Falta canal o contacto" }, 400);
      const mensajes = await SQL`SELECT * FROM bandeja_hilo(${canal}, ${contacto}, 200)`;
      const [c] = await SQL`SELECT * FROM bandeja_conversaciones(${contacto}, 5) WHERE canal = ${canal} AND contacto = ${contacto}`;
      return json({ conversacion: c || null, mensajes });
    }

    if (req.method === "GET" && ruta === "/media") {
      const id = limpio(url.searchParams.get("id"));
      if (!id) return json({ error: "Falta id" }, 400);
      const t = await tokenMeta();
      const info = await fetch(`${GRAPH}/${id}`, { headers: { Authorization: `Bearer ${t}` } });
      const di = await info.json().catch(() => ({}));
      if (!info.ok || !di?.url) return json({ error: "La imagen ya no esta disponible en Meta (dura 7 dias)" }, 404);
      const bin = await fetch(String(di.url), { headers: { Authorization: `Bearer ${t}` } });
      if (!bin.ok) return json({ error: `Meta descarga ${bin.status}` }, 502);
      return new Response(bin.body, { headers: { ...CORS,
        "content-type": String(di.mime_type || bin.headers.get("content-type") || "application/octet-stream"),
        "cache-control": "private, max-age=86400" } });
    }

    if (req.method !== "POST") return json({ error: "Ruta no encontrada" }, 404);
    const b = await req.json().catch(() => ({} as any));
    const canal = limpio(b.canal).toUpperCase();
    const contacto = limpio(b.contacto);
    if (!canal || !contacto) return json({ error: "Falta canal o contacto" }, 400);

    if (ruta === "/leido") {
      await SQL`INSERT INTO bandeja_estado (canal, contacto, leido_en, leido_por, actualizado_en)
                VALUES (${canal}, ${contacto}, now(), ${uid}, now())
                ON CONFLICT (canal, contacto) DO UPDATE SET leido_en = now(), leido_por = ${uid}, actualizado_en = now()`;
      return json({ ok: true });
    }

    if (ruta === "/tomo") {
      const activo = b.activo !== false;
      await SQL`INSERT INTO bandeja_estado (canal, contacto, tomo_yo, tomo_yo_por, tomo_yo_desde, actualizado_en)
                VALUES (${canal}, ${contacto}, ${activo}, ${activo ? uid : null}, ${activo ? new Date() : null}, now())
                ON CONFLICT (canal, contacto) DO UPDATE SET tomo_yo = ${activo},
                  tomo_yo_por = ${activo ? uid : null}, tomo_yo_desde = ${activo ? new Date() : null}, actualizado_en = now()`;
      return json({ ok: true, tomo_yo: activo });
    }

    if (ruta === "/enviar") {
      const texto = String(b.texto || "").trim().slice(0, 4000);
      if (!texto) return json({ error: "El mensaje esta vacio" }, 400);
      if (canal !== "WHATSAPP") return json({ error: `${canal} todavia no esta habilitado` }, 400);

      // Primero se toma la conversacion: asi SofIA no se cruza mientras sale el mensaje.
      await SQL`INSERT INTO bandeja_estado (canal, contacto, tomo_yo, tomo_yo_por, tomo_yo_desde, leido_en, leido_por, actualizado_en)
                VALUES (${canal}, ${contacto}, TRUE, ${uid}, now(), now(), ${uid}, now())
                ON CONFLICT (canal, contacto) DO UPDATE SET tomo_yo = TRUE, tomo_yo_por = ${uid},
                  tomo_yo_desde = now(), leido_en = now(), leido_por = ${uid}, actualizado_en = now()`;

      const r = await fetch(`${SB_URL}/functions/v1/ladys-wa/enviar`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": CLAVE_WA },
        body: JSON.stringify({ telefono: contacto, texto }),
      });
      const d = await r.json().catch(() => ({} as any));
      const ok = !!d?.enviado;
      await SQL`INSERT INTO bandeja_envios (canal, contacto, wamid, usuario_id, texto, ok, error)
                VALUES (${canal}, ${contacto}, ${d?.wamid || null}, ${uid}, ${texto}, ${ok},
                        ${ok ? null : String(d?.error || d?.motivo || `HTTP ${r.status}`).slice(0, 300)})`;
      if (!ok)
        return json({ ok: false, fuera_de_ventana: !!d?.fuera_de_ventana,
                      error: String(d?.error || d?.motivo || "Meta no acepto el mensaje") }, 200);
      return json({ ok: true, wamid: d.wamid });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
