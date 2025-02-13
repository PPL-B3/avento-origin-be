# Stage 1: Build
FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the NestJS application (make sure your package.json has a build script, e.g., "build": "nest build")
RUN pnpm run build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

# Install pnpm globally (optional if you need it at runtime)
RUN npm install -g pnpm

# Copy only the built files and package.json (if needed for production configuration)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Set NODE_ENV to production
ENV NODE_ENV=production

# Expose the port your app listens on (default NestJS port is 3000)
EXPOSE 4000

# Start the application
CMD ["node", "dist/src/main.js"]
