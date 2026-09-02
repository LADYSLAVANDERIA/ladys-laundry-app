const jwt = require('jsonwebtoken');
const SECRET = () => process.env.JWT_SECRET || 'ladys_jwt_secret_super_seguro_2024';

const auth = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token requerido' });
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try { req.user = jwt.verify(token, SECRET()); next(); }
  catch { return res.status(401).json({ error: 'Token inválido o expirado' }); }
};

const adminOnly = (req, res, next) => {
  if (req.user?.perfil !== 'ADMINISTRADOR') return res.status(403).json({ error: 'Acceso solo para administradores' });
  next();
};

// Para integraciones (SofIA / n8n): header x-api-key = WEBHOOK_KEY
const webhookAuth = (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key && process.env.WEBHOOK_KEY && key === process.env.WEBHOOK_KEY) {
    req.user = { id: null, local_id: 1, perfil: 'WEBHOOK', nombre: 'SofIA' };
    return next();
  }
  return res.status(401).json({ error: 'API key inválida' });
};

module.exports = { auth, adminOnly, webhookAuth };
