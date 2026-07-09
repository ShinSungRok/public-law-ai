# Application Configuration

## 1. Purpose

`ApplicationConfiguration` (`app/legal/config`) is the single, typed
representation of everything the application needs to start: which
environment it's running in, how it logs, and how it reaches the server,
database, search engine, and AI provider. It exists so that runtime
components (the HTTP adapter, controllers, the AI provider/prompt executor)
receive their settings through composition rather than each reading
`process.env` directly.

`EnvironmentApplicationConfigurationFactory` is the single entry point for
loading configuration from environment variables — it is the only place in
the production composition path that reads `process.env`. Everything else
(`DefaultApplicationContextFactory` and the components it wires together)
receives an already-built `ApplicationConfiguration` object.

## 2. Environment variables

See `.env.example` at the project root for a copy-pasteable starting point.

| Variable | Maps to | Default | Required |
|---|---|---|---|
| `APP_ENVIRONMENT` | `environment` | `development` | No |
| `LOG_LEVEL` | `logLevel` | `info` | No |
| `SERVER_HOST` | `server.host` | `0.0.0.0` | No |
| `SERVER_PORT` | `server.port` | `3000` | No |
| `POSTGRES_HOST` | `database.host` | `localhost` | No |
| `POSTGRES_PORT` | `database.port` | `5432` | No |
| `POSTGRES_DATABASE` | `database.database` | `public_law_ai` | No |
| `POSTGRES_USERNAME` | `database.username` | `public_law_ai` | No |
| `POSTGRES_PASSWORD` | `database.password` | `""` (empty) | No |
| `OPENSEARCH_NODE_URL` | `search.nodeUrl` | `http://localhost:9200` | No |
| `OPENSEARCH_INDEX_NAME` | `search.indexName` | `public-law-ai-local` | No |
| `LLM_PROVIDER` | `ai.provider` | `fake` | No |
| `LLM_MODEL` | `ai.model` | `fake-model` | No |
| `LLM_API_KEY` | `ai.apiKey` | `fake-api-key` | Yes, for `openai`/`anthropic` (see below) |
| `LLM_TIMEOUT_MS` | `ai.timeout` | `30000` | No |
| `LLM_MAX_RETRIES` | `ai.maxRetries` | `3` | No |

`LLM_BASE_URL` is also read (maps to the optional `ai.baseUrl`) if a
provider needs a custom endpoint; it has no default and is omitted when unset.

Every default above is safe for local development out of the box — an
unconfigured environment boots with the `fake` AI provider and no real
secrets required.

## 3. Required values and the AI provider `apiKey` rule

Only `LLM_API_KEY` is conditionally required: it must be set when
`LLM_PROVIDER` is `openai` or `anthropic`. When `LLM_PROVIDER` is `fake` (the
default), `LLM_API_KEY` is not required — `EnvironmentApplicationConfigurationFactory`
falls back to a placeholder value (`fake-api-key`), and
`DefaultApplicationConfigurationValidator` allows the fake provider through
without an API key. This is what lets the whole application run and be
validated end-to-end with no external accounts or secrets.

## 4. Fake provider behavior

`LLM_PROVIDER=fake` is the default and the one used by every validation
runner in this repo (`pnpm validate:ai`, `pnpm validate:composition`, etc.).
It wires `FakeAiProvider` — a deterministic, in-memory implementation of
`AiProvider` that returns a canned response and metadata without making any
network call. This is what makes it possible to boot and exercise the whole
composition graph (`ApplicationContext`, `aiProvider`, `aiPromptExecutor`)
without external API keys or network access, both in CI and locally.

## 5. Startup validation behavior

`DefaultApplicationContextFactory.create()` builds `ApplicationConfiguration`
via `EnvironmentApplicationConfigurationFactory` and immediately passes it to
`DefaultApplicationConfigurationValidator.validate()` — before any other
runtime component (health controller, RAG controller, HTTP adapter, AI
provider) is constructed. This validation checks:

- `environment` is one of `development`, `test`, `production`.
- `logLevel` is one of `trace`, `debug`, `info`, `warn`, `error`.
- `server.host` is non-empty and `server.port` is positive.
- `database.host` is non-empty, `database.port` is positive, and
  `database.database` is non-empty.
- `search.nodeUrl` and `search.indexName` are non-empty.
- `ai.provider` exists, `ai.model` is non-empty, `ai.timeout` is positive,
  and `ai.maxRetries` is zero or positive.
- `ai.apiKey` is present when `ai.provider` is `openai` or `anthropic`.

If any check fails, `validate()` throws a single `Error` listing every
violation, and `create()` fails fast before wiring any runtime component —
an invalid deployment configuration cannot produce a partially-composed
application.

This validation intentionally lives only in `app/legal/config`. Other
layers (repository, search, embedding, retrieval, RAG, AI provider, HTTP
adapter, server runtime) do not re-validate configuration; they simply
receive already-validated values through composition.
