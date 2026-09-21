// NAVEGACIÓN DEL CONDUCTOR DENTRO DE LA APP (21-sep-2026).
//
// Por qué existe: al tocar "Ir", el conductor salía a Google Maps y el
// navegador dejaba de reportar su posición (una web no tiene GPS en segundo
// plano). El rastro del día quedaba en 37 puntos. Con la navegación dentro de
// la app, la pantalla de la app sigue delante y el GPS no se corta.
//
// La navegación de Google Maps no se puede incrustar en una web (solo existe
// para apps nativas, Navigation SDK). Aquí se pide a Routes API el recorrido
// por calles CON las maniobras (gire a la derecha, rotonda, etc.) y la app se
// encarga de seguir la camioneta y anunciarlas con voz.
//
// POST /ruta  { origen:{lat,lng}, destino:{lat,lng}, parada_id? }
//   → { polyline, m, seg, pasos:[{ maniobra, texto, m, seg, polyline, fin:{lat,lng} }] }
//
// Entra con el mismo token de sesión que el resto de la app (JWT propio).
// La clave de Google es la de servidor (configuracion.google_maps_api_key) y
// nunca llega al navegador. Cada pedido queda contado en navegacion_uso para
// ver cuánto se usa (Routes API se cobra por pedido).
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

const punto = (lat: number, lng: number) => ({ location: { latLng: { latitude: lat, longitude: lng } } });
const seg = (d: any) => Number(String(d || "0s").replace("s", "")) || 0;
const valido = (p: any) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-navegacion/, "").replace(/\/$/, "") || "/";

  if (req.method === "GET" && ruta === "/salud") return json({ ok: true });

  let usuario: number | null = null;
  try {
    const h = req.headers.get("authorization") || "";
    const { payload } = await jose.jwtVerify(h.startsWith("Bearer ") ? h.slice(7) : h, SECRET);
    usuario = Number((payload as any).id ?? (payload as any).usuario_id ?? (payload as any).sub) || null;
  } catch { return json({ error: "Token requerido" }, 401); }

  try {
    if (req.method === "POST" && ruta === "/ruta") {
      const b = await req.json().catch(() => ({}));
      if (!valido(b.origen) || !valido(b.destino)) return json({ error: "origen y destino requeridos" }, 400);

      const [c] = await SQL`SELECT valor FROM configuracion WHERE clave = 'google_maps_api_key'`;
      const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "content-type": "application/json", "X-Goog-Api-Key": String(c?.valor ?? ""),
          "X-Goog-FieldMask": [
            "routes.polyline.encodedPolyline", "routes.distanceMeters", "routes.duration",
            "routes.legs.steps.distanceMeters", "routes.legs.steps.staticDuration",
            "routes.legs.steps.polyline.encodedPolyline", "routes.legs.steps.endLocation",
            "routes.legs.steps.navigationInstruction",
          ].join(","),
        },
        body: JSON.stringify({
          origin: { ...punto(Number(b.origen.lat), Number(b.origen.lng)),
                    ...(Number.isFinite(Number(b.rumbo)) ? { heading: Math.round(Number(b.rumbo)) % 360 } : {}) },
          destination: punto(Number(b.destino.lat), Number(b.destino.lng)),
          travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", languageCode: "es-CL", units: "METRIC",
        }),
      });
      const d = await r.json().catch(() => ({}));
      const rt = d?.routes?.[0];
      const ok = r.ok && !!rt?.polyline?.encodedPolyline;
      SQL`INSERT INTO navegacion_uso (usuario_id, parada_id, motivo, ok, error)
          VALUES (${usuario}, ${Number(b.parada_id) || null}, ${String(b.motivo || "inicio").slice(0, 20)},
                  ${ok}, ${ok ? null : `Google ${r.status}: ${String(d?.error?.message || "sin ruta").slice(0, 200)}`})`
        .catch(() => {});
      if (!ok) return json({ error: `Google no entregó ruta (${r.status})`, detalle: d?.error?.message || null }, 502);

      const pasos = (rt.legs || []).flatMap((l: any) => l.steps || []).map((s: any) => ({
        maniobra: s.navigationInstruction?.maneuver || "STRAIGHT",
        texto: s.navigationInstruction?.instructions || "",
        m: Number(s.distanceMeters) || 0,
        seg: seg(s.staticDuration),
        polyline: s.polyline?.encodedPolyline || "",
        fin: { lat: s.endLocation?.latLng?.latitude, lng: s.endLocation?.latLng?.longitude },
      }));
      return json({ polyline: rt.polyline.encodedPolyline, m: Number(rt.distanceMeters) || 0, seg: seg(rt.duration), pasos });
    }
    return json({ error: "ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
