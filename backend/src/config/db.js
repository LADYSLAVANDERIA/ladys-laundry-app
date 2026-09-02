const { Pool, types } = require('pg');

// Tipos: DATE como 'YYYY-MM-DD' (sin desfase de zona), NUMERIC y COUNT como número
types.setTypeParser(1082, v => v);
types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)));
types.setTypeParser(20,   v => (v === null ? null : parseInt(v, 10)));

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'ladys_laundry',
  user:     process.env.DB_USER     || 'ladys_user',
  password: process.env.DB_PASSWORD || 'ladys_password_2024',
});

pool.on('connect', client => { client.query("SET timezone TO 'America/Santiago'").catch(() => {}); });
pool.on('error', err => console.error('Error en pool PostgreSQL:', err));

module.exports = pool;
