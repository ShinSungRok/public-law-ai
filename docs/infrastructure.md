# Local Infrastructure

## 1. Purpose

`docker-compose.yml` at the project root provides the local infrastructure
the application depends on outside of the Next.js process itself: PostgreSQL
and OpenSearch (plus OpenSearch Dashboards for local inspection). It does
**not** run the application server — the app is still started with
`pnpm dev` / `pnpm start` outside of Docker.

## 2. Services

| Service | Container name | Port(s) | Volume |
|---|---|---|---|
| `postgres` | `public-ai-postgres` | `5432` | `postgres-data` |
| `opensearch` | `public-ai-opensearch` | `9200`, `9600` | `opensearch-data` |
| `opensearch-dashboards` | `public-law-ai-opensearch-dashboards` | `5601` | — |

All services share the `public-ai-network` bridge network. `postgres` and
`opensearch` each define a `healthcheck` so `docker compose ps` reports
readiness, not just process liveness.

`postgres` reads `POSTGRES_DATABASE` / `POSTGRES_USER` / `POSTGRES_PASSWORD`
from your `.env` file (see `.env.example` and `docs/configuration.md`).
`opensearch` reads `OPENSEARCH_PASSWORD`; `opensearch-dashboards` reads
`OPENSEARCH_NODE`.

## 3. Lifecycle scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm infra:config` | `docker compose config` | Validate and print the fully resolved compose configuration. |
| `pnpm infra:up` | `docker compose up -d` | Start postgres/opensearch/opensearch-dashboards in the background. |
| `pnpm infra:down` | `docker compose down` | Stop and remove the containers (named volumes persist). |
| `pnpm infra:logs` | `docker compose logs -f` | Follow logs from all compose services. |
| `pnpm infra:ps` | `docker compose ps` | Show the status of the compose services, including healthcheck state. |

These scripts require the Docker daemon to be running locally; they are not
exercised by `pnpm validate:infra:local`, which statically parses
`docker-compose.yml` and needs no Docker daemon (see
`app/legal/infra/runLocalInfrastructureValidation.ts`).

## 4. Typical workflow

```bash
cp .env.example .env   # fill in real values as needed; fake AI provider needs none
pnpm infra:up
pnpm infra:ps
pnpm infra:logs
pnpm infra:down
```
