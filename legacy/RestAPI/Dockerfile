# official Node LTS, slim-версия for less weight
FROM node:20-slim

WORKDIR /app

# copying only for now package*.json, for docker to cache layer with dependencies and not reinstalling those because code got edited
COPY package*.json ./
RUN npm ci --omit=dev

# Now the rest
COPY . .

# Listening that one (it MUST be the same as PORT from .env)
EXPOSE 8080

# .env doesn't go to the image (because of .dockerignore config) —
# use --env-file or docker compose intead
CMD ["node", "server.js"]