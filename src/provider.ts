/**
 * Provider glue — adapt an SSE event stream (e.g. from `sse-wire`) into the
 * text-chunk {@link StreamSource} that {@link useStreamingObject} consumes.
 *
 * These are plain async generators (no React), so they compose anywhere:
 *
 * ```ts
 * import { sse } from "sse-wire";
 * useStreamingObject(schema, (signal) => openAIContent(sse(url, { method: "POST", body, signal })));
 * ```
 */

/** Minimal shape of an SSE event (matches `sse-wire`'s `SSEEvent`). */
export interface SSELike {
  data: string;
  event?: string;
  id?: string;
}

/** Yield each event's raw `data` (for endpoints whose `data` lines are the JSON itself). */
export async function* fromSSE(
  events: AsyncIterable<SSELike>,
  options?: { done?: string },
): AsyncGenerator<string> {
  const sentinel = options?.done ?? "[DONE]";
  for await (const ev of events) {
    if (ev.data === sentinel) return;
    yield ev.data;
  }
}

/** Extract OpenAI chat-completion `choices[0].delta.content` text as it streams. */
export async function* openAIContent(
  events: AsyncIterable<SSELike>,
  options?: { done?: string },
): AsyncGenerator<string> {
  const sentinel = options?.done ?? "[DONE]";
  for await (const ev of events) {
    const data = ev.data?.trim();
    if (!data || data === sentinel) continue;
    try {
      const chunk = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) yield delta;
    } catch {
      /* ignore a malformed event */
    }
  }
}

/** Extract Anthropic message-stream text (and `input_json_delta`) as it streams. */
export async function* anthropicText(events: AsyncIterable<SSELike>): AsyncGenerator<string> {
  for await (const ev of events) {
    const data = ev.data?.trim();
    if (!data) continue;
    try {
      const e = JSON.parse(data) as {
        delta?: { type?: string; text?: string; partial_json?: string };
      };
      const d = e.delta;
      if (d?.type === "text_delta" && typeof d.text === "string") yield d.text;
      else if (d?.type === "input_json_delta" && typeof d.partial_json === "string") {
        yield d.partial_json;
      }
    } catch {
      /* ignore a malformed event */
    }
  }
}
