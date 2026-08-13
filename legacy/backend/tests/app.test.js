import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

const originalApiKey = process.env.OPENAI_API_KEY;
const originalBrailleProvider = process.env.BRAILLE_PROVIDER;
const originalLocalBrailleServiceUrl = process.env.LOCAL_BRAILLE_SERVICE_URL;
const originalRestApiUrl = process.env.REST_API_URL;
const originalRestApiWriteKey = process.env.REST_API_WRITE_KEY;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
  if (originalBrailleProvider === undefined) delete process.env.BRAILLE_PROVIDER;
  else process.env.BRAILLE_PROVIDER = originalBrailleProvider;
  if (originalLocalBrailleServiceUrl === undefined) delete process.env.LOCAL_BRAILLE_SERVICE_URL;
  else process.env.LOCAL_BRAILLE_SERVICE_URL = originalLocalBrailleServiceUrl;
  if (originalRestApiUrl === undefined) delete process.env.REST_API_URL;
  else process.env.REST_API_URL = originalRestApiUrl;
  if (originalRestApiWriteKey === undefined) delete process.env.REST_API_WRITE_KEY;
  else process.env.REST_API_WRITE_KEY = originalRestApiWriteKey;
});

describe('Metrics proxy', () => {
  it('forwards a valid metrics request', async () => {
    let forwarded;
    const metricsFetch = async (url, options) => {
      forwarded = { url, options };
      return { ok: true };
    };

    const response = await request(createApp({ metricsFetch }))
      .post('/api/metrics')
      .send({ reading_speed: 24, mistakes: 2, rereads: 3 });

    assert.equal(response.status, 200);
    assert.equal(forwarded.url, 'http://localhost:8080/update');
    assert.deepEqual(JSON.parse(forwarded.options.body), {
      reading_speed: 24,
      mistakes: 2,
      rereads: 3
    });
  });

  it('rejects negative values', async () => {
    const response = await request(createApp())
      .post('/api/metrics')
      .send({ reading_speed: -1, mistakes: 0, rereads: 0 });
    assert.equal(response.status, 400);
  });

  it('rejects decimal values', async () => {
    const response = await request(createApp())
      .post('/api/metrics')
      .send({ reading_speed: 1.5, mistakes: 0, rereads: 0 });
    assert.equal(response.status, 400);
  });

  it('rejects missing values', async () => {
    const response = await request(createApp())
      .post('/api/metrics')
      .send({ reading_speed: 1, mistakes: 0 });
    assert.equal(response.status, 400);
  });

  it('returns 503 when RestAPI is unavailable', async () => {
    const metricsFetch = async () => {
      throw new Error('connection refused');
    };
    const response = await request(createApp({ metricsFetch }))
      .post('/api/metrics')
      .send({ reading_speed: 1, mistakes: 0, rereads: 0 });
    assert.equal(response.status, 503);
    assert.equal(response.body.error, 'The metrics service is unavailable.');
  });

  it('adds the write key only in the backend request', async () => {
    process.env.REST_API_WRITE_KEY = 'server-only-test-key';
    let upstreamHeaders;
    const metricsFetch = async (_url, options) => {
      upstreamHeaders = options.headers;
      return { ok: true };
    };

    const response = await request(createApp({ metricsFetch }))
      .post('/api/metrics')
      .send({ reading_speed: 1, mistakes: 0, rereads: 0 });

    assert.equal(response.status, 200);
    assert.equal(upstreamHeaders['X-Api-Key'], 'server-only-test-key');
    assert.doesNotMatch(JSON.stringify(response.body), /server-only-test-key/);
  });
});

describe('Braille API', () => {
  it('reports health', async () => {
    const response = await request(createApp()).get('/api/health');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      success: true,
      message: 'Braille API is running'
    });
  });

  it('rejects a missing image', async () => {
    const response = await request(createApp()).post('/api/braille/scan');

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'An image file is required.');
  });

  it('rejects an unsupported image type', async () => {
    const response = await request(createApp())
      .post('/api/braille/scan')
      .attach('image', Buffer.from('not an image'), {
        filename: 'braille.txt',
        contentType: 'text/plain'
      });

    assert.equal(response.status, 415);
    assert.match(response.body.error, /Unsupported image type/);
  });

  it('reports a missing OpenAI API key without preventing startup', async () => {
    process.env.BRAILLE_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;
    const response = await request(createApp())
      .post('/api/braille/scan')
      .attach('image', Buffer.from('image'), {
        filename: 'braille.png',
        contentType: 'image/png'
      });

    assert.equal(response.status, 503);
    assert.equal(response.body.error, 'OPENAI_API_KEY is not configured.');
  });

  it('defaults to local and forwards the in-memory image to the Python service', async () => {
    delete process.env.BRAILLE_PROVIDER;
    process.env.LOCAL_BRAILLE_SERVICE_URL = 'http://local-ai.test';
    let forwarded;
    const localFetch = async (url, options) => {
      forwarded = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          text: 'local result',
          confidence: 0.75,
          brailleStandard: 'UEB_UNCONTRACTED',
          lines: [{ lineIndex: 0, text: 'local result' }],
          warnings: []
        })
      };
    };

    const response = await request(createApp({ localFetch }))
      .post('/api/braille/scan')
      .attach('image', Buffer.from('image bytes'), {
        filename: 'braille.webp',
        contentType: 'image/webp'
      });

    assert.equal(response.status, 200);
    assert.equal(forwarded.url, 'http://local-ai.test/scan');
    assert.equal(forwarded.options.method, 'POST');
    assert.ok(forwarded.options.body instanceof FormData);
    const forwardedImage = forwarded.options.body.get('image');
    assert.equal(forwardedImage.type, 'image/webp');
    assert.deepEqual(Buffer.from(await forwardedImage.arrayBuffer()), Buffer.from('image bytes'));
  });

  it('maps an unavailable local service to 503 without exposing details', async () => {
    const localFetch = async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:8000 secret trace');
    };
    const response = await request(createApp({ localFetch }))
      .post('/api/braille/scan')
      .attach('image', Buffer.from('image'), {
        filename: 'braille.png',
        contentType: 'image/png'
      });

    assert.equal(response.status, 503);
    assert.equal(response.body.error, 'The local Braille service is unavailable.');
    assert.doesNotMatch(JSON.stringify(response.body), /ECONNREFUSED|secret trace/);
  });

  it('maps a malformed local service response to 502', async () => {
    const localFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true })
    });
    const response = await request(createApp({ localFetch }))
      .post('/api/braille/scan')
      .attach('image', Buffer.from('image'), {
        filename: 'braille.jpeg',
        contentType: 'image/jpeg'
      });

    assert.equal(response.status, 502);
    assert.equal(response.body.error, 'The local Braille service returned an invalid result.');
  });

  it('returns a successful scan from a mocked service', async () => {
    const scanService = async () => ({
      text: 'hello',
      confidence: 0.9,
      brailleStandard: 'UEB_UNCONTRACTED',
      lines: [{ lineIndex: 0, text: 'hello' }],
      warnings: []
    });

    const response = await request(createApp({ scanService }))
      .post('/api/braille/scan')
      .attach('image', Buffer.from('image'), {
        filename: 'braille.png',
        contentType: 'image/png'
      });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      success: true,
      text: 'hello',
      confidence: 0.9,
      brailleStandard: 'UEB_UNCONTRACTED',
      lines: [{ lineIndex: 0, text: 'hello' }],
      warnings: []
    });
  });
});
