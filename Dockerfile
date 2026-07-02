# OpenWA - Dockerfile simplificado para Render
# Multi-stage build

# ===== Stage 1: Builder =====
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && npm run dashboard:ci -- --include=dev && npm run dashboard:build

# ===== Stage 2: Production =====
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y \
    chromium fonts-liberation libappindicator3-1 libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 \
    libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 \
    libxdamage1 libxrandr2 xdg-utils dumb-init gosu curl procps \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN groupadd -r openwa && useradd -r -g openwa openwa

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dashboard/dist ./dashboard/dist
COPY bot.cjs ./

RUN mkdir -p ./data/sessions ./data/media && chown -R openwa:openwa /app

ENV HOME=/app/data
ENV XDG_CONFIG_HOME=/tmp/.config
ENV XDG_CACHE_HOME=/tmp/.cache

EXPOSE 2785

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:2785/api/health || exit 1

USER openwa

CMD ["sh", "-c", "node dist/main.js & sleep 10 && node bot.cjs"]
