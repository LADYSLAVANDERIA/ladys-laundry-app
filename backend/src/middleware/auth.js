const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token requerido' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ladys_jwt_secret_super_seguro_2024');
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.perfil !== 'ADMINISTRADOR') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
};

module.exports = { auth, adminOnly };
