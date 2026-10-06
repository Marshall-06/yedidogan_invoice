'use strict';

const path    = require('path');
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const swaggerUi = require('swagger-ui-express');

const config            = require('./config');
const swaggerSpec       = require('./config/swagger');
const apiRouter         = require('./routers');
const notFound          = require('./middlewares/notFound.middleware');
const errorHandler      = require('./middlewares/error.middleware');

/* ══════════════════════════════════════════════════════
   EXPRESS APP
══════════════════════════════════════════════════════ */
const app = express();

/* ── Global middleware-ler ── */
app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map(s => s.trim()),
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

if (config.env !== 'test') {
  app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
}

/* ── Frontend (statik) — backend bilen BIR origin-den hyzmat edýär,
   şonuň üçin CORS problemasy ýok. Diňe gerekli papkalar açylýar
   (backend gizlin faýllary, .env we ş.m. açylmaýar). ── */
const FRONTEND_DIR = path.join(__dirname, '..');
app.use('/css', express.static(path.join(FRONTEND_DIR, 'css')));
app.use('/js',  express.static(path.join(FRONTEND_DIR, 'js')));
app.use('/assets', express.static(path.join(FRONTEND_DIR, 'assets')));
app.use('/public', express.static(path.join(FRONTEND_DIR, 'public')));
app.get('/', (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

/* ── Swagger API dokumentasiýasy ── */
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Label Zawod API',
  swaggerOptions: { persistAuthorization: true },
}));
// Çig OpenAPI JSON
app.get('/api/docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

/* ── API marşrutlary ── */
app.use('/api', apiRouter);

/* ── 404 we global error handler ── */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
