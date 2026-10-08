import { describe, expect, it } from "vitest";
import { type SSELike, anthropicText, fromSSE, openAIContent } from "../src/provider.js";

async function* events(list: SSELike[]): AsyncGenerator<SSELike> {
  for (const e of list) yield e;
}
async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const s of gen) out.push(s);
  return out;
}

describe("fromSSE", () => {
  it("yields data payloads and stops at the sentinel", async () => {
    const out = await collect(
      fromSSE(events([{ data: "a" }, { data: "b" }, { data: "[DONE]" }, { data: "c" }])),
    );
    expect(out).toEqual(["a", "b"]);
  });
});

describe("openAIContent", () => {
  it("extracts choices[0].delta.content and skips sentinels/malformed", async () => {
    const out = await collect(
      openAIContent(
        events([
          { data: JSON.stringify({ choices: [{ delta: { content: "Hel" } }] }) },
          { data: "not json" },
          { data: JSON.stringify({ choices: [{ delta: { role: "assistant" } }] }) },
          { data: JSON.stringify({ choices: [{ delta: { content: "lo" } }] }) },
          { data: "[DONE]" },
        ]),
      ),
    );
    expect(out).toEqual(["Hel", "lo"]);
  });
});

describe("anthropicText", () => {
  it("extracts text_delta and input_json_delta", async () => {
    const out = await collect(
      anthropicText(
        events([
          {
            data: JSON.stringify({
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Hi" },
            }),
          },
          {
            data: JSON.stringify({
              type: "content_block_delta",
              delta: { type: "input_json_delta", partial_json: '{"a":' },
            }),
          },
          {
            data: JSON.stringify({
              type: "content_block_delta",
              delta: { type: "input_json_delta", partial_json: "1}" },
            }),
          },
          { data: JSON.stringify({ type: "ping" }) },
        ]),
      ),
    );
    expect(out).toEqual(["Hi", '{"a":', "1}"]);
  });
});
