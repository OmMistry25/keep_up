FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy only the files needed for install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/ingestion/package.json ./apps/ingestion/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile --filter ingestion

# Copy ingestion source
COPY apps/ingestion/ ./apps/ingestion/

# Build
RUN pnpm --filter ingestion build

EXPOSE 3001

CMD ["node", "apps/ingestion/dist/index.js"]
