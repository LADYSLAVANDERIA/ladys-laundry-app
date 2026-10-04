// ladys-wa v7 - canal propio de WhatsApp (Cloud API de Meta), entrada Y salida.
//
// App "Ladys Mensajeria" 2319302108806020, portfolio ladyslavanderia
// 357817798549522, WABA 465648913293459, numero +56 9 7541 0232
// (phone_number_id 463802600154819) en coexistence.
//
// v4 (30-09, bitacora #232): SofIA POR META. Interruptor configuracion.sofia_canal.
//   - 'ghl'  (por defecto): todo sigue como antes, SofIA la dispara GHL.
//   - 'meta': cada mensaje entrante del numero de Ladys despierta a SofIA desde
//     aca. Espera 8 s por si el cliente sigue escribiendo (solo responde el
//     ultimo), junta lo que el cliente escribio sin respuesta, le pide la
//     respuesta a ladys-sofia2 en modo prueba (asi sofia2 NO toca GHL para
//     enviar) y la manda por Meta. Se registra en sofia_mensajes ANTES de enviar
//     y solo se marca enviado con la confirmacion de Meta.
//   - Silencios: si una persona escribio desde el celular (smb_message_echoes)
//     hace menos de sofia_silencio_humano_minutos, SofIA no responde. Si SofIA
//     derivo hace menos de sofia_silencio_minutos, tampoco.
//   - Derivar: como sofia2 en modo prueba no avisa, el aviso al n8n lo hace aca.
//   - Imagenes: se bajan de Meta con el token (el link de Meta exige token y
//     dura 7 dias) y se guardan en el bucket privado wa-media; a sofia2 se le
//     pasa un link firmado. Asi los comprobantes quedan guardados.
//   - Notas de voz: la transcripcion es de GHL; por Meta todavia no. Se le pide
//     al cliente que lo escriba.
//   - El token: el de Embedded Signup (wa_onboarding) si existe; si no, meta_token.
//
// v5 (02-10, bitacora #238/#239): numero en WABA 1103177355380677 (portfolio
//   TopKreativa, temporal). Espera de rafaga 8 s -> 3 s. Cuando SofIA va a
//   responder, se marca el mensaje como leido con "escribiendo..." (typing
//   indicator de Cloud API, dura hasta 25 s o hasta la respuesta). Si el webhook
//   falla (p.ej. sin conexiones a la base) responde 500 para que Meta REINTENTE
//   en vez de perder el evento.
//
// v6 (02-10, bitacora #242): LAS IMAGENES NUNCA SE GUARDARON. El bucket wa-media
//   tenia 0 archivos: SUPABASE_SERVICE_ROLE_KEY es una clave nueva "sb_secret_..."
//   que NO es un JWT, y mandada como "Authorization: Bearer" Storage la rechaza
//   ("Invalid Compact JWS", 400). Ahora va en el header "apikey" (y Bearer solo
//   si la clave es un JWT viejo "eyJ..."). Ademas, una imagen que no se pudo
//   guardar ya NO se pierde en silencio: si era lo unico que mando el cliente,
//   se le responde que una persona la revisa y se avisa al equipo; si venia con
//   texto, SofIA sabe que hubo una imagen que no pudo abrir.
//
// v7 (02-10, bitacora #243/#244): RESPUESTAS DOBLES. Joanna, Karina y una
//   postulante mandaron 2 mensajes con 9-17 s de diferencia. La espera de 3 s no
//   alcanzaba: el 1er mensaje ya estaba en SofIA (~15 s) cuando llego el 2do, y
//   cada corrida respondio con los dos mensajes (a veces con datos distintos).
//   Ahora: (1) espera de rafaga 12 s (Lufi, 02-10 14:45, caso Valeria: 3 mensajes
//   seguidos con ~9 s entre cada uno; con la region de abajo SofIA tarda ~5 s
//   menos, asi que el cliente espera ~17 s en total); (2) ANTES de llamar a SofIA y ANTES de
//   enviar se revisa si llego otro mensaje del mismo numero que esta corrida no
//   incluyo; si llego, esta corrida NO responde (queda en sofia_mensajes con
//   respuesta NULL, motivo_envio 'descartada...' y las herramientas que uso, para
//   que SofIA sepa lo que ya hizo) y responde UNA vez la corrida del ultimo
//   mensaje, con todo junto. (3) La llamada a ladys-sofia2 va con x-region
//   sa-east-1 (donde esta la base): preparar el contexto son ~17 consultas en
//   serie y desde otra region cada una cruzaba el continente (4-9 s). El pool
//   max:3 no era el problema: la base tenia 5 de 60 conexiones.
//
// LAS TRAMPAS DEL WEBHOOK DE META:
// 1. Meta AGRUPA. entry[], changes[], messages[] son ARRAYS. Nunca leer solo [0].
// 2. Meta REINTENTA. Se deduplica por wamid (UNIQUE + ON CONFLICT DO NOTHING).
// 3. NO hay garantia de orden.
// 4. Hay que responder 200 RAPIDO: SofIA corre en segundo plano (waitUntil).
// 5. La media se baja con token y solo por 7 DIAS.
// 6. Solo el campo "messages" trae mensajes VIVOS; "history" trae viejos.
//
// LA VENTANA DE 24 HORAS: texto libre solo dentro de 24 h desde el ultimo
// mensaje DEL CLIENTE. Fuera de eso, plantilla. Nunca se finge un envio.
import postgres from "npm:postgres@3.4.4";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
});
const CLAVE = Deno.env.get("WEBHOOK_KEY") || "ladys_webhook_2026";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SOFIA = `${SB_URL}/functions/v1/ladys-sofia2/mensaje`;
const REGION_BD = "sa-east-1";
const GRAPH = "https://graph.facebook.com/v23.0";
const SEGUNDOS_ENTRE_MENSAJES = 6;
const ESPERA_MS = 12000;
const BUCKET = "wa-media";

// v6: una clave "sb_secret_..." va en apikey; Bearer solo si es un JWT ("eyJ...").
const hStorage = (extra: Record<string, string>) => ({
  apikey: SB_KEY,
  ...(SB_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SB_KEY}` } : {}),
  ...extra,
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-hub-signature-256, x-api-key",
  "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

const soloDigitos = (t: any) => String(t ?? "").replace(/\D/g, "");
const paraMeta = (t: any) => {
  const d = soloDigitos(t);
  if (!d) return "";
  if (d.startsWith("56")) return d;
  if (d.length === 9) return "56" + d;
  return d;
};
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: any) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

async function config(clave: string) {
  const [r] = await SQL`SELECT valor FROM configuracion WHERE clave = ${clave}`;
  return String(r?.valor || "");
}

// v4: el token del Embedded Signup manda; si no hay, el del usuario de sistema.
async function credenciales() {
  const waba = await config("meta_waba_id");
  const [o] = await SQL`
    SELECT token, phone_number_id FROM wa_onboarding
     WHERE ok = TRUE AND token IS NOT NULL AND waba_id = ${waba}
     ORDER BY id DESC LIMIT 1`;
  return {
    tok: String(o?.token || "") || (await config("meta_token")),
    phoneId: String(o?.phone_number_id || "") || (await config("meta_phone_number_id")),
  };
}

async function firmaValida(crudo: string, cabecera: string, secreto: string) {
  if (!secreto) return null;
  const esperado = String(cabecera || "").replace(/^sha256=/, "").toLowerCase();
  if (!esperado) return false;
  const clave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(crudo));
  const calculado = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  if (calculado.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < calculado.length; i++) dif |= calculado.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

function textoDe(m: any) {
  const t = String(m?.type || "");
  if (t === "text") return String(m.text?.body || "");
  if (t === "button") return String(m.button?.text || "");
  if (t === "interactive")
    return String(m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "");
  if (t === "image" || t === "video" || t === "document") return String(m[t]?.caption || `[${t}]`);
  if (t === "audio") return "[audio]";
  if (t === "location") return "[ubicacion]";
  if (t === "sticker") return "[sticker]";
  if (t === "reaction") return `[reaccion ${m.reaction?.emoji || ""}]`;
  return `[${t || "desconocido"}]`;
}

// Se le puede escribir texto libre solo si EL escribio en las ultimas 24 h.
async function ventana(telefono: string) {
  const d = paraMeta(telefono);
  const [r] = await SQL`
    SELECT MAX(creado_en) AS ultimo
      FROM wa_eventos
     WHERE tipo = 'mensaje' AND de = ${d}`;
  if (!r?.ultimo) return { abierta: false, desde: null as any, minutos: null as any };
  const min = Math.round((Date.now() - new Date(r.ultimo).getTime()) / 60000);
  return { abierta: min < 24 * 60, desde: r.ultimo, minutos: min };
}

async function demasiadoSeguido(telefono: string) {
  const d = paraMeta(telefono);
  const [r] = await SQL`
    SELECT MAX(creado_en) AS ultimo FROM wa_eventos
     WHERE tipo = 'salida' AND de = ${d}
       AND creado_en > NOW() - (${SEGUNDOS_ENTRE_MENSAJES} || ' seconds')::interval`;
  return !!r?.ultimo;
}

async function aMeta(cuerpo: any) {
  const { tok, phoneId } = await credenciales();
  if (!tok || !phoneId) return { ok: false, error: "faltan token o phone_number_id" };
  const r = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...cuerpo }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d?.error) {
    const e = d?.error || {};
    return { ok: false, error: String(e.message || `HTTP ${r.status}`),
             codigo: e.code ?? null, subcodigo: e.error_subcode ?? null };
  }
  return { ok: true, wamid: d?.messages?.[0]?.id || null };
}

// El unico punto por donde sale un mensaje.
async function enviar(a: any) {
  const telefono = paraMeta(a.telefono);
  if (!telefono) return { ok: false, error: "falta el telefono" };

  const texto = String(a.texto || "").trim();
  const plantilla = String(a.plantilla || "").trim();
  if (!texto && !plantilla) return { ok: false, error: "no hay nada que enviar" };

  const v = await ventana(telefono);
  const forzarPlantilla = !!plantilla && (a.siempre_plantilla === true || !v.abierta);

  if (!texto && !forzarPlantilla && !v.abierta)
    return { ok: false, fuera_de_ventana: true,
             error: "Hace mas de 24 h que no escribe, asi que solo se le puede mandar una plantilla aprobada." };
  if (texto && !forzarPlantilla && !v.abierta)
    return { ok: false, fuera_de_ventana: true,
             error: "Fuera de la ventana de 24 h: texto libre no llega. Hace falta plantilla." };

  const cuerpo = forzarPlantilla
    ? { to: telefono, type: "template",
        template: { name: plantilla, language: { code: String(a.idioma || "es") },
          components: Array.isArray(a.parametros) && a.parametros.length
            ? [{ type: "body", parameters: a.parametros.map((p: any) => ({ type: "text", text: String(p) })) }]
            : [] } }
    : { to: telefono, type: "text", text: { preview_url: false, body: texto } };

  const activo = (await config("meta_envio_activo")) === "true";
  const resumen = forzarPlantilla ? `[plantilla ${plantilla}] ${(a.parametros || []).join(", ")}` : texto;

  if (!activo) {
    await SQL`INSERT INTO wa_eventos (canal, tipo, de, cuerpo, payload)
              VALUES ('WHATSAPP', 'sombra', ${telefono}, ${resumen}, ${SQL.json({ cuerpo, ventana: v })})`;
    return { ok: true, enviado: false, modo: "sombra",
             motivo: "meta_envio_activo no esta en true: se anoto pero no se envio",
             habria_mandado: forzarPlantilla ? "plantilla" : "texto", ventana: v };
  }

  for (let i = 0; i < 3 && await demasiadoSeguido(telefono); i++) await esperar(2500);

  const r = await aMeta(cuerpo);
  await SQL`INSERT INTO wa_eventos (canal, tipo, wamid, de, cuerpo, payload)
            VALUES ('WHATSAPP', ${r.ok ? "salida" : "salida_fallida"}, ${r.ok ? r.wamid : null},
                    ${telefono}, ${resumen}, ${SQL.json({ cuerpo, resultado: r, ventana: v })})`;
  return r.ok
    ? { ok: true, enviado: true, wamid: r.wamid, via: forzarPlantilla ? "plantilla" : "texto", ventana: v }
    : { ok: false, enviado: false, error: r.error, codigo: r.codigo, ventana: v };
}

// ---------------------------------------------------------------- SofIA v4 --

// Baja un archivo de Meta y lo guarda en el bucket privado. Devuelve link firmado.
// v6: si falla, devuelve { error } con el paso y el codigo, en vez de null mudo.
async function guardarMedia(mediaId: string, telefono: string): Promise<any> {
  try {
    const { tok } = await credenciales();
    const info = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${tok}` } });
    const di = await info.json().catch(() => ({}));
    if (!info.ok || !di?.url) return { error: `Meta media ${info.status}` };
    const bin = await fetch(String(di.url), { headers: { Authorization: `Bearer ${tok}` } });
    if (!bin.ok) return { error: `Meta descarga ${bin.status}` };
    const tipo = String(di.mime_type || bin.headers.get("content-type") || "application/octet-stream").split(";")[0];
    const ext = tipo.split("/")[1] || "bin";
    const ruta = `${telefono}/${Date.now()}_${mediaId}.${ext}`;
    const bytes = new Uint8Array(await bin.arrayBuffer());
    const up = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: "POST",
      headers: hStorage({ "content-type": tipo, "x-upsert": "true" }),
      body: bytes,
    });
    if (!up.ok) return { error: `Storage subida ${up.status}: ${(await up.text().catch(() => "")).slice(0, 120)}` };
    const sg = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
      method: "POST",
      headers: hStorage({ "content-type": "application/json" }),
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
    });
    const ds = await sg.json().catch(() => ({}));
    const rel = String(ds?.signedURL || ds?.signedUrl || "");
    if (!rel) return { error: `Storage firma ${sg.status}` };
    return { url: rel.startsWith("http") ? rel : `${SB_URL}/storage/v1${rel}`, tipo };
  } catch (e) { return { error: String((e as Error).message).slice(0, 150) }; }
}

// Texto de los ecos (lo que escribe el equipo desde el celular) hacia ese numero.
function textosEco(payload: any, tel: string) {
  const v = payload?.value || {};
  const lista = Array.isArray(v?.message_echoes) ? v.message_echoes : [];
  return lista.filter((e: any) => soloDigitos(e?.to) === tel)
    .map((e: any) => String(e?.text?.body || e?.type || ""));
}

async function avisarN8n(nombre: string, telefono: string, motivo: string) {
  try {
    const url = (await config("n8n_webhook_agente")) ||
                "https://lufi.app.n8n.cloud/webhook/ladys-agente-humano";
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact_id: "", nombre, telefono, motivo, origen: "SofIA por Meta" }) });
    return r.ok;
  } catch { return false; }
}

// v7: llego un mensaje del cliente que esta corrida NO incluyo? Entonces esta
// corrida no responde: lo hace la del ultimo mensaje, con todo junto.
async function hayMasNuevo(tel: string, ultimoIncluido: number) {
  const [n] = await SQL`SELECT id FROM wa_eventos WHERE tipo = 'mensaje' AND de = ${tel} AND id > ${ultimoIncluido} LIMIT 1`;
  return !!n;
}

async function despertarSofia(idEvento: number, tel: string) {
  await esperar(ESPERA_MS);
  if ((await config("sofia_canal")) !== "meta") return;
  if ((await config("sofia_activa")) !== "true") return;

  // Solo responde el ULTIMO mensaje de una rafaga.
  if (await hayMasNuevo(tel, idEvento)) return;

  const contactId = `wa:${tel}`;
  const [yo] = await SQL`SELECT wamid FROM wa_eventos WHERE id = ${idEvento}`;
  const wamid = String(yo?.wamid || "");

  // Registrar ANTES de trabajar: si otro proceso ya lo tomo, no se duplica.
  const reg = await SQL`
    INSERT INTO sofia_mensajes (telefono, contact_id, mensaje_ghl_id, entrada, canal)
    VALUES (${tel}, ${contactId}, ${wamid}, ${"(juntando)"}, 'WhatsApp')
    ON CONFLICT (mensaje_ghl_id) WHERE mensaje_ghl_id IS NOT NULL DO NOTHING
    RETURNING id`;
  if (!reg.length) return;
  const filaId = reg[0].id;

  try {
    // Silencio tras derivar.
    const minDerivar = Number(await config("sofia_silencio_minutos")) || 10;
    const [derivada] = await SQL`
      SELECT id FROM sofia_mensajes WHERE contact_id = ${contactId} AND escalado = TRUE AND id <> ${filaId}
         AND creado_en > NOW() - (${minDerivar} || ' minutes')::interval LIMIT 1`;

    // Silencio si una persona escribio desde el celular.
    const minHumano = Number(await config("sofia_silencio_humano_minutos")) || 60;
    const ecos = await SQL`
      SELECT creado_en, payload FROM wa_eventos
       WHERE tipo = 'smb_message_echoes' AND payload::text LIKE ${"%" + tel + "%"}
         AND creado_en > NOW() - (${minHumano} || ' minutes')::interval
       ORDER BY id DESC LIMIT 5`;
    let humano = false;
    if (ecos.length) {
      const sistema = await SQL`
        SELECT mensaje AS t FROM marketing_envios WHERE mensaje IS NOT NULL AND creado_en > NOW() - INTERVAL '72 hours'
        UNION ALL SELECT mensaje FROM orden_avisos WHERE mensaje IS NOT NULL AND creado_en > NOW() - INTERVAL '24 hours'`;
      const conocidos = new Set(sistema.map((x: any) => norm(x.t)));
      for (const e of ecos)
        for (const t of textosEco(e.payload, tel))
          if (!conocidos.has(norm(t))) humano = true;
    }
    if (derivada || humano) {
      await SQL`DELETE FROM sofia_mensajes WHERE id = ${filaId}`;
      return;
    }

    // v5: "escribiendo..." en el celular del cliente mientras SofIA piensa.
    if (wamid) {
      try { await aMeta({ status: "read", message_id: wamid, typing_indicator: { type: "text" } }); }
      catch { /* no es critico */ }
    }

    // Lo que el cliente escribio y nadie le respondio todavia.
    const [ult] = await SQL`
      SELECT GREATEST(
        (SELECT MAX(creado_en) FROM sofia_mensajes WHERE contact_id = ${contactId} AND respuesta IS NOT NULL),
        (SELECT MAX(creado_en) FROM wa_eventos WHERE tipo = 'salida' AND de = ${tel}),
        NOW() - INTERVAL '30 minutes') AS desde`;
    const pendientes = await SQL`
      SELECT id, cuerpo, payload FROM wa_eventos
       WHERE tipo = 'mensaje' AND de = ${tel} AND creado_en > ${ult.desde}
       ORDER BY id`;
    // v7: el ultimo mensaje que esta corrida cubre.
    let ultimoIncluido = idEvento;
    for (const p of pendientes) if (Number(p.id) > ultimoIncluido) ultimoIncluido = Number(p.id);
    const textos: string[] = [];
    const adjuntos: string[] = [];
    const fallas: string[] = [];
    let audio = false;
    for (const p of pendientes) {
      const m = p.payload?.mensaje || {};
      const t = String(m?.type || "");
      if (t === "audio") { audio = true; continue; }
      if ((t === "image" || t === "document") && m[t]?.id && adjuntos.length < 3) {
        const g = await guardarMedia(String(m[t].id), tel);
        if (g?.url) adjuntos.push(g.url);
        else fallas.push(String(g?.error || "sin detalle"));
        const cap = String(m[t]?.caption || "").trim();
        if (cap) textos.push(cap);
        continue;
      }
      if (t === "reaction" || t === "sticker") continue;
      const c = String(p.cuerpo || "").trim();
      if (c && c !== "[edit]") textos.push(c);
    }

    // v6: una imagen que no se pudo guardar no se pierde en silencio.
    if (fallas.length)
      await avisarN8n("Cliente de WhatsApp", tel,
        `Mando ${fallas.length} imagen(es) que no se pudieron abrir (${fallas[0].slice(0, 120)}). Revisa el chat en el celular.`);

    if (!textos.length && !adjuntos.length) {
      if (audio) {
        const pedir = "Hola \u{1F60A} Por ahora no puedo escuchar audios. \u00bfMe lo escribes en un mensaje? As\u00ed te ayudo al tiro.";
        await SQL`UPDATE sofia_mensajes SET entrada = '[nota de voz]', respuesta = ${pedir} WHERE id = ${filaId}`;
        const e = await enviar({ telefono: tel, texto: pedir });
        await SQL`UPDATE sofia_mensajes SET enviado = ${!!e.enviado}, motivo_envio = ${e.enviado ? null : String(e.error || e.motivo || "")} WHERE id = ${filaId}`;
      } else if (fallas.length) {
        const decir = "Recib\u00ed tu imagen \u{1F44D} En un momento alguien del equipo la revisa y te responde.";
        await SQL`UPDATE sofia_mensajes SET entrada = '[imagen que no se pudo abrir]', respuesta = ${decir},
                    error = ${("imagen: " + fallas[0]).slice(0, 300)}, escalado = TRUE,
                    motivo_escala = 'imagen que no se pudo abrir' WHERE id = ${filaId}`;
        const e = await enviar({ telefono: tel, texto: decir });
        await SQL`UPDATE sofia_mensajes SET enviado = ${!!e.enviado}, motivo_envio = ${e.enviado ? null : String(e.error || e.motivo || "")} WHERE id = ${filaId}`;
      } else {
        await SQL`DELETE FROM sofia_mensajes WHERE id = ${filaId}`;
      }
      return;
    }

    const texto = textos.join("\n") +
      (audio ? "\n[Tambien mando una nota de voz que no puedes escuchar: pidele que te la escriba.]" : "") +
      (fallas.length ? "\n[Tambien mando una imagen que no se pudo abrir: ya se aviso al equipo; no le pidas que la reenvie.]" : "");
    await SQL`UPDATE sofia_mensajes SET entrada = ${texto} WHERE id = ${filaId}`;

    // v7: si mientras juntaba llego otro mensaje, que responda esa corrida.
    if (await hayMasNuevo(tel, ultimoIncluido)) {
      await SQL`UPDATE sofia_mensajes SET enviado = FALSE,
                  motivo_envio = 'descartada: el cliente siguio escribiendo, responde la corrida de su ultimo mensaje'
                WHERE id = ${filaId}`;
      return;
    }

    // v7: x-region = donde esta la base, para que preparar el contexto no cruce el continente.
    const r = await fetch(SOFIA, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": CLAVE, "x-region": REGION_BD },
      body: JSON.stringify({ contact_id: contactId, telefono: tel, canal: "WhatsApp",
                             texto, adjuntos, responder: false }),
    });
    const s = await r.json().catch(() => ({} as any));
    const respuesta = String(s?.respuesta || "").trim();
    if (!r.ok || !respuesta) {
      const falla = String(s?.error || `sofia2 HTTP ${r.status}`).slice(0, 300);
      await SQL`UPDATE sofia_mensajes SET error = ${falla}, escalado = TRUE, motivo_escala = 'falla tecnica' WHERE id = ${filaId}`;
      await avisarN8n("Cliente de WhatsApp", tel, `SofIA (Meta) no pudo responder: ${falla}`);
      return;
    }

    const usadas = Array.isArray(s?.detalle_herramientas) ? s.detalle_herramientas : [];

    // v7: el cliente escribio otra cosa mientras SofIA pensaba. Esta respuesta NO
    // sale (no cubre lo nuevo y seria la segunda). Se guardan las herramientas
    // (si agendo o registro algo, la corrida siguiente lo ve en LO QUE YA HICISTE)
    // y la respuesta queda NULL para que sus mensajes entren en la corrida siguiente.
    if (await hayMasNuevo(tel, ultimoIncluido)) {
      await SQL`UPDATE sofia_mensajes SET herramientas = ${JSON.stringify(usadas)},
                  orden_id = ${s?.orden_creada ?? null}, enviado = FALSE,
                  motivo_envio = ${("descartada: el cliente siguio escribiendo mientras SofIA pensaba. No enviado: " + respuesta).slice(0, 600)}
                WHERE id = ${filaId}`;
      return;
    }

    const der = usadas.find((u: any) => u?.herramienta === "derivar_a_persona") ||
                usadas.find((u: any) => u?.salida?.derivar);
    const motivo = s?.derivar_a_persona
      ? String(der?.entrada?.motivo || der?.salida?.error || "derivado").slice(0, 180) : null;

    await SQL`UPDATE sofia_mensajes SET
        respuesta = ${respuesta}, herramientas = ${JSON.stringify(usadas)},
        orden_id = ${s?.orden_creada ?? null}, escalado = ${!!motivo}, motivo_escala = ${motivo}
      WHERE id = ${filaId}`;

    if (motivo) await avisarN8n(String(s?.cliente || "Cliente de WhatsApp"), tel, motivo);

    const e = await enviar({ telefono: tel, texto: respuesta });
    await SQL`UPDATE sofia_mensajes SET enviado = ${!!e.enviado},
                motivo_envio = ${e.enviado ? null : String(e.error || e.motivo || "no enviado").slice(0, 200)}
              WHERE id = ${filaId}`;
    if (!e.enviado)
      await avisarN8n(String(s?.cliente || "Cliente de WhatsApp"), tel,
        `SofIA respondio pero Meta no lo entrego: ${String(e.error || e.motivo || "").slice(0, 150)}`);
  } catch (err) {
    await SQL`UPDATE sofia_mensajes SET error = ${String((err as Error).message).slice(0, 300)} WHERE id = ${filaId}`;
    await avisarN8n("Cliente de WhatsApp", tel, `SofIA (Meta) fallo: ${String((err as Error).message).slice(0, 150)}`);
  }
}

function enSegundoPlano(p: Promise<unknown>) {
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(p.catch(() => {}));
  else p.catch(() => {});
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-wa/, "").replace(/\/$/, "") || "/";

  try {
    if (req.method === "GET" && (ruta === "/" || ruta === "/webhook")) {
      const modo = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const reto = url.searchParams.get("hub.challenge");
      if (modo === "subscribe" && token && token === (await config("meta_verify_token")) && reto)
        return new Response(reto, { status: 200, headers: { "content-type": "text/plain" } });
      return new Response("forbidden", { status: 403, headers: { "content-type": "text/plain" } });
    }

    if (req.method === "GET" && ruta === "/salud") {
      const [n] = await SQL`
        SELECT COUNT(*) FILTER (WHERE tipo = 'mensaje')::int AS entrantes,
               COUNT(*) FILTER (WHERE tipo = 'salida')::int AS enviados,
               COUNT(*) FILTER (WHERE tipo = 'salida_fallida')::int AS fallidos,
               COUNT(*) FILTER (WHERE tipo = 'sombra')::int AS en_sombra,
               MAX(creado_en) AS ultimo
        FROM wa_eventos`;
      const ultimos = await SQL`
        SELECT tipo, de, LEFT(COALESCE(cuerpo,''), 70) AS cuerpo, creado_en
        FROM wa_eventos ORDER BY id DESC LIMIT 10`;
      const { tok, phoneId } = await credenciales();
      return json({
        version: 7,
        espera_rafaga_ms: ESPERA_MS,
        envio_activo: (await config("meta_envio_activo")) === "true",
        sofia_canal: await config("sofia_canal"),
        token_de: tok === (await config("meta_token")) ? "usuario_de_sistema" : "embedded_signup",
        firma_configurada: !!(await config("meta_app_secret")),
        storage_clave: SB_KEY.startsWith("eyJ") ? "jwt" : SB_KEY ? "sb_secret (apikey)" : "FALTA",
        numero: phoneId, waba: await config("meta_waba_id"),
        eventos: n, ultimos,
      });
    }

    if (req.method === "POST" && ruta === "/enviar") {
      if ((req.headers.get("x-api-key") || url.searchParams.get("k") || "") !== CLAVE)
        return json({ error: "no autorizado" }, 401);
      const b = await req.json().catch(() => ({} as any));
      return json(await enviar(b));
    }

    if (req.method === "GET" && ruta === "/ventana") {
      if ((req.headers.get("x-api-key") || url.searchParams.get("k") || "") !== CLAVE)
        return json({ error: "no autorizado" }, 401);
      const v = await ventana(String(url.searchParams.get("telefono") || ""));
      return json({ ...v, puede_texto_libre: v.abierta,
        aviso: v.abierta ? "Escribio hace poco: se le puede mandar texto libre."
                         : "Fuera de las 24 horas: solo plantilla aprobada." });
    }

    if (req.method !== "POST") return json({ error: "Ruta no encontrada" }, 404);

    const crudo = await req.text();
    const ok = await firmaValida(crudo, req.headers.get("x-hub-signature-256") || "",
                                 await config("meta_app_secret"));
    if (ok === false) return json({ error: "firma invalida" }, 401);

    let cuerpo: any;
    try { cuerpo = JSON.parse(crudo); } catch { return json({ error: "json invalido" }, 400); }

    const canal = String(cuerpo?.object || "") === "whatsapp_business_account" ? "WHATSAPP"
                : String(cuerpo?.object || "") === "instagram" ? "INSTAGRAM"
                : String(cuerpo?.object || "") === "page" ? "MESSENGER" : "OTRO";

    let guardados = 0, repetidos = 0;
    const miNumero = await config("meta_phone_number_id");
    const despertar = new Map<string, number>();

    for (const entry of (Array.isArray(cuerpo?.entry) ? cuerpo.entry : [])) {
      const wabaId = String(entry?.id || "");
      for (const cambio of (Array.isArray(entry?.changes) ? entry.changes : [])) {
        const v = cambio?.value || {};
        const phoneId = String(v?.metadata?.phone_number_id || "");
        const esVivo = !cambio?.field || cambio.field === "messages";

        if (esVivo) {
          for (const m of (Array.isArray(v?.messages) ? v.messages : [])) {
            const r = await SQL`
              INSERT INTO wa_eventos (canal, tipo, wamid, de, phone_id, waba_id, cuerpo, payload)
              VALUES (${canal}, 'mensaje', ${String(m?.id || "")}, ${String(m?.from || "")},
                      ${phoneId || null}, ${wabaId || null}, ${textoDe(m)},
                      ${SQL.json({ mensaje: m, contactos: v?.contacts ?? null, firma: ok })})
              ON CONFLICT (wamid) DO NOTHING RETURNING id`;
            if (r.length) {
              guardados++;
              if (canal === "WHATSAPP" && phoneId === miNumero && m?.from)
                despertar.set(String(m.from), Math.max(despertar.get(String(m.from)) || 0, Number(r[0].id)));
            } else repetidos++;
          }

          for (const s of (Array.isArray(v?.statuses) ? v.statuses : [])) {
            await SQL`
              INSERT INTO wa_eventos (canal, tipo, de, phone_id, waba_id, cuerpo, payload)
              VALUES (${canal}, 'estado', ${String(s?.recipient_id || "")}, ${phoneId || null},
                      ${wabaId || null}, ${String(s?.status || "")}, ${SQL.json(s)})`;
            guardados++;
          }
        }

        if (!esVivo || (!Array.isArray(v?.messages) && !Array.isArray(v?.statuses))) {
          await SQL`
            INSERT INTO wa_eventos (canal, tipo, de, phone_id, waba_id, cuerpo, payload)
            VALUES (${canal}, ${String(cambio?.field || "otro")}, ${null}, ${phoneId || null},
                    ${wabaId || null}, ${null}, ${SQL.json(cambio)})`;
          guardados++;
        }
      }

      for (const msg of (Array.isArray(entry?.messaging) ? entry.messaging : [])) {
        const mid = String(msg?.message?.mid || "");
        const r = await SQL`
          INSERT INTO wa_eventos (canal, tipo, wamid, de, phone_id, cuerpo, payload)
          VALUES (${canal}, 'mensaje', ${mid || null}, ${String(msg?.sender?.id || "")},
                  ${String(entry?.id || "")}, ${String(msg?.message?.text || "")}, ${SQL.json(msg)})
          ON CONFLICT (wamid) DO NOTHING RETURNING id`;
        if (r.length) guardados++; else repetidos++;
      }
    }

    if (despertar.size && (await config("sofia_canal")) === "meta")
      for (const [tel, id] of despertar) enSegundoPlano(despertarSofia(id, tel));

    return json({ ok: true, canal, guardados, repetidos });
  } catch (e) {
    try {
      await SQL`INSERT INTO wa_eventos (canal, tipo, cuerpo, payload)
                VALUES ('OTRO', 'error', ${String((e as Error).message).slice(0, 300)}, ${SQL.json({})})`;
    } catch { /* nada */ }
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
