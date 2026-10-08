# Roadmap

`trickle-react` is the React adoption layer over the streaming structured-output
suite. The 0.1 milestones are done; post-1.0 ideas and known trade-offs follow.

## Shipped (0.1)

- **M0 — Validate & name, scope frameworks.** npm name, single React package
  (Vue as a future `/vue` subpath), competitor scan, doc-driven API.
- **M1 — Core hook.** `useStreamingObject(schema, startStream)` → `{ data, status, done, error, abort }`,
  on `useSyncExternalStore` (no tearing, React 18+), aborts on unmount / `deps` change.
- **M2 — Per-field status + lists.** `status.field` readiness derived from the
  partial; `useStreamingList(path)` for array rows.
- **M3 — Provider glue + tool calls.** `openAIContent` / `anthropicText` / `fromSSE`
  adapters; `useToolCalls()` on trickle-json's `streamOpenAIToolCalls`.
- **M4 — Tests & size.** Unit + React Testing Library tests (progressive renders,
  per-field status, abort-on-unmount, error states, lists, tool calls); size-limit gate.
- **M5 — Docs, CI, release.** ESM + CJS + types; CI matrix (Node 18/20/22) + Bun
  smoke; npm provenance; README with the full-suite composition; launch post.

## Post-1.0 ideas

- `trickle-react/vue` and Svelte adapters (same core).
- A full runnable example app + recorded gif for the README and launch.
- Richer per-field status (settled vs. in-progress) using trickle-json path events.
- First-class `coerce-json` integration for lenient final validation (opt-in).
- `useToolCalls` beyond OpenAI shape (Anthropic tool input, generic).
- Suspense / `use()` integration and retry/stale handling.

## Known trade-offs

- **Status heuristic.** `status.field` is key-order based: the last field present
  while streaming is treated as still-filling. It's conservative, not exact.
- **Tool calls are OpenAI-shaped** (via trickle-json). Other providers can be
  adapted with the provider glue + `useStreamingObject`.
- **`startStream` identity.** The stream re-opens only when `deps` change (not on
  every render), matching data-fetching conventions.
