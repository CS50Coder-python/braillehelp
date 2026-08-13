import { Router } from 'express';
import multer from 'multer';
import { createBrailleController } from '../controllers/brailleController.js';

const acceptedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!acceptedTypes.has(file.mimetype)) {
      const error = new Error('Unsupported image type. Use PNG, JPEG, or WebP.');
      error.status = 415;
      callback(error);
      return;
    }
    callback(null, true);
  }
});

export function createBrailleRouter(options = {}) {
  const router = Router();
  const controller = createBrailleController(options);

  router.post('/scan', upload.single('image'), controller.scan);

  return router;
}
