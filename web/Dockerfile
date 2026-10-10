FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.12.2

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

EXPOSE 3000

CMD ["pnpm", "dev", "--host"]
