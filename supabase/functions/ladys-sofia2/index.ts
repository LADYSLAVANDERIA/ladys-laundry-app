// SofIA 2.0 — agente de Ladys Lavandería.
//
// ⚠️ AL EDITAR ESTA FUNCIÓN: descarga SIEMPRE la versión que está desplegada y
// parte de ahí. El 11-sep-2026 un despliegue hecho sobre una copia vieja borró,
// de una sola vez, el sábado con retiros, la transcripción de audios, el arreglo
// de emojis y el de campañas. No hay copia en git: la fuente única es lo
// desplegado.
//
// EL EQUIPO REGISTRA COMPROBANTES DE CLIENTES (26-sep-2026, v38): Alexandra
// mandó el comprobante de Asunción (pedido 6565) y SofIA no lo aplicó. Tres
// fallas juntas: (1) con alguien del equipo SofIA seguía usando SU ficha de
// cliente (Alexandra también es clienta), así que estado_pedidos le mostró los
// pedidos de Alexandra y registrar_comprobante buscó el 6565 entre ellos; (2) el
// prompt del equipo decía "no registres pagos"; (3) la imagen llegó en un
// mensaje y el número de pedido en el siguiente, y SofIA ya no tenía la imagen.
// Ahora: con el equipo NO se usa su ficha de cliente; tiene ver_pedido (busca
// cualquier pedido por número o nombre) y registrar_comprobante con orden_id
// abona a CUALQUIER pedido, con el usuario del equipo como responsable; y si el
// comprobante vino en un mensaje anterior (hasta 30 min), se le vuelve a mostrar.
//
// FACTURA A EMPRESA (25-sep-2026, v35, bitácora #198): Luz Adriana Fajardo pidió
// factura, mandó razón social, RUT, giro y dirección, y SofIA le respondió
// "Anoto todo para la factura". No anotó nada: registrar_cliente solo aceptaba
// nombre, apellido, email y dirección, así que la ficha nació PARTICULAR con
// BOLETA y los datos quedaron sueltos en las observaciones del pedido. Ahora
// existe registrar_datos_factura (y registrar_cliente acepta los mismos campos):
// valida el dígito verificador del RUT, no duplica una empresa que ya es
// cliente, deja la ficha como EMPRESA/FACTURA y pasa a FACTURA los pedidos
// abiertos. agendar_retiro toma el tipo de documento de la ficha en vez de
// poner BOLETA fijo. Y a una ficha de empresa se la saluda por el nombre de la
// persona, no por la razón social.
// v36 (mismo día): en el sistema una ficha de EMPRESA lleva la razón social en
// nombre/apellido (así la muestran la app, las OT y los reportes) y la persona
// en contacto. v35 dejaba el nombre de la persona en nombre y la OT 6683 se veía
// a nombre de Luz Adriana. Ahora guardarFactura parte la razón social en
// nombre/apellido, y buscarCliente saluda a una empresa por su contacto.
//
// SOFIA SE RETRACTABA DE LO QUE SÍ HIZO (25-sep-2026, v37, bitácora #199):
// Laura Cea mandó su comprobante a las 14:40, SofIA lo registró bien y el pedido
// 6671 quedó PAGADO. A las 16:11 Laura escribió "Gracias" y SofIA respondió
// "cometí un error, me adelanté, reenvíame el comprobante". Lo mismo con María
// el 14-sep (pedido 6534). La causa: el modelo NO ve los resultados de las
// herramientas de turnos anteriores; en el hilo solo ve "[imagen adjunta]" y su
// propio "quedó registrado", cree que lo inventó y se retracta. Al reenviar, el
// duplicado se derivaba a una persona. Ahora: (1) cada mensaje lleva "LO QUE YA
// HICISTE", sacado de la base (comprobantes registrados y acciones de las
// últimas horas), con la orden de no retractarse; (2) el mismo comprobante
// reenviado por el mismo cliente se confirma como ya registrado, sin derivar;
// (3) registrar_comprobante sin imagen ya no invita a pedir que lo reenvíe.
//
// TELÉFONO COMPARTIDO Y SECTOR (24-sep-2026, v34, bitácora #189): Alejandra
// Vidaurre preguntó por su ropa y SofIA le dijo dos veces que no tenía pedidos.
// Su teléfono está en DOS fichas (la suya y CASAS BALI SPA) y buscarCliente se
// quedaba con una sola, la de más pedidos. Ahora devuelve ids_mismo_telefono y
// estado_pedidos, link_pago, anular_retiro y registrar_comprobante miran TODAS
// esas fichas; cada pedido trae a_nombre_de y se saluda con el nombre de la
// persona, nunca con el de la empresa. Además la línea de Direcciones del
// contexto no traía el SECTOR: Soledad (sector Reñaca, ciudad Viña del Mar)
// recibió cobro de despacho de Viña. Ahora el sector va en la ficha.
//
// CLIENTE DE QUINTERO (23-sep-2026, v33): Catalina lo atendía a mano y a los 11
// minutos de su último mensaje SofIA volvió a responder (el silencio por
// "persona atendiendo" era de 10 min). Ahora ese silencio se lee de
// sofia_silencio_humano_minutos (60); el silencio tras DERIVAR sigue en
// sofia_silencio_minutos. Además: las notas de voz del hilo aparecían como
// "[imagen adjunta]" y SofIA contestó "veo que me enviaste una imagen"; ahora
// salen como [nota de voz]. Y cuando el cliente REENVÍA un mensaje nuestro (lo
// hizo para mostrar que SofIA dijo lo contrario que Catalina), SofIA lo sabe, no
// lo repite ni lo defiende, y si contradice a una persona del equipo deriva.
//
// EL EQUIPO TAMBIÉN ESCRIBE: Lufi, Alexandra y Catalina hablan con SofIA por el
// mismo WhatsApp que los clientes. La identidad la pone el número y la lista sale
// de ladys.usuarios, así que dar de baja a alguien ahí lo saca de aquí también.
//
// Y TAMBIÉN ESCRIBEN LOS PROVEEDORES (17-sep-2026): hasta hoy había dos mundos,
// el equipo y "todo lo demás es cliente", así que el proveedor de agua recíía
// precios de lavado por kilo y ofertas del Club. Ahora existe ladys.proveedores
// y quien esté ahí se trata como lo que es: alguien a quien le COMPRAMOS. No se
// le vende, no se le agenda retiro y no ve nada de clientes. Puede dejar
// anotado un precio o una entrega (queda por confirmar, nunca como un hecho
// cerrado), y la plata siempre pasa por una persona. Hacerle pedidos desde acá
// todavía no existe: eso llega con el botón de la app.
//
// LO QUE EL EQUIPO REPORTA NO SE PIERDE (12-sep-2026): Catalina avisó por audio
// que la pantalla del taller fallaba y SofIA la mandó a "hablar con Luis u
// operaciones", que es como no decir nada: el reporte murió en el chat. Ahora
// existe registrar_mejora, que deja fallas, ideas y dudas en ladys.mejoras. Lo
// urgente además dispara el aviso a Lufi al toque. Se consulta con
// GET /mejoras (y por SQL) para trabajarlas después una por una.
//
// ANULAR UN RETIRO LO HACE ELLA (14-sep-2026): Stephany Pernia avisó a las 12:32
// que no estarían en casa y SofIA respondió "un ejecutivo te contacta ahora
// mismo". Nadie la contactó y la camioneta iba igual a su casa a las 15:00. No
// era falta de ganas: no existía la herramienta y el prompt mandaba a derivar.
// Ahora existe anular_retiro, con candados: solo un retiro AGENDADO, sin ropa ya
// retirada y sin pagos. La parada sale sola de la ruta porque el trigger
// parada_sigue_a_la_orden la borra al anular. Reagendar ya lo hacía
// agendar_retiro, moviendo el pedido existente.
//
// QUIÉN SE MUEVE LO DECIDE EL SISTEMA (17-sep-2026, bitácora #97): el pedido 6599
// de Bárbara iba a SU casa y SofIA le escribió "te esperamos en un ratito".
// estadoPedidos devolvía frases sueltas por etapa y el booleano a_domicilio
// aparte, y el cierre lo armaba el modelo: tercer caso del mismo patrón. Ahora
// cada pedido viaja con quien_se_mueve (LADYS_VA · CLIENTE_VIENE · NADIE_TODAVIA)
// y con frase, la oración completa ya redactada cruzando etapa con
// entrega_domicilio y retiro_domicilio, con fecha y franja adentro. La frase se
// copia tal cual: no se reescribe.
//
// NOTAS DE VOZ CON TRANSCRIPCIÓN PROPIA: el modelo no recibe audio. El audio se
// registra en audio_transcripciones y se transcribe con Whisper abierto
// (faster-whisper) en GitHub Actions, workflow transcribir-audio.yml del repo
// ladys-reporte. El texto vuelve por POST /transcripcion y se procesa como un
// mensaje escrito, marcado con [Audio transcrito]. Sin servicios pagados.
//
// LOS MENSAJES DE CAMPAÑA NO SON "UNA PERSONA ATENDIENDO": los envíos de
// Marketing salen a mano desde el celular y para GHL eso es una persona, así que
// SofIA se callaba justo con quien respondía a la campaña. Ahora un mensaje que
// está en marketing_envios o que calza con una plantilla cuenta como del sistema.
//
// TEXTO CORTADO POR LA MITAD DE UN CARÁCTER: emojis y letras decorativas ocupan
// DOS unidades en JavaScript. Se recorta con cortar() y todo lo que va al modelo
// pasa por sano().
//
// FECHAS ALTERNATIVAS LAS CALCULA EL SISTEMA: cuando una fecha no sirve,
// cupos_ruta devuelve los días más cercanos ya revisados contra feriados,
// domingos, antelación y cupos. SofIA nunca propone días de memoria.
//
// RUTAS: lunes a SÁBADO, 10:00-13:00 y 15:00-18:00, las dos con retiro y entrega.
// El sábado NO se corta a mano: sus rutas viven en la tabla.
//
// EL MENSAJE AL QUE EL CLIENTE RESPONDE NO SE PIERDE · EL HILO SE CORTA A 12
// HORAS · UN MENSAJE, UNA RESPUESTA (INSERT ON CONFLICT) · SofIA VE LAS IMÁGENES
// y lee comprobantes de transferencia.
//
// CASO VIOLETA (09-sep-2026): los cupos cuentan PARADAS (retiros más entregas),
// hay antelación mínima, y reagendar mueve la orden existente en vez de crear otra.
import postgres from "npm:postgres@3.4.4";
import * as jose from "npm:jose@5.9.6";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
});
const CLAVE = Deno.env.get("WEBHOOK_KEY") || "ladys_webhook_2026";
const SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET") || "ladys_jwt_secret_super_seguro_2024");
const COBROS = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ladys-cobros`;
const YO = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ladys-sofia2`;
const LOC = "o1V9sCKjH5Ywd9PRURj0";
const REPO_TRANSCRIPCION = "LADYSLAVANDERIA/ladys-reporte";
const HORAS_DE_HILO = 12;
const FORMA_TRANSFERENCIA = 1;
const MARCA_IMAGEN = "[imagen adjunta]";
const MARCA_VOZ = "[nota de voz]";
const MAX_ADJUNTOS = 3;
const MAX_BYTES = 4_500_000;
const TIPOS_ADJUNTO: Record<string, "image" | "document"> = {
  "image/jpeg": "image", "image/jpg": "image", "image/png": "image",
  "image/webp": "image", "image/gif": "image", "application/pdf": "document",
};
const esAudio = (tipo: string) =>
  tipo.startsWith("audio/") || tipo === "video/ogg" || tipo === "application/ogg";
// v33: en el hilo, un adjunto de audio se nombra como nota de voz, no como imagen.
const pareceAudio = (u: string) =>
  /\.(ogg|oga|opus|mp3|m4a|aac|amr|wav|weba)(\?|#|$)/i.test(u) || /audio/i.test(u);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

const clp = (v: any) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CL");
const cola = (t: string) => String(t || "").replace(/\D/g, "").slice(-8);
const hoyChile = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
const ahoraChile = () =>
  new Date().toLocaleTimeString("en-GB", { timeZone: "America/Santiago", hour12: false }).slice(0, 5);
const norm = (s: string) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 120).toLowerCase();
const planoTxt = (s: string) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
const sinTilde = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const soloAlfaNum = (s: string) => sinTilde(s).replace(/[^a-z0-9]/g, "");
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sano = (s: any) => String(s ?? "")
  .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
const cortar = (s: any, n: number) => sano(Array.from(String(s ?? "")).slice(0, n).join(""));
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const DIAS_BD = ["DOMINGO","LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// v34: todas las fichas que comparten el teléfono de quien escribe.
const idsDe = (cli: any): number[] =>
  Array.isArray(cli?.ids_mismo_telefono) && cli.ids_mismo_telefono.length
    ? cli.ids_mismo_telefono.map(Number)
    : (cli?.cliente_id ? [Number(cli.cliente_id)] : []);

function minutosDeAntelacion(fecha: string, hora: string) {
  const sale  = new Date(`${fecha}T${String(hora).slice(0, 5)}:00`);
  const ahora = new Date(`${hoyChile()}T${ahoraChile()}:00`);
  if (isNaN(sale.getTime()) || isNaN(ahora.getTime())) return 99999;
  return Math.round((sale.getTime() - ahora.getTime()) / 60000);
}

function fechaLarga(f: any) {
  if (!f) return null;
  const iso = f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10);
  const d = new Date(iso + "T12:00:00");
  return isNaN(d.getTime()) ? null : `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function sumarDias(f: string, n: number) {
  const d = new Date(f + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// v37: "hoy 14:40" o "jueves 24 de septiembre 19:38", en hora de Chile.
function fechaHora(f: any) {
  const d = f instanceof Date ? f : new Date(f);
  if (isNaN(d.getTime())) return "";
  const dia = d.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const hora = d.toLocaleTimeString("en-GB", { timeZone: "America/Santiago", hour12: false }).slice(0, 5);
  return dia === hoyChile() ? `hoy ${hora}` : `${fechaLarga(dia)} ${hora}`;
}

async function config(clave: string) {
  const [r] = await SQL`SELECT valor FROM configuracion WHERE clave = ${clave}`;
  return String(r?.valor || "");
}
async function antelacionMinima() {
  const min = Number(await config("retiro_antelacion_minutos"));
  if (min > 0) return Math.round(min);
  const horas = Number(await config("retiro_antelacion_horas"));
  return Math.round((horas > 0 ? horas : 4) * 60);
}

function enTiempo(min: number) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} minutos`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} hora${h === 1 ? "" : "s"}`;
}

const GHL_H = (pit: string) => ({
  Authorization: `Bearer ${pit}`, Version: "2021-04-15",
  Accept: "application/json", "Content-Type": "application/json",
});
const CANAL_DE_TIPO: Record<string, string> = {
  TYPE_WHATSAPP: "WhatsApp", TYPE_INSTAGRAM: "IG", TYPE_FACEBOOK: "FB",
  TYPE_SMS: "SMS", TYPE_EMAIL: "Email", TYPE_LIVE_CHAT: "Live_Chat",
};
const CANALES: Record<string, string> = {
  whatsapp: "WhatsApp", wa: "WhatsApp", ig: "IG", instagram: "IG",
  fb: "FB", facebook: "FB", messenger: "FB",
  sms: "SMS", email: "Email", live_chat: "Live_Chat",
};

function tieneContenido(m: any) {
  return String(m?.body || "").trim().length > 0 ||
         (Array.isArray(m?.attachments) && m.attachments.length > 0);
}

async function mensajesDe(pit: string, conversacionId: string, limite = 16) {
  const r = await fetch(
    `https://services.leadconnectorhq.com/conversations/${conversacionId}/messages?limit=${limite}`,
    { headers: GHL_H(pit) });
  if (!r.ok) return null;
  const d = await r.json();
  return (d?.messages?.messages || []).filter(tieneContenido);
}

function esReciente(m: any, horas = HORAS_DE_HILO) {
  const t = new Date(m?.dateAdded || 0).getTime();
  if (!t) return false;
  return Date.now() - t < horas * 3600 * 1000;
}

async function esDelSistema(contactId: string, body: string) {
  const b = norm(body);
  if (!b) return false;
  const hechos = await SQL`
    SELECT respuesta AS texto FROM sofia_mensajes
     WHERE contact_id = ${contactId} AND respuesta IS NOT NULL
       AND creado_en > NOW() - INTERVAL '24 hours'
    UNION ALL
    SELECT mensaje FROM orden_avisos
     WHERE mensaje IS NOT NULL AND creado_en > NOW() - INTERVAL '24 hours'
    UNION ALL
    SELECT mensaje FROM marketing_envios
     WHERE mensaje IS NOT NULL AND creado_en > NOW() - INTERVAL '72 hours'`;
  if (hechos.some((x: any) => norm(x.texto) === b)) return true;
  const cuerpo = planoTxt(body);
  const plantillas = await SQL`SELECT valor FROM configuracion WHERE clave LIKE 'marketing_plantilla%'`;
  return plantillas.some((p: any) => String(p.valor).split(/\{[a-z_]+\}/i)
    .map(planoTxt).filter((f: string) => f.length >= 40)
    .some((f: string) => cuerpo.includes(f)));
}

function base64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}

async function bajarAdjunto(url: string) {
  try {
    const ctl = new AbortController();
    const reloj = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(reloj);
    if (!r.ok) return null;
    const tipo = String(r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (esAudio(tipo)) {
      try { await r.body?.cancel(); } catch { /* nada */ }
      return { url, tipo, audio: true };
    }
    const clase = TIPOS_ADJUNTO[tipo];
    if (!clase) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) return null;
    const media = tipo === "image/jpg" ? "image/jpeg" : tipo;
    return { url, tipo: media,
      bloque: { type: clase, source: { type: "base64", media_type: media, data: base64(buf) } } };
  } catch { return null; }
}

async function bajarAdjuntos(urls: string[]) {
  const salida: any[] = [];
  for (const u of (urls || []).slice(0, MAX_ADJUNTOS)) {
    const a = await bajarAdjunto(String(u));
    if (a) salida.push(a);
  }
  return salida;
}

async function despacharTranscripcion(id: number, url: string) {
  const token = await config("github_token");
  if (!token) return { ok: false, motivo: "falta github_token en configuracion" };
  try {
    const r = await fetch(
      `https://api.github.com/repos/${REPO_TRANSCRIPCION}/actions/workflows/transcribir-audio.yml/dispatches`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
                   "Content-Type": "application/json", "User-Agent": "ladys-sofia2" },
        body: JSON.stringify({ ref: "main", inputs: { id: String(id), url } }) });
    if (r.status === 204) return { ok: true, motivo: null };
    return { ok: false, motivo: `GitHub ${r.status}: ${(await r.text()).slice(0, 150)}` };
  } catch (e) { return { ok: false, motivo: String((e as Error).message) }; }
}

async function ultimoMensaje(pit: string, contactId: string) {
  const u = `https://services.leadconnectorhq.com/conversations/search` +
            `?locationId=${LOC}&contactId=${encodeURIComponent(contactId)}&limit=1`;
  const r = await fetch(u, { headers: GHL_H(pit) });
  if (!r.ok) return { ok: false, motivo: `GHL ${r.status}` };
  const d = await r.json();
  const c = d?.conversations?.[0];
  if (!c) return { ok: false, motivo: "el contacto no tiene conversación" };
  const conv = String(c.id || "");
  for (let intento = 0; intento < 2; intento++) {
    const lista = await mensajesDe(pit, conv, 5);
    const nuevo = lista?.[0];
    if (nuevo && String(nuevo.direction) === "inbound") {
      return { ok: true, conversacion: conv, mensajeId: String(nuevo.id || ""),
               texto: String(nuevo.body || "").trim(),
               adjuntos: Array.isArray(nuevo.attachments) ? nuevo.attachments : [],
               canal: CANAL_DE_TIPO[String(nuevo.messageType)] ||
                      CANAL_DE_TIPO[String(c.lastMessageType)] || "WhatsApp",
               entrante: true };
    }
    if (intento === 0) await esperar(1500);
  }
  return { ok: true, conversacion: conv, mensajeId: "",
           texto: String(c.lastMessageBody || "").trim(), adjuntos: [],
           canal: CANAL_DE_TIPO[String(c.lastMessageType)] || "WhatsApp",
           entrante: false };
}

async function hiloGHL(pit: string, conversacionId: string, contactId: string,
                       textoActual: string, minutos: number) {
  const vacio = { mensajes: [] as any[], humano: false, haceMin: null as number | null,
                  viejos: 0, previo: "" };
  if (!conversacionId) return vacio;
  try {
    const todos = await mensajesDe(pit, conversacionId, 16);
    if (!todos) return vacio;
    const brutos = todos.filter((m: any) => esReciente(m));
    const viejos = todos.length - brutos.length;

    let humano = false, haceMin: number | null = null;
    const ultimaSalida = brutos.find((m: any) => String(m.direction) === "outbound");
    if (ultimaSalida && !(await esDelSistema(contactId, String(ultimaSalida.body || "")))) {
      const t = new Date(ultimaSalida.dateAdded || 0).getTime();
      haceMin = t ? Math.round((Date.now() - t) / 60000) : null;
      humano = haceMin === null ? true : haceMin < minutos;
    }

    const actual = cortar(textoActual, 600);
    const salida: any[] = [];
    for (const m of [...brutos].reverse()) {
      const adj = Array.isArray(m.attachments) ? m.attachments.map(String) : [];
      const marca = adj.some(pareceAudio) ? MARCA_VOZ : MARCA_IMAGEN;
      const cuerpo = cortar(String(m.body || "").trim() || marca, 600);
      const rol = String(m.direction) === "inbound" ? "user" : "assistant";
      // Se salta solo el mensaje ENTRANTE que se está respondiendo. Uno nuestro
      // con el mismo texto (un reenvío del cliente) se queda en el hilo.
      if (rol === "user" && cuerpo === actual) continue;
      if (salida.length && salida[salida.length - 1].role === rol)
        salida[salida.length - 1].content += "\n" + cuerpo;
      else salida.push({ role: rol, content: cuerpo });
    }

    const previas: string[] = [];
    while (salida.length && salida[0].role !== "user") previas.push(salida.shift().content);

    return { mensajes: salida.slice(-12), humano, haceMin, viejos,
             previo: cortar(previas.join("\n"), 700) };
  } catch { return vacio; }
}

async function responderPorGHL(pit: string, contactId: string, canal: string, mensaje: string) {
  if (!pit) return { enviado: false, motivo: "falta el PIT de GHL" };
  if (!contactId) return { enviado: false, motivo: "el webhook no mandó contact_id" };
  if (!mensaje) return { enviado: false, motivo: "sin texto que enviar" };
  const tipo = CANALES[String(canal || "").toLowerCase()] || canal || "WhatsApp";
  try {
    const r = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
      method: "POST", headers: GHL_H(pit),
      body: JSON.stringify({ type: tipo, contactId, message: mensaje }),
    });
    if (r.ok) return { enviado: true, canal: tipo, motivo: null };
    return { enviado: false, canal: tipo, motivo: `GHL ${r.status}` };
  } catch (e) { return { enviado: false, canal: tipo, motivo: String((e as Error).message) }; }
}

async function telefonoDe(pit: string, contactId: string) {
  try {
    const r = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`,
      { headers: { Authorization: `Bearer ${pit}`, Version: "2021-07-28", Accept: "application/json" } });
    if (!r.ok) return "";
    const d = await r.json();
    return String(d?.contact?.phone || "");
  } catch { return ""; }
}

async function catalogo(busqueda: string) {
  const filas = await SQL`
    SELECT COALESCE(c.nombre, 'OTROS') AS categoria, s.nombre,
           s.precio_lav_secado AS lavado, s.precio_lav_planch AS lav_planch,
           s.precio_solo_planch AS solo_planch, s.precio_productos AS producto,
           s.dias_habiles
    FROM servicios s LEFT JOIN categorias c ON c.id = s.categoria_id
    WHERE s.activo AND s.nombre <> 'AJUSTE POR PEDIDO MÍNIMO'
    ORDER BY c.orden, s.nombre`;
  const items = filas.map((f: any) => {
    const lav = Number(f.lavado), lp = Number(f.lav_planch);
    const sp = Number(f.solo_planch), pr = Number(f.producto);
    const precio = Math.max(lav, lp, sp, pr);
    const tipo = precio <= 0 ? ""
               : lav === precio ? "lavado y secado"
               : lp === precio ? "lavado y planchado"
               : sp === precio ? "solo planchado"
               : "producto o tratamiento";
    return { categoria: f.categoria, servicio: f.nombre, precio, precio_texto: clp(precio),
             incluye: tipo, dias_habiles: Number(f.dias_habiles) };
  }).filter((x: any) => x.precio > 0);
  const q = sinTilde(busqueda || "").trim();
  if (!q) return { total: items.length, aviso: "Búscalo por nombre." };
  const palabras = q.split(/\s+/).filter((w) => w.length > 2);
  const puntaje = (i: any) => {
    const txt = sinTilde(i.servicio + " " + i.categoria);
    return palabras.filter((w) => txt.includes(w)).length;
  };
  const hit = items.map((i: any) => ({ i, p: puntaje(i) })).filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p).slice(0, 12).map((x) => x.i);
  if (!hit.length) return { encontrados: [],
    aviso: "No existe ese servicio. NO inventes un precio: deriva a un ejecutivo." };
  return { encontrados: hit };
}

async function planesClub() {
  const filas = await SQL`
    SELECT nombre, precio, kilos_incluidos, kilo_adicional, modalidad, descripcion, servicios_incluidos
    FROM planes_prepago WHERE activo ORDER BY orden, precio`;
  return { pagina: "https://ladyslavanderia.cl/club",
    planes: filas.map((p: any) => ({
      plan: p.nombre, precio_mes: clp(p.precio),
      kilos_incluidos: String(p.modalidad) === "ILIMITADO" ? "sin tope" : Number(p.kilos_incluidos),
      kilo_extra: Number(p.kilo_adicional) > 0 ? clp(p.kilo_adicional) : null,
      incluye: p.servicios_incluidos, detalle: p.descripcion })) };
}

// v34 (bitácora #189): un mismo teléfono puede estar en VARIAS fichas (la de la
// persona y la de su empresa). La ficha principal sigue siendo la de más pedidos
// (es la que se usa para agendar), pero se devuelven TODOS los ids para que
// ningún pedido quede fuera, y el nombre para saludar es el de la persona.
// v35: una ficha de empresa guarda a la persona en nombre o en contacto: se la
// saluda por ahí, nunca por la razón social.
async function buscarCliente(telefono: string) {
  const t = cola(telefono);
  if (t.length < 8) return { encontrado: false };
  const fichas = await SQL`
    SELECT c.id, c.nombre, c.apellido, c.razon_social, c.telefono, c.email, c.tipo,
           c.contacto, c.tipo_doc, c.id_fiscal,
           (SELECT COUNT(*) FROM ordenes o WHERE o.cliente_id = c.id)::int AS n
    FROM clientes c WHERE c.activo
      AND RIGHT(regexp_replace(COALESCE(c.telefono,''), '\\D', '', 'g'), 8) = ${t}
    ORDER BY n DESC, c.id DESC`;
  if (!fichas.length) return { encontrado: false };
  const c = fichas[0];
  const esEmpresa = (f: any) => !!f.razon_social || String(f.tipo) === "EMPRESA";
  const nombreDe = (f: any) => f.razon_social || [f.nombre, f.apellido].filter(Boolean).join(" ");
  const persona = fichas.find((f: any) => !esEmpresa(f)) || c;
  const ids = fichas.map((f: any) => Number(f.id));
  const variasFichas = ids.length > 1;
  const dirs = await SQL`
    SELECT d.id, d.cliente_id, TRIM(CONCAT_WS(' ', d.calle, d.numero)) AS direccion, d.otro AS depto,
           d.sector, COALESCE(NULLIF(d.comuna_geo,''), d.ciudad) AS comuna, d.es_principal
    FROM direcciones_clientes d WHERE d.cliente_id = ANY(${ids}::int[])
    ORDER BY (d.cliente_id = ${c.id}) DESC, d.es_principal DESC, d.id`;
  const [h] = await SQL`
    SELECT COUNT(*)::int AS pedidos, COALESCE(SUM(monto_total),0) AS gastado,
           MAX(fecha_recogida) AS ultimo
    FROM ordenes WHERE cliente_id = ANY(${ids}::int[]) AND estado <> 'ANULADA'`;
  const nombreFicha = new Map(fichas.map((f: any) => [Number(f.id), nombreDe(f)]));
  const personaNombre = esEmpresa(persona)
    ? (persona.contacto || persona.nombre || persona.razon_social || "")
    : (persona.nombre || "");
  return {
    encontrado: true, cliente_id: c.id,
    ids_mismo_telefono: ids,
    fichas: fichas.map((f: any) => ({ cliente_id: Number(f.id), nombre: nombreDe(f),
      es_empresa: esEmpresa(f), pedidos: Number(f.n) || 0 })),
    nombre: String(personaNombre).split(" ")[0],
    nombre_completo: esEmpresa(persona) && !variasFichas
      ? (persona.contacto || [persona.nombre, persona.apellido].filter(Boolean).join(" ") || nombreDe(persona))
      : nombreDe(persona),
    email: persona.email || c.email || null, telefono: c.telefono || null,
    factura: String(c.tipo_doc) === "FACTURA" && c.id_fiscal
      ? { razon_social: c.razon_social || null, rut: c.id_fiscal } : null,
    direcciones: dirs.map((x: any) => ({ ...x,
      a_nombre_de: variasFichas ? nombreFicha.get(Number(x.cliente_id)) || null : null })),
    pedidos_historicos: Number(h?.pedidos) || 0,
    gastado_total: clp(h?.gastado), ultimo_retiro: fechaLarga(h?.ultimo),
  };
}

// QUIEN ESCRIBE PUEDE SER DEL EQUIPO. La lista sale de ladys.usuarios, que es
// donde ya viven los teléfonos del equipo: no se duplica en ninguna parte.
async function buscarColaborador(telefono: string) {
  const t = cola(telefono);
  if (t.length < 8) return null;
  const [u] = await SQL`
    SELECT id, nombre, apellido, perfil FROM usuarios
     WHERE estado = TRUE AND telefono IS NOT NULL
       AND RIGHT(regexp_replace(telefono, '\\D', '', 'g'), 8) = ${t}
     ORDER BY id LIMIT 1`;
  if (!u) return null;
  return { usuario_id: u.id, nombre: String(u.nombre || "").trim(),
           nombre_completo: [u.nombre, u.apellido].filter(Boolean).join(" "),
           perfil: String(u.perfil || "") };
}

// O PUEDE SER UN PROVEEDOR: alguien a quien le COMPRAMOS. Vive en
// ladys.proveedores y se reconoce por los últimos 8 dígitos, igual que el equipo
// y los clientes.
async function buscarProveedor(telefono: string) {
  const t = cola(telefono);
  if (t.length < 8) return null;
  const [p] = await SQL`
    SELECT id, nombre, rubro, contacto, entrega_en_local, notas
      FROM proveedores
     WHERE activo AND telefono IS NOT NULL
       AND RIGHT(regexp_replace(telefono, '\\D', '', 'g'), 8) = ${t}
     ORDER BY id LIMIT 1`;
  if (!p) return null;
  const articulos = await SQL`
    SELECT nombre, unidad, precio, confirmado
      FROM proveedor_precios WHERE proveedor_id = ${p.id}`;
  return {
    proveedor_id: p.id, nombre: String(p.nombre || "").trim(),
    rubro: p.rubro || null, contacto: p.contacto || null,
    entrega_en_local: !!p.entrega_en_local, notas: p.notas || null,
    articulos: articulos.map((a: any) => ({
      articulo: a.nombre, unidad: a.unidad || null,
      precio: Number(a.precio) > 0 ? clp(a.precio) : null,
      precio_confirmado: !!a.confirmado })),
  };
}

// Lo que le hemos pedido y lo que nos ha traído. Sirve para responderle sin
// inventar y para no volver a pedir algo que ya está pedido.
async function pedidosProveedor(prov: any) {
  if (!prov) return { error: "Esto es solo para proveedores." };
  const filas = await SQL`
    SELECT p.id, p.estado, p.fecha_esperada, p.pedido_en, p.recibido_en, p.total,
           p.pagado, p.nota,
           (SELECT string_agg(i.nombre || ' x' || ROUND(i.cantidad, 0), ' + ')
              FROM proveedor_pedido_items i WHERE i.pedido_id = p.id) AS detalle
      FROM proveedor_pedidos p
     WHERE p.proveedor_id = ${prov.proveedor_id}
     ORDER BY p.id DESC LIMIT 8`;
  return {
    proveedor: prov.nombre,
    nos_vende: prov.articulos,
    pedidos: filas.map((p: any) => ({
      numero: p.id, estado: p.estado, detalle: p.detalle,
      esperado: fechaLarga(p.fecha_esperada),
      pedido: fechaLarga(p.pedido_en), recibido: fechaLarga(p.recibido_en),
      total: Number(p.total) > 0 ? clp(p.total) : null, pagado: !!p.pagado,
      nota: p.nota,
    })),
    aviso: "Habla solo de estos pedidos y con estas fechas. Si te pregunta por un pago o una " +
           "factura, no confirmes nada de plata: deriva a una persona.",
  };
}

// Lo que el proveedor cuenta queda anotado, pero SIEMPRE como algo por
// confirmar: un precio nuevo no es un precio aceptado y una entrega contada por
// WhatsApp no es una entrega revisada en el local.
async function anotarProveedor(a: any, prov: any) {
  if (!prov) return { ok: false, error: "Esto es solo para proveedores." };
  const tipo = ["PRECIO", "ENTREGA", "NOTA"].includes(String(a.tipo).toUpperCase())
    ? String(a.tipo).toUpperCase() : "NOTA";
  const detalle = cortar(String(a.detalle || "").trim(), 500);
  const porDefecto = prov.articulos?.[0]?.articulo || "";

  if (tipo === "PRECIO") {
    const precio = Math.round(Number(a.precio) || 0);
    if (precio <= 0)
      return { ok: false, error: "Sin un monto claro no se anota un precio. Pídéselo o anótalo como NOTA." };
    const nombre = cortar(String(a.articulo || porDefecto).trim(), 120);
    if (!nombre) return { ok: false, error: "Falta de qué artículo es el precio. Pregúntaselo." };
    const [r] = await SQL`
      INSERT INTO proveedor_articulos (proveedor_id, nombre, unidad, precio, confirmado, vigente_desde)
      VALUES (${prov.proveedor_id}, ${nombre}, ${cortar(String(a.unidad || ""), 40) || null},
              ${precio}, FALSE, CURRENT_DATE)
      RETURNING id`;
    return { ok: true, articulo_id: r.id,
      aviso: `Anotado: ${clp(precio)} por ${nombre}. Queda pendiente de que Ladys lo confirme. ` +
             `Agradécele en una frase y NO le digas que aceptamos el precio ni que le compraremos a ese valor.` };
  }

  if (tipo === "ENTREGA") {
    const cantidad = Number(a.cantidad) || 0;
    if (cantidad <= 0)
      return { ok: false, error: "Falta cuántas unidades. Pregúntaselo antes de anotar." };
    const nombre = cortar(String(a.articulo || porDefecto).trim(), 120) || "Entrega";
    const [ped] = await SQL`
      INSERT INTO proveedor_pedidos (proveedor_id, estado, recibido_en, origen, nota)
      VALUES (${prov.proveedor_id}, 'RECIBIDO', NOW(), 'WHATSAPP',
              ${("Contado por el proveedor por WhatsApp, falta confirmarlo en el local. " + detalle).slice(0, 500)})
      RETURNING id`;
    await SQL`INSERT INTO proveedor_pedido_items (pedido_id, nombre, cantidad)
              VALUES (${ped.id}, ${nombre}, ${cantidad})`;
    return { ok: true, pedido_id: ped.id,
      aviso: `Anotada la entrega de ${cantidad} · ${nombre} como registro #${ped.id}. ` +
             `Confírmaselo en una frase. NO confirmes montos ni pagos.` };
  }

  if (!detalle) return { ok: false, error: "No hay nada que anotar." };
  await SQL`UPDATE proveedores
               SET notas = LEFT(COALESCE(notas || ' | ', '') || ${detalle}, 2000),
                   actualizado_en = NOW()
             WHERE id = ${prov.proveedor_id}`;
  return { ok: true, aviso: "Anotado. Díselo en una frase, sin prometer nada." };
}

// Lo que el equipo reporta queda en ladys.mejoras. Es la única vía para que una
// falla contada por WhatsApp llegue a quien puede arreglarla.
async function registrarMejora(a: any, equipo: any, telefono: string) {
  if (!equipo) return { ok: false, error: "Solo el equipo de Ladys puede registrar esto." };
  const titulo = cortar(String(a.titulo || "").trim(), 160);
  if (!titulo) return { ok: false, error: "Falta el título: resume el problema en una línea." };
  const tipo = ["FALLA", "MEJORA", "DUDA"].includes(String(a.tipo).toUpperCase())
    ? String(a.tipo).toUpperCase() : "MEJORA";
  const urgencia = ["ALTA", "NORMAL", "BAJA"].includes(String(a.urgencia).toUpperCase())
    ? String(a.urgencia).toUpperCase() : "NORMAL";

  // Si acaba de reportar lo mismo, se suma al detalle en vez de duplicar.
  const [repetida] = await SQL`
    SELECT id FROM mejoras
     WHERE estado = 'ABIERTA' AND usuario_id = ${equipo.usuario_id}
       AND lower(titulo) = lower(${titulo}) AND creado_en > NOW() - INTERVAL '12 hours'
     LIMIT 1`;
  if (repetida) {
    await SQL`UPDATE mejoras SET detalle = LEFT(COALESCE(detalle,'') || ' | ' || ${cortar(String(a.detalle || ""), 800)}, 2000)
               WHERE id = ${repetida.id}`;
    return { ok: true, mejora_id: repetida.id, repetida: true,
             aviso: "Ya estaba anotado y se le sumó lo nuevo. Díselo en una frase." };
  }

  const [m] = await SQL`
    INSERT INTO mejoras (tipo, titulo, detalle, urgencia, donde, usuario_id, reportado_por, telefono, origen)
    VALUES (${tipo}, ${titulo}, ${cortar(String(a.detalle || ""), 2000) || null}, ${urgencia},
            ${cortar(String(a.donde || ""), 60) || null}, ${equipo.usuario_id},
            ${equipo.nombre_completo}, ${telefono || null}, 'WHATSAPP')
    RETURNING id`;

  // Lo urgente no espera a que alguien revise la lista: se avisa al toque.
  let avisado = false;
  if (urgencia === "ALTA") {
    try {
      const url = (await config("n8n_webhook_agente")) ||
                  "https://lufi.app.n8n.cloud/webhook/ladys-agente-humano";
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact_id: "", nombre: equipo.nombre_completo, telefono,
          motivo: `REPORTE DEL EQUIPO (${tipo}, urgente) · ${titulo}${a.donde ? " · " + a.donde : ""}. ` +
                  `Reporte #${m.id} en la bitácora de mejoras.`,
          origen: "SofIA · bitácora" }) });
      avisado = r.ok;
    } catch { /* queda anotado igual */ }
  }
  return { ok: true, mejora_id: m.id, tipo, urgencia, avisado,
    aviso: `Anotado como reporte #${m.id}. Confírmaselo en UNA frase, con el número, y dile ` +
           (urgencia === "ALTA" ? "que ya se avisó a Lufi." : "que queda en la lista para revisarlo.") +
           " No prometas plazos ni digas que ya está arreglado." };
}

// v35 (bitácora #198): RUT chileno con dígito verificador. Devuelve el RUT
// normalizado como 12345678-9, o null si no cuadra.
function rutNormal(r: string) {
  const s = String(r || "").toUpperCase().replace(/[^0-9K]/g, "");
  if (s.length < 2) return null;
  const cuerpo = s.slice(0, -1), dv = s.slice(-1);
  if (!/^\d{6,8}$/.test(cuerpo)) return null;
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (suma % 11);
  const esperado = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return esperado === dv ? `${cuerpo}-${dv}` : null;
}

// v35: los datos de factura se GUARDAN en la ficha. Nada de dejarlos sueltos en
// las observaciones del pedido: con eso la ficha quedaba con BOLETA.
async function guardarFactura(clienteId: number, a: any) {
  const razon = cortar(String(a.razon_social || "").trim(), 200);
  const rutTxt = String(a.rut || "").trim();
  const giro = cortar(String(a.giro || "").trim(), 200);
  const dirF = cortar(String(a.direccion_fiscal || "").trim(), 200);
  const comunaF = cortar(String(a.comuna_fiscal || "").trim(), 80);
  const emailF = String(a.email_facturacion || a.email || "").trim();
  const faltan = [!razon && "razón social", !rutTxt && "RUT", !giro && "giro",
    !dirF && "dirección tributaria", !comunaF && "comuna tributaria",
    !emailF && "correo de facturación"].filter(Boolean);
  if (faltan.length)
    return { ok: false, error: `Para la factura faltan: ${faltan.join(", ")}. Pídeselos. NO le digas que los anotaste.` };
  const rut = rutNormal(rutTxt);
  if (!rut)
    return { ok: false, error: `El RUT ${rutTxt} no es válido: no cuadra el dígito verificador. Pídele que lo revise y te lo mande de nuevo. No lo corrijas tú y NO le digas que quedó anotado.` };

  const [otra] = await SQL`
    SELECT id, COALESCE(NULLIF(razon_social,''), nombre) AS nombre FROM clientes
     WHERE activo AND id <> ${clienteId}
       AND upper(regexp_replace(COALESCE(id_fiscal,''), '[^0-9Kk]', '', 'g')) = ${rut.replace("-", "")}
     LIMIT 1`;
  if (otra)
    return { ok: false, derivar: true,
      error: `Esa empresa ya es cliente (${otra.nombre}, ficha ${otra.id}). No la dupliques: deriva a una persona para que asocie el pedido a esa ficha. Al cliente dile solo que un ejecutivo deja lista su factura.` };

  // v36: la ficha de empresa lleva la razón social en nombre/apellido; la
  // persona pasa a contacto (se toma del nombre ANTES de sobrescribirlo).
  const partes = razon.split(/\s+/).filter(Boolean);
  const nombreEmp = partes[0] || razon;
  const apellidoEmp = partes.slice(1).join(" ") || null;
  const [c] = await SQL`
    UPDATE clientes SET
      contacto = COALESCE(NULLIF(contacto,''),
                          CASE WHEN tipo <> 'EMPRESA' THEN NULLIF(TRIM(CONCAT_WS(' ', nombre, apellido)),'') END),
      nombre = ${nombreEmp}, apellido = ${apellidoEmp},
      modo_facturacion = CASE WHEN tipo <> 'EMPRESA' THEN 'POR_PEDIDO' ELSE modo_facturacion END,
      tipo = 'EMPRESA', tipo_doc = 'FACTURA',
      razon_social = ${razon}, id_fiscal = ${rut}, giro = ${giro},
      direccion_fiscal = ${dirF}, comuna_fiscal = ${comunaF},
      ciudad_fiscal = ${cortar(String(a.ciudad_fiscal || comunaF).trim(), 80)},
      email_facturacion = ${emailF},
      regla_facturacion = COALESCE(regla_facturacion, 'CONTADO')
    WHERE id = ${clienteId}
    RETURNING id`;
  if (!c) return { ok: false, error: "No encontré la ficha del cliente." };

  const ords = await SQL`
    UPDATE ordenes SET tipo_doc = 'FACTURA', actualizado_en = NOW()
     WHERE cliente_id = ${clienteId} AND estado NOT IN ('ANULADA','ENTREGADA')
       AND nro_doc_tributario IS NULL AND tipo_doc IS DISTINCT FROM 'FACTURA'
    RETURNING id`;
  return { ok: true, cliente_id: clienteId, razon_social: razon, rut,
    pedidos_pasados_a_factura: ords.map((o: any) => Number(o.id)),
    aviso: `GUARDADO en la ficha: factura a ${razon}, RUT ${rut}. Recién ahora puedes decirle que sus datos de factura quedaron registrados.` };
}

async function registrarCliente(a: any, telefonoWa: string) {
  const nombre = String(a.nombre || "").trim();
  const apellido = String(a.apellido || "").trim();
  const email = String(a.email || "").trim();
  const calle = String(a.calle || "").trim();
  const numero = String(a.numero || "").trim();
  const comuna = String(a.comuna || "").trim();
  const telefono = String(a.telefono || telefonoWa || "").trim();
  const faltan = [!nombre && "nombre", !apellido && "apellido", !email && "email",
    !calle && "calle", !numero && "número", !comuna && "comuna"].filter(Boolean);
  if (faltan.length) return { ok: false, error: `Faltan datos: ${faltan.join(", ")}` };
  const [ya] = await SQL`
    SELECT id FROM clientes WHERE activo
      AND RIGHT(regexp_replace(COALESCE(telefono,''), '\\D', '', 'g'), 8) = ${cola(telefono)}
    ORDER BY id DESC LIMIT 1`;
  let clienteId = ya?.id as number | undefined;
  if (!clienteId) {
    const [c] = await SQL`
      INSERT INTO clientes (local_id, tipo, nombre, apellido, telefono, email, tipo_doc, activo)
      VALUES (1, 'PARTICULAR', ${nombre}, ${apellido}, ${telefono}, ${email}, 'BOLETA', TRUE)
      RETURNING id`;
    clienteId = c.id;
  }
  await SQL`
    INSERT INTO direcciones_clientes (cliente_id, ciudad, sector, calle, numero, otro, es_principal)
    VALUES (${clienteId}, ${comuna}, ${a.sector || null}, ${calle}, ${numero}, ${a.depto || null}, TRUE)`;
  // v35: si pidió factura, los datos de la empresa van a la ficha en el mismo paso.
  let factura: any = null;
  if (a.rut || a.razon_social) factura = await guardarFactura(Number(clienteId), a);
  return { ok: true, cliente_id: clienteId, nombre_completo: `${nombre} ${apellido}`.trim(),
    factura,
    aviso: factura && !factura.ok
      ? `La ficha se creó, pero la FACTURA NO quedó guardada: ${factura.error}`
      : factura?.ok ? factura.aviso : undefined };
}

// v37 (bitácora #199): lo que SofIA ya hizo con este cliente, leído de la base.
// El modelo no ve los resultados de herramientas de turnos anteriores; sin esto
// dudaba de sus propias confirmaciones y se retractaba.
async function hechosDelCliente(cli: any, contactId: string) {
  const lineas: string[] = [];
  const ids = idsDe(cli);
  if (ids.length) {
    const comps = await SQL`
      SELECT c.id, c.orden_id, c.monto_abonado, c.operacion, c.creado_en,
             o.estado_pago, o.saldo_pendiente
        FROM comprobantes c LEFT JOIN ordenes o ON o.id = c.orden_id
       WHERE c.cliente_id = ANY(${ids}::int[]) AND c.estado <> 'ANULADO'
         AND c.creado_en > NOW() - INTERVAL '7 days'
       ORDER BY c.id DESC LIMIT 5`;
    for (const k of comps)
      lineas.push(`${fechaHora(k.creado_en)} · Comprobante de transferencia por ${clp(k.monto_abonado)}` +
        `${k.operacion ? ` (operación ${k.operacion})` : ""} YA REGISTRADO en el pedido ${k.orden_id}. ` +
        `Ese pedido hoy está ${String(k.estado_pago) === "PAGADA" ? "PAGADO" : `con saldo ${clp(k.saldo_pendiente)}`}.`);
  }
  if (contactId) {
    const filas = await SQL`
      SELECT creado_en, herramientas FROM sofia_mensajes
       WHERE contact_id = ${contactId} AND herramientas IS NOT NULL
         AND creado_en > NOW() - (${HORAS_DE_HILO} || ' hours')::interval
       ORDER BY id DESC LIMIT 20`;
    for (const f of filas) {
      let usadas: any = [];
      try { usadas = typeof f.herramientas === "string" ? JSON.parse(f.herramientas) : f.herramientas; }
      catch { usadas = []; }
      if (!Array.isArray(usadas)) continue;
      const t = fechaHora(f.creado_en);
      for (const u of usadas) {
        const r = u?.salida || {};
        if (!r.ok) continue;
        const h = String(u?.herramienta || "");
        if (h === "agendar_retiro")
          lineas.push(`${t} · ${r.reagendado ? "Reagendaste" : "Agendaste"} el retiro del pedido ${r.orden_id} para el ${r.fecha}, de ${r.horario}.`);
        else if (h === "anular_retiro" && !r.ya_estaba)
          lineas.push(`${t} · Anulaste el pedido ${r.orden_id}.`);
        else if (h === "registrar_cliente")
          lineas.push(`${t} · Registraste su ficha de cliente.`);
        else if (h === "registrar_datos_factura")
          lineas.push(`${t} · Guardaste sus datos de factura: ${r.razon_social}, RUT ${r.rut}.`);
        else if (h === "link_pago")
          lineas.push(`${t} · Le mandaste un link de pago por ${r.monto}.`);
      }
    }
  }
  return lineas.slice(0, 12);
}

async function avisarAgente(cli: any, telefono: string, contactId: string,
                            motivo: string, minutos: number, prueba: boolean) {
  if (prueba) return { avisado: true, repetido: true };
  const [reciente] = await SQL`
    SELECT id FROM sofia_mensajes WHERE contact_id = ${contactId || null} AND escalado = TRUE
       AND creado_en > NOW() - (${minutos} || ' minutes')::interval LIMIT 1`;
  if (reciente) return { avisado: true, repetido: true };
  const url = (await config("n8n_webhook_agente")) ||
              "https://lufi.app.n8n.cloud/webhook/ladys-agente-humano";
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact_id: contactId || "",
        nombre: cli.encontrado ? cli.nombre_completo : "Cliente de WhatsApp",
        telefono, motivo, origen: "SofIA 2.0" }) });
    return { avisado: r.ok, repetido: false };
  } catch { return { avisado: false, repetido: false }; }
}

// LA FRASE LA ARMA EL SISTEMA, NO EL MODELO (bitácora #97). Cada pedido sale con
// quien_se_mueve y con la oración ya redactada: etapa cruzada con
// entrega_domicilio y retiro_domicilio, con la fecha y la franja adentro.
const EN_PROCESO: Record<string, string> = {
  RETIRADO: "Ya retiramos tu ropa y va camino al local",
  RECEPCIONADO: "Tu pedido ya está en el local",
  EN_LAVADO: "Tu pedido está en lavado",
  EN_SECADO: "Tu pedido está en secado",
  EMBOLSADO: "Tu pedido ya está doblado y embalado",
};

function cuandoTexto(f: any) {
  if (!f) return null;
  const iso = f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10);
  const hoy = hoyChile();
  if (iso === hoy) return "hoy";
  if (iso === sumarDias(hoy, 1)) return "mañana";
  const larga = fechaLarga(iso);
  return larga ? `el ${larga}` : null;
}

function franjaTexto(hi: any, hf: any) {
  if (!hi || !hf) return null;
  return `entre las ${String(hi).slice(0, 5)} y las ${String(hf).slice(0, 5)}`;
}

function momento(fecha: any, hi: any, hf: any) {
  return [cuandoTexto(fecha), franjaTexto(hi, hf)].filter(Boolean).join(" ") || "";
}

function quienSeMueve(etapa: string, entregaDom: boolean, retiroDom: boolean) {
  if (etapa === "ENTREGADO") return "NADIE_TODAVIA";
  if (etapa === "AGENDADO") return retiroDom ? "LADYS_VA" : "CLIENTE_VIENE";
  return entregaDom ? "LADYS_VA" : "CLIENTE_VIENE";
}

function frasePedido(p: any) {
  const etapa = String(p.etapa || "");
  const aDom = !!p.entrega_domicilio;
  const retDom = !!p.retiro_domicilio;
  const cuandoRec = momento(p.fecha_recogida, p.hi_rec, p.hf_rec);
  const cuandoEnt = momento(p.fecha_entrega, p.hi_ent, p.hf_ent);
  const conEnt = cuandoEnt ? ` ${cuandoEnt}` : "";

  if (etapa === "AGENDADO")
    return retDom
      ? `Tenemos agendado el retiro en tu domicilio${cuandoRec ? ` ${cuandoRec}` : ""}. Pasamos nosotros a buscar la ropa, no tienes que traerla al local.`
      : `Tenemos anotado tu pedido${cuandoRec ? ` para ${cuandoRec}` : ""} y la ropa la traes tú al local.`;

  if (EN_PROCESO[etapa])
    return `${EN_PROCESO[etapa]}. ` + (aDom
      ? `Cuando esté listo te lo llevamos a tu domicilio${conEnt}: no tienes que venir al local.`
      : `Cuando esté listo lo pasas a buscar al local${conEnt}.`);

  if (etapa === "LISTO_RETIRO" || etapa === "LISTO_DESPACHO")
    return aDom
      ? `Tu pedido está listo y sale a tu domicilio${conEnt || " en la próxima ruta"}. Vamos nosotros, no tienes que venir al local.`
      : `Tu pedido está listo y te espera en el local: lo puedes pasar a buscar en horario de atención.`;

  if (etapa === "EN_CAMINO")
    return aDom
      ? `Tu pedido va en camino a tu domicilio${conEnt}. Vamos nosotros, espéranos en casa.`
      : `Tu pedido va en camino.`;

  if (etapa === "ENTREGADO")
    return aDom
      ? `Tu pedido ya fue entregado en tu domicilio${conEnt}.`
      : `Tu pedido ya fue entregado.`;

  return aDom
    ? `Tu pedido está en proceso y cuando esté listo te lo llevamos a tu domicilio${conEnt}.`
    : `Tu pedido está en proceso y cuando esté listo lo pasas a buscar al local${conEnt}.`;
}

// v34: mira TODAS las fichas con el mismo teléfono y dice a nombre de quién está
// cada pedido.
async function estadoPedidos(cli: any) {
  const ids = idsDe(cli);
  const varias = ids.length > 1;
  const nombres = new Map((cli.fichas || []).map((f: any) => [Number(f.cliente_id), f.nombre]));
  const ETAPA: Record<string, string> = {
    RECEPCIONADO: "lo tenemos en el local", EN_LAVADO: "está en lavado",
    EN_SECADO: "está en secado", EMBOLSADO: "ya está doblado y embalado",
    LISTO_RETIRO: "está listo para retirar", LISTO_DESPACHO: "está listo y sale en la próxima ruta",
    EN_CAMINO: "va en camino", ENTREGADO: "ya fue entregado",
    AGENDADO: "tiene el retiro agendado", RETIRADO: "lo retiramos y va al local",
  };
  const pedidos = await SQL`
    SELECT o.id, o.cliente_id, o.estado, o.etapa, o.estado_pago, o.fecha_entrega, o.fecha_recogida,
           o.entrega_domicilio, o.retiro_domicilio, o.monto_total, o.saldo_pendiente, o.kilos,
           re.hora_inicio AS hi_ent, re.hora_fin AS hf_ent,
           rr.hora_inicio AS hi_rec, rr.hora_fin AS hf_rec,
           (SELECT string_agg(replace(i.nombre,'SERVICIO ','') || ' x' || ROUND(i.cantidad,1), ' + ')
              FROM orden_items i WHERE i.orden_id = o.id) AS detalle
    FROM ordenes o
    LEFT JOIN rutas re ON re.id = o.ruta_entrega_id
    LEFT JOIN rutas rr ON rr.id = o.ruta_recogida_id
    WHERE o.cliente_id = ANY(${ids}::int[]) AND o.estado <> 'ANULADA'
      AND (o.estado <> 'ENTREGADA' OR o.entregada_el > NOW() - INTERVAL '10 days')
    ORDER BY o.id DESC LIMIT 10`;
  const [m] = await SQL`
    SELECT pc.kilos_incluidos, pc.kilos_usados, pc.ciclo_fin, pc.modalidad, pp.nombre AS plan
    FROM prepagos_cliente pc JOIN planes_prepago pp ON pp.id = pc.plan_id
    WHERE pc.cliente_id = ANY(${ids}::int[]) AND pc.activo ORDER BY pc.id DESC LIMIT 1`;
  return {
    pedidos: pedidos.map((p: any) => ({
      numero: p.id, estado: p.estado, detalle: p.detalle,
      a_nombre_de: varias ? nombres.get(Number(p.cliente_id)) || null : null,
      frase: frasePedido(p),
      quien_se_mueve: quienSeMueve(String(p.etapa || ""), !!p.entrega_domicilio, !!p.retiro_domicilio),
      en_que_va: ETAPA[p.etapa] || "está en proceso",
      se_puede_anular: String(p.estado) === "PRE_ORDEN" && String(p.etapa) === "AGENDADO",
      retiro: fechaLarga(p.fecha_recogida), entrega: fechaLarga(p.fecha_entrega),
      franja: p.hi_ent ? `${String(p.hi_ent).slice(0,5)} a ${String(p.hf_ent).slice(0,5)}`
            : p.hi_rec ? `${String(p.hi_rec).slice(0,5)} a ${String(p.hf_rec).slice(0,5)}` : null,
      a_domicilio: p.entrega_domicilio, retiro_a_domicilio: p.retiro_domicilio,
      total: clp(p.monto_total),
      pagado: String(p.estado_pago) === "PAGADA",
      debe: Number(p.saldo_pendiente) > 0 ? clp(p.saldo_pendiente) : null,
    })),
    membresia: m ? { plan: m.plan, ilimitado: m.modalidad === "ILIMITADO",
      kilos_disponibles: Math.max((Number(m.kilos_incluidos)||0) - (Number(m.kilos_usados)||0), 0),
      vence: fechaLarga(m.ciclo_fin) } : null,
    aviso: (pedidos.length
      ? `Cada pedido trae dos campos que mandan sobre todo lo demás: "frase" y "quien_se_mueve". ` +
        `USA LA FRASE TAL CUAL, no la reescribas ni la resumas: es la única versión correcta del estado. ` +
        `Puedes agregarle el nombre del cliente al principio y una pregunta al final, nada más. ` +
        `quien_se_mueve dice quién se mueve: LADYS_VA = vamos NOSOTROS a su domicilio; ` +
        `CLIENTE_VIENE = pasa ÉL por el local; NADIE_TODAVIA = no hay movimiento pendiente. ` +
        `Si quien_se_mueve es LADYS_VA, NUNCA le digas que lo esperamos, que pase, que venga ni que ` +
        `lo retire: eso es exactamente al revés y es un error grave. ` +
        `Los campos en_que_va, entrega y franja son para que tú entiendas: no los recites aparte.`
      : "No aparece ningún pedido en curso asociado a este teléfono. NUNCA le digas que no tiene pedidos: " +
        "puede haberlo dejado a otro nombre o con otro teléfono. Pídele el número de orden o el nombre con " +
        "que lo dejó, y si igual no aparece, deriva a una persona.") +
      (varias
        ? ` Este teléfono está en ${ids.length} fichas (${(cli.fichas || []).map((f: any) => f.nombre).join(", ")}): ` +
          `los pedidos son de TODAS ellas y a_nombre_de dice de cuál es cada uno. Si le hablas de un pedido que ` +
          `está a nombre de una empresa, puedes decírselo ("el pedido a nombre de ..."), pero salúdalo por su ` +
          `nombre de persona.`
        : ""),
  };
}

async function registrarComprobante(a: any, cli: any, contactId: string, imagenUrl: string,
                                    equipo: any = null) {
  if (equipo) return comprobanteDelEquipo(a, equipo, contactId, imagenUrl);
  if (!cli.encontrado)
    return { ok: false, error: "El cliente no está en la base: regístralo primero o deriva a una persona." };
  const ids = idsDe(cli);

  const monto = Math.round(Number(a.monto) || 0);
  if (monto <= 0)
    return { ok: false, error: "No se lee el monto en el comprobante. Pídeselo por escrito, no lo inventes." };

  const operacion = String(a.operacion || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const soloDigitos = operacion.replace(/\D/g, "");
  if (soloDigitos) {
    const [rep] = await SQL`
      SELECT c.id, c.orden_id, c.cliente_id, o.estado_pago, o.saldo_pendiente
        FROM comprobantes c LEFT JOIN ordenes o ON o.id = c.orden_id
       WHERE c.estado <> 'ANULADO'
         AND regexp_replace(COALESCE(c.operacion,''), '\\D', '', 'g') = ${soloDigitos} LIMIT 1`;
    // v37: si es SU comprobante y ya está registrado, no es un problema: se le
    // confirma. Solo se deriva si la operación está en el pedido de OTRO cliente.
    if (rep && ids.includes(Number(rep.cliente_id)))
      return { ok: true, ya_estaba_registrado: true, orden_id: Number(rep.orden_id),
        quedo_pagado: String(rep.estado_pago) === "PAGADA", saldo: clp(rep.saldo_pendiente),
        aviso: `Este comprobante YA estaba registrado en el pedido ${rep.orden_id} y no se vuelve a abonar. ` +
               (String(rep.estado_pago) === "PAGADA"
                 ? `El pedido está PAGADO. Confírmaselo en una frase, sin disculpas y sin pedirle nada más. No derives.`
                 : `Le queda un saldo de ${clp(rep.saldo_pendiente)}: díselo con claridad. No derives.`) };
    if (rep)
      return { ok: false, derivar: true,
               error: `Ese comprobante ya se usó en el pedido ${rep.orden_id}, de otro cliente. No lo abones: deriva a una persona.` };
  }

  const destino = String(a.destino || "").trim();
  const claves = (await config("comprobante_cuentas") || "ladys").split("|").map(soloAlfaNum).filter(Boolean);
  const plano2 = soloAlfaNum(destino);
  if (!plano2)
    return { ok: false, error: "No se ve a qué cuenta se transfirió. Sin eso no puedo abonar: pídele que reenvíe el comprobante completo." };
  if (!claves.some((k) => plano2.includes(k)))
    return { ok: false, derivar: true,
             error: `El comprobante está a nombre de "${destino.slice(0, 60)}", que no es la cuenta de Ladys. NO abones: deriva a una persona.` };

  const tope = Number(await config("comprobante_tope_auto")) || 150000;
  if (monto > tope)
    return { ok: false, derivar: true,
             error: `Son ${clp(monto)}, sobre el tope para registrar solo. Deriva a una persona para que lo confirme.` };

  const [pendientes] = await SQL`
    SELECT COUNT(*)::int AS n FROM comprobantes
     WHERE cliente_id = ANY(${ids}::int[]) AND estado = 'POR_VERIFICAR'`;
  if (Number(pendientes?.n) >= 3)
    return { ok: false, derivar: true,
             error: "Este cliente ya tiene 3 comprobantes sin confirmar en Mercado Pago. Deriva a una persona." };

  const conSaldo = await SQL`
    SELECT id, cliente_id, monto_total, saldo_pendiente FROM ordenes
     WHERE cliente_id = ANY(${ids}::int[]) AND estado <> 'ANULADA' AND saldo_pendiente > 0
     ORDER BY id DESC LIMIT 10`;

  let orden: any = null;
  if (Number(a.orden_id)) {
    orden = conSaldo.find((o: any) => Number(o.id) === Number(a.orden_id));
    if (!orden)
      return { ok: false, error: `El pedido ${a.orden_id} no es de este cliente o no tiene saldo pendiente.` };
  } else if (conSaldo.length === 1) {
    orden = conSaldo[0];
  } else if (conSaldo.length > 1) {
    const exactos = conSaldo.filter((o: any) => Math.round(Number(o.saldo_pendiente)) === monto);
    if (exactos.length === 1) orden = exactos[0];
    else return { ok: false, elegir: conSaldo.map((o: any) => ({ pedido: o.id, debe: clp(o.saldo_pendiente) })),
                  error: "Tiene varios pedidos con saldo. Pregúntale a cuál va y vuelve a llamar esta herramienta con orden_id." };
  } else {
    return { ok: false, derivar: true,
             error: "No tiene ningún pedido con saldo pendiente. Puede ser un pago adelantado o de otra persona: deriva a un ejecutivo." };
  }

  const saldo = Math.round(Number(orden.saldo_pendiente));
  const abonar = Math.min(monto, saldo);
  const sobrante = monto - abonar;
  const referencia = soloDigitos ? `TRF-${soloDigitos}` : `TRF-C${Date.now()}`;

  let comprobanteId: number | null = null;
  let resultado: any = null;
  await SQL.begin(async (tx: any) => {
    const [r] = await tx`SELECT * FROM registrar_abono(${Number(orden.id)}, ${abonar},
      ${FORMA_TRANSFERENCIA}, ${referencia}, NULL)`;
    resultado = r;
    const [k] = await tx`
      INSERT INTO comprobantes (orden_id, cliente_id, origen, contact_id, imagen_url,
        monto_declarado, monto_abonado, fecha_transfer, hora, operacion, banco_origen,
        destino, pago_id, estado, nota)
      VALUES (${Number(orden.id)}, ${Number(orden.cliente_id)}, 'WHATSAPP', ${contactId || null},
              ${imagenUrl || null}, ${monto}, ${abonar},
              ${String(a.fecha || "").slice(0, 10) || null}, ${String(a.hora || "").slice(0, 8) || null},
              ${operacion || null}, ${String(a.banco_origen || "").slice(0, 60) || null},
              ${destino.slice(0, 120)}, ${r?.pago_id ?? null}, 'POR_VERIFICAR',
              ${sobrante > 0 ? `Transfirio ${sobrante} de mas` : null})
      RETURNING id`;
    comprobanteId = k.id;
    await tx`INSERT INTO ordenes_historial (orden_id, estado, nota, usuario_id)
             SELECT ${Number(orden.id)}, estado,
                    ${"Comprobante #" + k.id + " recibido por WhatsApp: " + abonar +
                      (operacion ? " (operacion " + operacion + ")" : "") + ". Falta confirmar en Mercado Pago."},
                    NULL FROM ordenes WHERE id = ${Number(orden.id)}`;
  });

  return {
    ok: true, comprobante_id: comprobanteId, orden_id: Number(orden.id),
    abonado: clp(abonar), saldo: clp(resultado?.saldo), estado_pago: resultado?.estado_pago,
    quedo_pagado: String(resultado?.estado_pago) === "PAGADA",
    sobrante: sobrante > 0 ? clp(sobrante) : null,
    aviso: sobrante > 0
      ? `Registrado. Transfirió ${clp(sobrante)} de más: agradécele, dile que el pedido quedó pagado y que un ejecutivo lo contacta por la diferencia.`
      : String(resultado?.estado_pago) === "PAGADA"
        ? "Registrado y el pedido quedó PAGADO. Confírmaselo con el número de pedido y el monto. No digas que está \"en verificación\": para el cliente está pagado."
        : `Registrado como abono parcial. Le queda un saldo de ${clp(resultado?.saldo)}: díselo con claridad.`,
  };
}

// v38: alguien del EQUIPO manda el comprobante de un CLIENTE. No se mira la ficha
// de quien escribe: el pedido lo dice orden_id. Sin tope automático ni límite de
// comprobantes por verificar (quien lo manda es del equipo), pero con los mismos
// candados de cuenta de destino y de operación repetida.
async function comprobanteDelEquipo(a: any, equipo: any, contactId: string, imagenUrl: string) {
  const id = Number(a.orden_id);
  if (!id)
    return { ok: false, error: "Falta el número de pedido. Pregúntale a qué pedido va (o búscalo con ver_pedido) y vuelve a llamar con orden_id." };
  const monto = Math.round(Number(a.monto) || 0);
  if (monto <= 0)
    return { ok: false, error: "No se lee el monto en el comprobante. Pídeselo, no lo inventes." };

  const [orden] = await SQL`
    SELECT o.id, o.cliente_id, o.estado, o.saldo_pendiente, o.monto_total, o.estado_pago,
           COALESCE(NULLIF(c.razon_social,''), TRIM(CONCAT_WS(' ', c.nombre, c.apellido))) AS cliente
      FROM ordenes o LEFT JOIN clientes c ON c.id = o.cliente_id WHERE o.id = ${id}`;
  if (!orden) return { ok: false, error: `El pedido ${id} no existe. Revisa el número con ver_pedido.` };
  if (String(orden.estado) === "ANULADA")
    return { ok: false, error: `El pedido ${id} está ANULADO: no se le abona nada. Díselo.` };

  const operacion = String(a.operacion || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const soloDigitos = operacion.replace(/\D/g, "");
  if (soloDigitos) {
    const [rep] = await SQL`
      SELECT c.orden_id, o.estado_pago, o.saldo_pendiente FROM comprobantes c
        LEFT JOIN ordenes o ON o.id = c.orden_id
       WHERE c.estado <> 'ANULADO'
         AND regexp_replace(COALESCE(c.operacion,''), '\\D', '', 'g') = ${soloDigitos} LIMIT 1`;
    if (rep && Number(rep.orden_id) === id)
      return { ok: true, ya_estaba_registrado: true, orden_id: id, cliente: orden.cliente,
        quedo_pagado: String(rep.estado_pago) === "PAGADA", saldo: clp(rep.saldo_pendiente),
        aviso: `Ese comprobante YA estaba registrado en el pedido ${id} (${orden.cliente}); no se abona dos veces. ` +
               `Hoy está ${String(rep.estado_pago) === "PAGADA" ? "PAGADO" : `con saldo ${clp(rep.saldo_pendiente)}`}. Díselo así.` };
    if (rep)
      return { ok: false, error: `Esa operación ya se usó en el pedido ${rep.orden_id}. No se abona dos veces: díselo con ese número para que lo revise.` };
  }

  const destino = String(a.destino || "").trim();
  const claves = (await config("comprobante_cuentas") || "ladys").split("|").map(soloAlfaNum).filter(Boolean);
  const plano2 = soloAlfaNum(destino);
  if (!plano2) return { ok: false, error: "No se ve a qué cuenta se transfirió. Pídele el comprobante completo." };
  if (!claves.some((k) => plano2.includes(k)))
    return { ok: false, error: `El comprobante está a nombre de "${destino.slice(0, 60)}", que no es la cuenta de Ladys. No se abona: díselo.` };

  const saldo = Math.round(Number(orden.saldo_pendiente));
  if (saldo <= 0)
    return { ok: false, error: `El pedido ${id} (${orden.cliente}) no tiene saldo pendiente: ya figura pagado. ` +
      `No se abonó nada. Díselo tal cual: si el pago se registró a mano, el comprobante sobra; si no, hay que revisar ese pedido en la app.` };

  const abonar = Math.min(monto, saldo);
  const sobrante = monto - abonar;
  const referencia = soloDigitos ? `TRF-${soloDigitos}` : `TRF-C${Date.now()}`;
  let comprobanteId: number | null = null;
  let resultado: any = null;
  await SQL.begin(async (tx: any) => {
    await tx`SELECT id FROM ordenes WHERE id = ${id} FOR UPDATE`;
    const [r] = await tx`SELECT * FROM registrar_abono(${id}, ${abonar},
      ${FORMA_TRANSFERENCIA}, ${referencia}, ${Number(equipo.usuario_id)})`;
    resultado = r;
    const [k] = await tx`
      INSERT INTO comprobantes (orden_id, cliente_id, origen, contact_id, imagen_url,
        monto_declarado, monto_abonado, fecha_transfer, hora, operacion, banco_origen,
        destino, pago_id, estado, nota)
      VALUES (${id}, ${Number(orden.cliente_id)}, 'WHATSAPP', ${contactId || null},
              ${imagenUrl || null}, ${monto}, ${abonar},
              ${String(a.fecha || "").slice(0, 10) || null}, ${String(a.hora || "").slice(0, 8) || null},
              ${operacion || null}, ${String(a.banco_origen || "").slice(0, 60) || null},
              ${destino.slice(0, 120)}, ${r?.pago_id ?? null}, 'POR_VERIFICAR',
              ${("Enviado por " + equipo.nombre_completo + " (equipo) a SofIA." +
                 (sobrante > 0 ? " Transfirio " + sobrante + " de mas." : "")).slice(0, 300)})
      RETURNING id`;
    comprobanteId = k.id;
    await tx`INSERT INTO ordenes_historial (orden_id, estado, nota, usuario_id)
             SELECT ${id}, estado,
                    ${"Comprobante #" + k.id + " enviado por " + equipo.nombre_completo + " a SofIA: " + abonar +
                      (operacion ? " (operacion " + operacion + ")" : "") + ". Falta confirmar en Mercado Pago."},
                    ${Number(equipo.usuario_id)} FROM ordenes WHERE id = ${id}`;
  });
  return {
    ok: true, comprobante_id: comprobanteId, orden_id: id, cliente: orden.cliente,
    abonado: clp(abonar), saldo: clp(resultado?.saldo), estado_pago: resultado?.estado_pago,
    quedo_pagado: String(resultado?.estado_pago) === "PAGADA",
    sobrante: sobrante > 0 ? clp(sobrante) : null,
    aviso: `Abonado ${clp(abonar)} al pedido ${id} de ${orden.cliente}. ` +
      (String(resultado?.estado_pago) === "PAGADA" ? "El pedido quedó PAGADO." : `Queda saldo ${clp(resultado?.saldo)}.`) +
      (sobrante > 0 ? ` Ojo: transfirió ${clp(sobrante)} de más.` : "") +
      " Confírmaselo en una o dos líneas con pedido, cliente, monto y estado. Sin adornos.",
  };
}

// v38: para el EQUIPO. Busca cualquier pedido por número o por nombre de cliente.
async function verPedido(a: any) {
  const id = Number(a.orden_id);
  const q = String(a.cliente || "").trim();
  if (!id && q.length < 3) return { error: "Dame el número de pedido o al menos 3 letras del nombre del cliente." };
  const filas = id
    ? await SQL`
      SELECT o.id, o.estado, o.etapa, o.estado_pago, o.monto_total, o.saldo_pendiente,
             o.fecha_entrega, o.entrega_domicilio,
             COALESCE(NULLIF(c.razon_social,''), TRIM(CONCAT_WS(' ', c.nombre, c.apellido))) AS cliente, c.telefono
        FROM ordenes o LEFT JOIN clientes c ON c.id = o.cliente_id WHERE o.id = ${id}`
    : await SQL`
      SELECT o.id, o.estado, o.etapa, o.estado_pago, o.monto_total, o.saldo_pendiente,
             o.fecha_entrega, o.entrega_domicilio,
             COALESCE(NULLIF(c.razon_social,''), TRIM(CONCAT_WS(' ', c.nombre, c.apellido))) AS cliente, c.telefono
        FROM ordenes o JOIN clientes c ON c.id = o.cliente_id
       WHERE o.estado <> 'ANULADA'
         AND translate(lower(CONCAT_WS(' ', c.nombre, c.apellido, c.razon_social)), 'áéíóúüñ', 'aeiouun') ILIKE ${"%" + sinTilde(q) + "%"}
       ORDER BY o.id DESC LIMIT 6`;
  if (!filas.length) return { encontrados: [], aviso: "No aparece. Pídele el número de pedido." };
  return { encontrados: filas.map((o: any) => ({
    pedido: o.id, cliente: o.cliente, telefono: o.telefono, estado: o.estado, etapa: o.etapa,
    total: clp(o.monto_total), saldo: clp(o.saldo_pendiente), pagado: String(o.estado_pago) === "PAGADA",
    entrega: fechaLarga(o.fecha_entrega), a_domicilio: !!o.entrega_domicilio })) };
}

async function linkDePago(ordenId: number, ids: number[] | null) {
  const [o] = await SQL`SELECT id, cliente_id, saldo_pendiente, es_membresia FROM ordenes WHERE id = ${ordenId}`;
  if (!o) return { ok: false, error: "Ese pedido no existe." };
  if (ids && ids.length && !ids.includes(Number(o.cliente_id)))
    return { ok: false, error: "Ese pedido no es de este cliente." };
  if (o.es_membresia) return { ok: false, error: "Es de socio del Club: su plan lo cubre." };
  if (Number(o.saldo_pendiente) <= 0) return { ok: false, error: "Ese pedido ya está pagado." };
  const tok = await new jose.SignJWT({ id: 0, perfil: "SISTEMA", local_id: 1 })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(SECRET);
  const r = await fetch(`${COBROS}/link`, {
    method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ orden_id: ordenId }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) return { ok: false, error: `No se pudo generar el link: ${d.error || r.status}` };
  return { ok: true, link: d.url, monto: clp(d.monto) };
}

// Un cupo de ruta es una PARADA, no un retiro: retiros MÁS entregas.
const PARADAS = (rutaId: any, fecha: string) => SQL`
  SELECT COUNT(*)::int AS n FROM ordenes o
   WHERE o.estado <> 'ANULADA'
     AND ((o.ruta_recogida_id = ${rutaId} AND o.fecha_recogida = ${fecha}::date)
       OR (o.ruta_entrega_id  = ${rutaId} AND o.fecha_entrega  = ${fecha}::date))`;

// El sábado NO se corta a mano: sus rutas viven en la tabla como las de cualquier
// día. Si algún día vuelve a ser solo entregas, se marca la ruta como
// SOLO_ENTREGAS y el filtro de abajo la deja fuera de los retiros.
async function tramosDe(fecha: string, tope: number) {
  const d = new Date(fecha + "T12:00:00");
  if (isNaN(d.getTime())) return { cierre: "Fecha inválida.", tramos: [] as any[] };
  if (fecha < hoyChile()) return { cierre: "Esa fecha ya pasó.", tramos: [] as any[] };
  if (d.getDay() === 0) return { cierre: "Domingo: no hay ruta.", tramos: [] as any[] };
  const [fer] = await SQL`SELECT motivo FROM dias_inhabiles WHERE fecha = ${fecha}`;
  if (fer) return { cierre: `Ese día es feriado (${fer.motivo}): no hay ruta.`, tramos: [] as any[] };

  const rutas = await SQL`
    SELECT r.id, r.nombre, r.tipo, r.hora_inicio, r.hora_fin, r.puntos_disp
    FROM rutas r WHERE r.activo AND r.dia_semana = ${DIAS_BD[d.getDay()]}
    ORDER BY r.hora_inicio`;

  const tramos: any[] = [];
  for (const r of rutas) {
    if (r.tipo === "SOLO_ENTREGAS") continue;
    const faltan = minutosDeAntelacion(fecha, String(r.hora_inicio));
    const [p] = await PARADAS(r.id, fecha);
    const libres = Math.max(0, Number(r.puntos_disp) - Number(p?.n || 0));
    const aTiempo = faltan >= tope;
    tramos.push({
      ruta_id: r.id, nombre: r.nombre,
      horario: `${String(r.hora_inicio).slice(0,5)} a ${String(r.hora_fin).slice(0,5)}`,
      es_manana: Number(String(r.hora_inicio).slice(0,2)) < 12,
      cupos_libres: libres,
      minutos_para_salir: faltan,
      admite_retiro: libres > 0 && aTiempo,
      motivo: libres <= 0 ? "sin cupos"
            : !aTiempo ? (faltan <= 0 ? "ese tramo ya salió"
                                      : `sale en ${enTiempo(faltan)} y se necesitan ${enTiempo(tope)} de antelación`)
            : null,
    });
  }
  return { cierre: null as string | null, tramos };
}

async function alternativas(fecha: string, tope: number) {
  const salida: any[] = [];
  for (let i = 1; i <= 4; i++) {
    const f = sumarDias(fecha, -i);
    if (f < hoyChile()) break;
    const ok = (await tramosDe(f, tope)).tramos.filter((t: any) => t.admite_retiro);
    if (ok.length) { salida.push({ fecha: f, dia: fechaLarga(f), tramos: ok.map((t: any) => ({ ruta_id: t.ruta_id, horario: t.horario })) }); break; }
  }
  let despues = 0;
  for (let i = 1; i <= 14 && despues < 2; i++) {
    const f = sumarDias(fecha, i);
    if (f < hoyChile()) continue;
    const ok = (await tramosDe(f, tope)).tramos.filter((t: any) => t.admite_retiro);
    if (ok.length) { salida.push({ fecha: f, dia: fechaLarga(f), tramos: ok.map((t: any) => ({ ruta_id: t.ruta_id, horario: t.horario })) }); despues++; }
  }
  return salida.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

async function cuposRuta(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  if (isNaN(d.getTime())) return { error: "Fecha inválida" };
  const dia = DIAS[d.getDay()];
  const tope = await antelacionMinima();
  const { cierre, tramos } = await tramosDe(fecha, tope);
  const ofrecibles = tramos.filter((t: any) => t.admite_retiro);
  const fuera = tramos.length - ofrecibles.length;

  if (cierre || !ofrecibles.length) {
    const base = fecha < hoyChile() ? sumarDias(hoyChile(), -1) : fecha;
    const alt = await alternativas(base, tope);
    return { fecha, dia, hora_chile: ahoraChile(), antelacion_minutos: tope, rutas: tramos,
      alternativas: alt,
      aviso: `${cierre || "No queda ningún tramo tomable esa fecha."} ` +
        (alt.length
          ? `Si quiere otro día, ofrécele SOLO estas alternativas, ya revisadas por el sistema contra feriados, domingos y cupos: ` +
            alt.map((a: any) => `${a.dia} (${a.tramos.map((t: any) => t.horario).join(" o ")})`).join("; ") +
            `. No propongas ningún otro día de memoria; si el cliente pide otro, llama a cupos_ruta para esa fecha.`
          : "No hay días con cupo en las próximas dos semanas: deriva a una persona.") };
  }

  return { fecha, dia, hora_chile: ahoraChile(), antelacion_minutos: tope, rutas: tramos,
    aviso: `OFRECE SOLO los tramos con admite_retiro true. Los que vienen en false están en la lista para que sepas que existen, NO para ofrecerlos: no los menciones como opción ni los negocies.` +
      ` Los cupos ya descuentan los retiros Y las entregas de ese tramo: es la capacidad real de paradas de la camioneta.` +
      (fuera ? ` Hay ${fuera} tramo(s) en false por hora o por cupo.` : "") +
      " Los tramos con es_manana true son de la mañana y los demás de la tarde: nómbralos así y nunca le digas mañana a un tramo de tarde." };
}

async function agendarRetiro(a: any) {
  const fecha = String(a.fecha || "");
  const clienteId = Number(a.cliente_id);
  const rutaId = Number(a.ruta_id);
  if (!clienteId) return { ok: false, error: "No hay cliente: usa registrar_cliente primero" };
  if (!fecha || !rutaId) return { ok: false, error: "Faltan la fecha o el tramo" };
  if (fecha < hoyChile()) return { ok: false, error: "Esa fecha ya pasó" };
  const [ruta] = await SQL`SELECT id, nombre, tipo, hora_inicio, hora_fin, puntos_disp, dia_semana
    FROM rutas WHERE id = ${rutaId} AND activo`;
  if (!ruta) return { ok: false, error: "Esa ruta no existe" };
  if (ruta.tipo === "SOLO_ENTREGAS") return { ok: false, error: "Esa ruta es solo de entregas" };
  const d = new Date(fecha + "T12:00:00");
  if (String(ruta.dia_semana) !== DIAS_BD[d.getDay()])
    return { ok: false, error: `Ese tramo no existe el ${DIAS[d.getDay()]}.` };

  const tope = await antelacionMinima();
  const faltan = minutosDeAntelacion(fecha, String(ruta.hora_inicio));
  if (faltan < tope)
    return { ok: false, admite_retiro: false, minutos_para_salir: faltan,
      error: faltan <= 0
        ? `Ese tramo ya salió: no admite retiros. Usa cupos_ruta para otra fecha y ofrécele solo los tramos con admite_retiro true.`
        : `Ese tramo sale en ${enTiempo(faltan)} y se necesitan ${enTiempo(tope)} de antelación, así que ya no admite retiros. ` +
          `Usa cupos_ruta y ofrécele solo los tramos con admite_retiro true.` };

  const [p] = await PARADAS(rutaId, fecha);
  if (Number(p?.n || 0) >= Number(ruta.puntos_disp))
    return { ok: false, error: "Ese tramo no tiene cupos (contando retiros y entregas): ofrece otro" };
  const [fer] = await SQL`SELECT motivo FROM dias_inhabiles WHERE fecha = ${fecha}`;
  if (fer) return { ok: false, error: `Ese día es feriado (${fer.motivo})` };

  const [dir] = await SQL`SELECT id, TRIM(CONCAT_WS(' ', calle, numero)) AS texto,
      COALESCE(NULLIF(comuna_geo,''), ciudad) AS comuna
    FROM direcciones_clientes WHERE cliente_id = ${clienteId}
    ORDER BY es_principal DESC, id DESC LIMIT 1`;
  if (!dir) return { ok: false, error: "El cliente no tiene dirección registrada" };

  const [previa] = await SQL`
    SELECT id, fecha_recogida FROM ordenes
     WHERE cliente_id = ${clienteId} AND estado = 'PRE_ORDEN' AND etapa = 'AGENDADO'
       AND fecha_recogida >= ${hoyChile()}::date
     ORDER BY id DESC LIMIT 1`;

  if (previa && !a.nuevo_pedido) {
    const antes = fechaLarga(previa.fecha_recogida);
    await SQL`UPDATE ordenes
                 SET fecha_recogida = ${fecha}::date, ruta_recogida_id = ${rutaId},
                     dir_recogida_id = ${dir.id}, actualizado_en = NOW(),
                     observaciones = LEFT(COALESCE(observaciones,'') || ${" | Reagendado por SofIA a " + fecha + ". " + String(a.observaciones || "")}, 900)
               WHERE id = ${previa.id}`;
    await SQL`INSERT INTO ordenes_historial (orden_id, estado, nota, usuario_id)
              VALUES (${previa.id}, 'PRE_ORDEN',
                      ${"Reagendado por SofIA: de " + String(previa.fecha_recogida).slice(0,10) + " a " + fecha}, NULL)`;
    return { ok: true, orden_id: previa.id, reagendado: true, antes,
      fecha: fechaLarga(fecha),
      horario: `${String(ruta.hora_inicio).slice(0,5)} a ${String(ruta.hora_fin).slice(0,5)}`,
      direccion: `${dir.texto}, ${dir.comuna}`,
      aviso: `REAGENDADO el pedido ${previa.id}, que estaba para ${antes}. NO se creó uno nuevo: sigue siendo el mismo número. Confírmaselo con ese número y el horario nuevo.` };
  }

  // v35: el tipo de documento sale de la ficha (FACTURA si es empresa), no fijo.
  const [o] = await SQL`
    INSERT INTO ordenes (local_id, cliente_id, tipo_doc, estado, etapa, estado_pago,
                         fecha_recogida, ruta_recogida_id, dir_recogida_id, retiro_domicilio,
                         entrega_domicilio, monto_total, monto_abonado, saldo_pendiente,
                         kilos, bultos, origen, observaciones)
    VALUES (1, ${clienteId},
            COALESCE((SELECT NULLIF(tipo_doc,'') FROM clientes WHERE id = ${clienteId}), 'BOLETA'),
            'PRE_ORDEN', 'AGENDADO', 'PENDIENTE',
            ${fecha}::date, ${rutaId}, ${dir.id}, TRUE, TRUE, 0, 0, 0, 0, 1,
            'WHATSAPP', ${"Agendado por SofIA. " + String(a.observaciones || "")})
    RETURNING id`;
  return { ok: true, orden_id: o.id, reagendado: false, fecha: fechaLarga(fecha),
    horario: `${String(ruta.hora_inicio).slice(0,5)} a ${String(ruta.hora_fin).slice(0,5)}`,
    direccion: `${dir.texto}, ${dir.comuna}`,
    aviso: "AGENDADO. Confírmaselo con el número de pedido y el horario." };
}

// ANULAR UN RETIRO. Con candados, porque anular es irreversible para el cliente
// y porque hay casos que NO le tocan a SofIA: ropa ya retirada o plata ya pagada.
// La parada sale sola de la ruta: la borra el trigger parada_sigue_a_la_orden.
async function anularRetiro(a: any, cli: any) {
  if (!cli.encontrado) return { ok: false, error: "El cliente no está registrado." };
  const id = Number(a.orden_id);
  if (!id) return { ok: false, error: "Falta el número de pedido. Míralo con estado_pedidos y confírmaselo antes de anular." };

  const [o] = await SQL`
    SELECT id, cliente_id, estado, etapa, monto_abonado, fecha_recogida, ruta_recogida_id
      FROM ordenes WHERE id = ${id}`;
  if (!o) return { ok: false, error: "Ese pedido no existe." };
  if (!idsDe(cli).includes(Number(o.cliente_id)))
    return { ok: false, error: "Ese pedido no es de este cliente. No lo toques." };

  if (String(o.estado) === "ANULADA")
    return { ok: true, ya_estaba: true, orden_id: id,
             aviso: "Ese pedido ya estaba anulado. Díselo en una frase y ofrécele agendar otro día." };

  if (Number(o.monto_abonado) > 0)
    return { ok: false, derivar: true,
             error: "Ese pedido ya tiene pagos registrados: la anulación implica devolver plata y eso no lo haces tú. Deriva a una persona." };

  if (!(String(o.estado) === "PRE_ORDEN" && String(o.etapa) === "AGENDADO"))
    return { ok: false, derivar: true,
             error: "Ese pedido ya no es solo un retiro agendado: la ropa está en el local o en proceso. Eso no se anula solo, deriva a una persona." };

  const motivo = cortar(String(a.motivo || "").trim(), 200) || "El cliente pidió anular el retiro";
  await SQL`UPDATE ordenes
               SET estado = 'ANULADA', motivo_anulacion = ${motivo}, actualizado_en = NOW()
             WHERE id = ${id}`;
  await SQL`INSERT INTO ordenes_historial (orden_id, estado, nota, usuario_id)
            VALUES (${id}, 'ANULADA', ${"Anulado por SofIA a pedido del cliente: " + motivo}, NULL)`;

  return { ok: true, orden_id: id, fecha_anulada: fechaLarga(o.fecha_recogida),
    aviso: `ANULADO el pedido ${id}, que estaba para ${fechaLarga(o.fecha_recogida)}. ` +
           `Confírmaselo con ESE número y ESA fecha, dile que la camioneta ya no pasa, ` +
           `y ofrécele agendar para otro día antes de despedirte.` };
}

// v35: los campos de factura, iguales en registrar_cliente y registrar_datos_factura.
const CAMPOS_FACTURA = {
  razon_social: { type: "string", description: "Razón social de la empresa, tal cual la escribió" },
  rut: { type: "string", description: "RUT de la empresa, tal cual lo escribió (con o sin puntos)" },
  giro: { type: "string" },
  direccion_fiscal: { type: "string", description: "Dirección tributaria: calle, número y oficina o depto" },
  comuna_fiscal: { type: "string", description: "Comuna de la dirección tributaria" },
  ciudad_fiscal: { type: "string", description: "Ciudad de la dirección tributaria, si la dijo" },
  email_facturacion: { type: "string", description: "Correo donde se manda la factura" },
};

const HERRAMIENTAS = [
  { name: "catalogo", description: "Precios y plazos reales. Úselo SIEMPRE antes de decir un precio.",
    input_schema: { type: "object", properties: { busqueda: { type: "string" } }, required: ["busqueda"] } },
  { name: "planes_club", description: "Los planes vigentes de El Club.",
    input_schema: { type: "object", properties: {}, required: [] } },
  { name: "estado_pedidos", description: "Pedidos del cliente (de TODAS las fichas con su teléfono), su membresía y su saldo. Cada pedido trae la frase ya redactada, quién se mueve y a nombre de quién está. Úselo SIEMPRE antes de hablar de un pedido, y antes de anular uno.",
    input_schema: { type: "object", properties: {}, required: [] } },
  { name: "link_pago", description: "Link de Mercado Pago para pagar con tarjeta. El conductor NO lleva máquina.",
    input_schema: { type: "object", properties: { orden_id: { type: "number" } }, required: ["orden_id"] } },
  { name: "registrar_comprobante",
    description: "El cliente mandó el comprobante de una transferencia. Lee los datos EN LA IMAGEN y regístralo: abona el pago al pedido. Úselo solo si estás viendo el comprobante; nunca con un monto que el cliente escribió a mano.",
    input_schema: { type: "object", properties: {
      monto: { type: "number", description: "Monto transferido, en pesos y sin puntos" },
      destino: { type: "string", description: "A quién o a qué cuenta se transfirió, TAL CUAL sale en el comprobante: nombre, RUT o número de cuenta" },
      operacion: { type: "string", description: "Número de operación o de comprobante" },
      fecha: { type: "string", description: "AAAA-MM-DD de la transferencia" },
      hora: { type: "string" },
      banco_origen: { type: "string" },
      orden_id: { type: "number", description: "Pedido al que corresponde. No lo mandes si no estás seguro." },
    }, required: ["monto", "destino"] } },
  { name: "cupos_ruta", description: "Tramos de retiro de una fecha, con el cupo real y si TODAVÍA admiten retiro a esta hora. Si esa fecha no sirve, trae también las alternativas más cercanas ya revisadas. Úselo SIEMPRE antes de ofrecer un horario o un día.",
    input_schema: { type: "object", properties: { fecha: { type: "string", description: "AAAA-MM-DD" } }, required: ["fecha"] } },
  { name: "registrar_cliente", description: "Crea la ficha de un cliente nuevo. El teléfono sale del WhatsApp. Si pidió FACTURA, pasa aquí también los datos de la empresa (razon_social, rut, giro, direccion_fiscal, comuna_fiscal, email_facturacion): quedan guardados en la ficha en el mismo paso. Revisa en la respuesta que factura.ok sea true antes de decirle que quedaron.",
    input_schema: { type: "object", properties: {
      nombre: { type: "string" }, apellido: { type: "string" }, email: { type: "string" },
      telefono: { type: "string" }, calle: { type: "string" }, numero: { type: "string" },
      depto: { type: "string" }, sector: { type: "string" }, comuna: { type: "string" },
      ...CAMPOS_FACTURA,
    }, required: ["nombre", "apellido", "email", "calle", "numero", "comuna"] } },
  { name: "registrar_datos_factura",
    description: "El cliente pide FACTURA y ya tiene ficha. GUARDA los datos de la empresa en su ficha apenas los tengas completos, sin esperar a agendar. Si todavía no tiene ficha, usa registrar_cliente con estos mismos campos. Nunca le digas que anotaste los datos si esta herramienta no respondió ok.",
    input_schema: { type: "object", properties: { ...CAMPOS_FACTURA },
      required: ["razon_social", "rut", "giro", "direccion_fiscal", "comuna_fiscal", "email_facturacion"] } },
  { name: "agendar_retiro",
    description: "Agenda el retiro DE VERDAD. Si el cliente aceptó un horario, USA ESTO antes de responder. Para REAGENDAR usa esta misma herramienta con la fecha nueva: mueve el pedido que ya tiene, no crea otro.",
    input_schema: { type: "object", properties: {
      fecha: { type: "string" }, ruta_id: { type: "number" }, observaciones: { type: "string" },
      nuevo_pedido: { type: "boolean", description: "Solo si el cliente quiere un retiro ADICIONAL, aparte del que ya tiene agendado. Por defecto se reagenda el existente." } },
      required: ["fecha", "ruta_id"] } },
  { name: "anular_retiro",
    description: "Anula un retiro agendado cuando el cliente dice que no va a estar, que ya no lo necesita o que quiere cancelarlo. ÚSALO TÚ: no lo derives a un ejecutivo. Mira antes estado_pedidos para saber cuál es el pedido. Si el cliente lo que quiere es CAMBIAR la fecha, no anules: usa agendar_retiro con la fecha nueva.",
    input_schema: { type: "object", properties: {
      orden_id: { type: "number", description: "Número del pedido que se anula" },
      motivo: { type: "string", description: "Lo que dijo el cliente, con sus palabras" } },
      required: ["orden_id"] } },
  { name: "derivar_a_persona", description: "Pasa la conversación a un ejecutivo. Reclamos, prendas dañadas, express a domicilio, discusiones de cobro, convenios. NO lo uses para anular ni para reagendar un retiro: eso lo haces tú.",
    input_schema: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] } },
];

// v38: solo para el equipo. Cualquier pedido, no solo los de quien escribe.
const HERRAMIENTA_VER_PEDIDO = {
  name: "ver_pedido",
  description: "Busca CUALQUIER pedido por número o por nombre del cliente: cliente, estado, total, saldo y si está pagado. Úsalo cuando alguien del equipo te hable de un pedido o te mande un comprobante de un cliente.",
  input_schema: { type: "object", properties: {
    orden_id: { type: "number", description: "Número de pedido u OT" },
    cliente: { type: "string", description: "Nombre o apellido del cliente, si no hay número" },
  }, required: [] },
};

// Solo para el equipo: deja el reporte en la bitácora de mejoras.
const HERRAMIENTA_MEJORA = {
  name: "registrar_mejora",
  description: "El equipo reportó una falla del sistema, una idea de mejora o una duda de operación. Antótala en la bitácora para que llegue a quien puede resolverla. Úselo SIEMPRE que alguien del equipo cuente que algo no funciona, que algo se podría hacer mejor, o que necesita un cambio: no lo mandes a hablar con otra persona.",
  input_schema: { type: "object", properties: {
    tipo: { type: "string", enum: ["FALLA", "MEJORA", "DUDA"],
            description: "FALLA si algo no funciona, MEJORA si es una idea o un cambio que pide, DUDA si pregunta cómo hacer algo y no lo sabes con las otras herramientas" },
    titulo: { type: "string", description: "El problema en una línea, con sus palabras" },
    detalle: { type: "string", description: "Todo lo que contó: qué pasó, cuándo, qué estaba haciendo, qué esperaba que pasara" },
    donde: { type: "string", description: "Dónde ocurre: taller, reparto, app, caja, SofIA, lockers, pantalla…" },
    urgencia: { type: "string", enum: ["ALTA", "NORMAL", "BAJA"],
                description: "ALTA solo si está frenando el trabajo AHORA o afecta a un cliente hoy" },
  }, required: ["tipo", "titulo"] },
};

// Solo para proveedores: ver lo que le pedimos y dejar anotado lo que cuenta.
const HERRAMIENTAS_PROVEEDOR = [
  { name: "pedidos_proveedor",
    description: "Lo que le hemos pedido a ESTE proveedor y lo que nos ha traído, con fechas y cantidades, más los precios que tenemos registrados. Úselo SIEMPRE antes de hablar de un pedido, una entrega o un precio: nunca de memoria.",
    input_schema: { type: "object", properties: {}, required: [] } },
  { name: "anotar_proveedor",
    description: "Deja anotado lo que el proveedor cuenta: un precio nuevo, una entrega que hizo o que va a hacer, o cualquier dato útil. Queda como pendiente de confirmar por Ladys, nunca como algo aceptado.",
    input_schema: { type: "object", properties: {
      tipo: { type: "string", enum: ["PRECIO", "ENTREGA", "NOTA"],
              description: "PRECIO si avisa cuánto cuesta algo, ENTREGA si dejó o va a dejar mercadería, NOTA para lo demás" },
      articulo: { type: "string", description: "De qué producto habla, con sus palabras" },
      unidad: { type: "string", description: "Unidad: bidón de 20 L, caja, saco, litro…" },
      precio: { type: "number", description: "Precio unitario en pesos, sin puntos. Solo si lo dijo claro." },
      cantidad: { type: "number", description: "Cuántas unidades, para una entrega" },
      detalle: { type: "string", description: "Lo que dijo, resumido" },
    }, required: ["tipo"] } },
];

// v34: la línea de Direcciones incluye el SECTOR (Reñaca, Jardín del Mar…) y, si
// el teléfono está en varias fichas, a nombre de cuál está cada dirección.
function lineaDireccion(x: any) {
  return `${x.direccion}${x.depto ? ", depto " + x.depto : ""}` +
         `${x.sector ? ", sector " + x.sector : ", SIN SECTOR"}, ${x.comuna}` +
         `${x.a_nombre_de ? ` (ficha ${x.a_nombre_de})` : ""}`;
}

function contexto(cli: any, hoy: string, nota: string, previo: string, conImagen: boolean,
                  equipo: any = null, proveedor: any = null, hechos: string[] = []) {
  const d = new Date(hoy + "T12:00:00");
  // v37 (bitácora #199): lo que ya hizo, para que no se retracte.
  const hechosTxt = (equipo || proveedor) ? "" : hechos.length ? `
LO QUE YA HICISTE CON ESTE CLIENTE (lo dice la base de datos: está guardado y es cierto)
${hechos.map((h) => "· " + h).join("\n")}
Tus mensajes anteriores que confirmaron estas cosas eran CORRECTOS. Tú no ves los
resultados de las herramientas de turnos anteriores, pero esta lista sí: créele.
NUNCA te retractes de algo que está aquí, NUNCA digas que te adelantaste o que te
equivocaste, y NUNCA pidas reenviar un comprobante que ya aparece registrado. Si el
cliente responde "gracias", "ok" o similar después de una confirmación, solo cierra
amable. Si pregunta por eso, confírmaselo con estos datos.
` : `
LO QUE HICISTE EN TURNOS ANTERIORES
No ves los resultados de las herramientas de turnos anteriores. Si en el hilo le
confirmaste algo, fue porque la herramienta respondió bien: no te retractes, no te
disculpes por eso ni le pidas repetir nada. Si dudas, consulta estado_pedidos.
`;
  const fichasTxt = cli.encontrado && Array.isArray(cli.fichas) && cli.fichas.length > 1
    ? `\nOJO: este teléfono está en ${cli.fichas.length} fichas: ${cli.fichas.map((f: any) =>
        `${f.nombre} (id ${f.cliente_id}${f.es_empresa ? ", empresa" : ""}, ${f.pedidos} pedidos)`).join(" · ")}.
Quien escribe es una PERSONA: salúdala por su nombre (${cli.nombre}), nunca con el nombre de una empresa.
estado_pedidos ya trae los pedidos de TODAS estas fichas, cada uno con a_nombre_de.`
    : "";
  const facturaTxt = cli.encontrado && cli.factura
    ? `\nFactura: esta ficha ya emite FACTURA a ${cli.factura.razon_social || "su empresa"} (RUT ${cli.factura.rut}). Los datos ya están guardados: no se los pidas de nuevo.`
    : "";
  const ficha = equipo
    ? `TE ESCRIBE ALGUIEN DEL EQUIPO DE LADYS, NO UN CLIENTE.
Es ${equipo.nombre_completo} (${equipo.perfil}). Llámalo ${equipo.nombre}.
Cómo cambia esto tu forma de responder:
· Habla como colega, no como atención al cliente. Sin saludos de venta, sin
  emojis de más, sin ofrecerle servicios ni precios como si fuera a comprar.
· Responde preguntas de operación con las herramientas: cupos de ruta, precios
  del catálogo, planes, estado de un pedido. Dile los datos crudos, no adornados.
· NO lo derives a un agente humano: él ES el agente humano.
· Quien te escribe también puede tener ficha de cliente: IGNÓRALA. Cuando habla de
  un pedido, habla de un pedido de un CLIENTE. Búscalo con ver_pedido.
· NO agendes retiros. Si te pide agendar para un cliente, dile que eso se hace
  desde la app.

COMPROBANTES QUE MANDA EL EQUIPO
Cuando te manda la foto de una transferencia de un cliente, es para que la
apliques: léela y usa registrar_comprobante con el orden_id del pedido. Si el
número de pedido viene en el mensaje o en el hilo, úsalo; si no, pregúntaselo en
una línea (o búscalo con ver_pedido si te da el nombre). No lo mandes a hacerlo a
mano ni le ofrezcas "derivarlo". Si la herramienta responde ok, confírmale pedido,
cliente, monto y si quedó pagado. Si responde un error, díselo tal cual en una línea.

SI TE CUENTA QUE ALGO FALLA O QUE ALGO SE PODRÍA MEJORAR
Esto es importante y es tu trabajo: USA registrar_mejora y antótalo. Nunca le
digas "eso escapa de lo que puedo resolver", "hablalo con Luis" ni "avísale a
operaciones": ese es justamente el camino por donde los problemas se pierden. Tú
eres el canal. Anota el reporte, dale el número y dile qué va a pasar.
· Antes de anotar, pregúntale lo que falte para que el reporte sirva: qué pantalla
  o parte del sistema, qué estaba haciendo y qué esperaba que pasara. Una pregunta
  a la vez, y si ya te lo contó todo, no preguntes de nuevo: anótalo.
· Urgencia ALTA solo si está frenando el trabajo ahora o afecta a un cliente hoy.
· Tú NO arreglas el sistema ni cambias precios, horarios, cupos ni reglas: eso
  vive en la configuración. Lo que sí puedes es dejarlo anotado para que se
  trabaje. No prometas plazos ni digas que quedó resuelto.`
    : proveedor
    ? `TE ESCRIBE UN PROVEEDOR DE LADYS, NO UN CLIENTE.
Es ${proveedor.nombre}${proveedor.rubro ? ` · ${proveedor.rubro}` : ""}${proveedor.contacto ? ` · contacto: ${proveedor.contacto}` : ""}.
A él le COMPRAMOS nosotros: no es alguien a quien haya que venderle.
Lo que nos vende: ${proveedor.articulos.length
        ? proveedor.articulos.map((a: any) =>
            `${a.articulo}${a.unidad ? ` (${a.unidad})` : ""}${a.precio ? ` a ${a.precio}${a.precio_confirmado ? "" : ", precio por confirmar"}` : ", sin precio registrado"}`).join(" · ")
        : "todavía no hay artículos registrados"}.
${proveedor.notas ? `Notas nuestras: ${proveedor.notas}\n` : ""}
Cómo responderle:
· Trato breve, cordial y de trabajo. Sin saludos de venta ni emojis de más.
· NO le ofrezcas lavado, ni el Club, ni promociones. NO le agendes retiro de ropa
  ni le pidas su dirección como si fuera cliente. Si ÉL pregunta por el servicio
  para él mismo, ahí sí puedes responderle con el catálogo.
· NUNCA le cuentes nada de nuestros clientes, pedidos, ventas, rutas ni del
  equipo. Lo suyo es solo lo que él nos vende.
· Antes de hablar de un pedido, una entrega o un precio, usa pedidos_proveedor.
  No hables de memoria ni des por hecho lo que no esté ahí.
· Si avisa un precio nuevo: anótalo con anotar_proveedor tipo PRECIO. Agradécele
  y dile que queda anotado, NUNCA que lo aceptamos ni que compraremos a ese valor.
· Si avisa que dejó o que va a dejar mercadería: anótalo con tipo ENTREGA,
  preguntando cuántas unidades si no lo dijo.
· PLATA NO: si pide que le paguemos, reclama un pago, manda una factura o quiere
  confirmar un monto, deriva a una persona. Tú no pagas ni comprometes pagos.
· HACERLE PEDIDOS TODAVÍA NO PUEDES. Si pregunta si necesitamos algo, dile la
  verdad: que del local le confirman el pedido por acá. No inventes una cantidad
  ni digas que ya le encargaste algo.`
    : cli.encontrado
    ? `Es cliente registrado: ${cli.nombre_completo} (ficha principal id ${cli.cliente_id}). Llámalo ${cli.nombre}.${fichasTxt}${facturaTxt}
Email ${cli.email || "NO TIENE"} · Direcciones: ${cli.direcciones.map(lineaDireccion).join(" | ") || "NINGUNA"}
Para el despacho manda el SECTOR, no la comuna: una dirección con sector Reñaca o Jardín del Mar NO es Viña del Mar centro aunque la comuna diga Viña del Mar. Si dice SIN SECTOR y la comuna es Viña del Mar, no anuncies cobro: pregúntale el sector.
Historial: ${cli.pedidos_historicos} pedidos${cli.ultimo_retiro ? `, último retiro el ${cli.ultimo_retiro}` : ""}.`
    : `NO está en la base. Si quiere agendar, reúne los datos y usa registrar_cliente.`;

  const imagen = conImagen ? (proveedor ? `
TE MANDÓ UNA IMAGEN
Es un proveedor, así que lo más probable es una boleta, una factura, una lista de
precios o una foto de la mercadería. Mírala y responde a lo que muestra.
· Si es una lista de precios y se leen claros, anótalos con anotar_proveedor.
· Si es una factura o un cobro: NO confirmes montos ni pagos, deriva a una persona.
· Si no se entiende: pídele que la reenvíe, no adivines.
` : `
TE MANDÓ UNA IMAGEN
Estás viendo el archivo que adjuntó. Míralo antes de contestar.
· Si es un COMPROBANTE DE TRANSFERENCIA: lee monto, a quién se transfirió, número
  de operación, fecha y banco, y usa registrar_comprobante. Copia los datos tal
  cual salen en la imagen: no completes lo que no se lee ni redondees el monto.
· Si es una mancha, una prenda o una etiqueta: descríbela y responde la consulta.
  Si te piden garantizar que una mancha sale, deriva a una persona.
· Si es del EQUIPO y muestra un error o una pantalla con problemas: descríbelo en
  el detalle al usar registrar_mejora.
· Si no se entiende: pídele que la reenvíe, no adivines.
`) : "";

  const deCliente = (equipo || proveedor) ? "" : `
CUANDO ACEPTAN UN HORARIO
"Perfecto", "ya", "dale", "ok" o "sí" después de ofrecer un tramo es un SÍ.
USA agendar_retiro y recién entonces responde con el número de pedido. Nunca des
por agendado algo que no agendaste.

FACTURA
Si pide factura, pídele razón social, RUT, giro, dirección y comuna tributaria y
correo de facturación. Apenas los tengas completos, GUÁRDALOS: con
registrar_datos_factura si ya tiene ficha, o dentro de registrar_cliente si es
nuevo. No esperes a agendar para guardarlos.
Decir "anoto todo", "quedó registrado" o algo parecido SIN que la herramienta
haya respondido ok es mentirle: el 24-sep una clienta quedó con boleta porque se
le dijo que se anotaba la factura y no se guardó nada. Si la herramienta
devuelve un error (RUT inválido, faltan datos), pídele lo que corresponda.
Nunca le pongas los datos de factura solo en las observaciones del retiro.

QUIÉN SE MUEVE NO SE ADIVINA
Cuando hables del estado de un pedido, la fuente es estado_pedidos: cada pedido
trae "frase" ya redactada y "quien_se_mueve". Usa la frase tal cual. Si
quien_se_mueve es LADYS_VA, vamos NOSOTROS a su domicilio: nunca le digas que lo
esperamos, que pase, que venga ni que lo retire. Si es CLIENTE_VIENE, pasa él por
el local y no le prometas que se lo llevamos.

HORARIOS DE RETIRO
cupos_ruta devuelve todos los tramos del día, cada uno con admite_retiro.
Ofrece SOLO los que vienen con admite_retiro true. Los que vienen en false ya no
se pueden tomar —por hora o por cupo— y no se ofrecen ni se negocian, aunque el
cliente insista. Si ese día no sirve, cupos_ruta trae "alternativas" ya
revisadas: ofrece SOLO esas. Nunca propongas un día ni un horario de memoria.

REAGENDAR
Si el cliente pide cambiar la fecha de un retiro que ya tiene, llama a
agendar_retiro con la fecha nueva: mueve el pedido existente y conserva el mismo
número. NO pidas nuevo_pedido salvo que quiera un retiro ADICIONAL además del que
ya tiene. Y al confirmarle, dale el número que devuelve la herramienta.

ANULAR UN RETIRO LO HACES TÚ
Si el cliente dice que no va a estar, que no lo necesita, que lo cancelemos o
cualquier cosa que signifique que el retiro no va: USA anular_retiro. No lo
mandes a esperar a un ejecutivo. Eso fue lo que dejó a una clienta con la
camioneta yendo a su casa después de haber avisado que no estaría.
· Primero mira estado_pedidos: ahí cada pedido trae se_puede_anular.
· Confírmale cuál vas a anular si tiene más de uno. Si tiene uno solo, no le
  hagas preguntas de más: anúlalo y avísale.
· Si lo que quiere es CAMBIAR la fecha, no anules: reagenda.
· Si la herramienta te dice que derives —porque ya hay pagos o porque la ropa ya
  está en el local—, deriva sin explicar el motivo técnico.
· Al confirmar dale el número de pedido y la fecha que quedó cancelada, dile que
  la camioneta ya no pasa, y ofrécele agendar otro día antes de despedirte.

PAGOS POR TRANSFERENCIA
Cuando registres un comprobante, el pedido queda pagado de inmediato. No le
hables al cliente de "verificación", "revisión" ni "confirmación pendiente": eso
pasa por dentro. Si la herramienta te dice que derives, deriva sin explicar el
motivo técnico: solo que un ejecutivo lo revisa y le confirma.`;

  return `Hoy es ${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()} (${hoy}), son las ${ahoraChile()} en Chile.

${(equipo || proveedor) ? "" : "QUIÉN TE ESCRIBE\n"}${ficha}
${previo ? `
LO ÚLTIMO QUE LE ESCRIBIMOS NOSOTROS, ANTES DE SU MENSAJE:
"${previo}"
Su mensaje es una respuesta A ESTO. Léelo antes de contestar: si le avisamos que
su pedido está listo y responde "ok gracias", NO lo saludes de nuevo ni preguntes
en qué puedes ayudar. Cierra bien: quedó claro, lo esperamos.
ESO ES PARA TI, NO PARA ÉL. No le expliques tu razonamiento ni le cuentes cómo
entendiste su mensaje: nada de "le avisamos que...", "su 'perfecto' es la
respuesta a eso" ni "entiendo que te refieres a". Tampoco le cites lo que él
mismo acaba de escribir. Responde, no narres.
` : ""}${hechosTxt}${imagen}
EL HILO ES SOLO DE LAS ÚLTIMAS HORAS
Lo anterior a eso no te lo paso a propósito: no es esta conversación. Responde a
lo que te dicen AHORA.

SI SOLO SALUDAN
Un "hola" no es un reclamo. Saluda y pregunta en qué puedes ayudar. NO derives
por un saludo.

NOTAS DE VOZ
Si el mensaje empieza con [Audio transcrito], te mandaron una nota de voz y estás
leyendo su transcripción automática. Puede traer errores en nombres, números y
direcciones: responde normal, como a un mensaje escrito, y si un dato clave suena
raro, confírmalo antes de agendar o de anotar. No menciones la transcripción. Si
en el hilo aparece [nota de voz], es un audio anterior: NO es una imagen.
${deCliente}${nota}`;
}

async function conversar(apiKey: string, negocio: string, cli: any, historial: any[],
                         texto: string, adjuntos: any[], telefono: string, contactId: string,
                         nota: string, previo: string, minutos: number, prueba: boolean,
                         equipo: any = null, proveedor: any = null, hechos: string[] = []) {
  const limpio = sano(texto);
  const primero = adjuntos.length
    ? { role: "user", content: [...adjuntos.map((a: any) => a.bloque), { type: "text", text: limpio }] }
    : { role: "user", content: limpio };
  const previos = historial.map((m: any) =>
    typeof m.content === "string" ? { ...m, content: sano(m.content) } : m);
  const mensajes: any[] = [...previos, primero];
  // El equipo puede anotar en la bitácora; los clientes no la ven siquiera.
  // El proveedor tiene su propio juego: nada de agendar, cobrar ni vender.
  // v38: con el equipo no se tocan SUS fichas de cliente (agendar, anular,
  // registrar, estado_pedidos): todo va por número de pedido.
  const SOLO_CLIENTE = ["derivar_a_persona", "registrar_datos_factura", "estado_pedidos",
                        "agendar_retiro", "anular_retiro", "registrar_cliente"];
  const tools = equipo
    ? [...HERRAMIENTAS.filter((h) => !SOLO_CLIENTE.includes(h.name)),
       HERRAMIENTA_VER_PEDIDO, HERRAMIENTA_MEJORA]
    : proveedor
    ? [...HERRAMIENTAS.filter((h) => h.name === "catalogo" || h.name === "derivar_a_persona"),
       ...HERRAMIENTAS_PROVEEDOR]
    : HERRAMIENTAS;
  const usadas: any[] = [];
  let ordenId: number | null = null, clienteNuevo: number | null = null;
  let escalado: string | null = null, avisoOk: boolean | null = null;
  let mejoraId: number | null = null;
  let tin = 0, tout = 0;

  for (let vuelta = 0; vuelta < 8; vuelta++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey,
                 "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 900,
        system: sano(contexto(cli, hoyChile(), nota, previo, adjuntos.length > 0, equipo, proveedor, hechos) + "\n\n" + negocio),
        tools, messages: mensajes,
      }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    tin += data.usage?.input_tokens || 0;
    tout += data.usage?.output_tokens || 0;
    mensajes.push({ role: "assistant", content: data.content });
    const llamadas = (data.content || []).filter((b: any) => b.type === "tool_use");
    if (!llamadas.length) {
      const t = (data.content || []).filter((b: any) => b.type === "text")
        .map((b: any) => b.text).join("\n").trim();
      return { respuesta: t, usadas, ordenId, clienteNuevo, escalado, avisoOk, mejoraId, tin, tout };
    }
    const resultados: any[] = [];
    for (const t of llamadas) {
      let out: any;
      try {
        if (t.name === "catalogo") out = await catalogo(String(t.input.busqueda || ""));
        else if (t.name === "planes_club") out = await planesClub();
        else if (t.name === "estado_pedidos")
          out = cli.encontrado ? await estadoPedidos(cli) : { error: "No está registrado" };
        else if (t.name === "link_pago")
          out = equipo ? await linkDePago(Number(t.input.orden_id), null)
              : cli.encontrado ? await linkDePago(Number(t.input.orden_id), idsDe(cli))
                               : { ok: false, error: "No está registrado" };
        else if (t.name === "ver_pedido")
          out = equipo ? await verPedido(t.input) : { error: "Herramienta desconocida" };
        else if (t.name === "registrar_mejora") {
          out = await registrarMejora(t.input, equipo, telefono);
          if (out.ok) mejoraId = out.mejora_id;
        }
        else if (t.name === "pedidos_proveedor") out = await pedidosProveedor(proveedor);
        else if (t.name === "anotar_proveedor") out = await anotarProveedor(t.input, proveedor);
        else if (t.name === "registrar_comprobante") {
          if (!adjuntos.length)
            out = { ok: false, error: "No hay ninguna imagen en ESTE mensaje. Si el comprobante ya aparece en LO QUE YA HICISTE, está registrado y bien hecho: NO pidas reenviarlo ni te disculpes, solo confírmaselo. Si no aparece ahí, recién entonces pídele la imagen." };
          else {
            out = await registrarComprobante(t.input, cli, contactId, adjuntos[0]?.url || "", equipo);
            if (out.ok) ordenId = out.orden_id;
            if (out.derivar && !equipo) {
              escalado = String(out.error).slice(0, 180);
              const av = await avisarAgente(cli, telefono, contactId, escalado, minutos, prueba);
              avisoOk = av.avisado;
            }
          }
        }
        else if (t.name === "cupos_ruta") out = await cuposRuta(String(t.input.fecha));
        else if (t.name === "registrar_cliente") {
          out = await registrarCliente(t.input, telefono);
          if (out.ok) { clienteNuevo = out.cliente_id; cli = await buscarCliente(telefono); }
          if (out.factura?.derivar) {
            escalado = String(out.factura.error).slice(0, 180);
            const av = await avisarAgente(cli, telefono, contactId, escalado, minutos, prueba);
            avisoOk = av.avisado;
          }
        } else if (t.name === "registrar_datos_factura") {
          // v35: con varias fichas en el mismo teléfono no se adivina cuál es la
          // empresa: lo resuelve una persona.
          if (!cli.encontrado)
            out = { ok: false, error: "Todavía no tiene ficha: usa registrar_cliente y pásale ahí los datos de la factura." };
          else if (idsDe(cli).length > 1)
            out = { ok: false, derivar: true,
                    error: "Este teléfono está en varias fichas y no sé en cuál guardar la factura. Deriva a una persona; al cliente dile solo que un ejecutivo deja lista su factura." };
          else {
            out = await guardarFactura(Number(cli.cliente_id), t.input);
            if (out.ok) cli = await buscarCliente(telefono);
          }
          if (out.derivar) {
            escalado = String(out.error).slice(0, 180);
            const av = await avisarAgente(cli, telefono, contactId, escalado, minutos, prueba);
            avisoOk = av.avisado;
          }
        } else if (t.name === "agendar_retiro") {
          out = cli.encontrado ? await agendarRetiro({ ...t.input, cliente_id: cli.cliente_id })
                               : { ok: false, error: "El cliente no está registrado" };
          if (out.ok) ordenId = out.orden_id;
        } else if (t.name === "anular_retiro") {
          out = await anularRetiro(t.input, cli);
          if (out.ok) ordenId = out.orden_id;
          if (out.derivar) {
            escalado = String(out.error).slice(0, 180);
            const av = await avisarAgente(cli, telefono, contactId, escalado, minutos, prueba);
            avisoOk = av.avisado;
          }
        } else if (t.name === "derivar_a_persona") {
          escalado = String(t.input.motivo || "sin motivo");
          const av = await avisarAgente(cli, telefono, contactId, escalado, minutos, prueba);
          avisoOk = av.avisado;
          out = { ok: true, aviso: av.repetido ? "Ya estaba derivada, responde breve."
                                              : "Avisado. Díselo en UNA frase y termina." };
        } else out = { error: "Herramienta desconocida" };
      } catch (e) { out = { error: (e as Error).message }; }
      usadas.push({ herramienta: t.name, entrada: t.input, salida: out });
      resultados.push({ type: "tool_result", tool_use_id: t.id, content: sano(JSON.stringify(out)) });
    }
    mensajes.push({ role: "user", content: resultados });
  }
  return { respuesta: "Prefiero que te responda una persona, ya le aviso.", usadas, ordenId,
           clienteNuevo, escalado: "se agotó el ciclo", avisoOk, mejoraId, tin, tout };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-sofia2/, "").replace(/\/$/, "") || "/";
  if ((req.headers.get("x-api-key") || url.searchParams.get("k") || "") !== CLAVE)
    return json({ error: "no autorizado" }, 401);

  try {
    if (ruta === "/salud") {
      const p = await config("sofia_prompt");
      const [f] = await SQL`
        SELECT COUNT(*) FILTER (WHERE error IS NOT NULL)::int AS fallas,
               COUNT(*) FILTER (WHERE respuesta IS NOT NULL)::int AS respondidos
        FROM sofia_mensajes WHERE creado_en > NOW() - INTERVAL '1 hour'`;
      const [c] = await SQL`
        SELECT COUNT(*) FILTER (WHERE estado='POR_VERIFICAR')::int AS por_verificar,
               COUNT(*) FILTER (WHERE estado='SIN_RESPALDO')::int AS sin_respaldo
        FROM comprobantes`;
      const [au] = await SQL`
        SELECT COUNT(*) FILTER (WHERE estado='PENDIENTE')::int AS pendientes,
               COUNT(*) FILTER (WHERE estado='ERROR' AND creado_en > NOW() - INTERVAL '24 hours')::int AS errores_24h
        FROM audio_transcripciones`;
      const [mj] = await SQL`
        SELECT COUNT(*) FILTER (WHERE estado='ABIERTA')::int AS abiertas,
               COUNT(*) FILTER (WHERE estado='ABIERTA' AND urgencia='ALTA')::int AS urgentes
        FROM mejoras`;
      const equipo = await SQL`
        SELECT nombre, apellido, perfil FROM usuarios
         WHERE estado = TRUE AND telefono IS NOT NULL ORDER BY id`;
      const provs = await SQL`
        SELECT nombre, rubro FROM proveedores
         WHERE activo AND telefono IS NOT NULL ORDER BY id`;
      return json({ activa: (await config("sofia_activa")) === "true",
        version: 38,
        prompt: p ? `${p.length} caracteres` : "FALTA",
        herramientas: HERRAMIENTAS.map((h) => h.name),
        herramienta_equipo: HERRAMIENTA_MEJORA.name,
        herramientas_proveedor: HERRAMIENTAS_PROVEEDOR.map((h) => h.name),
        ve_imagenes: true, transcribe_audios: true, horas_de_hilo: HORAS_DE_HILO,
        frase_por_pedido: true, fichas_por_telefono: true, sector_en_ficha: true,
        factura_en_ficha: true, memoria_de_acciones: true, equipo_registra_comprobantes: true,
        silencio_tras_derivar_min: Number(await config("sofia_silencio_minutos")) || 10,
        silencio_tras_persona_min: Number(await config("sofia_silencio_humano_minutos")) || 60,
        antelacion_minutos: await antelacionMinima(),
        colaboradores: equipo.map((u: any) =>
          `${[u.nombre, u.apellido].filter(Boolean).join(" ")} (${u.perfil})`),
        proveedores: provs.map((x: any) => `${x.nombre}${x.rubro ? ` (${x.rubro})` : ""}`),
        hora_chile: ahoraChile(), ultima_hora: f, comprobantes: c, audios: au, mejoras: mj });
    }

    // La bitácora de lo que reportó el equipo. GET /mejoras?estado=ABIERTA
    if (req.method === "GET" && ruta === "/mejoras") {
      const estado = String(url.searchParams.get("estado") || "ABIERTA").toUpperCase();
      const filas = estado === "TODAS"
        ? await SQL`SELECT * FROM mejoras ORDER BY creado_en DESC LIMIT 100`
        : await SQL`SELECT * FROM mejoras WHERE estado = ${estado}
                     ORDER BY array_position(ARRAY['ALTA','NORMAL','BAJA'], urgencia), creado_en DESC
                     LIMIT 100`;
      return json({ estado, total: filas.length, mejoras: filas });
    }

    if (req.method === "POST" && ruta === "/transcripcion") {
      const b = await req.json().catch(() => ({} as any));
      const id = Number(b.id);
      if (!id) return json({ error: "Falta id" }, 400);
      const texto = cortar(String(b.texto || "").trim(), 3000);
      const [t] = await SQL`
        UPDATE audio_transcripciones
           SET estado = ${texto ? "TRANSCRITO" : "ERROR"}, texto = ${texto || null},
               error = ${texto ? null : String(b.error || "sin texto").slice(0, 300)},
               segundos = ${Number(b.segundos) || null}, duracion = ${Number(b.duracion) || null},
               actualizado_en = NOW()
         WHERE id = ${id} AND estado = 'PENDIENTE'
        RETURNING *`;
      if (!t) return json({ ignorado: true, motivo: "ya procesada o no existe" });
      if (!texto) {
        const pit = await config("ghl_pit");
        const tel = t.telefono || (t.contact_id && pit ? await telefonoDe(pit, t.contact_id) : "");
        const av = await avisarAgente(await buscarCliente(tel), tel, t.contact_id || "",
          `Mandó una nota de voz que no se pudo transcribir (${t.error}). Escúchala en GHL.`, 0, false);
        return json({ ok: false, equipo_avisado: av.avisado });
      }
      const r = await fetch(`${YO}/mensaje`, {
        method: "POST", headers: { "content-type": "application/json", "x-api-key": CLAVE },
        body: JSON.stringify({ contact_id: t.contact_id, telefono: t.telefono || "", canal: t.canal || "",
                               texto: `[Audio transcrito] ${texto}`, audio_de: t.mensaje_ghl_id }) });
      return json({ ok: true, sofia: await r.json().catch(() => null) });
    }

    if (req.method === "POST" && (ruta === "/mensaje" || ruta === "/")) {
      const b = await req.json().catch(() => ({} as any));
      const contactId = String(b.contact_id || "").trim();
      const pit = await config("ghl_pit");
      const prueba = b.responder === false;
      const minutos = Number(await config("sofia_silencio_minutos")) || 10;
      // v33: cuando una PERSONA del equipo escribió en el hilo, SofIA espera más
      // que tras derivar: la persona está atendiendo y no se le quita la palabra.
      const minutosHumano = Number(await config("sofia_silencio_humano_minutos")) || 60;
      let telefono = String(b.telefono || "").trim();
      let texto = String(b.texto || "").trim();
      let canal = String(b.canal || "").trim();
      let urls: string[] = Array.isArray(b.adjuntos) ? b.adjuntos.map(String) : [];
      let conversacion = "", mensajeId = "";
      let filaId: number | null = null;

      const [derivada] = await SQL`
        SELECT id FROM sofia_mensajes
         WHERE contact_id = ${contactId || null} AND escalado = TRUE
           AND creado_en > NOW() - (${minutos} || ' minutes')::interval LIMIT 1`;
      if (derivada && !prueba) return json({ ignorado: true, motivo: "derivada hace poco" });

      if (!texto) {
        if (!contactId) return json({ error: "Sin texto y sin contact_id" }, 400);
        if (!pit) return json({ error: "Falta el PIT de GHL" }, 503);
        const m = await ultimoMensaje(pit, contactId);
        if (!m.ok) return json({ error: `No pude leer el mensaje: ${m.motivo}` }, 502);
        if (!m.entrante) return json({ ignorado: true, motivo: "el último no es del cliente" });
        texto = m.texto; conversacion = m.conversacion || ""; mensajeId = m.mensajeId || "";
        if (!urls.length) urls = (m.adjuntos || []).map(String);
        if (!canal) canal = m.canal;
      } else if (contactId && pit) {
        const m = await ultimoMensaje(pit, contactId);
        if (m.ok) {
          conversacion = m.conversacion || "";
          if (!canal) canal = m.canal;
          if (!urls.length && m.texto === texto) urls = (m.adjuntos || []).map(String);
        }
      }

      const bajados = urls.length ? await bajarAdjuntos(urls) : [];
      const audios = bajados.filter((a: any) => a.audio);
      const adjuntos = bajados.filter((a: any) => !a.audio);

      if (!texto && !adjuntos.length && audios.length) {
        if (prueba || !mensajeId)
          return json({ ignorado: true, motivo: "nota de voz: solo se transcriben mensajes reales de GHL" });
        const [fila] = await SQL`
          INSERT INTO audio_transcripciones (mensaje_ghl_id, contact_id, telefono, canal, url)
          VALUES (${mensajeId}, ${contactId || null}, ${telefono || null}, ${canal || null}, ${audios[0].url})
          ON CONFLICT (mensaje_ghl_id) DO NOTHING
          RETURNING id`;
        if (!fila) return json({ ignorado: true, motivo: "esa nota de voz ya está en transcripción" });
        const d = await despacharTranscripcion(fila.id, audios[0].url);
        if (!d.ok) {
          await SQL`UPDATE audio_transcripciones SET estado = 'ERROR', error = ${d.motivo},
                    actualizado_en = NOW() WHERE id = ${fila.id}`;
          const tel = telefono || (contactId && pit ? await telefonoDe(pit, contactId) : "");
          await avisarAgente(await buscarCliente(tel), tel, contactId,
            `Llegó una nota de voz y no se pudo mandar a transcribir: ${d.motivo}`, 0, false);
          return json({ error: d.motivo }, 502);
        }
        return json({ en_transcripcion: true, transcripcion_id: fila.id });
      }

      if (!texto && adjuntos.length) texto = MARCA_IMAGEN;

      // v38: el equipo suele mandar la foto del comprobante y el número de pedido en
      // mensajes separados. Si este mensaje no trae imagen y el anterior (<= 30 min)
      // sí, se le vuelve a mostrar la imagen a SofIA.
      let imagenPrevia = false;
      if (!adjuntos.length && conversacion && pit && texto &&
          /\d{4,}|comprobante|transfer|pago|pedido|orden|ot\b/i.test(texto) &&
          await buscarColaborador(telefono || (contactId ? await telefonoDe(pit, contactId) : ""))) {
        try {
          const lista = await mensajesDe(pit, conversacion, 8) || [];
          const previa = lista.find((m: any) => String(m.direction) === "inbound" &&
            Array.isArray(m.attachments) && m.attachments.length &&
            Date.now() - new Date(m.dateAdded || 0).getTime() < 30 * 60000 &&
            String(m.id || "") !== mensajeId);
          if (previa) {
            const b2 = (await bajarAdjuntos(previa.attachments.map(String))).filter((x: any) => !x.audio);
            if (b2.length) { adjuntos.push(b2[0]); imagenPrevia = true; }
          }
        } catch { /* sin imagen previa */ }
      }
      if (!texto) return json({ ignorado: true, motivo: urls.length
        ? "adjunto de un tipo que no puedo leer" : "mensaje vacío" });

      if (mensajeId && !prueba) {
        const res = await SQL`
          INSERT INTO sofia_mensajes (telefono, contact_id, mensaje_ghl_id, entrada, canal)
          VALUES (${telefono || null}, ${contactId || null}, ${mensajeId}, ${texto}, ${canal || null})
          ON CONFLICT (mensaje_ghl_id) WHERE mensaje_ghl_id IS NOT NULL DO NOTHING
          RETURNING id`;
        if (!res.length) return json({ ignorado: true, motivo: "ya lo responde otro proceso" });
        filaId = res[0].id;
      }

      if (!telefono && contactId && pit) telefono = await telefonoDe(pit, contactId);

      const apiKey = await config("anthropic_api_key");
      if (!apiKey) return json({ error: "Falta la clave de Anthropic" }, 503);
      const negocio = await config("sofia_prompt");
      if (!negocio) return json({ error: "Falta sofia_prompt" }, 503);
      if (!prueba && (await config("sofia_activa")) !== "true")
        return json({ error: "SofIA está apagada" }, 503);

      const cli = await buscarCliente(telefono);
      const equipo = await buscarColaborador(telefono);
      // El equipo manda sobre el proveedor: si alguien está en las dos listas, es
      // del equipo. Y un proveedor nunca se trata como cliente, aunque exista su
      // ficha de cliente.
      const proveedor = equipo ? null : await buscarProveedor(telefono);

      // Con el equipo no aplica el silencio por "alguien está atendiendo": él ES
      // el equipo y le está escribiendo a SofIA a propósito.
      const hilo = conversacion
        ? await hiloGHL(pit, conversacion, contactId, texto, minutosHumano)
        : { mensajes: [] as any[], humano: false, haceMin: null, viejos: 0, previo: "" };
      if (hilo.humano && !prueba && !equipo) {
        if (filaId) await SQL`DELETE FROM sofia_mensajes WHERE id = ${filaId}`;
        return json({ ignorado: true, motivo: `una persona escribió hace ${hilo.haceMin} minutos` });
      }

      let nota = !equipo && hilo.haceMin !== null && hilo.haceMin >= minutosHumano
        ? `\n\nOJO: alguien del equipo respondió este hilo y dejó de escribir hace ${hilo.haceMin} minutos. Retomas tú, sin repetir ni contradecir lo que dijo esa persona.`
        : "";
      if (imagenPrevia)
        nota += `\n\nOJO: la imagen adjunta NO viene en este mensaje: la mandó en un mensaje anterior de los últimos 30 minutos y te la vuelvo a mostrar. ` +
          `Si es un comprobante y este mensaje trae el número de pedido, aplícalo con registrar_comprobante.`;

      // v33: el cliente puede REENVIAR un mensaje que nosotros le escribimos (lo
      // hizo el 23-sep para mostrar que SofIA dijo lo contrario que Catalina).
      if (!equipo && !proveedor && contactId && texto !== MARCA_IMAGEN &&
          texto.length >= 40 && await esDelSistema(contactId, texto)) {
        nota += `\n\nOJO: el mensaje del cliente es una COPIA TEXTUAL de algo que NOSOTROS le escribimos antes: lo reenvió. ` +
          `No es una imagen ni un mensaje nuevo suyo. Casi siempre lo reenvía para preguntar o reclamar por eso. ` +
          `No lo repitas ni lo defiendas. Si en el hilo una persona del equipo le dijo algo distinto, no decidas tú cuál vale: ` +
          `discúlpate en una frase por la confusión y usa derivar_a_persona para que lo aclare una persona. ` +
          `Si no hay contradicción, pregúntale en una frase qué quiere saber de ese mensaje.`;
      }

      let historial = hilo.mensajes;
      if (!historial.length) {
        const previos = await SQL`
          SELECT entrada, respuesta FROM sofia_mensajes
          WHERE contact_id = ${contactId || null} AND respuesta IS NOT NULL
            AND creado_en > NOW() - INTERVAL '6 hours' ORDER BY id DESC LIMIT 5`;
        historial = previos.reverse().flatMap((m: any) => ([
          { role: "user", content: m.entrada }, { role: "assistant", content: m.respuesta }]));
      }
      if (b.audio_de) historial = historial.map((m: any) => typeof m.content === "string"
        ? { ...m, content: m.content.split(MARCA_IMAGEN).join(MARCA_VOZ) } : m);

      // v37: lo que SofIA ya hizo con este cliente, para que no se retracte.
      let hechos: string[] = [];
      if (!equipo && !proveedor && cli.encontrado) {
        try { hechos = await hechosDelCliente(cli, contactId); } catch { hechos = []; }
      }

      let out: any;
      try {
        out = await conversar(apiKey, negocio, cli, historial, texto, adjuntos, telefono, contactId,
                              nota, hilo.previo, minutos, prueba, equipo, proveedor, hechos);
      } catch (e) {
        const falla = (e as Error).message;
        const av = await avisarAgente(cli, telefono, contactId,
          `SofIA no pudo responder: ${falla.slice(0, 160)}`, minutos, prueba);
        let envioF: any = { enviado: false, motivo: prueba ? "modo prueba" : "aviso ya enviado" };
        if (!prueba && !av.repetido) {
          const decir = (await config("sofia_texto_falla")) ||
            "Hola, recibimos tu mensaje. En un momento te responde alguien del equipo.";
          envioF = await responderPorGHL(pit, contactId, canal, decir);
        }
        if (filaId) await SQL`UPDATE sofia_mensajes SET error=${falla}, escalado=TRUE,
            motivo_escala=${"falla técnica"}, enviado=${!!envioF.enviado} WHERE id=${filaId}`;
        return json({ error: falla, equipo_avisado: av.avisado }, 500);
      }

      const envio = prueba ? { enviado: false, motivo: "modo prueba" }
                           : await responderPorGHL(pit, contactId, canal, out.respuesta);

      if (filaId) {
        await SQL`UPDATE sofia_mensajes SET
            telefono=${telefono}, cliente_id=${cli.cliente_id ?? out.clienteNuevo ?? null},
            respuesta=${out.respuesta}, herramientas=${JSON.stringify(out.usadas)},
            orden_id=${out.ordenId}, escalado=${!!out.escalado}, motivo_escala=${out.escalado},
            tokens_in=${out.tin}, tokens_out=${out.tout}, enviado=${!!envio.enviado},
            canal=${envio.canal ?? canal ?? null}, motivo_envio=${envio.motivo ?? null}
          WHERE id=${filaId}`;
      } else if (!prueba) {
        await SQL`INSERT INTO sofia_mensajes
          (telefono, cliente_id, contact_id, entrada, respuesta, herramientas, orden_id,
           escalado, motivo_escala, tokens_in, tokens_out, enviado, canal)
          VALUES (${telefono}, ${cli.cliente_id ?? null}, ${contactId || null}, ${texto},
                  ${out.respuesta}, ${JSON.stringify(out.usadas)}, ${out.ordenId},
                  ${!!out.escalado}, ${out.escalado}, ${out.tin}, ${out.tout},
                  ${!!envio.enviado}, ${envio.canal ?? canal ?? null})`;
      }

      return json({ leido: texto, contexto: historial.length,
        adjuntos_leidos: adjuntos.map((a: any) => a.tipo),
        adjuntos_ignorados: urls.length - bajados.length,
        vio_lo_que_le_escribimos: !!hilo.previo,
        mensajes_viejos_descartados: hilo.viejos,
        respuesta: out.respuesta, cliente: cli.encontrado ? cli.nombre_completo : null,
        colaborador: equipo ? equipo.nombre_completo : null,
        proveedor: proveedor ? proveedor.nombre : null,
        orden_creada: out.ordenId, mejora_registrada: out.mejoraId,
        derivar_a_persona: !!out.escalado,
        enviado_al_cliente: envio, herramientas: out.usadas.map((u: any) => u.herramienta),
        detalle_herramientas: prueba ? out.usadas : undefined });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
