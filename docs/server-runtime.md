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
4. Once `start()` succeeds, the entrypoint reads `server.host` /
   `server.port` from `runtime.getContext().applicationConfiguration` and
   prints a startup message.
5. Only after a successful start does it register `SIGINT`/`SIGTERM`
   handlers. Each handler calls `runtime.stop()`, prints a shutdown message,
   and exits with code `0`.

The entrypoint never reads `process.env` directly — configuration loading
stays isolated in `EnvironmentApplicationConfigurationFactory`, as described
in `docs/configuration.md`.

## 3. Current limitation: no socket-bound HTTP server yet

`ProductionServerRuntime.start()` composes the `ApplicationContext` (routes,
controllers, the AI provider, etc.) but does not yet bind a real TCP socket
or invoke a Fastify (or Fastify-like) listener. `FastifyHttpAdapter` can
register the application's routes onto any `FastifyLikeServer`, but no
concrete, network-bound implementation of that interface has been wired into
the production entrypoint yet — today it is exercised only by the fake
servers in the validation runners (e.g.
`app/legal/composition/runApplicationRuntimeValidation.ts`).

In practice this means running `pnpm server:start` today boots and validates
the full composition graph and prints the startup message, but the process
does not keep listening for HTTP traffic and exits once `main()` completes
(unless a signal is delivered first). Wiring an actual listener is expected
in a later phase.

## 4. Scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm server:start` | `tsx app/legal/server/runProductionServer.ts` | Boot the production runtime: build the validated `ApplicationContext`, print a startup message, and register graceful shutdown handlers. |
| `pnpm validate:server:entrypoint` | `tsx app/legal/server/runProductionServerEntrypointValidation.ts` | Statically verify the entrypoint exists, wires `DefaultApplicationContextFactory` / `ApplicationBootstrap`, and never reads `process.env` directly. |
| `pnpm validate:server:lifecycle` | `tsx app/legal/server/runServerRuntimeLifecycleValidation.ts` | Verify `ServerRuntime` / `ProductionServerRuntime` exist, expose `start()`/`stop()`, and that `start()` is idempotent. |
| `pnpm validate:server:shutdown` | `tsx app/legal/server/runGracefulShutdownValidation.ts` | Verify `SIGINT`/`SIGTERM` are registered, `runtime.stop()` is called on shutdown, and that `await runtime.start()` happens before `runtime.getContext()` and before shutdown handlers are registered. |
| `pnpm validate:server` | `tsx app/legal/server/runServerRuntimeValidation.ts` | Milestone runner: runs the three validations above plus checks on required `package.json` scripts and the absence of direct `process.env` access across the server runtime files. |

## 5. Typical workflow

```bash
pnpm validate:server   # run the full server runtime validation suite
pnpm server:start      # boot the production runtime locally
```
