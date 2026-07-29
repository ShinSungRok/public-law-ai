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

# Trust the org root CA before any network call in this stage: apk's own
# fetch from the Alpine mirror goes through a TLS-inspecting corporate
# proxy, so the base image's stock CA bundle isn't enough to fetch the
# ca-certificates package in the first place. Append it to the CA bundle
# that already ships in the base image ahead of installing the package
# that will properly manage it afterwards.
COPY certs/company-root-ca.crt \
  /usr/local/share/ca-certificates/company-root-ca.crt
RUN cat /usr/local/share/ca-certificates/company-root-ca.crt \
  >> /etc/ssl/certs/ca-certificates.crt

# Install system CA tools.
RUN apk add --no-cache ca-certificates

RUN update-ca-certificates

# Explicitly allow Node.js to trust the additional CA.
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/company-root-ca.crt

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
