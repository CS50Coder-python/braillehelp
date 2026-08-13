import multer from 'multer';

export function errorHandler(error, _request, response, _next) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({
      success: false,
      error: 'Image is too large. The maximum size is 10 MB.'
    });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  const message = status >= 500 && !error.status
    ? 'An unexpected server error occurred.'
    : error.message;

  return response.status(status).json({ success: false, error: message });
}
