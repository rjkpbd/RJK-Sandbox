FROM node:22-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/home
COPY home/package.json home/package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/home/node_modules ./home/node_modules
COPY home/ ./home/
COPY shared/ ./shared/
WORKDIR /app/home
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/home/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/home/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/home/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
