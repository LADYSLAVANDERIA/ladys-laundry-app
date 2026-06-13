const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email=$1 AND estado=TRUE', [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    await db.query('UPDATE usuarios SET ultimo_acceso=NOW() WHERE id=$1', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, perfil: user.perfil, local_id: user.local_id, nombre: user.nombre },
      process.env.JWT_SECRET || 'ladys_jwt_secret_super_seguro_2024',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, perfil: user.perfil, local_id: user.local_id }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login };
