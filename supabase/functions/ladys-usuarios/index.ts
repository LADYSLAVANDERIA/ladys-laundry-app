// Ladys — usuarios: crear, editar y desactivar personas del equipo.
// Va aparte de la API principal a propósito: el monolito `ladys` es grande y
// tocarlo a días del corte tiene mucho más riesgo que agregar esta pieza chica.
import postgres from "npm:postgres@3.4.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import * as jose from "npm:jose@5.9.6";

const SQL = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { search_path: "ladys, public", timezone: "America/Santiago" },
});
const SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET") || "ladys_jwt_secret_super_seguro_2024");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });

const PERFILES = ["ADMINISTRADOR", "JEFE_LOCAL", "ASISTENTE", "CONDUCTOR"];

async function auth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : h;
  try { const { payload } = await jose.jwtVerify(tok, SECRET); return payload as any; }
  catch { return null; }
}

// Nunca se puede dejar el local sin un administrador activo: quedaría sin llave.
async function quedanAdmins(lid: number, excepto: number) {
  const [r] = await SQL`SELECT COUNT(*)::int AS n FROM usuarios
    WHERE local_id=${lid} AND perfil='ADMINISTRADOR' AND estado=TRUE AND id <> ${excepto}`;
  return r.n > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/ladys-usuarios/, "").replace(/\/$/, "") || "/";

  try {
    const u = await auth(req);
    if (!u) return json({ error: "Token requerido" }, 401);
    const lid = Number(u.local_id) || 1;

    if (req.method === "GET" && ruta === "/") {
      return json(await SQL`SELECT id,nombre,apellido,telefono,email,perfil,estado,ultimo_acceso
        FROM usuarios WHERE local_id=${lid} ORDER BY estado DESC, nombre`);
    }

    // Cambiar la propia clave. Cualquiera puede, pero tiene que saber la actual.
    if (req.method === "POST" && ruta === "/mi-clave") {
      const b = await req.json();
      const actual = String(b.actual || "");
      const nueva = String(b.nueva || "");
      if (nueva.length < 6) return json({ error: "La clave nueva debe tener al menos 6 caracteres" }, 400);
      if (nueva === actual) return json({ error: "La clave nueva tiene que ser distinta de la actual" }, 400);
      const [yo] = await SQL`SELECT id, password_hash FROM usuarios WHERE id=${Number(u.id)}`;
      if (!yo) return json({ error: "No encuentro tu usuario" }, 404);
      if (!bcrypt.compareSync(actual, yo.password_hash)) return json({ error: "La clave actual no coincide" }, 401);
      await SQL`UPDATE usuarios SET password_hash=${bcrypt.hashSync(nueva, 10)} WHERE id=${yo.id}`;
      return json({ ok: true });
    }

    if (u.perfil !== "ADMINISTRADOR") return json({ error: "Solo el administrador puede administrar usuarios" }, 403);

    if (req.method === "POST" && ruta === "/") {
      const b = await req.json();
      const nombre = String(b.nombre || "").trim();
      const email = String(b.email || "").trim().toLowerCase();
      const pass = String(b.password || "");
      const perfil = String(b.perfil || "ASISTENTE").toUpperCase();

      if (!nombre) return json({ error: "Falta el nombre" }, 400);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "El correo no es válido" }, 400);
      if (pass.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
      if (!PERFILES.includes(perfil)) return json({ error: "Perfil inválido" }, 400);

      const [dup] = await SQL`SELECT id FROM usuarios WHERE LOWER(email)=${email}`;
      if (dup) return json({ error: "Ya existe un usuario con ese correo" }, 409);

      const [n] = await SQL`INSERT INTO usuarios
          (local_id,nombre,apellido,telefono,email,password_hash,perfil,creado_por)
        VALUES (${lid}, ${nombre}, ${b.apellido || null}, ${b.telefono || null},
                ${email}, ${bcrypt.hashSync(pass, 10)}, ${perfil}, ${Number(u.id) || null})
        RETURNING id,nombre,apellido,telefono,email,perfil,estado`;
      return json(n, 201);
    }

    const mu = ruta.match(/^\/(\d+)$/);
    if (mu && req.method === "PUT") {
      const id = Number(mu[1]);
      const b = await req.json();
      const [ex] = await SQL`SELECT id, perfil FROM usuarios WHERE id=${id} AND local_id=${lid}`;
      if (!ex) return json({ error: "No existe ese usuario" }, 404);

      if (b.perfil !== undefined) {
        const perfil = String(b.perfil).toUpperCase();
        if (!PERFILES.includes(perfil)) return json({ error: "Perfil inválido" }, 400);
        if (ex.perfil === "ADMINISTRADOR" && perfil !== "ADMINISTRADOR" && !(await quedanAdmins(lid, id)))
          return json({ error: "No puedes dejar el sistema sin administrador" }, 400);
        await SQL`UPDATE usuarios SET perfil=${perfil} WHERE id=${id}`;
      }

      if (b.estado !== undefined) {
        const activo = b.estado === true || b.estado === "true";
        if (!activo && ex.perfil === "ADMINISTRADOR" && !(await quedanAdmins(lid, id)))
          return json({ error: "No puedes desactivar al único administrador" }, 400);
        await SQL`UPDATE usuarios SET estado=${activo} WHERE id=${id}`;
      }

      if (b.nombre !== undefined)   await SQL`UPDATE usuarios SET nombre=${String(b.nombre).trim()} WHERE id=${id}`;
      if (b.apellido !== undefined) await SQL`UPDATE usuarios SET apellido=${b.apellido || null} WHERE id=${id}`;
      if (b.telefono !== undefined) await SQL`UPDATE usuarios SET telefono=${b.telefono || null} WHERE id=${id}`;

      if (b.password) {
        if (String(b.password).length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
        await SQL`UPDATE usuarios SET password_hash=${bcrypt.hashSync(String(b.password), 10)} WHERE id=${id}`;
      }

      const [n] = await SQL`SELECT id,nombre,apellido,telefono,email,perfil,estado,ultimo_acceso FROM usuarios WHERE id=${id}`;
      return json(n);
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
