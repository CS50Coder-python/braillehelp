import cors from 'cors';
import express from 'express';
import { createBrailleRouter } from './routes/brailleRoutes.js';
import { createMetricsRouter } from './routes/metricsRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(options = {}) {
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
  }));

  app.get('/api/health', (_request, response) => {
    response.json({
      success: true,
      message: 'Braille API is running'
    });
  });

  app.use('/api/braille', createBrailleRouter(options));
  app.use('/api/metrics', createMetricsRouter(options));
  app.use(errorHandler);

  return app;
}
