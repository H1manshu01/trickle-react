// Cross-runtime smoke test against the BUILT output (dist/).
// Runs under both Node and Bun to confirm the published package loads and works.
// This is a React package, but hooks can't run without a renderer and this test
// has no DOM — so it checks the exports and exercises the non-React helpers only.
import assert from "node:assert/strict";
import {
  anthropicText,
  computeStatus,
  fromSSE,
  openAIContent,
  selectPath,
  useStreamingList,
  useStreamingObject,
  useToolCalls,
} from "../dist/index.js";

async function* events(list) {
  for (const e of list) yield e;
}
async function collect(gen) {
  const out = [];
  for await (const v of gen) out.push(v);
  return out;
}

// Every hook and helper is exported and callable.
for (const fn of [
  useStreamingObject,
  useStreamingList,
  useToolCalls,
  fromSSE,
  openAIContent,
  anthropicText,
  computeStatus,
  selectPath,
]) {
  assert.equal(typeof fn, "function");
}

// Pure helpers.
assert.deepEqual(computeStatus({ a: 1, b: 2 }, false), { a: true, b: false });
assert.deepEqual(computeStatus({ a: 1, b: 2 }, true), { a: true, b: true });
assert.deepEqual(selectPath({ a: { b: [1] } }, "a.b"), [1]);
assert.equal(selectPath({ a: 1 }, "a.b.c"), undefined);

// Provider glue (async generators, no React).
{
  const out = await collect(
    openAIContent(
      events([
        { data: JSON.stringify({ choices: [{ delta: { content: "Hi" } }] }) },
        { data: JSON.stringify({ choices: [{ delta: { role: "assistant" } }] }) },
        { data: JSON.stringify({ choices: [{ delta: { content: "!" } }] }) },
        { data: "[DONE]" },
      ]),
    ),
  );
  assert.deepEqual(out, ["Hi", "!"]); // extracts content, skips non-content + [DONE]
}
{
  const out = await collect(fromSSE(events([{ data: "a" }, { data: "[DONE]" }, { data: "b" }])));
  assert.deepEqual(out, ["a"]);
}
{
  const out = await collect(
    anthropicText(
      events([
        { data: JSON.stringify({ delta: { type: "text_delta", text: "yo" } }) },
        { data: JSON.stringify({ delta: { type: "input_json_delta", partial_json: "{}" } }) },
      ]),
    ),
  );
  assert.deepEqual(out, ["yo", "{}"]);
}

console.log(`smoke ok (${typeof Bun !== "undefined" ? "bun" : "node"})`);
