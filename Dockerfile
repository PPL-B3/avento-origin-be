# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files and install all dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the entire project and build it
COPY . .
RUN pnpm run build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

# Copy package files for production install
COPY package.json pnpm-lock.yaml ./
# Install only production dependencies (make sure prisma is available if you need it at runtime)
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Copy build artifacts from the builder stage
COPY --from=builder /app/dist /app/dist

# Copy the entrypoint script into the image
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Set production environment variable and expose the app port
ENV NODE_ENV=production
EXPOSE 4000

# Use the entrypoint script as the container's entrypoint
CMD ["/app/entrypoint.sh"]
