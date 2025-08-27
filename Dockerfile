# Use Bun as the base image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN bun run build

# Create a non-root user
# RUN addgroup nodejs
# RUN adduser -D nodejs -u 1001

# Create config directory
# RUN mkdir -p /home/nodejs/.config/fosscode

# Switch to non-root user
# USER nodejs

# Expose any ports if needed (not needed for CLI)
# EXPOSE 3000

# Set the entrypoint to allow passing commands
ENTRYPOINT ["bun", "run", "src/index.ts"]
CMD ["--help"]