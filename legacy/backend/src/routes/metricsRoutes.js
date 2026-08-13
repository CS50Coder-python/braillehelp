import express from 'express';

const REQUEST_TIMEOUT_MS = 5000;
const METRIC_FIELDS = ['reading_speed', 'mistakes', 'rereads'];

function isNonnegativeInteger(value) {
  return typeof value === 'number' && Number.isFinite(value) &&
    Number.isInteger(value) && value >= 0;
}

export function createMetricsRouter({ metricsFetch = globalThis.fetch } = {}) {
  const router = express.Router();

  router.post('/', express.json({ limit: '10kb' }), async (request, response) => {
    const payload = request.body;
    if (
      !payload ||
      typeof payload !== 'object' ||
      !METRIC_FIELDS.every((field) => isNonnegativeInteger(payload[field]))
    ) {
      return response.status(400).json({
        success: false,
        error: 'reading_speed, mistakes, and rereads must be nonnegative integers.'
      });
    }

    const restApiUrl = process.env.REST_API_URL || 'http://localhost:8080';
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.REST_API_WRITE_KEY) {
      headers['X-Api-Key'] = process.env.REST_API_WRITE_KEY;
    }

    try {
      const upstream = await metricsFetch(`${restApiUrl.replace(/\/$/, '')}/update`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reading_speed: payload.reading_speed,
          mistakes: payload.mistakes,
          rereads: payload.rereads
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!upstream.ok) {
        return response.status(502).json({
          success: false,
          error: 'The metrics service rejected the update.'
        });
      }

      return response.status(200).json({ success: true });
    } catch {
      return response.status(503).json({
        success: false,
        error: 'The metrics service is unavailable.'
      });
    }
  });

  return router;
}
