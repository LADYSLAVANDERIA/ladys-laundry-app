const serverless = require('serverless-http');
const express    = require('express');
const cors       = require('cors');
const routes     = require('../../backend/src/routes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Netlify entrega la ruta completa; la recortamos para que Express la reconozca
app.use((req, _res, next) => {
  req.url = req.url.replace(/^\/(\.netlify\/functions\/api|api)/, '') || '/';
  if (!req.url.startsWith('/')) req.url = '/' + req.url;
  next();
});

app.get('/health', (_, res) => res.json({
  status: 'ok', app: 'Ladys Laundry API', version: '2.0.0',
  hora_chile: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
}));

app.use('/', routes);
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Error interno del servidor' }); });

module.exports.handler = serverless(app);
