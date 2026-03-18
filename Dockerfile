# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Install deps (including dev for build)
COPY eidolon/agent/package*.json ./
RUN npm ci

# Copy source
COPY eidolon/agent/tsconfig.json ./
COPY eidolon/agent/src ./src
COPY eidolon/agent/.env.example ./

# Build
RUN npm run build

# Runtime
FROM node:18-alpine AS runtime

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nodeuser

# Copy built artifacts
COPY --from=builder --chown=nodeuser:nodejs /app/package*.json ./
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/.env.example .env.example
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Create data directory for x402 persistence
RUN mkdir -p /app/data && chown nodeuser:nodejs /app/data

# Copy public assets (dashboard)
COPY --chown=nodeuser:nodejs eidolon/agent/public ./public

# Copy OpenClaw agent skills (needed for ethskills, image-hosting, etc.)
COPY --chown=nodeuser:nodejs ./.agents ./../.agents

USER nodeuser

EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

CMD ["node", "dist/index.js"]
