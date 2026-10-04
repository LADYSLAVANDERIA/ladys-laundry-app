// ladys-bandeja v2 (04-10-2026) — Bandeja de mensajes de la app (pantalla Mensajes).
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
//
// v2 (04-10): INSTAGRAM y MESSENGER. Se responde con la Send API de la pagina
// (POST /{page}/messages, messaging_type RESPONSE, ventana 24 h igual que WA) con
// configuracion.meta_page_token. Ese token lo deja el flujo de conexion:
//   GET /meta/conectar?t=<jwt admin>  -> dialogo de Facebook (permisos de pagina e IG)
//   GET /meta/callback                -> code -> token largo -> token de la pagina
//        (no vence) -> guarda meta_page_token / meta_page_id / meta_ig_id y
//        suscribe la pagina a la app (messages, message_echoes, postbacks, feed).
// Requiere que la URL de callback este en "URI de redireccionamiento OAuth validos"
// de la app y que los permisos esten agregados a la app (casos de uso).
// Los canales se habilitan solos cuando hay meta_page_token.
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
const CALLBACK = `${SB_URL}/functions/v1/ladys-bandeja/meta/callback`;
const PERMISOS = ["pages_show_list", "pages_messaging", "pages_manage_metadata", "pages_read_engagement",
  "pages_manage_engagement", "instagram_basic", "instagram_manage_messages", "instagram_manage_comments",
  "business_management"];
async function canales() {
  return (await config("meta_page_token")) ? ["WHATSAPP", "INSTAGRAM", "MESSENGER"] : ["WHATSAPP"];
}
async function guardarConfig(clave: string, valor: string) {
  await SQL`INSERT INTO configuracion (clave, valor) VALUES (${clave}, ${valor})
            ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`;
}
const html = (titulo: string, cuerpo: string, ok = true) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${titulo}</title><body style="font-family:system-ui;max-width:520px;margin:40px auto;padding:0 16px;color:#222">
  <h2 style="color:${ok ? "#16a34a" : "#dc2626"}">${titulo}</h2>${cuerpo}
  <p><a href="https://ladyslavanderia.cl/app/#/mensajes">Volver a Mensajes</a></p></body>`,
  { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
const g = async (ruta: string, params: Record<string, string>, metodo = "GET") => {
  const u = new URL(`${GRAPH}/${ruta}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { method: metodo });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d?.error) throw new Error(`${ruta}: ${d?.error?.message || r.status}`);
  return d;
};

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
    if (req.method === "GET" && ruta === "/meta/conectar") {
      const yo0 = await usuario(String(url.searchParams.get("t") || ""));
      if (!yo0) return html("Sesión vencida", "<p>Vuelve a entrar a la app y toca el enlace de nuevo.</p>", false);
      const appId = await config("meta_app_id");
      const d = new URL("https://www.facebook.com/v23.0/dialog/oauth");
      d.searchParams.set("client_id", appId);
      d.searchParams.set("redirect_uri", CALLBACK);
      d.searchParams.set("scope", PERMISOS.join(","));
      d.searchParams.set("state", String(url.searchParams.get("t")));
      d.searchParams.set("response_type", "code");
      return new Response(null, { status: 302, headers: { location: d.toString() } });
    }

    if (req.method === "GET" && ruta === "/meta/callback") {
      if (!(await usuario(String(url.searchParams.get("state") || ""))))
        return html("No se pudo conectar", "<p>La sesión venció. Vuelve a abrir el enlace desde la app.</p>", false);
      const code = String(url.searchParams.get("code") || "");
      if (!code) return html("No se conectó", `<p>Facebook respondió: ${url.searchParams.get("error_description") || "sin permiso"}</p>`, false);
      const appId = await config("meta_app_id"), sec = await config("meta_app_secret");
      try {
        const corto = await g("oauth/access_token", { client_id: appId, client_secret: sec, redirect_uri: CALLBACK, code });
        const largo = await g("oauth/access_token", { grant_type: "fb_exchange_token", client_id: appId,
          client_secret: sec, fb_exchange_token: corto.access_token });
        const pageId = (await config("meta_page_id")) || "104915934635952";
        const cuentas = await g("me/accounts", { access_token: largo.access_token, limit: "100",
          fields: "id,name,access_token,instagram_business_account{id,username}" });
        const pag = (cuentas.data || []).find((p: any) => String(p.id) === pageId);
        if (!pag) return html("Falta la página", `<p>Tu usuario no entregó acceso a la página de Ladys (${pageId}). Vuelve a conectar y marca la página <b>Ladys Lavandería</b> y su Instagram.</p>
          <p>Páginas recibidas: ${(cuentas.data || []).map((p: any) => p.name).join(", ") || "ninguna"}</p>`, false);
        await guardarConfig("meta_page_token", String(pag.access_token));
        await guardarConfig("meta_page_id", pageId);
        const ig = pag.instagram_business_account;
        if (ig?.id) await guardarConfig("meta_ig_id", String(ig.id));
        let sus = "ok";
        try {
          await g(`${pageId}/subscribed_apps`, { access_token: pag.access_token,
            subscribed_fields: "messages,messaging_postbacks,message_echoes,feed" }, "POST");
        } catch (e) { sus = (e as Error).message; }
        return html("Conectado ✓", `<p>Página: <b>${pag.name}</b><br>Instagram: <b>${ig?.username ? "@" + ig.username : "no vinculado a la página"}</b><br>
          Suscripción de mensajes: <b>${sus}</b></p><p>Los mensajes de Instagram y Messenger empiezan a llegar a la pantalla Mensajes.</p>`, sus === "ok");
      } catch (e) {
        return html("No se pudo conectar", `<p>${(e as Error).message}</p>`, false);
      }
    }

    const h = req.headers.get("authorization") || "";
    const tok = h.startsWith("Bearer ") ? h.slice(7) : (url.searchParams.get("t") || h);
    const yo = await usuario(tok);
    if (!yo) return json({ error: "Token requerido" }, 401);
    const uid = Number(yo.id) || null;

    if (req.method === "GET" && ruta === "/conversaciones") {
      const q = String(url.searchParams.get("q") || "").trim().slice(0, 60);
      const filas = await SQL`SELECT * FROM bandeja_conversaciones(${q || null}, 120)`;
      return json({ canales: await canales(), conversaciones: filas });
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
      if (!["WHATSAPP", "INSTAGRAM", "MESSENGER"].includes(canal))
        return json({ error: `${canal} todavia no esta habilitado` }, 400);
      const pageTok = canal === "WHATSAPP" ? "" : await config("meta_page_token");
      if (canal !== "WHATSAPP" && !pageTok)
        return json({ ok: false, error: "Falta conectar la pagina de Facebook (Mensajes > Conectar)." }, 200);

      // Primero se toma la conversacion: asi SofIA no se cruza mientras sale el mensaje.
      await SQL`INSERT INTO bandeja_estado (canal, contacto, tomo_yo, tomo_yo_por, tomo_yo_desde, leido_en, leido_por, actualizado_en)
                VALUES (${canal}, ${contacto}, TRUE, ${uid}, now(), now(), ${uid}, now())
                ON CONFLICT (canal, contacto) DO UPDATE SET tomo_yo = TRUE, tomo_yo_por = ${uid},
                  tomo_yo_desde = now(), leido_en = now(), leido_por = ${uid}, actualizado_en = now()`;

      let d: any = {}, status = 200;
      if (canal === "WHATSAPP") {
        const r = await fetch(`${SB_URL}/functions/v1/ladys-wa/enviar`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": CLAVE_WA },
          body: JSON.stringify({ telefono: contacto, texto }),
        });
        status = r.status;
        d = await r.json().catch(() => ({} as any));
      } else {
        // Ventana de 24 h: texto libre solo si el cliente escribio en las ultimas 24 h.
        const [v] = await SQL`SELECT MAX(creado_en) > NOW() - INTERVAL '24 hours' AS abierta
                                FROM bandeja_mensajes WHERE canal = ${canal} AND contacto = ${contacto} AND direccion = 'entrada'`;
        if (!v?.abierta) {
          d = { enviado: false, fuera_de_ventana: true, error: "Pasaron mas de 24 h desde su ultimo mensaje." };
        } else {
          const pageId = (await config("meta_page_id")) || "104915934635952";
          const r = await fetch(`${GRAPH}/${pageId}/messages?access_token=${encodeURIComponent(pageTok)}`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ recipient: { id: contacto }, messaging_type: "RESPONSE", message: { text: texto } }),
          });
          status = r.status;
          const x = await r.json().catch(() => ({} as any));
          d = x?.message_id ? { enviado: true, wamid: x.message_id } : { enviado: false, error: x?.error?.message || `HTTP ${r.status}` };
        }
      }
      const ok = !!d?.enviado;
      await SQL`INSERT INTO bandeja_envios (canal, contacto, wamid, usuario_id, texto, ok, error)
                VALUES (${canal}, ${contacto}, ${d?.wamid || null}, ${uid}, ${texto}, ${ok},
                        ${ok ? null : String(d?.error || d?.motivo || `HTTP ${status}`).slice(0, 300)})`;
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
