# Development Guide

## 1. Local development

```bash
pnpm install
pnpm dev            # Next.js dev server (http://localhost:3000)
pnpm lint           # ESLint
pnpm build          # next build, includes a full TypeScript check
```

`pnpm dev`/`pnpm build` never require PostgreSQL, OpenSearch, Docker, or a
real AI provider key: the default configuration (`LLM_PROVIDER=fake`, see
`docs/configuration.md`) boots the whole composition graph against fakes.
Copy `.env.example` to `.env` only when you want real infrastructure:

```bash
cp .env.example .env
pnpm infra:up       # local PostgreSQL + OpenSearch via Docker
```

## 2. Validation workflow

This repository has no test framework — every phase ships one or more
**validation runners**: plain `tsx` scripts under `app/legal/**/run*Validation.ts`
that assert behavior with small `assertTruthy`/`assertEqual` helpers and
throw (non-zero exit) on the first failure. Run any of them directly via
its `package.json` script, e.g.:

```bash
pnpm validate:rag:runtime-flow
pnpm validate:ai:provider
pnpm validate:security-reliability:foundation
```

Most modules also have a **milestone runner** — `pnpm validate:<module>` —
that sequences every validator in that module and additionally checks that
the module's own `package.json` scripts and docs page exist, e.g.
`pnpm validate:evaluation`, `pnpm validate:observability`, `pnpm
validate:security-reliability`. Before considering any phase complete,
its milestone runner (or, for a module with no milestone runner yet, every
individual validator) must pass.

Every validation runner uses fake or in-memory implementations only —
`FakeAiProvider`, `KeywordSearchEngine`/`KeywordRetriever`, an in-memory
`LegalDocumentRepository`, a fake `FastifyLikeServer`, injected fake
clocks/delays for time-based logic (retry, circuit breaker, rate limiter).
No validator requires PostgreSQL, OpenSearch, Docker, an OpenAI/Anthropic
API key, or a running server.

## 3. Commit strategy

- One focused commit per task, not per file. A task's commit bundles every
  file that task touched (new module files, `index.ts` export updates,
  `package.json` script, docs).
- Commit messages follow Conventional Commits (`feat(scope): ...`,
  `chore(scope): ...`, `docs(scope): ...`, `refactor(scope): ...`),
  matching `git log` in this repository.
- A **milestone commit** (`chore(<module>): complete phase N <name>`) closes
  out a phase only after its milestone validation runner passes — see
  `git log --oneline | grep "complete phase"` for every phase boundary to
  date.
- Never mark a task done, and never commit, before its required
  `pnpm lint` / `pnpm build` / `pnpm validate:*` commands all pass.

## 4. Phase strategy

Each phase:

1. Has one explicit **goal** and an explicit **non-goal list** (what it must
   not touch — e.g. "do not modify RAG business logic", "do not add
   external libraries").
2. Adds new module(s)/file(s) following the existing interface +
   implementation pattern already used throughout the codebase (see
   `docs/architecture.md` §2).
3. Ships its own validation runner(s), using only fakes/in-memory
   implementations.
4. Is documented under `docs/` before or as part of the same commit that
   closes it out.
5. Ends with a milestone validation runner (once the module has more than
   one task/validator) and a milestone commit.

Multi-task phases (e.g. Phase 19–21) typically split into: **Task 1 —
foundation** (types + in-memory implementations + their own validator),
**Task 2 — integration** (a lightweight composition object wiring the
foundation's pieces together, plus an integration validator), and a final
**milestone task** that sequences everything and confirms the phase is
complete — without ever wiring the new capability into production runtime
until a later, explicitly scoped phase decides to.

## 5. Coding principles

- **Interfaces before implementations.** Any capability with more than one
  plausible backing implementation gets an interface first
  (`Retriever`, `SearchEngine`, `AiProvider`, `RetryPolicy`, ...);
  concrete classes are named `Default*`/`InMemory*`/`Fake*` + the
  interface name, matching the existing convention.
- **Composition root owns wiring.** Only `DefaultApplicationContextFactory`
  (and, within a module, its own `Default*ServiceFactory`) is allowed to
  import multiple concrete adapters at once; business logic depends only on
  interfaces.
- **No external libraries for solved problems this repo already owns.**
  Retry/timeout/circuit-breaker, rate limiting/input validation, and
  logging/metrics/health-checks are hand-rolled and dependency-free by
  design — see `docs/security-reliability.md` and `docs/observability.md`.
- **Deterministic by default.** Time-based logic (retry delay, circuit
  breaker reset, rate-limit windows) always accepts an injectable
  clock/delay function so validation never depends on real wall-clock time.
- **Document limits, not just capabilities.** Every phase doc has a
  "Current limitations" section stating what is deliberately deferred, so
  scope boundaries stay explicit across phases instead of silently eroding.
