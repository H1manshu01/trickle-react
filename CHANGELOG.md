# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-10-08

### Added

- `useStreamingObject(schema, startStream, options?)` — a typed object that
  fills in live from a streamed JSON source, with per-field loading `status`,
  `done`, `error`, and `abort`. Built on `useSyncExternalStore` (tearing-free,
  React 18+); aborts the stream on unmount or when `deps` change.
- `useStreamingList(startStream, options?)` — stream a JSON array and render
  rows as they arrive (`path` selects the array within the object).
- `useToolCalls(startStream, options?)` — stream OpenAI tool/function calls with
  arguments parsed best-effort as they fill in (on trickle-json's
  `streamOpenAIToolCalls`).
- Provider glue: `openAIContent`, `anthropicText`, `fromSSE` — adapt an SSE
  event stream (e.g. from `sse-wire`) into the text chunks the hooks consume.
- Helpers: `computeStatus`, `selectPath`.
- ESM + CJS + `.d.ts`; `react` peer dependency; `zod` and `coerce-json` optional
  peers; built on `trickle-json`. Published with npm provenance.

[0.1.0]: https://github.com/H1manshu01/trickle-react/releases/tag/v0.1.0
