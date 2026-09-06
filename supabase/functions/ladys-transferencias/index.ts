// Ladys — transferencias: comprobante en el mesón y confirmación del banco (BCI)
import postgres from "npm:postgres@3.4.4";
import * as jose from "npm:jose@5.9.6";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
});
const SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET") || "ladys_jwt_secret_super_seguro_2024");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

const FORMA_TRANSF = 1;   // Transferencia

async function conf(clave: string) {
  const [r] = await SQL`SELECT valor FROM configuracion WHERE clave = ${clave}`;
  return r?.valor || "";
}
async function auth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
  try { const { payload } = await jose.jwtVerify(tok, SECRET); return payload as any; }
  catch { return null; }
}

// Nombres reales del aviso de BCI (producto Business Notifications):
//   idEvento · idContable · monto · fechaNotificacion · fechaTransaccion · fechaContable
//   conceptoId · cuentaCliente · rutCliente · dvCliente · tipoTransaccion
//   anulacion · numeroReintento
//   concepto: { nombre, rut, dv, numeroCuenta, codigoBanco, nroOperacion, mensaje }
// Se mantienen los nombres alternativos por si el ambiente productivo difiere.
function leerAviso(b: any) {
  const num = (v: any) => Math.round(Number(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0);
  const txt = (...v: any[]) => String(v.find((x) => x !== undefined && x !== null && x !== "") ?? "").trim();
  const c = b.concepto ?? b.Concepto ?? {};

  const tipo = txt(b.tipoTransaccion, b.TipoTransaccion, b.MovementType, b.movementType, b.tipoMovimiento).toUpperCase();

  // "anulacion" marca una reversa: no es plata que entró.
  const anulRaw = b.anulacion ?? b.Anulacion ?? b.anulado ?? false;
  const anulacion = anulRaw === true || /^(S|SI|TRUE|1|Y)$/i.test(String(anulRaw));

  return {
    monto: num(b.monto ?? b.Monto ?? b.Amount ?? b.amount ?? b.transactionAmount),
    tipo,
    anulacion,
    // idEvento es el identificador único del aviso: es la mejor llave anti-duplicado,
    // porque BCI reintenta el mismo evento (numeroReintento) hasta recibir un 200.
    ref: txt(b.idEvento, b.IdEvento, c.nroOperacion, b.idContable, b.transactionId, b.id, b.folio),
    nombre: txt(c.nombre, c.Nombre, b.originName, b.senderName, b.nombreOrigen),
    rut: txt(c.rut, c.Rut, b.originRut, b.rutOrigen),
    cuentaOrigen: txt(c.numeroCuenta, c.NumeroCuenta),
    mensaje: txt(c.mensaje, c.Mensaje),
    nroOperacion: txt(c.nroOperacion, c.NroOperacion),
    fecha: txt(b.fechaTransaccion, b.FechaTransaccion, b.fechaContable, b.fechaNotificacion, b.date, b.fecha).slice(0, 10),
  };
}
// Solo nos interesan los abonos. Un cargo es plata que sale, no un pago de cliente.
function esCargo(tipo: string) {
  return /CARGO|DEBIT|EGRESO|SALIDA|ENVIAD/.test(tipo);
}

async function abonar(ordenId: number, monto: number, ref: string, usuarioId: number | null) {
  const [ya] = await SQL`SELECT id FROM pagos WHERE referencia = ${ref}`;
  if (ya) return true;
  await SQL`INSERT INTO pagos (orden_id, cliente_id, forma_pago_id, monto, referencia, usuario_id)
            SELECT ${ordenId}, cliente_id, ${FORMA_TRANSF}, ${monto}, ${ref}, ${usuarioId}
            FROM ordenes WHERE id = ${ordenId}`;
  await SQL`UPDATE ordenes
              SET monto_abonado = COALESCE(monto_abonado,0) + ${monto},
                  saldo_pendiente = GREATEST(COALESCE(monto_total,0) - (COALESCE(monto_abonado,0) + ${monto}), 0)
            WHERE id = ${ordenId}`;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-transferencias/, "").replace(/\/$/, "") || "/";

  try {
    // ── PUERTA DEL BANCO ──
    if (req.method === "POST" && ruta === "/aviso-banco") {
      const clave = req.headers.get("x-api-key") || url.searchParams.get("k") || "";
      const esperada = await conf("bci_callback_key");
      if (esperada && clave !== esperada) return json({ error: "no autorizado" }, 401);

      const body = await req.json().catch(() => ({}));
      // se guarda crudo SIEMPRE: así sabemos qué manda BCI de verdad
      await SQL`INSERT INTO bci_avisos (crudo) VALUES (${JSON.stringify(body)}::jsonb)`;

      const a = leerAviso(body);
      if (!a.monto) return json({ ok: true, ignorado: "sin monto" });
      if (a.anulacion) return json({ ok: true, ignorado: "es una anulacion" });
      if (esCargo(a.tipo)) return json({ ok: true, ignorado: "es un cargo, no un abono" });

      const ref = a.ref || `BCI-${a.fecha || "s/f"}-${a.monto}-${Date.now()}`;
      // BCI reintenta el mismo idEvento hasta recibir 200: el duplicado es normal, no un error.
      const [dup] = await SQL`SELECT id FROM transferencias WHERE banco_ref = ${ref}`;
      if (dup) return json({ ok: true, duplicado: true });

      const [calce] = await SQL`SELECT id, orden_id FROM transferencias
        WHERE estado = 'POR_CONFIRMAR' AND monto = ${a.monto}
          AND (fecha_mov IS NULL OR fecha_mov >= CURRENT_DATE - 2)
        ORDER BY creado_en LIMIT 1`;

      if (calce) {
        await SQL`UPDATE transferencias
            SET estado = 'CONFIRMADA', banco_ref = ${ref},
                nombre_origen = COALESCE(NULLIF(${a.nombre},''), nombre_origen),
                rut_origen = COALESCE(NULLIF(${a.rut},''), rut_origen),
                nota = COALESCE(NULLIF(${a.mensaje},''), nota),
                confirmado_en = NOW()
            WHERE id = ${calce.id}`;
        return json({ ok: true, confirmada: calce.id, orden_id: calce.orden_id });
      }

      const [t] = await SQL`INSERT INTO transferencias
          (monto, origen, estado, fecha_mov, nombre_origen, rut_origen, banco_ref, nota, confirmado_en)
        VALUES (${a.monto}, 'BANCO', 'SIN_ASIGNAR',
                ${a.fecha || null}::date, ${a.nombre || null}, ${a.rut || null}, ${ref},
                ${a.mensaje || null}, NOW())
        RETURNING id`;
      return json({ ok: true, sin_asignar: t.id });
    }

    const u = await auth(req);
    if (!u) return json({ error: "Token requerido" }, 401);
    const uid = Number(u.id) || null;

    // GET /bci/ultimos — para ver qué manda el banco en las pruebas
    if (req.method === "GET" && ruta === "/bci/ultimos") {
      const filas = await SQL`SELECT id, crudo, recibido FROM bci_avisos ORDER BY id DESC LIMIT 10`;
      const [ck] = await SQL`SELECT valor FROM configuracion WHERE clave = 'bci_callback_key'`;
      return json({
        callback: `https://vhjsizkbmabznupkfzji.supabase.co/functions/v1/ladys-transferencias/aviso-banco?k=${ck?.valor || ""}`,
        avisos: filas,
      });
    }

    if (req.method === "POST" && ruta === "/comprobante") {
      const b = await req.json();
      const ordenId = Number(b.orden_id);
      const monto = Math.round(Number(b.monto) || 0);
      if (!ordenId || !monto) return json({ error: "Falta el pedido o el monto" }, 400);
      const [o] = await SQL`SELECT id, cliente_id FROM ordenes WHERE id = ${ordenId}`;
      if (!o) return json({ error: "No existe el pedido" }, 404);
      const [t] = await SQL`INSERT INTO transferencias
          (orden_id, cliente_id, monto, origen, estado, fecha_mov, hora_mov,
           nombre_origen, comprobante_url, registrado_por, nota)
        VALUES (${ordenId}, ${o.cliente_id}, ${monto}, 'COMPROBANTE', 'POR_CONFIRMAR',
                CURRENT_DATE, LOCALTIME, ${b.nombre_origen || null}, ${b.comprobante_url || null},
                ${uid}, ${b.nota || null})
        RETURNING id`;
      await abonar(ordenId, monto, `TRF-${t.id}`, uid);
      return json({ ok: true, transferencia_id: t.id,
                    aviso: "Registrada. Queda pendiente de confirmar con el banco." });
    }

    if (req.method === "GET" && ruta === "/pendientes") {
      const porConfirmar = await SQL`SELECT t.id, t.orden_id, t.monto, t.fecha_mov, t.nombre_origen,
            t.comprobante_url, t.creado_en,
            COALESCE(NULLIF(c.razon_social,''), CONCAT_WS(' ', c.nombre, c.apellido)) AS cliente,
            COALESCE(u.nombre,'') AS registro
          FROM transferencias t
          LEFT JOIN clientes c ON c.id = t.cliente_id
          LEFT JOIN usuarios u ON u.id = t.registrado_por
          WHERE t.estado = 'POR_CONFIRMAR' ORDER BY t.creado_en DESC LIMIT 100`;
      const sinAsignar = await SQL`SELECT id, monto, fecha_mov, nombre_origen, rut_origen, banco_ref
          FROM transferencias WHERE estado = 'SIN_ASIGNAR' ORDER BY fecha_mov DESC, id DESC LIMIT 100`;
      const candidatos = await SQL`SELECT o.id, o.saldo_pendiente,
            COALESCE(NULLIF(c.razon_social,''), CONCAT_WS(' ', c.nombre, c.apellido)) AS cliente
          FROM ordenes o JOIN clientes c ON c.id = o.cliente_id
          WHERE o.saldo_pendiente > 0 AND o.estado <> 'ANULADA'
          ORDER BY o.creado_en DESC LIMIT 60`;
      return json({ por_confirmar: porConfirmar, sin_asignar: sinAsignar, candidatos });
    }

    if (req.method === "POST" && ruta === "/asignar") {
      const b = await req.json();
      const [t] = await SQL`SELECT * FROM transferencias WHERE id = ${Number(b.id)}`;
      if (!t) return json({ error: "No existe" }, 404);
      if (t.orden_id) return json({ error: "Ya está asignada" }, 409);
      await abonar(Number(b.orden_id), Number(t.monto), `TRF-${t.id}`, uid);
      await SQL`UPDATE transferencias SET orden_id = ${Number(b.orden_id)}, estado = 'CONFIRMADA',
                  cliente_id = (SELECT cliente_id FROM ordenes WHERE id = ${Number(b.orden_id)})
                WHERE id = ${t.id}`;
      return json({ ok: true });
    }

    if (req.method === "POST" && ruta === "/marcar") {
      const b = await req.json();
      const est = String(b.estado || "").toUpperCase();
      if (!["CONFIRMADA", "NO_LLEGO", "POR_CONFIRMAR"].includes(est)) return json({ error: "Estado inválido" }, 400);
      if (est === "CONFIRMADA") {
        await SQL`UPDATE transferencias SET estado = 'CONFIRMADA', confirmado_en = NOW(),
                    nota = COALESCE(${b.nota ?? null}, nota) WHERE id = ${Number(b.id)}`;
      } else {
        await SQL`UPDATE transferencias SET estado = ${est}, confirmado_en = NULL,
                    nota = COALESCE(${b.nota ?? null}, nota) WHERE id = ${Number(b.id)}`;
      }
      return json({ ok: true });
    }

    if (req.method === "POST" && ruta === "/bci/suscribir") {
      const apiKey = await conf("bci_api_key");
      const cuenta = await conf("bci_cuenta");
      const rut = await conf("bci_rut");
      const dv = await conf("bci_dv");
      const amb = (await conf("bci_ambiente")) || "sandbox";
      if (!apiKey || !cuenta || !rut) return json({ error: "Faltan datos de BCI en Configuración" }, 400);
      const ck = await conf("bci_callback_key");
      const callback = `https://vhjsizkbmabznupkfzji.supabase.co/functions/v1/ladys-transferencias/aviso-banco?k=${ck}`;
      const r = await fetch(`https://apipartner.bci.cl/${amb}/v2/api-business-notifications/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": apiKey },
        body: JSON.stringify({
          OrganizationName: "Ladys Lavanderia Concon SpA",
          Account: cuenta, RUT: rut, CheckDigit: dv,
          URLCallback: callback, APIKey: apiKey,
        }),
      });
      const txt = await r.text();
      return json({ ok: r.ok, status: r.status, callback, respuesta: txt.slice(0, 600) });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
