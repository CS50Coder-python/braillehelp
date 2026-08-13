import { scanBrailleImage } from '../services/brailleService.js';

export function createBrailleController({ scanService, localFetch } = {}) {
  const recognize = scanService || ((file) =>
    scanBrailleImage(file, localFetch ? { fetchImpl: localFetch } : {}));

  return {
    scan: async (request, response, next) => {
      try {
        if (!request.file) {
          return response.status(400).json({ success: false, error: 'An image file is required.' });
        }

        if (!request.file.buffer?.length) {
          return response.status(400).json({ success: false, error: 'The image file is empty.' });
        }

        const result = await recognize(request.file);
        return response.json({ success: true, ...result });
      } catch (error) {
        return next(error);
      }
    }
  };
}
