const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'ladys_laundry',
  user:     process.env.DB_USER     || 'ladys_user',
  password: process.env.DB_PASSWORD || 'ladys_password_2024',
});

pool.on('error', (err) => {
  console.error('Error en pool PostgreSQL:', err);
});

module.exports = pool;
