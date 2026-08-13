const DEFAULT_URL = 'http://127.0.0.1:8000';
const DEFAULT_TIMEOUT_MS = 30_000;

function serviceError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateResult(result) {
  if (
    !result ||
    typeof result.text !== 'string' ||
    typeof result.confidence !== 'number' ||
    result.confidence < 0 ||
    result.confidence > 1 ||
    result.brailleStandard !== 'UEB_UNCONTRACTED' ||
    !Array.isArray(result.lines) ||
    !result.lines.every((line) =>
      Number.isInteger(line?.lineIndex) && typeof line?.text === 'string'
    ) ||
    !Array.isArray(result.warnings) ||
    !result.warnings.every((warning) => typeof warning === 'string')
  ) {
    throw serviceError(502, 'The local Braille service returned an invalid result.');
  }
  return result;
}

export async function scanLocalBrailleImage(file, {
  fetchImpl = globalThis.fetch,
  serviceUrl = process.env.LOCAL_BRAILLE_SERVICE_URL || DEFAULT_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const form = new FormData();
  form.append('image', new Blob([file.buffer], { type: file.mimetype }), file.originalname);

  let response;
  try {
    response = await fetchImpl(`${serviceUrl.replace(/\/$/, '')}/scan`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw serviceError(503, 'The local Braille service timed out.');
    }
    throw serviceError(503, 'The local Braille service is unavailable.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw serviceError(502, 'The local Braille service returned an invalid response.');
  }

  if (!response.ok) {
    const upstreamMessage = typeof result?.detail === 'string' ? result.detail : null;
    if (response.status === 400 || response.status === 413 || response.status === 415) {
      throw serviceError(response.status, upstreamMessage || 'The image was rejected.');
    }
    if (response.status === 503) {
      throw serviceError(503, 'The local Braille service is unavailable.');
    }
    throw serviceError(502, 'The local Braille service failed to process the image.');
  }

  return validateResult(result);
}
