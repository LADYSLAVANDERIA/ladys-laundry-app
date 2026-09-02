const fs = require('fs'), path = require('path');
const pool = require('./config/db');
const dir = path.join(__dirname, '..', 'database', 'migrations');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function esperarDB() {
  for (let i = 0; i < 45; i++) {
    try {
      const r = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_name='ordenes'");
      if (r.rowCount) return;
    } catch (e) { /* aún no responde */ }
    console.log('⏳ Esperando base de datos...'); await sleep(2000);
  }
  throw new Error('La base de datos no respondió a tiempo');
}

module.exports = async function migrar() {
  await esperarDB();
  await pool.query('CREATE TABLE IF NOT EXISTS _migraciones (nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMP DEFAULT NOW())');
  if (!fs.existsSync(dir)) return;
  const hechas = new Set((await pool.query('SELECT nombre FROM _migraciones')).rows.map(r => r.nombre));
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.sql')).sort()) {
    if (hechas.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO _migraciones (nombre) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`✅ Migración aplicada: ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`❌ Migración ${f} falló: ${e.message}`);
      throw e;
    } finally { client.release(); }
  }
};
