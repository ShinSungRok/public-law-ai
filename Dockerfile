# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable \
    && corepack prepare pnpm@11.10.0 --activate


# ---- Dependencies ----
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile


# ---- Build ----
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build


# ---- Runtime ----
FROM base AS runner

ENV NODE_ENV=production

# Install system CA tools.
RUN apk add --no-cache ca-certificates

# Add the organization/network root CA to Alpine's trusted CA store.
COPY certs/company-root-ca.crt \
  /usr/local/share/ca-certificates/company-root-ca.crt

RUN update-ca-certificates

# Explicitly allow Node.js to trust the additional CA.
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/company-root-ca.crt

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

COPY package.json \
  pnpm-lock.yaml \
  pnpm-workspace.yaml \
  next.config.ts \
  tsconfig.json \
  ./

EXPOSE 3000

CMD ["pnpm", "start"]
