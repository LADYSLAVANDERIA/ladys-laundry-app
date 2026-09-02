require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const routes  = require('./routes');
const migrar  = require('./migrate');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', routes);

app.get('/health', (_, res) => res.json({ status: 'ok', app: 'Ladys Laundry API', version: '2.0.0', hora_chile: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }) }));

app.use((err, req, res, next) => { console.error(err.stack); res.status(500).json({ error: 'Error interno del servidor' }); });

migrar()
  .then(() => app.listen(PORT, () => {
    console.log(`🚀 Ladys Laundry API v2 corriendo en puerto ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  }))
  .catch(e => { console.error('No se pudo iniciar:', e.message); process.exit(1); });
