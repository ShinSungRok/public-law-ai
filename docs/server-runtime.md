# Production Server Runtime

## 1. Purpose

`app/legal/server` provides the production entrypoint that boots the
application outside of tests and validation runners. It composes the same
`ApplicationContext` used everywhere else in the codebase — through
`DefaultApplicationContextFactory` and `ApplicationBootstrap` — and adds a
lifecycle wrapper (`ProductionServerRuntime`) plus graceful shutdown signal
handling around it.

## 2. Runtime flow

```
DefaultApplicationContextFactory
  → ApplicationBootstrap
    → ProductionServerRuntime
      → Graceful Shutdown (SIGINT / SIGTERM)
```

`app/legal/server/runProductionServer.ts` wires this together:

1. `DefaultApplicationContextFactory` is passed into a new
   `ApplicationBootstrap`.
2. `ProductionServerRuntime` wraps that `ApplicationBootstrap`.
3. `await runtime.start()` calls `bootstrap.bootstrap()`, which builds and
   validates `ApplicationConfiguration` and wires the full
   `ApplicationContext` (same validated configuration path documented in
   `docs/configuration.md`).
4. `await runtime.listen()` binds a real, socket-listening HTTP server
   (`NodeHttpFastifyLikeServer`, built on Node's built-in `http` module — no
   `fastify` dependency required) and registers every route from
   `context.httpAdapter` onto it.
5. Once `listen()` succeeds, the entrypoint reads `server.host` /
   `server.port` from `runtime.getContext().applicationConfiguration` and
   prints a startup message with the address it is actually listening on.
6. Only after a successful start does it register `SIGINT`/`SIGTERM`
   handlers. Each handler calls `runtime.stop()` (which closes the listening
   socket), prints a shutdown message, and exits with code `0`.

The entrypoint never reads `process.env` directly — configuration loading
stays isolated in `EnvironmentApplicationConfigurationFactory`, as described
in `docs/configuration.md`.

## 3. Real socket listener

`start()` and `listen()` are deliberately separate methods:

- `start()` only builds and validates the `ApplicationContext` — this is
  what the Next.js `/api/ask` route calls, since it invokes `ragController`
  directly in-process and must never bind a second listener on the port
  Next.js itself is already serving.
- `listen()` binds `NodeHttpFastifyLikeServer` to `server.host`/`server.port`
  and is only called by the standalone entrypoint (`pnpm server:start`),
  which runs the framework-independent REST API (`GET /health`,
  `POST /rag/answer`) as its own process, separate from the Next.js app.

`listen()` is idempotent (calling it twice returns the already-bound port)
and `stop()` releases the socket. This is exercised end to end — a real
socket bind, a real HTTP request, a 404 for an unregistered route, and a
release on `stop()` — by
`pnpm validate:server:listen` (`app/legal/server/runProductionServerListenValidation.ts`),
using an ephemeral port (`0`) so the check never conflicts with a port
already in use.

Every request handled through this listener also runs through
`FastifyHttpAdapter`'s observability and security/reliability wiring — see
`docs/observability.md` and `docs/security-reliability.md`.

## 4. Scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm server:start` | `tsx app/legal/server/runProductionServer.ts` | Boot the production runtime: build the validated `ApplicationContext`, bind a real socket listener, print a startup message, and register graceful shutdown handlers. |
| `pnpm validate:server:entrypoint` | `tsx app/legal/server/runProductionServerEntrypointValidation.ts` | Statically verify the entrypoint exists, wires `DefaultApplicationContextFactory` / `ApplicationBootstrap`, and never reads `process.env` directly. |
| `pnpm validate:server:lifecycle` | `tsx app/legal/server/runServerRuntimeLifecycleValidation.ts` | Verify `ServerRuntime` / `ProductionServerRuntime` exist, expose `start()`/`stop()`, and that `start()` is idempotent. |
| `pnpm validate:server:shutdown` | `tsx app/legal/server/runGracefulShutdownValidation.ts` | Verify `SIGINT`/`SIGTERM` are registered, `runtime.stop()` is called on shutdown, and that `await runtime.start()` happens before `runtime.getContext()` and before shutdown handlers are registered. |
| `pnpm validate:server:listen` | `tsx app/legal/server/runProductionServerListenValidation.ts` | Bind a real socket on an ephemeral port, make real HTTP requests against it (200 for `/health`, 404 for an unknown route), confirm `listen()` is idempotent, and confirm `stop()` releases the socket. |
| `pnpm validate:server` | `tsx app/legal/server/runServerRuntimeValidation.ts` | Milestone runner: runs the four validations above plus checks on required `package.json` scripts and the absence of direct `process.env` access across the server runtime files. |

## 5. Typical workflow

```bash
pnpm validate:server   # run the full server runtime validation suite
pnpm server:start      # boot the production runtime locally and start listening
```
