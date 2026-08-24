# Build Stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Keep only runtime dependencies for the production image
RUN npm prune --omit=dev

# Production Stage
FROM node:24-alpine

WORKDIR /app

# Production safeguards (required secrets are validated by server/config/auth.js)
ENV NODE_ENV=production

# Copy built assets and server code from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Keep application code root-owned and read-only to the runtime user, while
# granting write access only to the persistent-data mount points.
RUN chown -R root:node /app/server \
  && chmod -R u=rwX,g=rX,o= /app/server \
  && mkdir -p server/data server/uploads \
  && chown -R node:node /app/server/data /app/server/uploads

# Expose port
EXPOSE 4000

# Runtime health check for orchestrators and deployment verification
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

# The official Node image provides this unprivileged runtime user (uid/gid 1000).
USER node

# Run one foreground process; Docker is responsible for restart and signal handling.
CMD ["node", "server/index.js"]
