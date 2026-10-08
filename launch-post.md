---
title: "Stream an LLM object into React, field by field — in one hook"
published: true
description: "Streaming a structured object into a UI means parsing JSON that's broken until the last token, then knowing which fields are done. Here's trickle-react — one typed hook that fills your object in live with per-field loading status — and the four tiny zero-dep packages behind it."
tags: react, typescript, ai, opensource
series: "Streaming structured output"
cover_image: https://raw.githubusercontent.com/H1manshu01/trickle-react/main/assets/cover.png
canonical_url: https://dev.to/h1manshu01/stream-an-llm-object-into-react-field-by-field-in-one-hook-43jp
---

You asked the model for a JSON object and set `stream: true` so the UI can fill
in as it arrives. Now you're in the usual mess:

```tsx
useEffect(() => {
  const ctrl = new AbortController();
  (async () => {
    let buf = "";
    for await (const chunk of stream(ctrl.signal)) {
      buf += chunk;
      try {
        setData(JSON.parse(buf)); // 💥 throws on every partial chunk
      } catch {}
    }
  })();
  return () => ctrl.abort();
}, [prompt]);
```

`JSON.parse` throws until the very last token, you can't tell which fields are
done, and if you're not careful you'll tear or leak the stream. Let's fix it.

## One hook

```tsx
import { z } from "zod";
import { sse } from "sse-wire";
import { useStreamingObject, openAIContent } from "trickle-react";

const Profile = z.object({ name: z.string(), city: z.string(), bio: z.string() });

function ProfileCard({ prompt }: { prompt: string }) {
  const { data, status, done } = useStreamingObject(
    Profile,
    (signal) => openAIContent(sse("/api/profile", { method: "POST", body: prompt, signal })),
    { deps: [prompt] },
  );

  return (
    <article>
      <h2>{data.name ?? <Skeleton />}</h2>
      <p data-loading={!status.city}>{data.city}</p>
      <p data-loading={!status.bio}>{data.bio}</p>
      {done && <Badge>complete</Badge>}
    </article>
  );
}
```

- **`data`** is a `DeepPartial<Profile>` that updates on every chunk — never throws.
- **`status.city`** turns `true` once `city` has fully arrived (not just appeared).
- **`done`** flips at the end; the stream aborts automatically on unmount or when `deps` change.

Under the hood it uses `useSyncExternalStore`, so renders are tearing-free and
React-18 concurrent-safe, and the partial JSON parsing is handled by
[`trickle-json`](https://www.npmjs.com/package/trickle-json).

## It's the top of a small stack

`trickle-react` is the adoption layer over three other tiny, zero-dependency
packages I built — each solves one step of the streaming structured-output
pipeline, and each is useful on its own:

```
fetch → SSE (sse-wire) → parse partial JSON (trickle-json) → repair/coerce (coerce-json) → render (trickle-react)
```

- **[sse-wire](https://www.npmjs.com/package/sse-wire)** — fetch-based SSE: the POST + headers `EventSource` can't do.
- **[trickle-json](https://www.npmjs.com/package/trickle-json)** — incremental partial-JSON parser; best valid value on every chunk.
- **[coerce-json](https://www.npmjs.com/package/coerce-json)** — repairs & coerces the model's almost-valid JSON to fit your schema, logging every fix.

You don't have to adopt the whole stack — `trickle-react` only needs
`trickle-json`. Bring `sse-wire` for the stream and `coerce-json`/`zod` for
validation when you want them.

## There's more than one object

```tsx
// rows as they stream
const { items } = useStreamingList<Suggestion>(startStream, { path: "suggestions" });

// function-call arguments as they fill in
const { toolCalls } = useToolCalls((signal) => sse("/api/agent", { method: "POST", body, signal }));
```

## Try it

```sh
npm install trickle-react
```

- **npm:** https://www.npmjs.com/package/trickle-react
- **GitHub:** https://github.com/H1manshu01/trickle-react

`react` is a peer; `zod` and `coerce-json` are optional. ~1.5 kB, ESM + CJS,
fully typed, published with provenance. If it mis-renders something, open an
issue with the stream and the schema — ⭐ appreciated if it saves you a pile of
`useEffect` plumbing.
