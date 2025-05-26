# syntax=docker/dockerfile:1.4

########## Builder Stage ##########
FROM node:22-alpine as builder

# Set working directory
WORKDIR /app

# Copy package manifests and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@latest \
    && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client, build application, then prune dev dependencies
RUN pnpx prisma generate \
    && pnpm build \
    && pnpm prune --prod

########## Runner Stage ##########
FROM node:22-alpine as runner

# Working directory
WORKDIR /app

# Copy only necessary files from the builder stage.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install PNPM in the runner container.
RUN npm install -g pnpm

# Ensure application files are immutable (owned by root, not writable)
RUN chmod -R -w /app

# Create non-root user
RUN addgroup -S app \
    && adduser -S app -G app
USER app

# Set environment to production
ENV NODE_ENV=production

# Expose HTTP port
EXPOSE 4000

# Healthcheck for orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/hello || exit 1

# Start migrations and then the app
CMD ["sh", "-c", "pnpx prisma migrate deploy && node dist/src/main.js"]
