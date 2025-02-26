# Start from the official Node.js LTS image
FROM node:22-alpine AS builder

# Set working directory inside container
WORKDIR /app

# Copy package.json and lockfile
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy the entire project
COPY . .

# Generate Prisma client
RUN pnpx prisma generate

# Build NestJS application
RUN pnpm build

# Start a new lightweight production image
FROM node:22-alpine AS runner

# Set working directory inside container
WORKDIR /app

# Copy only necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install PNPM in the runner container
RUN npm install -g pnpm

# Set environment variables
ENV NODE_ENV=production

# Expose the application port
EXPOSE 4000

# Run database migrations before starting the app
CMD ["sh", "-c", "pnpm db:dev:restart && pnpx prisma migrate deploy && node dist/src/main.js"]
