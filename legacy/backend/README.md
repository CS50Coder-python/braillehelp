# Braille image API

This MVP accepts high-contrast images of uncontracted Unified English Braille (UEB) and uses the OpenAI Responses API to return recognized English text. It does not claim support for advanced contractions, math or music Braille, or reliable recognition of ordinary colorless embossed Braille.

## Requirements

- Node.js 20 or newer
- npm
- An OpenAI API key

## Install and configure

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and manually replace `replace_with_your_key` with your OpenAI API key. Never put the key in the frontend or commit the `.env` file.

The default frontend origin is `http://localhost:5173`, and the default backend port is `3000`.

## Run

```bash
npm run dev
```

For a non-watching process, use `npm start`. Run the automated tests with `npm test`; they mock recognition and never make a paid OpenAI request.

## Test health

With the backend running:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{"success":true,"message":"Braille API is running"}
```

## Scan an image

Send one PNG, JPEG, or WebP file (maximum 10 MB) in the multipart field named `image`:

```bash
curl -X POST http://localhost:3000/api/braille/scan \
  -F "image=@/path/to/braille.png"
```

Uploaded images remain in memory only and are discarded after the request.
