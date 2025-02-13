# Use a Node.js base image
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the entire project (including the prisma folder)
COPY . .

# Build the NestJS application (this should output your build files to the dist/ directory)
RUN pnpm run build

# Expose the port (adjust if your app uses a different one)
EXPOSE 4000

# Run Prisma migrations and then start the application
CMD ["sh", "-c", "pnpx prisma migrate deploy && node dist/src/main.js"]
