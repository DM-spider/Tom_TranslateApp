FROM node:20-alpine AS base

RUN corepack enable

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json ./packages/web/package.json
COPY shared/package.json ./shared/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api.tomtranslate.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web ./packages/web
COPY shared ./shared

RUN pnpm --filter web build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static

EXPOSE 3000

CMD ["node", "server.js"]