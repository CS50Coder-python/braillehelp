const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: true },
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000
});

// Crash-prevention: pg emits 'error' on idle clients (e.g. dropped connections).
// Left unhandled, this event throws and kills the whole process.
pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
});

const WRITE_API_KEY = process.env.API_WRITE_KEY || null;
if (!WRITE_API_KEY) {
    console.warn('[WARN] API_WRITE_KEY is not set — POST /update is unauthenticated.');
}

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const DEFAULT_DAILY_QUESTION = {
    id: 'question-1',
    question: 'Which part of the page did the student revisit most often?',
    body: 'Look for clusters of backtracking and relate them to the row or line where reading slowed down.',
    answerHint: 'Repeated pauses usually point to a harder line or an unfamiliar symbol.',
    updated_at: null
};

let currentDailyQuestion = DEFAULT_DAILY_QUESTION;

function normalizeDailyQuestionPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return DEFAULT_DAILY_QUESTION;
    }

    const record = payload;
    const question = typeof record.question === 'string' && record.question.trim() ? record.question.trim() : DEFAULT_DAILY_QUESTION.question;
    const body = typeof record.body === 'string' && record.body.trim() ? record.body.trim() : DEFAULT_DAILY_QUESTION.body;

    return {
        id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `${question}-${body}`,
        question,
        body,
        answerHint: typeof record.answerHint === 'string' && record.answerHint.trim() ? record.answerHint.trim() : undefined,
        updated_at: typeof record.updated_at === 'string' && record.updated_at.trim() ? record.updated_at.trim() : new Date().toISOString()
    };
}

// ---- Very small in-memory fixed-window rate limiter (per IP) ----
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateBuckets = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateBuckets.set(ip, { count: 1, windowStart: now });
        return false;
    }
    bucket.count += 1;
    return bucket.count > RATE_LIMIT_MAX;
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of rateBuckets) {
        if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) rateBuckets.delete(ip);
    }
}, RATE_LIMIT_WINDOW_MS).unref();

// ---- SSE client registry ----
const sseClients = new Set();
const MAX_SSE_CLIENTS = 200;

const getBody = (req, maxBytes = 100 * 1024) => {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;

        req.on('data', chunk => {
            size += chunk.length;
            if (size > maxBytes) {
                req.destroy();
                reject(new Error('PAYLOAD_TOO_LARGE'));
            } else {
                body += chunk.toString();
            }
        });

        req.on('end', () => resolve(body));
        req.on('error', (err) => reject(err));
    });
};

const sendJson = (res, statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

const broadcastData = (data) => {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch (err) {
            console.error('SSE write failed, dropping client:', err.message);
            sseClients.delete(client);
        }
    }
};

setInterval(() => {
    for (const client of sseClients) {
        try {
            client.write(': heartbeat\n\n');
        } catch {
            sseClients.delete(client);
        }
    }
}, 15_000).unref();

function isValidNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
}

function getClientIp(req) {
    return req.socket.remoteAddress || 'unknown';
}

function isTransientConnectionError(err) {
    return err.message?.includes('Connection terminated') ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT';
}

async function queryWithRetry(sql, params) {
    try {
        return await pool.query(sql, params);
    } catch (e) {
        if (!isTransientConnectionError(e)) throw e;
        console.warn('Transient DB connection error, retrying once:', e.message);
        return await pool.query(sql, params);
    }
}

const routes = {
    'GET /': (req, res) => {
        sendJson(res, 200, { status: 'ok' });
    },

    'GET /data': async (req, res) => {
        try {
            const result = await queryWithRetry(
                'SELECT reading_speed, mistakes, rereads, COALESCE(word_count, 0) AS word_count, COALESCE(mistake_ratio, 0) AS mistake_ratio, duration, created_at FROM ai_data ORDER BY created_at DESC LIMIT 1'
            );
            const fallback = { reading_speed: 0, mistakes: 0, rereads: 0, word_count: 0, mistake_ratio: 0, duration: '00:00', created_at: null };
            sendJson(res, 200, result.rows[0] || fallback);
        } catch (err) {
            console.error('DB error:', err);
            sendJson(res, 500, { error: 'Internal Server Error' });
        }
    },

    'GET /daily-question': async (_req, res) => {
        sendJson(res, 200, currentDailyQuestion);
    },

    'POST /daily-question': async (req, res) => {
        let rawBody;

        try {
            rawBody = await getBody(req);
        } catch (e) {
            if (e.message === 'PAYLOAD_TOO_LARGE') {
                return sendJson(res, 413, { error: 'Payload size exceeds limit' });
            }
            console.error('Body read error:', e);
            return sendJson(res, 400, { error: 'Failed to read request body' });
        }

        let body;

        try {
            body = JSON.parse(rawBody);
        } catch (e) {
            return sendJson(res, 400, { error: 'Invalid JSON payload' });
        }

        currentDailyQuestion = normalizeDailyQuestionPayload(body);
        sendJson(res, 201, { message: 'Daily question updated successfully', data: currentDailyQuestion });
    },

    'POST /update': async (req, res) => {
        if (WRITE_API_KEY && req.headers['x-api-key'] !== WRITE_API_KEY) {
            return sendJson(res, 401, { error: 'Unauthorized' });
        }

        const ip = getClientIp(req);
        if (isRateLimited(ip)) {
            return sendJson(res, 429, { error: 'Too many requests' });
        }

        let rawBody;
        try {
            rawBody = await getBody(req);
        } catch (e) {
            if (e.message === 'PAYLOAD_TOO_LARGE') {
                return sendJson(res, 413, { error: 'Payload size exceeds limit' });
            }
            console.error('Body read error:', e);
            return sendJson(res, 400, { error: 'Failed to read request body' });
        }

        let body;
        try {
            body = JSON.parse(rawBody);
        } catch (e) {
            return sendJson(res, 400, { error: 'Invalid JSON payload' });
        }

        const numericFieldsValid = [body.reading_speed, body.mistakes, body.rereads, body.mistake_ratio].every(isValidNumber);
        const wordCountValid = isValidNumber(body.word_count) && Number.isInteger(body.word_count);

        if (!numericFieldsValid || !wordCountValid || !isValidInterval(body.duration)) {
            console.error('Rejected payload — raw body:', rawBody);
            return sendJson(res, 400, { error: 'Invalid data format. Expected finite numbers (word_count must be an integer). And valid duration (MM:SS).' });
        }

        const readingSpeed = Math.round(Number(body.reading_speed));
        const mistakes = Math.round(Number(body.mistakes));
        const rereads = Math.round(Number(body.rereads));
        const wordCount = Math.round(Number(body.word_count));
        const mistakeRatio = Number(body.mistake_ratio);
        const duration = body.duration;
        
        try {
            const result = await queryWithRetry(
                'INSERT INTO ai_data (reading_speed, mistakes, rereads, word_count, mistake_ratio, duration) VALUES ($1, $2, $3, $4, $5, $6) RETURNING reading_speed, mistakes, rereads, word_count, mistake_ratio, duration, created_at',
                [readingSpeed, mistakes, rereads, wordCount, mistakeRatio, duration]
            );

            const newData = result.rows[0];
            broadcastData(newData);
            sendJson(res, 201, { message: 'Data saved successfully', data: newData });
        } catch (e) {
            console.error('DB error on /update:', e);
            sendJson(res, 500, { error: 'Internal Server Error' });
        }
    },

    'GET /events': (req, res) => {
        if (sseClients.size >= MAX_SSE_CLIENTS) {
            return sendJson(res, 503, { error: 'Too many active connections' });
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
            'X-Accel-Buffering': 'no'
        });

        res.write('retry: 3000\n\n');
        res.write(': connected\n\n');
        sseClients.add(res);

        req.on('close', () => {
            sseClients.delete(res);
        });
    }
};

function isValidInterval(str) {
    if (typeof str !== 'string') return false;
    const verboseRegex = /^(\d+\s*(minutes?|mins?))?\s*(\d+\s*(seconds?|secs?))?$/i;
    const colonRegex = /^\d{1,2}:\d{2}$/;
    return (verboseRegex.test(str.trim()) || colonRegex.test(str.trim())) && str.trim() !== "";
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url, `http://${host}`);
    const routeKey = `${req.method} ${parsedUrl.pathname}`;

    if (routes[routeKey]) {
        await routes[routeKey](req, res);
    } else {
        sendJson(res, 404, { error: 'Route Not Found' });
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running. process.env.PORT="${process.env.PORT}", bound to ${PORT}`));

function shutdown(signal) {
    console.log(`${signal} received, shutting down...`);
    for (const client of sseClients) {
        try { client.end(); } catch { /* already closed */ }
    }
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));