import OpenAI from 'openai';

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'confidence', 'brailleStandard', 'lines', 'warnings'],
  properties: {
    text: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    brailleStandard: { type: 'string', enum: ['UEB_UNCONTRACTED'] },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lineIndex', 'text'],
        properties: {
          lineIndex: { type: 'integer', minimum: 0 },
          text: { type: 'string' }
        }
      }
    },
    warnings: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

function configurationError(message) {
  const error = new Error(message);
  error.status = 503;
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
    !Array.isArray(result.warnings)
  ) {
    const error = new Error('The recognition service returned an invalid result.');
    error.status = 502;
    throw error;
  }

  return result;
}

export async function scanBrailleImage(file) {
  if (!process.env.OPENAI_API_KEY) {
    throw configurationError('OPENAI_API_KEY is not configured.');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const imageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5',
    instructions: [
      'Inspect the supplied high-contrast Braille image.',
      'Translate only visible uncontracted Unified English Braille into English.',
      'Do not claim support for contractions, math Braille, music Braille, or ordinary colorless embossed Braille.',
      'Do not guess or fabricate words. Use an empty text string if no Braille can be recognized.',
      'Add warnings for blur, bad lighting, rotation, missing areas, uncertainty, or unsupported Braille.'
    ].join(' '),
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Recognize and translate this Braille image.' },
        { type: 'input_image', image_url: imageUrl, detail: 'high' }
      ]
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'braille_scan',
        strict: true,
        schema: outputSchema
      }
    }
  });

  if (!response.output_text) {
    const error = new Error('The recognition service returned no result.');
    error.status = 502;
    throw error;
  }

  try {
    return validateResult(JSON.parse(response.output_text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      const parseError = new Error('The recognition service returned invalid JSON.');
      parseError.status = 502;
      throw parseError;
    }
    throw error;
  }
}
