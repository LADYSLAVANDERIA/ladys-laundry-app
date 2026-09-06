// Ladys — importa el detalle de las OT históricas desde el reporte
// "Detalle de órdenes por fecha" de EasyLaundry.
//
// Se le pasan las filas tal como salen del reporte y las convierte en items.
// No toca el monto de la orden por defecto: solo lo recalcula si se pide,
// porque el histórico ya tiene montos cargados y no queremos pisarlos sin querer.
import postgres from "npm:postgres@3.4.4";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
});
const CLAVE = Deno.env.get("WEBHOOK_KEY") || "ladys_webhook_2026";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

// EasyLaundry escribe a la chilena: "5,15" son kilos y "14.935" son pesos.
// El punto es separador de miles y la coma es decimal. Al revés que en JS.
const num = (v: any) => {
  const t = String(v ?? "").trim().replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(t);
  return isFinite(n) ? n : 0;
};

// Columnas del reporte: OT, Nombre, Recogida el, Cantidad, Servicio,
// Monto servicio, Etiquetas, Entrega programada, Entregada el, Generada por
const COL = { ot: 0, cantidad: 3, servicio: 4, monto: 5, etiqueta: 6 };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-detalle/, "").replace(/\/$/, "") || "/";

  const clave = req.headers.get("x-api-key") || url.searchParams.get("k") || "";
  if (clave !== CLAVE) return json({ error: "no autorizado" }, 401);

  try {
    // GET /estado → cuántas OT siguen sin detalle
    if (req.method === "GET" && ruta === "/estado") {
      const [r] = await SQL`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM orden_items i WHERE i.orden_id = o.id))::int AS con_detalle,
        COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM orden_items i WHERE i.orden_id = o.id))::int AS sin_detalle
        FROM ordenes o WHERE o.ot_easylaundry IS NOT NULL`;
      return json(r);
    }

    // POST /cargar { filas: [[...]] | gh_path + gh_token, simular?, recalcular? }
    if (req.method === "POST" && ruta === "/cargar") {
      const b = await req.json();

      // El archivo del extractor vive en el repo privado. Si se pide por ruta,
      // lo trae la función: así no hay que mandar megas de JSON por el camino.
      let filas: any[][] = Array.isArray(b.filas) ? b.filas : [];
      if (!filas.length && b.gh_path && b.gh_token) {
        const r = await fetch(
          `https://api.github.com/repos/LADYSLAVANDERIA/ladys-reporte/contents/${b.gh_path}`,
          { headers: { Authorization: `token ${b.gh_token}`, Accept: "application/vnd.github.raw" } });
        if (!r.ok) return json({ error: `GitHub respondió ${r.status}` }, 400);
        const d = await r.json();
        filas = Array.isArray(d?.filas) ? d.filas : [];
        if (!filas.length) return json({ error: "El archivo no trae filas", head: d?.head, texto: d?.texto }, 400);
      }
      if (!filas.length) return json({ error: "No llegaron filas" }, 400);
      const simular = b.simular !== false;

      // Se agrupa por OT: una OT trae varias líneas de servicio.
      const porOt = new Map<string, any[]>();
      for (const f of filas) {
        const ot = String(f?.[COL.ot] ?? "").trim();
        const servicio = String(f?.[COL.servicio] ?? "").trim();
        if (!ot || !servicio) continue;
        if (!porOt.has(ot)) porOt.set(ot, []);
        porOt.get(ot)!.push({
          nombre: servicio,
          cantidad: num(f[COL.cantidad]) || 1,
          subtotal: Math.round(num(f[COL.monto])),
          etiqueta: String(f?.[COL.etiqueta] ?? "").trim().replace(/,$/, "") || null,
        });
      }

      const res = { ots_en_archivo: porOt.size, sin_pareja: [] as string[],
                    ya_tenian: 0, cargadas: 0, items: 0, simulado: simular };

      for (const [ot, items] of porOt) {
        const [o] = await SQL`SELECT id FROM ordenes WHERE ot_easylaundry = ${ot} LIMIT 1`;
        if (!o) { res.sin_pareja.push(ot); continue; }
        const [ya] = await SQL`SELECT 1 AS x FROM orden_items WHERE orden_id = ${o.id} LIMIT 1`;
        if (ya) { res.ya_tenian++; continue; }
        res.cargadas++; res.items += items.length;
        if (simular) continue;

        await SQL.begin(async (t: any) => {
          for (const i of items) {
            const unit = i.cantidad ? Math.round(i.subtotal / i.cantidad) : i.subtotal;
            await t`INSERT INTO orden_items (orden_id, nombre, cantidad, precio_unit, subtotal, etiqueta)
                    VALUES (${o.id}, ${i.nombre}, ${i.cantidad}, ${unit}, ${i.subtotal}, ${i.etiqueta})`;
          }
          // Los kilos salen de las líneas que se cobran por kilo.
          const kilos = items
            .filter((i: any) => /KILO/i.test(i.nombre))
            .reduce((s: number, i: any) => s + i.cantidad, 0);
          if (kilos > 0) await t`UPDATE ordenes SET kilos = ${kilos} WHERE id = ${o.id} AND COALESCE(kilos,0) = 0`;
          if (b.recalcular === true) {
            const suma = items.reduce((s: number, i: any) => s + i.subtotal, 0);
            await t`UPDATE ordenes SET subtotal = ${suma} WHERE id = ${o.id}`;
          }
        });
      }
      res.sin_pareja = res.sin_pareja.slice(0, 50);
      return json(res);
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
