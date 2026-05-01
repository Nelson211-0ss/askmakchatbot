FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY backend ./backend
COPY frontend/public ./frontend/public

ENV NODE_ENV=production
EXPOSE 4500

CMD ["node", "backend/server.js"]
