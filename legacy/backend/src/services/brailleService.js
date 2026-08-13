import { scanLocalBrailleImage } from './localBrailleService.js';
import { scanBrailleImage as scanOpenAIBrailleImage } from './openaiBrailleService.js';

export async function scanBrailleImage(file, options = {}) {
  const provider = (process.env.BRAILLE_PROVIDER || 'local').toLowerCase();
  if (provider === 'local') {
    return scanLocalBrailleImage(file, options);
  }
  if (provider === 'openai') {
    return scanOpenAIBrailleImage(file);
  }

  const error = new Error('BRAILLE_PROVIDER must be either "local" or "openai".');
  error.status = 503;
  throw error;
}
