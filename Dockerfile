FROM node:25-bookworm-slim AS deps

WORKDIR /app

RUN npm install -g pnpm@11.7.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm run build

FROM node:25-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV DATABASE_PATH=/app/data/transfer-station.sqlite

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules

COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts ./scripts
COPY tsconfig.json ./tsconfig.json

RUN mkdir -p /app/data

EXPOSE 8787

CMD ["./node_modules/.bin/tsx", "server/index.ts"]
