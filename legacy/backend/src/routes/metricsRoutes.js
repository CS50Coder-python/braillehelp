import express from 'express';

const REQUEST_TIMEOUT_MS = 5000;
const INTEGER_METRIC_FIELDS = ['reading_speed', 'mistakes', 'rereads', 'word_count'];
const RATIO_FIELD = 'mistake_ratio';

function isNonnegativeInteger(value) {
  return typeof value === 'number' && Number.isFinite(value) &&
    Number.isInteger(value) && value >= 0;
}

function isNonnegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidDuration(value) {
  return typeof value === 'string' && /^\d{1,2}:[0-5]\d$/.test(value);
}

export function createMetricsRouter({ metricsFetch = globalThis.fetch } = {}) {
  const router = express.Router();

  router.post('/', express.json({ limit: '10kb' }), async (request, response) => {
    const payload = request.body;
    if (
      !payload ||
      typeof payload !== 'object' ||
      !INTEGER_METRIC_FIELDS.every((field) => isNonnegativeInteger(payload[field])) ||
      !isNonnegativeNumber(payload[RATIO_FIELD]) ||
      !isValidDuration(payload.duration)
    ) {
      return response.status(400).json({
        success: false,
        error: 'reading_speed, mistakes, rereads, and word_count must be nonnegative integers; mistake_ratio must be nonnegative; duration must use MM:SS.'
      });
    }

    const restApiUrl = process.env.REST_API_URL || 'http://localhost:8080';
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.REST_API_WRITE_KEY) {
      headers['X-Api-Key'] = process.env.REST_API_WRITE_KEY;
    }

    const upstreamPayload = {
      reading_speed: payload.reading_speed,
      mistakes: payload.mistakes,
      rereads: payload.rereads,
      word_count: payload.word_count,
      mistake_ratio: payload.mistake_ratio,
      duration: payload.duration
    };

    try {
      const upstream = await metricsFetch(`${restApiUrl.replace(/\/$/, '')}/update`, {
        method: 'POST',
        headers,
        body: JSON.stringify(upstreamPayload),
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
