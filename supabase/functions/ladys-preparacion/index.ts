// Ladys — PREPARACION y medicion por CARGA (bitacora #115, #117).
//
// La maquina trabaja en cargas, no en pedidos. Un pedido de 3 cobertores son 3
// cargas: la 1 puede estar secando mientras la 2 se lava. Aca Catalina:
//   1. empieza la preparacion de un pedido (revisa manchas, separa),
//   2. define las cargas DEFINITIVAS con su tipo (BLANCO, COLOR, DESMANCHADO, UNIDAD),
//   3. marca cada carga: a lavadora N -> a secadora N -> secado listo.
// La etapa del pedido la deduce la base (trigger trg_etapa_desde_cargas). NUNCA
// pasa sola a EMBOLSADO: embolsar lo hace una persona que revisa que este todo.
//
// UNA MAQUINA, UNA CARGA: si Catalina marca una lavadora que la base cree ocupada,
// se rechaza y se dice con que. Sin esto la medicion de "espera por maquina
// ocupada" no vale nada. Si la ropa ya se saco sin marcar, existe /liberar.
//
// v4 (28-sep, pedido de Lufi): PLANCHADO Y DOBLADO es una etapa propia
// (EN_PLANCHADO). Un pedido SOLO de planchado no lleva cargas de maquina: al
// "prepararlo" entra directo a EN_PLANCHADO. Los mixtos pasan por sus cargas y
// despues a planchado desde la pantalla. El tablero muestra tambien los pedidos
// en planchado y trae `trabajo` (LAVA / PLANCHA / MIXTO) en cada pedido.
//
// v3 (23-sep): POST /deshacer, porque marcar de mas es el error real del dia a
// dia (OT 6573 y OT 6547 en dos dias) y hasta ahora habia que arreglarlo a mano
// en la base. Devuelve la carga UN paso atras, dentro de la hora siguiente a la
// marca, y solo si la maquina a la que vuelve esta libre.
//
// v2 (22-sep): GET /buscar?q= para encontrar la OT por numero o por cliente sin
// bucear la lista, y los pedidos traen telefono, token, saldo y bultos, que es lo
// que necesita la pantalla fusionada para embolsar y avisar sin otra llamada.
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
const TIPOS = ["BLANCO", "COLOR", "DESMANCHADO", "UNIDAD"];
const EN_MAQUINAS = ["PREPARACION", "EN_LAVADO", "EN_SECADO"];

async function auth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
  try { const { payload } = await jose.jwtVerify(tok, SECRET); return payload as any; }
  catch { return null; }
}

async function preparar(id: number, uid: number | null) {
  const [o] = await SQL`SELECT id, etapa, estado, trabajo_de_orden(id) AS trabajo FROM ordenes WHERE id = ${id}`;
  if (!o) throw { s: 404, m: `No existe el pedido ${id}` };
  if (o.estado === "ANULADA") throw { s: 409, m: `El pedido ${id} está anulado` };
  // Solo planchado: no hay nada que separar para maquinas, va directo a planchar
  const destino = o.trabajo === "PLANCHA" ? "EN_PLANCHADO" : "PREPARACION";
  if (o.etapa === destino) return destino;
  if (o.etapa !== "RECEPCIONADO")
    throw { s: 409, m: `El pedido ${id} está en ${o.etapa}: solo se prepara lo que está recepcionado` };
  await SQL`UPDATE ordenes SET etapa = ${destino}, etapa_en = NOW(), estado = 'EN_PROCESO',
              actualizado_en = NOW() WHERE id = ${id}`;
  await SQL`INSERT INTO orden_etapas (orden_id, etapa, usuario_id) VALUES (${id}, ${destino}, ${uid})`;
  return destino;
}

async function tablero() {
  const [maq] = await SQL`SELECT
      (SELECT min_ciclo FROM maquinas WHERE tipo='LAVADORA') AS ciclo_lav,
      (SELECT unidades FROM maquinas WHERE tipo='LAVADORA') AS lavadoras,
      (SELECT unidades FROM maquinas WHERE tipo='SECADORA') AS secadoras`;

  const activas = await SQL`
    SELECT c.*, o.etapa AS orden_etapa,
           COALESCE(NULLIF(cl.razon_social,''), TRIM(cl.nombre||' '||COALESCE(cl.apellido,''))) AS cliente,
           ROUND(EXTRACT(EPOCH FROM NOW() - c.lavado_inicio)/60)::int AS min_lavando,
           ROUND(EXTRACT(EPOCH FROM NOW() - c.secado_inicio)/60)::int AS min_secando,
           ROUND(EXTRACT(EPOCH FROM NOW() - GREATEST(c.lista_en, c.lavado_inicio, c.secado_inicio, c.secado_fin))/60)::int AS min_ultima_marca,
           COALESCE(t.min_secadora, 50) AS min_secado_esperado
      FROM cargas c
      JOIN ordenes o  ON o.id = c.orden_id
      JOIN clientes cl ON cl.id = o.cliente_id
      LEFT JOIN proceso_tiempos t ON t.familia = c.familia
     WHERE NOT c.anulada AND o.etapa = ANY(${EN_MAQUINAS})
     ORDER BY c.orden_id, c.numero`;

  const lavadoras = Array.from({ length: Number(maq.lavadoras) }, (_, i) => {
    const c = activas.find((x: any) => x.lavadora === i + 1 && x.lavado_inicio && !x.lavado_fin);
    return { n: i + 1, carga: c ? { id: c.id, orden_id: c.orden_id, numero: c.numero, tipo: c.tipo,
      cliente: c.cliente, minutos: c.min_lavando, ciclo: Number(maq.ciclo_lav) } : null };
  });
  const secadoras = Array.from({ length: Number(maq.secadoras) }, (_, i) => {
    const c = activas.find((x: any) => x.secadora === i + 1 && x.secado_inicio && !x.secado_fin);
    return { n: i + 1, carga: c ? { id: c.id, orden_id: c.orden_id, numero: c.numero, tipo: c.tipo,
      cliente: c.cliente, minutos: c.min_secando, esperado: Number(c.min_secado_esperado) } : null };
  });

  // Pedidos en preparacion, en maquinas con cargas, o en planchado
  const pedidos = await SQL`
    SELECT o.id, o.etapa, o.estado, o.fecha_entrega, o.cargas_previstas, o.prevision_firme, o.kilos,
           o.entrega_domicilio, o.observaciones, o.bultos, o.saldo_pendiente, o.token_publico,
           cl.telefono AS cliente_telefono,
           (o.fecha_entrega - CURRENT_DATE) AS dias,
           trabajo_de_orden(o.id) AS trabajo,
           COALESCE(NULLIF(cl.razon_social,''), TRIM(cl.nombre||' '||COALESCE(cl.apellido,''))) AS cliente,
           (SELECT string_agg(replace(i.nombre,'SERVICIO ','') || ' x' || ROUND(i.cantidad,1), ' + ')
              FROM orden_items i WHERE i.orden_id = o.id) AS detalle
      FROM ordenes o JOIN clientes cl ON cl.id = o.cliente_id
     WHERE o.estado NOT IN ('ANULADA','ENTREGADA')
       AND (o.etapa IN ('PREPARACION','EN_PLANCHADO')
            OR (o.etapa IN ('EN_LAVADO','EN_SECADO')
                AND EXISTS (SELECT 1 FROM cargas c WHERE c.orden_id = o.id AND NOT c.anulada)))
     ORDER BY o.fecha_entrega NULLS LAST, o.id`;

  const conCargas = pedidos.map((p: any) => ({
    ...p, dias: p.dias === null ? null : Number(p.dias),
    cargas: activas.filter((c: any) => c.orden_id === p.id).map((c: any) => ({
      id: c.id, numero: c.numero, tipo: c.tipo, lavadora: c.lavadora, secadora: c.secadora,
      estado: c.secado_fin ? "SECA" : c.secado_inicio ? "SECANDO"
            : c.lavado_fin ? "MOJADA" : c.lavado_inicio ? "LAVANDO" : "LISTA",
      min_lavando: c.min_lavando, min_secando: c.min_secando,
      min_ultima_marca: c.min_ultima_marca,
    })),
  }));

  // Lo que espera ser preparado: recepcionado, con su prevision
  const porPreparar = await SQL`
    SELECT o.id, o.fecha_entrega, (o.fecha_entrega - CURRENT_DATE) AS dias, o.kilos,
           COALESCE(NULLIF(cl.razon_social,''), TRIM(cl.nombre||' '||COALESCE(cl.apellido,''))) AS cliente,
           p.cargas AS previstas, p.firme,
           trabajo_de_orden(o.id) AS trabajo,
           (SELECT string_agg(replace(i.nombre,'SERVICIO ','') || ' x' || ROUND(i.cantidad,1), ' + ')
              FROM orden_items i WHERE i.orden_id = o.id) AS detalle
      FROM ordenes o
      JOIN clientes cl ON cl.id = o.cliente_id
      CROSS JOIN LATERAL prevision_cargas(o.id) p
     WHERE o.estado NOT IN ('ANULADA','ENTREGADA','PRE_ORDEN') AND o.etapa = 'RECEPCIONADO'
     ORDER BY o.fecha_entrega NULLS FIRST, o.id`;

  return { lavadoras, secadoras, pedidos: conCargas,
           por_preparar: porPreparar.map((x: any) => ({ ...x, dias: x.dias === null ? null : Number(x.dias) })) };
}

// Buscar un pedido por numero de OT o por nombre de cliente, para no tener que
// bucear la lista. Devuelve lo mismo que el tablero mas la etapa, asi la pantalla
// sabe que boton corresponde: preparar, cargas, planchado, embolsar o entregar.
async function buscar(q: string) {
  const num = q.replace(/[^\d]/g, "");
  const texto = `%${q.trim()}%`;
  return await SQL`
    SELECT o.id, o.etapa, o.estado, o.fecha_entrega, o.cargas_previstas, o.prevision_firme,
           o.kilos, o.entrega_domicilio, o.observaciones, o.bultos, o.saldo_pendiente,
           o.token_publico, cl.telefono AS cliente_telefono,
           (o.fecha_entrega - CURRENT_DATE) AS dias,
           COALESCE(NULLIF(cl.razon_social,''), TRIM(cl.nombre||' '||COALESCE(cl.apellido,''))) AS cliente,
           (SELECT string_agg(replace(i.nombre,'SERVICIO ','') || ' x' || ROUND(i.cantidad,1), ' + ')
              FROM orden_items i WHERE i.orden_id = o.id) AS detalle,
           trabajo_de_orden(o.id) AS trabajo,
           (SELECT p.cargas FROM prevision_cargas(o.id) p) AS previstas,
           (SELECT p.firme  FROM prevision_cargas(o.id) p) AS firme,
           COALESCE((SELECT json_agg(json_build_object(
               'id', c.id, 'numero', c.numero, 'tipo', c.tipo,
               'lavadora', c.lavadora, 'secadora', c.secadora,
               'min_lavando', ROUND(EXTRACT(EPOCH FROM NOW() - c.lavado_inicio)/60)::int,
               'min_secando', ROUND(EXTRACT(EPOCH FROM NOW() - c.secado_inicio)/60)::int,
               'min_ultima_marca', ROUND(EXTRACT(EPOCH FROM NOW() - GREATEST(c.lista_en, c.lavado_inicio, c.secado_inicio, c.secado_fin))/60)::int,
               'estado', CASE WHEN c.secado_fin IS NOT NULL THEN 'SECA'
                              WHEN c.secado_inicio IS NOT NULL THEN 'SECANDO'
                              WHEN c.lavado_fin IS NOT NULL THEN 'MOJADA'
                              WHEN c.lavado_inicio IS NOT NULL THEN 'LAVANDO'
                              ELSE 'LISTA' END) ORDER BY c.numero)
             FROM cargas c WHERE c.orden_id = o.id AND NOT c.anulada), '[]'::json) AS cargas
      FROM ordenes o JOIN clientes cl ON cl.id = o.cliente_id
     WHERE o.estado <> 'ANULADA'
       AND (${num ? true : false} AND o.id::text LIKE ${num + "%"}
            OR COALESCE(NULLIF(cl.razon_social,''), TRIM(cl.nombre||' '||COALESCE(cl.apellido,''))) ILIKE ${texto})
     ORDER BY o.id DESC LIMIT 12`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const ruta = new URL(req.url).pathname.replace(/^\/ladys-preparacion/, "").replace(/\/$/, "") || "/";
  try {
    const u = await auth(req);
    if (!u) return json({ error: "Token requerido" }, 401);
    const uid = Number(u.id) || null;

    if (req.method === "GET" && ruta === "/") return json(await tablero());
    if (req.method === "GET" && ruta === "/buscar") {
      const q = (new URL(req.url).searchParams.get("q") || "").trim();
      if (q.length < 1) return json({ pedidos: [] });
      return json({ pedidos: await buscar(q) });
    }
    if (req.method !== "POST") return json({ error: "Ruta no encontrada" }, 404);
    const b = await req.json().catch(() => ({}));

    // Empezar la preparacion de un pedido recepcionado (solo planchado: directo a planchar)
    if (ruta === "/preparar") {
      const etapa = await preparar(Number(b.orden_id), uid);
      return json({ ok: true, etapa });
    }

    // Nueva carga definitiva
    if (ruta === "/carga") {
      const id = Number(b.orden_id);
      const tipo = String(b.tipo || "").toUpperCase();
      if (!TIPOS.includes(tipo)) return json({ error: "Tipo de carga desconocido" }, 400);
      const [o] = await SQL`SELECT etapa, trabajo_de_orden(id) AS trabajo FROM ordenes WHERE id = ${id}`;
      if (!o) return json({ error: `No existe el pedido ${id}` }, 404);
      if (o.trabajo === "PLANCHA")
        return json({ error: `El pedido ${id} es solo de planchado: no lleva cargas de lavadora ni secadora.` }, 409);
      if (o.etapa === "RECEPCIONADO") await preparar(id, uid);
      else if (!EN_MAQUINAS.includes(o.etapa))
        return json({ error: `El pedido ${id} está en ${o.etapa}: ya no se le agregan cargas` }, 409);
      const [fam] = await SQL`
        SELECT t.familia FROM orden_items i
          JOIN servicios s ON s.id = i.servicio_id
          JOIN proceso_tiempos t ON t.familia = s.familia
         WHERE i.orden_id = ${id} AND (t.min_lavadora > 0 OR t.min_secadora > 0)
           AND ${tipo === "UNIDAD"} = (t.unidades_carga = 1)
         ORDER BY i.cantidad DESC LIMIT 1`;
      const [c] = await SQL`
        INSERT INTO cargas (orden_id, numero, tipo, familia, kg, usuario_lista)
        VALUES (${id}, (SELECT COALESCE(MAX(numero),0)+1 FROM cargas WHERE orden_id = ${id}),
                ${tipo}, ${fam?.familia ?? null}, ${b.kg ?? null}, ${uid})
        RETURNING id, numero`;
      return json({ ok: true, carga: c });
    }

    // Los pasos sobre una carga
    const [c] = b.carga_id ? await SQL`SELECT * FROM cargas WHERE id = ${Number(b.carga_id)}` : [null];

    if (ruta === "/lavadora") {
      if (!c || c.anulada) return json({ error: "Carga no encontrada" }, 404);
      if (c.lavado_inicio) return json({ error: `La carga ${c.numero} ya entró a lavadora` }, 409);
      const n = Number(b.n);
      const [ocupa] = await SQL`SELECT orden_id, numero FROM cargas
        WHERE lavadora = ${n} AND lavado_inicio IS NOT NULL AND lavado_fin IS NULL AND NOT anulada`;
      if (ocupa) return json({ error: `La lavadora ${n} tiene la carga ${ocupa.numero} del pedido ${ocupa.orden_id}. Si ya la sacaste, libérala primero.`, ocupada: ocupa }, 409);
      await SQL`UPDATE cargas SET lavadora = ${n}, lavado_inicio = NOW(), usuario_lavado = ${uid} WHERE id = ${c.id}`;
      return json({ ok: true });
    }

    if (ruta === "/secadora") {
      if (!c || c.anulada) return json({ error: "Carga no encontrada" }, 404);
      if (!c.lavado_inicio) return json({ error: `La carga ${c.numero} todavía no pasó por lavadora` }, 409);
      if (c.secado_inicio) return json({ error: `La carga ${c.numero} ya está en secadora` }, 409);
      const n = Number(b.n);
      const [ocupa] = await SQL`SELECT orden_id, numero FROM cargas
        WHERE secadora = ${n} AND secado_inicio IS NOT NULL AND secado_fin IS NULL AND NOT anulada`;
      if (ocupa) return json({ error: `La secadora ${n} tiene la carga ${ocupa.numero} del pedido ${ocupa.orden_id}. Si ya la sacaste, libérala primero.`, ocupada: ocupa }, 409);
      // El lavado termina cuando termina el ciclo, no cuando se saca la ropa: lo
      // que pasa entre medio es ropa mojada esperando, y se mide aparte.
      await SQL`UPDATE cargas SET
          lavado_fin = COALESCE(lavado_fin, LEAST(NOW(), lavado_inicio + make_interval(mins => (SELECT min_ciclo FROM maquinas WHERE tipo='LAVADORA')::int))),
          secadora = ${n}, secado_inicio = NOW(), usuario_secado = ${uid}
        WHERE id = ${c.id}`;
      return json({ ok: true });
    }

    if (ruta === "/seco") {
      if (!c || c.anulada) return json({ error: "Carga no encontrada" }, 404);
      if (!c.secado_inicio) return json({ error: `La carga ${c.numero} no está en secadora` }, 409);
      if (c.secado_fin) return json({ ok: true });
      await SQL`UPDATE cargas SET secado_fin = NOW(), usuario_fin = ${uid} WHERE id = ${c.id}`;
      return json({ ok: true });
    }

    // UN PASO ATRAS. Marcar de mas es el error tipico: la carga sale de la
    // secadora "seca" y le quedaba humedad. Se permite dentro de la hora
    // siguiente a la marca y solo si la maquina a la que vuelve sigue libre;
    // pasado ese rato se arregla a mano, para que nadie borre historia vieja.
    if (ruta === "/deshacer") {
      if (!c || c.anulada) return json({ error: "Carga no encontrada" }, 404);
      const [o] = await SQL`SELECT etapa FROM ordenes WHERE id = ${c.orden_id}`;
      if (!EN_MAQUINAS.includes(o?.etapa))
        return json({ error: `El pedido ${c.orden_id} ya está en ${o?.etapa}: eso se corrige en el pedido` }, 409);

      const marca = c.secado_fin ?? c.secado_inicio ?? c.lavado_inicio;
      if (!marca) return json({ error: `La carga ${c.numero} todavía no se marca en ninguna máquina` }, 409);
      const minutos = (Date.now() - new Date(marca).getTime()) / 60000;
      if (minutos > 60)
        return json({ error: `Esa marca ya tiene ${Math.round(minutos / 60)} h: para corregirla avísale a Lufi.` }, 409);

      if (c.secado_fin) {
        const [ocupa] = await SQL`SELECT orden_id, numero FROM cargas
          WHERE secadora = ${c.secadora} AND secado_inicio IS NOT NULL AND secado_fin IS NULL AND NOT anulada`;
        if (ocupa) return json({ error: `La secadora ${c.secadora} ahora tiene la carga ${ocupa.numero} del pedido ${ocupa.orden_id}` }, 409);
        await SQL`UPDATE cargas SET secado_fin = NULL, usuario_fin = NULL,
                    nota = TRIM(COALESCE(nota,'') || ' Vuelve a la secadora ' || to_char(NOW(),'DD-MM HH24:MI') || '.')
                  WHERE id = ${c.id}`;
        return json({ ok: true, estado: "SECANDO" });
      }
      if (c.secado_inicio) {
        await SQL`UPDATE cargas SET secadora = NULL, secado_inicio = NULL, usuario_secado = NULL,
                    nota = TRIM(COALESCE(nota,'') || ' Sale de la secadora ' || to_char(NOW(),'DD-MM HH24:MI') || '.')
                  WHERE id = ${c.id}`;
        return json({ ok: true, estado: c.lavado_fin ? "MOJADA" : "LAVANDO" });
      }
      await SQL`UPDATE cargas SET lavadora = NULL, lavado_inicio = NULL, lavado_fin = NULL, usuario_lavado = NULL,
                  nota = TRIM(COALESCE(nota,'') || ' Sale de la lavadora ' || to_char(NOW(),'DD-MM HH24:MI') || '.')
                WHERE id = ${c.id}`;
      return json({ ok: true, estado: "LISTA" });
    }

    if (ruta === "/anular") {
      if (!c) return json({ error: "Carga no encontrada" }, 404);
      await SQL`UPDATE cargas SET anulada = true,
                  nota = TRIM(COALESCE(nota,'') || ' Anulada por usuario ' || ${String(uid)} || ' ' || to_char(NOW(),'DD-MM HH24:MI'))
                WHERE id = ${c.id}`;
      return json({ ok: true });
    }

    // La ropa se saco de la maquina sin marcarlo: se cierra el tramo ahora
    if (ruta === "/liberar") {
      const n = Number(b.n);
      if (b.maquina === "LAVADORA") {
        await SQL`UPDATE cargas SET lavado_fin = LEAST(NOW(), lavado_inicio + make_interval(mins => (SELECT min_ciclo FROM maquinas WHERE tipo='LAVADORA')::int)),
                    nota = TRIM(COALESCE(nota,'') || ' Lavadora liberada a mano.')
                  WHERE lavadora = ${n} AND lavado_inicio IS NOT NULL AND lavado_fin IS NULL AND NOT anulada`;
      } else if (b.maquina === "SECADORA") {
        await SQL`UPDATE cargas SET secado_fin = NOW(), usuario_fin = ${uid},
                    nota = TRIM(COALESCE(nota,'') || ' Secadora liberada a mano.')
                  WHERE secadora = ${n} AND secado_inicio IS NOT NULL AND secado_fin IS NULL AND NOT anulada`;
      } else return json({ error: "Máquina desconocida" }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e: any) {
    if (e?.s) return json({ error: e.m }, e.s);
    // Reglas de la base (p. ej. trg_planchado_sin_maquinas): su mensaje ya es para la persona
    if (e?.code === "P0001") return json({ error: e.message }, 409);
    return json({ error: (e as Error).message }, 500);
  }
});
