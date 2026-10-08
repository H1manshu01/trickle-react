/**
 * A complete example: a profile card that fills in field by field as an LLM
 * streams a JSON object, with a per-field loading state and a final "done".
 *
 * Pipeline: sse-wire (POST stream) → openAIContent (pull JSON out of the
 * OpenAI envelope) → useStreamingObject (parse partial JSON via trickle-json)
 * → validate against the Zod schema at the end.
 *
 *   npm install trickle-react sse-wire zod
 */
import { useState } from "react";
import { sse } from "sse-wire";
import { openAIContent, useStreamingObject } from "trickle-react";
import { z } from "zod";

const Profile = z.object({
  name: z.string(),
  title: z.string(),
  city: z.string(),
  bio: z.string(),
});

function Field({ label, value, loading }: { label: string; value?: string; loading: boolean }) {
  return (
    <div style={{ opacity: loading ? 0.5 : 1 }}>
      <strong>{label}: </strong>
      {value ?? (loading ? "…" : "")}
    </div>
  );
}

export function ProfileCard() {
  const [prompt, setPrompt] = useState("A short profile for Ada Lovelace");

  const { data, status, done, error, abort } = useStreamingObject(
    Profile,
    (signal) =>
      openAIContent(
        sse("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            stream: true,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "Reply with JSON: { name, title, city, bio }." },
              { role: "user", content: prompt },
            ],
          }),
          signal,
        }),
      ),
    { deps: [prompt] },
  );

  return (
    <section>
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button type="button" onClick={abort} disabled={done}>
        Stop
      </button>

      {error ? (
        <p role="alert">Could not stream: {error.message}</p>
      ) : (
        <>
          <h2>{data.name ?? "…"}</h2>
          <Field label="Title" value={data.title} loading={!status.title} />
          <Field label="City" value={data.city} loading={!status.city} />
          <Field label="Bio" value={data.bio} loading={!status.bio} />
          <small>{done ? "✓ complete" : "streaming…"}</small>
        </>
      )}
    </section>
  );
}
