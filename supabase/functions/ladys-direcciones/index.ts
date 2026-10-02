// Ladys — direcciones: mapa, pin ajustable y geocodificación.
//
// GEOCODIFICACIÓN CON GOOGLE (12-sep-2026): antes esto usaba Nominatim
// (OpenStreetMap) y en Concón fallaba seguido — muchas calles del sector no
// están en OSM o están mal trazadas, y cada dirección que no encontraba quedaba
// sin pin y fuera del recorrido. Ahora se consulta Google Geocoding con la clave
// LADYS SERVIDOR (configuracion.google_maps_api_key), que sí tiene bien cubierta
// la zona, y Nominatim queda solo de respaldo si Google no responde.
//
// Además: POST /geocodificar-ruta?fecha= ubica SOLO las direcciones de las
// paradas de esa fecha. Es lo que dispara el botón "Ubicar las que faltan" del
// reparto, para no depender de que alguien lo pida a mano.
//
// v6 (30-sep-2026): POST /ubicar-parada { parada_id } — lo llama el botón "Ir"
// del conductor cuando la parada no tiene coordenadas. Ubica esa dirección en
// el momento y la guarda, para que la navegación siga DENTRO de la app (con la
// ubicación en vivo para el cliente) en vez de saltar a Google Maps.
//
// v7 (02-oct-2026, bitácora #247): DELETE /direccion/:id — el tachito de la app.
// Toda la lógica vive en ladys.eliminar_direccion(): si la usa una orden en curso
// no se borra (dice cuál OT cambiar); si solo la usan órdenes cerradas, deja el
// texto en su historial, suelta las referencias y la borra.
import postgres from "npm:postgres@3.4.4";
import * as jose from "npm:jose@5.9.6";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
  types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
});
const SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET") || "ladys_jwt_secret_super_seguro_2024");
const KEY = Deno.env.get("WEBHOOK_KEY") || "ladys_webhook_2026";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, x-api-key", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });
const N = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const UA = { "User-Agent": "LadysLavanderia/1.0 (contacto@ladyslavanderia.cl)" };
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DENTRO = (lat: number, lng: number) => lat > -33.35 && lat < -32.55 && lng > -71.75 && lng < -71.15;
const COMUNAS = ["Concón", "Viña del Mar", "Valparaíso", "Quintero"];

// limpia prefijos que confunden al buscador
const limpiarCalle = (c: string) =>
  String(c || "").replace(/^(calle|pasaje|psje\.?|avenida|av\.?|camino)\s+/i, "").replace(/\s*&.*$/, "").trim();

async function nominatim(params: string) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}&format=json&addressdetails=1&limit=3&countrycodes=cl&accept-language=es`, { headers: UA });
  if (!r.ok) throw new Error("Nominatim " + r.status);
  return await r.json();
}

async function claveGoogle() {
  const [r] = await SQL`SELECT valor FROM configuracion WHERE clave = 'google_maps_api_key'`;
  return String(r?.valor || "");
}

// Arma el texto de búsqueda. Reñaca y los sectores no son comunas: se mandan
// como parte de la dirección para que Google los use de pista, no de filtro.
function textoDe(d: any) {
  const calle = String(d.calle || "").trim();
  const numero = String(d.numero || "").trim();
  const sector = String(d.sector || "").trim();
  const ciudad = String(d.ciudad || "").trim() || "Concón";
  const comuna = /reñaca/i.test(ciudad) ? "Viña del Mar" : ciudad;
  return [[calle, numero].filter(Boolean).join(" "), sector, comuna, "Chile"]
    .filter(Boolean).join(", ");
}

// Una dirección contra Google. Devuelve null si no la ubica dentro de la zona.
async function geocodificarUna(d: any, key: string) {
  const intentos = [textoDe(d)];
  if (d.numero) intentos.push(textoDe({ ...d, numero: null }));           // sin número
  if (d.calle) intentos.push(textoDe({ ...d, calle: limpiarCalle(d.calle) }));
  for (const texto of intentos) {
    try {
      const u = `https://maps.googleapis.com/maps/api/geocode/json?region=cl&language=es` +
                `&address=${encodeURIComponent(texto)}&key=${key}`;
      const r = await fetch(u);
      if (!r.ok) continue;
      const j = await r.json();
      if (j.status !== "OK" || !j.results?.length) continue;
      const g = j.results[0];
      const lat = Number(g.geometry?.location?.lat), lng = Number(g.geometry?.location?.lng);
      if (!DENTRO(lat, lng)) continue;
      const tipo = String(g.geometry?.location_type || "");
      return { lat, lng,
        precision: tipo === "ROOFTOP" ? "EXACTA" : tipo === "RANGE_INTERPOLATED" ? "EXACTA" : "CALLE",
        etiqueta: String(g.formatted_address || "").slice(0, 300) };
    } catch { /* siguiente intento */ }
  }
  return null;
}

// Respaldo: si Google no está disponible (sin clave o caída), se usa Nominatim.
async function geocodificarConOSM(d: any) {
  const calle = limpiarCalle(d.calle);
  if (!calle) return null;
  const propia = d.ciudad || d.sector || "Concón";
  const base = /reñaca/i.test(propia) ? "Viña del Mar" : propia;
  for (const comuna of [base, ...COMUNAS.filter((c) => c !== base)]) {
    const variantes = [
      `street=${encodeURIComponent((d.numero ? d.numero + " " : "") + calle)}&city=${encodeURIComponent(comuna)}`,
      `street=${encodeURIComponent(calle)}&city=${encodeURIComponent(comuna)}`,
    ];
    for (const v of variantes) {
      try {
        const res = await nominatim(v);
        await dormir(1100);
        for (const x of res) {
          const lat = Number(x.lat), lng = Number(x.lon);
          if (!DENTRO(lat, lng)) continue;
          return { lat, lng, precision: x.address?.house_number ? "EXACTA" : "CALLE",
                   etiqueta: String(x.display_name).slice(0, 300) };
        }
      } catch { /* siguiente variante */ }
    }
  }
  return null;
}

// Ubica una lista de direcciones y las guarda. Devuelve el detalle de cada una,
// para poder decirle al usuario cuáles no se pudieron y por qué.
async function ubicar(pendientes: any[], key: string) {
  let exactas = 0, porCalle = 0;
  const fallidas: any[] = [];
  for (const d of pendientes) {
    await SQL`UPDATE direcciones_clientes SET geo_intentos = COALESCE(geo_intentos,0) + 1 WHERE id=${d.id}`;
    const r = (key ? await geocodificarUna(d, key) : null) || await geocodificarConOSM(d);
    if (!r) {
      fallidas.push({ id: d.id, direccion: textoDe(d), cliente: d.cliente || null });
      continue;
    }
    await SQL`UPDATE direcciones_clientes
                 SET lat=${r.lat}, lng=${r.lng}, geo_precision=${r.precision}, geo_etiqueta=${r.etiqueta}
               WHERE id=${d.id}`;
    r.precision === "EXACTA" ? exactas++ : porCalle++;
  }
  return { exactas, por_calle: porCalle, fallidas };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const seg = url.pathname.split("/").filter((x) => x && x !== "functions" && x !== "v1" && x !== "ladys-direcciones");
  const m = req.method;

  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
  // v7: se guarda quién es, para dejarlo en el historial al borrar.
  let uid: number | null = null;
  if ((req.headers.get("x-api-key") || "") !== KEY) {
    try { const { payload } = await jose.jwtVerify(tok, SECRET); uid = Number((payload as any)?.id) || null; }
    catch { return json({ error: "Token requerido" }, 401); }
  }
  const body: any = ["POST", "PUT"].includes(m) ? await req.json().catch(() => ({})) : {};

  try {
    // Una parada, desde el botón "Ir" del conductor. Devuelve sus coordenadas;
    // si no tiene, ubica su dirección ahora y la guarda (dirección + paradas
    // de hoy en adelante que la usan). 422 si de verdad no se encuentra.
    if (m === "POST" && seg[0] === "ubicar-parada") {
      const pid = Number(body.parada_id);
      if (!pid) return json({ error: "Falta la parada" }, 400);
      const [p] = await SQL`SELECT p.id, p.lat, p.lng, p.direccion_id AS did,
          d.calle, d.numero, d.ciudad, d.sector, d.lat AS d_lat, d.lng AS d_lng
        FROM reparto_paradas p LEFT JOIN direcciones_clientes d ON d.id = p.direccion_id
        WHERE p.id = ${pid}`;
      if (!p) return json({ error: "Parada no encontrada" }, 404);
      if (p.lat != null && p.lng != null) return json({ ok: true, lat: Number(p.lat), lng: Number(p.lng), origen: "parada" });
      let lat = N(p.d_lat), lng = N(p.d_lng), origen = "direccion";
      if ((lat === null || lng === null) && p.did && p.calle) {
        await ubicar([{ id: p.did, calle: p.calle, numero: p.numero, ciudad: p.ciudad, sector: p.sector }], await claveGoogle());
        const [d] = await SQL`SELECT lat, lng FROM direcciones_clientes WHERE id = ${p.did}`;
        lat = N(d?.lat); lng = N(d?.lng); origen = "geocodificada";
      }
      if (lat === null || lng === null)
        return json({ ok: false, error: "No se pudo ubicar la dirección en el mapa" }, 422);
      if (p.did) await SQL`UPDATE reparto_paradas SET lat=${lat}, lng=${lng}
                            WHERE direccion_id=${p.did} AND fecha >= CURRENT_DATE AND lat IS NULL`;
      await SQL`UPDATE reparto_paradas SET lat=${lat}, lng=${lng} WHERE id=${pid}`;
      return json({ ok: true, lat, lng, origen });
    }

    // Las direcciones de las paradas de UNA fecha. Es el botón del reparto.
    // Reintenta aunque ya se haya intentado antes: si el conductor sale en una
    // hora, importa ubicarla ahora, no respetar el contador de intentos.
    if (m === "POST" && seg[0] === "geocodificar-ruta") {
      const fecha = String(body.fecha || url.searchParams.get("fecha") || "").slice(0, 10);
      if (!fecha) return json({ error: "Falta la fecha" }, 400);
      const pend = await SQL`
        SELECT DISTINCT d.id, d.calle, d.numero, d.ciudad, d.sector,
               TRIM(CONCAT_WS(' ', c.nombre, c.apellido)) AS cliente
        FROM reparto_paradas p
        JOIN direcciones_clientes d ON d.id = p.direccion_id
        LEFT JOIN ordenes o ON o.id = p.orden_id
        LEFT JOIN clientes c ON c.id = o.cliente_id
        WHERE p.fecha = ${fecha}::date AND d.lat IS NULL AND d.calle IS NOT NULL`;
      if (!pend.length) return json({ ok: true, pendientes: 0, exactas: 0, por_calle: 0, fallidas: [] });
      const r = await ubicar(pend, await claveGoogle());
      // Las paradas guardan su propia copia de las coordenadas: se refrescan.
      await SQL`UPDATE reparto_paradas p SET lat = d.lat, lng = d.lng
                  FROM direcciones_clientes d
                 WHERE p.direccion_id = d.id AND p.fecha = ${fecha}::date AND p.lat IS NULL`;
      return json({ ok: true, pendientes: pend.length, ...r });
    }

    if (m === "POST" && seg[0] === "geocodificar") {
      const limite = Math.min(Number(body.limite || 12), 25);
      const pend = await SQL`SELECT id, calle, numero, ciudad, sector FROM direcciones_clientes
        WHERE lat IS NULL AND COALESCE(geo_intentos,0) < 3 AND calle IS NOT NULL AND length(calle) > 3
        ORDER BY geo_intentos, id LIMIT ${limite}`;
      const r = await ubicar(pend, await claveGoogle());
      const [t] = await SQL`SELECT
          COUNT(*) FILTER (WHERE lat IS NOT NULL)::int AS ubicadas,
          COUNT(*) FILTER (WHERE lat IS NULL AND COALESCE(geo_intentos,0) < 3 AND calle IS NOT NULL)::int AS pendientes,
          COUNT(*)::int AS total FROM direcciones_clientes`;
      return json({ ok: true, procesadas: pend.length, exactas: r.exactas,
                    por_calle: r.por_calle, fallidas: r.fallidas.length, ...t });
    }

    if (m === "GET" && seg[0] === "estado-geo") {
      const [t] = await SQL`SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE lat IS NOT NULL)::int AS ubicadas,
          COUNT(*) FILTER (WHERE upper(COALESCE(geo_precision,''))='EXACTA')::int AS exactas,
          COUNT(*) FILTER (WHERE upper(COALESCE(geo_precision,''))='CALLE')::int AS solo_calle,
          COUNT(*) FILTER (WHERE lat IS NULL AND COALESCE(geo_intentos,0) >= 3)::int AS sin_resultado,
          COUNT(*) FILTER (WHERE lat IS NULL AND COALESCE(geo_intentos,0) < 3 AND calle IS NOT NULL)::int AS pendientes
        FROM direcciones_clientes`;
      return json(t);
    }

    if (m === "GET" && seg[0] === "coordenadas") {
      const fecha = url.searchParams.get("fecha");
      if (!fecha) return json({ error: "Falta la fecha" }, 400);
      const rows = await SQL`SELECT o.id, dr.lat AS lat_retiro, dr.lng AS lng_retiro,
          de.lat AS lat_entrega, de.lng AS lng_entrega
        FROM ordenes o
        LEFT JOIN direcciones_clientes dr ON dr.id = o.dir_recogida_id
        LEFT JOIN direcciones_clientes de ON de.id = o.dir_entrega_id
        WHERE o.local_id=1 AND o.estado<>'ANULADA'
          AND (o.fecha_recogida=${fecha} OR o.fecha_entrega=${fecha})
          AND (dr.lat IS NOT NULL OR de.lat IS NOT NULL)`;
      const mapa: Record<string, unknown> = {};
      rows.forEach((r: any) => { mapa[String(r.id)] = r; });
      return json(mapa);
    }

    // Buscador de direcciones del formulario: Google primero, OSM de respaldo.
    if (m === "POST" && seg[0] === "buscar") {
      const texto = String(body.texto || "").trim();
      if (texto.length < 4) return json({ error: "Escribe una dirección más completa" }, 400);
      const key = await claveGoogle();
      if (key) {
        try {
          const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?region=cl&language=es` +
            `&address=${encodeURIComponent(texto + ", Chile")}&key=${key}`);
          const j = await r.json();
          if (j.status === "OK" && j.results?.length) {
            const comp = (g: any, t: string) =>
              (g.address_components || []).find((c: any) => c.types.includes(t))?.long_name || "";
            return json(j.results.slice(0, 5).map((g: any) => ({
              etiqueta: g.formatted_address,
              lat: Number(g.geometry.location.lat), lng: Number(g.geometry.location.lng),
              calle: comp(g, "route"), numero: comp(g, "street_number"),
              comuna: comp(g, "locality") || comp(g, "administrative_area_level_3") ||
                      comp(g, "sublocality"),
              tipo: g.geometry.location_type,
            })));
          }
        } catch { /* cae a Nominatim */ }
      }
      let d = await nominatim(`q=${encodeURIComponent(texto + ", Chile")}`);
      if (!d.length) {
        const partes = texto.split(",").map((x) => x.trim()).filter(Boolean);
        const comuna = partes.length > 1 ? partes[partes.length - 1] : "Concón";
        d = await nominatim(`street=${encodeURIComponent(limpiarCalle(partes[0]))}&city=${encodeURIComponent(comuna)}`);
      }
      return json(d.map((x: any) => ({
        etiqueta: x.display_name, lat: Number(x.lat), lng: Number(x.lon),
        calle: x.address?.road || x.address?.pedestrian || "",
        numero: x.address?.house_number || "",
        comuna: x.address?.city || x.address?.town || x.address?.village || x.address?.suburb || "",
        tipo: x.type,
      })));
    }

    if (m === "POST" && seg[0] === "desde-punto") {
      const lat = N(body.lat), lng = N(body.lng);
      if (lat === null || lng === null) return json({ error: "Faltan coordenadas" }, 400);
      const key = await claveGoogle();
      if (key) {
        try {
          const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?language=es` +
            `&latlng=${lat},${lng}&key=${key}`);
          const j = await r.json();
          if (j.status === "OK" && j.results?.length) {
            const g = j.results[0];
            const comp = (t: string) =>
              (g.address_components || []).find((c: any) => c.types.includes(t))?.long_name || "";
            return json({ etiqueta: g.formatted_address, calle: comp("route"),
              numero: comp("street_number"),
              comuna: comp("locality") || comp("administrative_area_level_3") || comp("sublocality") });
          }
        } catch { /* cae a Nominatim */ }
      }
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`, { headers: UA });
      const x = await r.json();
      return json({ etiqueta: x.display_name || "", calle: x.address?.road || "",
        numero: x.address?.house_number || "",
        comuna: x.address?.city || x.address?.town || x.address?.village || x.address?.suburb || "" });
    }

    // Al crear una dirección sin pin se geocodifica al vuelo: así no nace sin
    // ubicación y no hay que rescatarla después desde el reparto.
    if (m === "POST" && seg[1] === "direcciones") {
      const cid = Number(seg[0]);
      if (!body.calle) return json({ error: "La calle es obligatoria" }, 400);
      if (body.es_principal) await SQL`UPDATE direcciones_clientes SET es_principal=FALSE WHERE cliente_id=${cid}`;
      let lat = N(body.lat), lng = N(body.lng);
      let precision = body.lat ? "MANUAL" : null;
      let etiqueta: string | null = null;
      if (lat === null || lng === null) {
        const key = await claveGoogle();
        const g = (key ? await geocodificarUna(body, key) : null) || await geocodificarConOSM(body);
        if (g) { lat = g.lat; lng = g.lng; precision = g.precision; etiqueta = g.etiqueta; }
      }
      const [d] = await SQL`INSERT INTO direcciones_clientes
          (cliente_id, ciudad, sector, calle, numero, otro, lat, lng, es_principal, geo_precision, geo_etiqueta)
        VALUES (${cid}, ${body.ciudad || "Concón"}, ${body.sector || null}, ${String(body.calle).slice(0,200)},
          ${body.numero || null}, ${body.otro || null}, ${lat}, ${lng}, ${!!body.es_principal},
          ${precision}, ${etiqueta}) RETURNING *`;
      return json(d, 201);
    }

    // v7: el tachito. 409 si la usa una orden en curso (el mensaje dice cuál).
    if (m === "DELETE" && seg[0] === "direccion" && seg[1]) {
      const [r] = await SQL`SELECT ladys.eliminar_direccion(${Number(seg[1])}::int, ${uid}::int) AS r`;
      const res: any = r?.r || { ok: false, error: "No se pudo borrar" };
      return json(res, res.ok ? 200 : res.en_uso ? 409 : 404);
    }

    if (m === "PUT" && seg[0] === "direccion" && seg[1]) {
      const id = Number(seg[1]);
      const campos = ["ciudad", "sector", "calle", "numero", "otro", "lat", "lng", "es_principal"];
      const upd: Record<string, unknown> = {};
      for (const k of campos) if (k in body) upd[k] = (k === "lat" || k === "lng") ? N(body[k]) : (body[k] === "" ? null : body[k]);
      if (!Object.keys(upd).length) return json({ error: "Nada que actualizar" }, 400);
      if ("lat" in upd && upd.lat !== null) upd.geo_precision = "MANUAL";
      if (upd.es_principal) {
        const [d0] = await SQL`SELECT cliente_id FROM direcciones_clientes WHERE id=${id}`;
        if (d0) await SQL`UPDATE direcciones_clientes SET es_principal=FALSE WHERE cliente_id=${d0.cliente_id}`;
      }
      const [d] = await SQL`UPDATE direcciones_clientes SET ${SQL(upd)} WHERE id=${id} RETURNING *`;
      // Si se movió el pin, las paradas futuras que la usan se actualizan solas.
      if (d && "lat" in upd)
        await SQL`UPDATE reparto_paradas SET lat=${d.lat}, lng=${d.lng}
                   WHERE direccion_id=${id} AND fecha >= CURRENT_DATE`;
      return d ? json(d) : json({ error: "Dirección no encontrada" }, 404);
    }

    if (m === "GET" && seg[1] === "direcciones")
      return json(await SQL`SELECT * FROM direcciones_clientes WHERE cliente_id=${Number(seg[0])} ORDER BY es_principal DESC, id`);

    return json({ error: `Ruta no encontrada: ${m} /${seg.join("/")}` }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
