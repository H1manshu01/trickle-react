# Competitor scan

How `trickle-react` compares to other ways of streaming a structured object into
a React UI, as of early 2026. The gap it fills: **provider-agnostic**, works with
**any stream source**, gives **per-field loading status** and **typed partials**,
and is built on a small reusable suite rather than a framework.

## Vercel AI SDK — `useObject` / `experimental_useObject`

The closest option. Streams a partial object typed from a Zod schema and
re-renders as it fills in. But it is designed around the AI SDK: you wire it to
an AI SDK route handler (`streamObject`) and its transport, so it is most natural
inside that ecosystem rather than against an arbitrary stream or provider. It
exposes the partial object but **not per-field readiness** — you can't cheaply
tell which fields are settled vs. still streaming. `trickle-react` takes any
`startStream` (including the AI SDK's) and adds `status.field`.

## Hashbrown

A toolkit for building generative UI with structured output; its streaming JSON
parsing (`useJsonParser`-style) powers progressive rendering. It is broader and
more opinionated (Angular-first, with React support), and streaming-object
rendering is one feature of a larger framework. `trickle-react` is a focused,
unopinionated hook you drop into any React app, with per-field status and a tiny
footprint.

## TanStack AI

Early, framework-spanning AI primitives. Useful for chat/completion flows, but
streaming a *typed partial object with per-field status* is not its focus, and
it carries more surface area. `trickle-react` stays small and single-purpose.

## Hand-rolled (`fetch` + `JSON.parse` in `useEffect`)

The default today: buffer chunks, try to parse, catch the errors, re-render,
abort on unmount. It works until you need partial parsing that never throws,
per-field status, tearing-free concurrent rendering, and clean cancellation —
which is exactly the boilerplate `trickle-react` removes.

## Summary

| | provider-agnostic | any stream source | per-field status | typed partials | tiny / low lock-in |
|---|:---:|:---:|:---:|:---:|:---:|
| **trickle-react** | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vercel AI SDK `useObject` | ⚠️ AI SDK | ⚠️ | — | ✅ | — |
| Hashbrown | ⚠️ | ⚠️ | — | ⚠️ | — |
| TanStack AI | ⚠️ | ⚠️ | — | ⚠️ | ⚠️ |
| hand-rolled | ✅ | ✅ | — | — | — |

> Third-party capabilities move quickly; the notes above are a point-in-time read
> (early 2026). Where unsure of a specific detail, the claim is kept general.
