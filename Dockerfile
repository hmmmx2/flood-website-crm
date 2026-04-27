# ─────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files only (layer cache)
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# ─────────────────────────────────────────────
# Stage 2: Build Next.js app
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args become env vars at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─────────────────────────────────────────────
# Stage 3: Minimal production runtime
# ─────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only what Next.js needs to run
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
