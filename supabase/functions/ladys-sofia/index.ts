// Ladys — datos para SofIA. Responde en frases listas para copiar al cliente,
// no en jerga del sistema. SofIA entra con la clave de webhook, sin sesión.
import postgres from "npm:postgres@3.4.4";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
});
const CLAVE = Deno.env.get("WEBHOOK_KEY") || "ladys_webhook_2026";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

const clp = (n: any) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const ot = (id: number) => "#" + String(id);

// El teléfono llega de mil formas: +56 9 ..., 9..., con puntos. Se compara por
// los últimos 8 dígitos, que es lo único estable.
const cola = (t: string) => String(t || "").replace(/\D/g, "").slice(-8);

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function fechaLarga(f: any) {
  if (!f) return null;
  // Postgres devuelve DATE como objeto Date a medianoche UTC. Si se pasa por
  // String() queda "Fri Sep 05 2026" y el recorte da basura: hay que separarlo.
  const iso = f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10);
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
const hoyChile = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

// Qué se le puede decir al cliente en cada etapa, en su idioma.
const ETAPA_TEXTO: Record<string, string> = {
  RECEPCIONADO:   "lo tenemos en el local, entra a proceso",
  EN_LAVADO:      "está en lavado",
  EN_SECADO:      "está en secado",
  EMBOLSADO:      "ya está doblado y embalado",
  LISTO_RETIRO:   "está listo para que lo pases a retirar",
  LISTO_DESPACHO: "está listo y sale en la próxima ruta",
  ASIGNADO_RUTA:  "está listo y va asignado a la ruta",
  EN_CAMINO:      "va en camino a tu domicilio",
  ENTREGADO:      "ya fue entregado",
  EN_LOCKER:      "está en el locker esperándote",
};

function frasePedido(o: any) {
  const n = ot(o.id);
  if (o.estado === "ANULADA") return `El pedido ${n} está anulado.`;
  if (o.estado === "ENTREGADA") return `El pedido ${n} ya fue entregado.`;

  const etapa = ETAPA_TEXTO[o.etapa] || (o.estado === "LISTA" ? "está listo" : "está en proceso");
  const cuando = fechaLarga(o.fecha_entrega);
  const retiro = fechaLarga(o.fecha_recogida);
  const franja = o.ruta_hora ? ` entre las ${String(o.ruta_hora).slice(0, 5)} y las ${String(o.ruta_fin).slice(0, 5)}` : "";

  let txt: string;
  if (o.estado === "PRE_ORDEN") {
    txt = retiro
      ? `El pedido ${n} está agendado: pasamos a retirarlo el ${retiro}${franja}.`
      : `El pedido ${n} está agendado para retiro a domicilio.`;
  } else if (o.entrega_domicilio) {
    txt = cuando
      ? `El pedido ${n} ${etapa}. Te lo llevamos el ${cuando}${franja}.`
      : `El pedido ${n} ${etapa}.`;
  } else {
    txt = cuando && o.estado !== "LISTA"
      ? `El pedido ${n} ${etapa}. Queda listo el ${cuando} para retirar en el local.`
      : `El pedido ${n} ${etapa}.`;
  }
  if (Number(o.saldo_pendiente) > 0) txt += ` Queda un saldo de ${clp(o.saldo_pendiente)}.`;
  else if (Number(o.monto_total) > 0) txt += " Ya está pagado.";
  return txt;
}

async function pedidosDe(clienteId: number) {
  return await SQL`
    SELECT o.id, o.estado, o.etapa, o.estado_pago, o.fecha_entrega, o.fecha_recogida,
           o.entrega_domicilio, o.monto_total, o.saldo_pendiente, o.kilos, o.bultos,
           re.hora_inicio AS ruta_hora, re.hora_fin AS ruta_fin
    FROM ordenes o
    LEFT JOIN rutas re ON re.id = COALESCE(o.ruta_entrega_id, o.ruta_recogida_id)
    WHERE o.cliente_id = ${clienteId} AND o.estado <> 'ANULADA'
      AND (o.estado <> 'ENTREGADA' OR o.entregada_el > NOW() - INTERVAL '7 days')
    ORDER BY o.creado_en DESC LIMIT 10`;
}

async function membresiaDe(clienteId: number) {
  const [m] = await SQL`
    SELECT pc.kilos_incluidos, pc.kilos_usados, pc.ciclo_fin, pc.fecha_venc,
           pc.saldo_actual, pc.modalidad, pp.nombre AS plan, pp.kilo_adicional
    FROM prepagos_cliente pc JOIN planes_prepago pp ON pp.id = pc.plan_id
    WHERE pc.cliente_id = ${clienteId} AND pc.activo = TRUE
    ORDER BY pc.id DESC LIMIT 1`;
  if (!m) return null;
  const incl = Number(m.kilos_incluidos) || 0;
  const usad = Number(m.kilos_usados) || 0;
  const quedan = Math.max(incl - usad, 0);
  const hasta = m.ciclo_fin || m.fecha_venc;
  return {
    plan: m.plan,
    kilos_incluidos: incl,
    kilos_usados: usad,
    kilos_disponibles: quedan,
    vence: hasta,
    kilo_adicional: Number(m.kilo_adicional) || null,
    frase: incl
      ? `Tu plan ${m.plan} tiene ${incl} kilos. Llevas ${usad} usados, así que te quedan ${quedan}` +
        (hasta ? `, hasta el ${fechaLarga(hasta)}.` : ".")
      : `Tienes el plan ${m.plan} con un saldo de ${clp(m.saldo_actual)}.`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-sofia/, "").replace(/\/$/, "") || "/";

  const clave = req.headers.get("x-api-key") || url.searchParams.get("k") || "";
  if (clave !== CLAVE) return json({ error: "no autorizado" }, 401);

  try {
    // GET /cliente?telefono=  → todo lo que SofIA necesita de una persona
    if (ruta === "/cliente") {
      const tel = cola(url.searchParams.get("telefono") || "");
      if (tel.length < 8) return json({ error: "Falta el teléfono" }, 400);

      // Un mismo teléfono puede estar en dos fichas (una vieja sin nombre y la
      // real). Gana la que tiene historial, no la más antigua.
      const [c] = await SQL`SELECT c.id, c.nombre, c.apellido, c.razon_social, c.telefono, c.continuidad
        FROM clientes c WHERE c.activo = TRUE
          AND RIGHT(regexp_replace(COALESCE(c.telefono,''), '\\D', '', 'g'), 8) = ${tel}
        ORDER BY (SELECT COUNT(*) FROM ordenes o WHERE o.cliente_id = c.id) DESC, c.id DESC
        LIMIT 1`;
      if (!c) return json({ encontrado: false, frase: "No encuentro ese teléfono entre nuestros clientes." });

      const nombre = String(c.razon_social || c.nombre || "").split(" ")[0];
      const [pedidos, memb] = await Promise.all([pedidosDe(c.id), membresiaDe(c.id)]);

      const activos = pedidos.filter((p: any) => p.estado !== "ENTREGADA");
      const frases = pedidos.map(frasePedido);
      const deuda = pedidos.reduce((s: number, p: any) => s + Number(p.saldo_pendiente || 0), 0);

      return json({
        encontrado: true,
        cliente_id: c.id, nombre,
        pedidos: pedidos.map((p: any) => ({
          numero: p.id, ot: ot(p.id), estado: p.estado, etapa: p.etapa,
          listo: p.estado === "LISTA" || ["LISTO_RETIRO", "LISTO_DESPACHO", "EN_LOCKER"].includes(p.etapa),
          entrega_domicilio: p.entrega_domicilio,
          fecha_entrega: p.fecha_entrega, kilos: Number(p.kilos) || 0,
          saldo_pendiente: Number(p.saldo_pendiente) || 0,
          frase: frasePedido(p),
        })),
        membresia: memb,
        saldo_total: deuda,
        frase: activos.length
          ? frases.join(" ")
          : `${nombre}, no tienes pedidos en proceso ahora mismo.`,
      });
    }

    // GET /pedido/:numero  → estado de una OT puntual
    const mp = ruta.match(/^\/pedido\/(\d+)$/);
    if (mp) {
      const [o] = await SQL`
        SELECT o.id, o.estado, o.etapa, o.fecha_entrega, o.fecha_recogida, o.entrega_domicilio,
               o.monto_total, o.saldo_pendiente, o.kilos, o.bultos,
               re.hora_inicio AS ruta_hora, re.hora_fin AS ruta_fin,
               COALESCE(NULLIF(c.razon_social,''), CONCAT_WS(' ', c.nombre, c.apellido)) AS cliente
        FROM ordenes o JOIN clientes c ON c.id = o.cliente_id
        LEFT JOIN rutas re ON re.id = COALESCE(o.ruta_entrega_id, o.ruta_recogida_id)
        WHERE o.id = ${Number(mp[1])}`;
      if (!o) return json({ encontrado: false, frase: `No encuentro el pedido ${ot(Number(mp[1]))}.` });
      return json({ encontrado: true, numero: o.id, ot: ot(o.id), cliente: o.cliente,
                    estado: o.estado, etapa: o.etapa, kilos: Number(o.kilos) || 0,
                    saldo_pendiente: Number(o.saldo_pendiente) || 0, frase: frasePedido(o) });
    }

    // GET /ruta?fecha=  → qué días y horarios hay, para no prometer imposibles
    if (ruta === "/ruta") {
      const fecha = url.searchParams.get("fecha") || hoyChile();
      const d = new Date(fecha + "T12:00:00");
      const dia = ["DOMINGO","LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"][d.getDay()];
      const [fer] = await SQL`SELECT motivo FROM dias_inhabiles WHERE fecha = ${fecha}`;
      const rutas = await SQL`SELECT id, nombre, tipo, hora_inicio, hora_fin, puntos_disp,
          (SELECT COUNT(*)::int FROM ordenes o WHERE o.estado <> 'ANULADA'
             AND ((o.fecha_recogida = ${fecha}::date AND o.ruta_recogida_id = r.id)
               OR (o.fecha_entrega  = ${fecha}::date AND o.ruta_entrega_id  = r.id))) AS usados
        FROM rutas r WHERE r.activo = TRUE AND r.dia_semana = ${dia} ORDER BY r.hora_inicio`;
      return json({
        fecha, dia: DIAS[d.getDay()], feriado: fer?.motivo || null,
        rutas: rutas.map((r: any) => ({
          nombre: r.nombre, tipo: r.tipo,
          horario: `${String(r.hora_inicio).slice(0,5)}–${String(r.hora_fin).slice(0,5)}`,
          cupos: Math.max(0, Number(r.puntos_disp) - Number(r.usados)),
        })),
      });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
