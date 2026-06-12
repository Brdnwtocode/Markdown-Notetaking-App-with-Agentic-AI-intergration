# Stage 1: Build the app
FROM node:18-slim AS builder
WORKDIR /app

# Install openssl and other required system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Set build-time dummy variables for Prisma schema validation
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Install dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

# Build the Next.js application
RUN npm run build


# Stage 2: Run the app
FROM node:18-slim AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install openssl in runner stage so Prisma engine can run at startup
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and prisma schema
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Install only production dependencies and regenerate prisma
RUN npm ci --only=production && npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/tsconfig.json ./

# Expose Next.js port
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Command to run database sync and start server
CMD npx prisma db push && npm run start
