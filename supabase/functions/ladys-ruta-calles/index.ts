// LADYS-RUTA-CALLES (26-sep-2026). Todo lo que se dibuja como "camino" en un
// mapa de reparto sale de aqui, siempre por calles. Nunca una recta.
//
// Por que existe: el 21-sep se arreglo el monitor /ruta/ y el 22-sep el link del
// cliente, pero la pantalla Ruta en vivo de la app seguia uniendo los puntos GPS
// con rectas y no dibujaba lo que falta (bitacora 122). Cada pantalla tenia su
// propio dibujo y el arreglo de una no llegaba a las otras. Esta funcion es la
// fuente unica: cualquier pantalla nueva debe pedirle el camino aqui.
//
// Devuelve por tramo (AM/PM):
//  - rastro: por donde anduvo la camioneta, en pedazos. "gps" = puntos reales.
//    "hueco" = el celular dejo de reportar (>2 min o >300 m entre puntos): se
//    reconstruye por calles con Routes API entre el ultimo punto antes del hueco
//    y el primero despues, y se marca como reconstruido (sin GPS).
//  - falta: camioneta (o local si no hay senal) -> paradas pendientes en orden
//    -> local, por calles y con trafico. Comparte ruta_calles_cache con
//    ladys-pantalla-ruta (misma clave), asi las dos pantallas muestran lo mismo.
// Si Google falla NO se inventa nada: el pedazo viaja sin polyline y con error.
// OJO postgres.js: un JSON.stringify con ::jsonb queda guardado como TEXTO json ("string").
// Siempre ::text::jsonb.
import postgres from "npm:postgres@3.4.4";
import * as jose from "npm:jose@5.9.6";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 2, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
});
const SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET") || "ladys_jwt_secret_super_seguro_2024");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });
const hoy = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });
const rad = (g: number) => (g * Math.PI) / 180;
function metros(a: any, b: any) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
const SIN_SENAL_MIN = 4;
const REHACER_EN_MOVIMIENTO_MIN = 3;
const REINTENTAR_ERROR_MIN = 10;
const HUECO_SEG = 120, HUECO_M = 300;
const MAX_HUECOS_NUEVOS = 12; // tope de consultas nuevas a Google por llamada

async function auth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
  try { const { payload } = await jose.jwtVerify(tok, SECRET); return payload as any; } catch { return null; }
}
async function cfg(clave: string) {
  const [r] = await SQL`SELECT valor FROM configuracion WHERE clave = ${clave}`;
  return String(r?.valor ?? "");
}
const punto = (p: any) => ({ ...(p.via ? { via: true } : {}), location: { latLng: { latitude: Number(p.lat), longitude: Number(p.lng) } } });
const valido = (p: any) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180;
const EDITAN = ["ADMINISTRADOR", "JEFE_LOCAL"];

// Pide un camino por calles y lo guarda. rehacerMin = null: no vence nunca (el pasado no cambia).
async function porCalles(clave: string, origen: any, destino: any, inter: any[], trafico: boolean, rehacerMin: number | null) {
  const [c] = await SQL`SELECT polyline, legs, error, EXTRACT(EPOCH FROM (NOW() - creado_en)) / 60 AS edad
                          FROM ruta_calles_cache WHERE clave = ${clave}`;
  if (c) {
    const edad = Number(c.edad);
    if (c.polyline && (rehacerMin == null || edad < rehacerMin)) return { polyline: c.polyline, legs: c.legs, error: null, nuevo: false };
    if (!c.polyline && edad < REINTENTAR_ERROR_MIN) return { polyline: null, legs: null, error: c.error, nuevo: false };
  }
  const llave = await cfg("google_maps_api_key");
  let polyline: string | null = null, legs: any = null, error: string | null = null;
  try {
    const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": llave,
                 "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters" },
      body: JSON.stringify({
        origin: punto(origen), destination: punto(destino),
        intermediates: inter.slice(0, 25).map(punto),
        travelMode: "DRIVE", routingPreference: trafico ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
        languageCode: "es-CL", units: "METRIC",
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d?.routes?.[0]?.polyline?.encodedPolyline) {
      polyline = d.routes[0].polyline.encodedPolyline;
      legs = (d.routes[0].legs || []).map((l: any) => ({
        seg: Number(String(l.duration || "0s").replace("s", "")) || 0, m: Number(l.distanceMeters) || 0 }));
    } else error = `Google ${r.status}: ${String(d?.error?.message || "sin ruta").slice(0, 200)}`;
  } catch (e) { error = String((e as Error).message).slice(0, 200); }
  await SQL`INSERT INTO ruta_calles_cache (clave, polyline, legs, error, creado_en)
            VALUES (${clave}, ${polyline}, ${legs ? JSON.stringify(legs) : null}::text::jsonb, ${error}, NOW())
            ON CONFLICT (clave) DO UPDATE SET polyline = EXCLUDED.polyline, legs = EXCLUDED.legs,
              error = EXCLUDED.error, creado_en = NOW()`;
  return { polyline, legs, error, nuevo: true };
}

const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const horaCL = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: "America/Santiago", hour12: false }).slice(0, 5);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  if (url.pathname.endsWith("/salud")) return json({ ok: true, funcion: "ladys-ruta-calles", v: 3 });
  try {
    const u = await auth(req);
    if (!u) return json({ error: "no autorizado" }, 401);
    const camino = url.pathname.replace(/^.*ladys-ruta-calles/, "").replace(/\/$/, "") || "/";

    // -- CORREGIR CAMINO (26-sep, bitacora 203) --
    // Se guarda en la DIRECCION del cliente: vale para esta y las proximas visitas.
    // ladys-navegacion la usa para guiar a la conductora; aqui se usa para "lo que falta".
    if (camino === "/correccion" && req.method === "GET") {
      const [x] = await SQL`SELECT d.id AS direccion_id, d.lat, d.lng, d.nav_llegada, d.nav_via, d.nav_corregido_por, d.nav_corregido_en
                              FROM reparto_paradas p JOIN direcciones_clientes d ON d.id = p.direccion_id
                             WHERE p.id = ${Number(url.searchParams.get("parada_id")) || 0}`;
      if (!x) return json({ error: "parada sin direccion" }, 404);
      return json(x);
    }
    if (camino === "/previa" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (!valido(b.origen) || !valido(b.destino)) return json({ error: "origen y destino requeridos" }, 400);
      const via = (Array.isArray(b.via) ? b.via : []).filter(valido).slice(0, 10).map((v: any) => ({ ...v, via: true }));
      const llave = await cfg("google_maps_api_key");
      const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Goog-Api-Key": llave,
                   "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration" },
        body: JSON.stringify({ origin: punto(b.origen), destination: punto(b.destino), intermediates: via.map(punto),
                               travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", languageCode: "es-CL", units: "METRIC" }),
      });
      const d = await r.json().catch(() => ({}));
      const rt = d?.routes?.[0];
      if (!r.ok || !rt?.polyline?.encodedPolyline) return json({ error: `Google ${r.status}: ${d?.error?.message || "sin ruta"}` }, 502);
      return json({ polyline: rt.polyline.encodedPolyline, m: Number(rt.distanceMeters) || 0,
                    seg: Number(String(rt.duration || "0s").replace("s", "")) || 0 });
    }
    if (camino === "/correccion" && req.method === "POST") {
      if (!EDITAN.includes(String(u.perfil || ""))) return json({ error: "Solo administracion o jefe de local pueden corregir el camino" }, 403);
      const b = await req.json().catch(() => ({}));
      const [p] = await SQL`SELECT direccion_id, fecha FROM reparto_paradas WHERE id = ${Number(b.parada_id) || 0}`;
      if (!p?.direccion_id) return json({ error: "parada sin direccion" }, 404);
      const quitar = b.quitar === true;
      const llegada = !quitar && valido(b.llegada) ? { lat: Number(b.llegada.lat), lng: Number(b.llegada.lng) } : null;
      const via = quitar ? [] : (Array.isArray(b.via) ? b.via : []).filter(valido).slice(0, 10)
        .map((v: any) => ({ lat: Number(v.lat), lng: Number(v.lng) }));
      const quien = `${u.nombre || "usuario " + (u.id ?? "?")} (${u.perfil || "?"})`;
      const [g] = await SQL`UPDATE direcciones_clientes
                               SET nav_llegada = ${llegada ? JSON.stringify(llegada) : null}::text::jsonb,
                                   nav_via = ${via.length ? JSON.stringify(via) : null}::text::jsonb,
                                   nav_corregido_por = ${quitar ? null : quien}, nav_corregido_en = ${quitar ? null : new Date()}
                             WHERE id = ${p.direccion_id}
                         RETURNING id, nav_llegada, nav_via, nav_corregido_por`;
      // "Lo que falta" de hoy se recalcula con la correccion (el rastro reconstruido no se toca).
      await SQL`DELETE FROM ruta_calles_cache WHERE clave LIKE ${hoy() + ":%"}`;
      await SQL`INSERT INTO bitacora (tipo, area, titulo, detalle, prioridad, chat)
                VALUES ('HECHO', 'reparto', ${quitar ? "Camino: correccion quitada" : "Camino corregido a mano"},
                        ${`Direccion ${p.direccion_id} (parada ${b.parada_id}) por ${quien}. llegada=${JSON.stringify(llegada)} via=${JSON.stringify(via)}`},
                        'baja', 'app: Ruta en vivo')`.catch(() => {});
      return json({ ok: true, ...g });
    }

    const f = url.searchParams.get("fecha") || hoy();

    const [conductor] = await SQL`SELECT lat, lng, ROUND(EXTRACT(EPOCH FROM (NOW() - actualizado)) / 60)::int AS min_sin
                                    FROM reparto_tracking WHERE fecha = ${f}::date ORDER BY actualizado DESC LIMIT 1`;
    const vivo = !!conductor && Number(conductor.min_sin) < SIN_SENAL_MIN && f === hoy();
    const [base] = await SQL`SELECT lat, lng FROM reparto_config WHERE id = 1`;
    const baseP = base ? { lat: Number(base.lat), lng: Number(base.lng) } : null;

    const rastro = (await SQL`SELECT id, lat, lng, momento FROM reparto_recorrido WHERE fecha = ${f}::date ORDER BY momento`)
      .map((r: any) => ({ id: Number(r.id), lat: Number(r.lat), lng: Number(r.lng), t: new Date(r.momento) }));

    const paradas = await SQL`
      SELECT p.id, p.estado, p.lat, p.lng, p.ruta_id, r.nombre, r.hora_inicio, r.hora_fin, d.nav_llegada, d.nav_via
        FROM reparto_paradas p LEFT JOIN rutas r ON r.id = p.ruta_id
        LEFT JOIN direcciones_clientes d ON d.id = p.direccion_id
       WHERE p.fecha = ${f}::date
       ORDER BY r.hora_inicio NULLS LAST, COALESCE(NULLIF(p.secuencia, 0), 999), p.id`;

    const tramos: any[] = [];
    for (const p of paradas) {
      const k = String(p.ruta_id ?? "sin");
      let t = tramos.find((x) => x.clave === k);
      if (!t) {
        t = { clave: k, ruta_id: p.ruta_id, nombre: p.nombre || "Sin ruta",
              inicio: p.hora_inicio ? String(p.hora_inicio).slice(0, 5) : null,
              fin: p.hora_fin ? String(p.hora_fin).slice(0, 5) : null, _p: [] as any[] };
        tramos.push(t);
      }
      t._p.push(p);
    }

    let nuevos = 0;
    for (const t of tramos) {
      // -- el rastro del horario de este tramo, partido en pedazos --
      const desde = t.inicio ? aMin(t.inicio) - 60 : 0, hasta = t.fin ? aMin(t.fin) + 150 : 24 * 60;
      const pts = rastro.filter((r: any) => { const m = aMin(horaCL(r.t)); return m >= desde && m <= hasta; });
      const pedazos: any[] = [];
      let actual: any[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (a && ((b.t.getTime() - a.t.getTime()) / 1000 > HUECO_SEG || metros(a, b) > HUECO_M)) {
          if (actual.length > 1) pedazos.push({ tipo: "gps", puntos: actual.map((x) => [x.lat, x.lng]) });
          actual = [];
          const dist = metros(a, b);
          const hueco: any = { tipo: "hueco", desde: horaCL(a.t), hasta: horaCL(b.t), m: Math.round(dist),
                               min: Math.round((b.t.getTime() - a.t.getTime()) / 60000) };
          // Si casi no se movio (quedo detenido sin senal) no hay camino que reconstruir.
          if (dist > 60) {
            const ck = `hueco:${f}:${a.id}:${b.id}`;
            const [ya] = await SQL`SELECT 1 FROM ruta_calles_cache WHERE clave = ${ck}`;
            if (ya || nuevos < MAX_HUECOS_NUEVOS) {
              const r = await porCalles(ck, a, b, [], false, null);
              if (r.nuevo) nuevos++;
              hueco.polyline = r.polyline; hueco.error = r.error;
            } else hueco.error = "pendiente";
          }
          pedazos.push(hueco);
        }
        actual.push(b);
      }
      if (actual.length > 1) pedazos.push({ tipo: "gps", puntos: actual.map((x) => [x.lat, x.lng]) });
      t.rastro = pedazos;

      // -- lo que falta, por calles --
      const faltan = t._p.filter((p: any) => (p.estado === "PENDIENTE" || p.estado === "EN_CAMINO") && p.lat != null)
        .map((p: any) => ({ id: p.id,
          lat: Number(valido(p.nav_llegada) ? p.nav_llegada.lat : p.lat), lng: Number(valido(p.nav_llegada) ? p.nav_llegada.lng : p.lng),
          via: (Array.isArray(p.nav_via) ? p.nav_via : []).filter(valido) }));
      if (f === hoy() && faltan.length && baseP) {
        const origen = vivo ? { lat: Number(conductor.lat), lng: Number(conductor.lng) } : baseP;
        // MISMA clave que ladys-pantalla-ruta: comparten el calculo.
        const ck = `${f}:${t.clave}:${faltan.map((p: any) => p.id).join(",")}:${vivo ? "vivo" : "local"}`;
        // Cada parada entra con sus puntos de paso corregidos (via) antes de ella.
        const inter = faltan.flatMap((p: any) => [...p.via.map((v: any) => ({ lat: v.lat, lng: v.lng, via: true })), { lat: p.lat, lng: p.lng }]);
        const r = await porCalles(ck, origen, baseP, inter, true, vivo ? REHACER_EN_MOVIMIENTO_MIN : 60 * 24);
        t.falta = { polyline: r.polyline, legs: r.legs, error: r.error, desde: vivo ? "camioneta" : "local" };
      } else t.falta = null;
      delete t._p;
    }
    return json({ fecha: f, vivo, tramos });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
