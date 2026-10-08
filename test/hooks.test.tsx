import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SSELike } from "../src/provider.js";
import type { StartStream } from "../src/types.js";
import { useStreamingList } from "../src/useStreamingList.js";
import { useStreamingObject } from "../src/useStreamingObject.js";
import { type StartEventStream, useToolCalls } from "../src/useToolCalls.js";

function controllable<T>() {
  const queue: T[] = [];
  let wake: () => void = () => {};
  let gate = new Promise<void>((r) => {
    wake = r;
  });
  let closed = false;
  async function* iterate(): AsyncGenerator<T> {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift() as T;
        continue;
      }
      if (closed) return;
      await gate;
      gate = new Promise<void>((r) => {
        wake = r;
      });
    }
  }
  return {
    iterable: { [Symbol.asyncIterator]: iterate },
    push(v: T) {
      queue.push(v);
      wake();
    },
    close() {
      closed = true;
      wake();
    },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function ObjHarness({ start }: { start: StartStream }) {
  const { data, status, done } = useStreamingObject<null, { name: string; city: string }>(
    null,
    start,
    { deps: [] },
  );
  return (
    <div>
      <span data-testid="name">{data.name ?? "-"}</span>
      <span data-testid="city">{data.city ?? "-"}</span>
      <span data-testid="name-ready">{status.name ? "y" : "n"}</span>
      <span data-testid="done">{done ? "y" : "n"}</span>
    </div>
  );
}

describe("useStreamingObject", () => {
  it("fills in the object progressively, tracks per-field status, and flips done", async () => {
    const src = controllable<string>();
    render(<ObjHarness start={() => src.iterable} />);
    expect(screen.getByTestId("name").textContent).toBe("-");

    await act(async () => {
      src.push('{"name":"Ada"');
      await tick();
    });
    expect(screen.getByTestId("name").textContent).toBe("Ada");
    expect(screen.getByTestId("name-ready").textContent).toBe("n"); // last field, still streaming

    await act(async () => {
      src.push(',"city":"London"}');
      await tick();
    });
    expect(screen.getByTestId("city").textContent).toBe("London");
    expect(screen.getByTestId("name-ready").textContent).toBe("y"); // no longer the last field

    await act(async () => {
      src.close();
      await tick();
    });
    expect(screen.getByTestId("done").textContent).toBe("y");
  });

  it("aborts the stream on unmount", async () => {
    let captured: AbortSignal | undefined;
    const src = controllable<string>();
    const start: StartStream = (signal) => {
      captured = signal;
      return src.iterable;
    };
    const { unmount } = render(<ObjHarness start={start} />);
    await act(async () => {
      src.push('{"name":"x"}');
      await tick();
    });
    expect(captured?.aborted).toBe(false);
    unmount();
    expect(captured?.aborted).toBe(true);
  });

  it("surfaces an error from the stream", async () => {
    const start: StartStream = () =>
      (async function* () {
        yield '{"name":"x"}';
        throw new Error("boom");
      })();
    function ErrHarness() {
      const { error, done } = useStreamingObject(null, start, { deps: [] });
      return (
        <div>
          <span data-testid="error">{error?.message ?? ""}</span>
          <span data-testid="done">{done ? "y" : "n"}</span>
        </div>
      );
    }
    render(<ErrHarness />);
    await waitFor(() => expect(screen.getByTestId("error").textContent).toBe("boom"));
    expect(screen.getByTestId("done").textContent).toBe("y");
  });
});

function ListHarness({ start }: { start: StartStream }) {
  const { items, done } = useStreamingList<{ title: string }>(start, { path: "items", deps: [] });
  return (
    <div>
      <span data-testid="count">{items.length}</span>
      <span data-testid="last">{items[items.length - 1]?.title ?? "-"}</span>
      <span data-testid="done">{done ? "y" : "n"}</span>
    </div>
  );
}

describe("useStreamingList", () => {
  it("appends rows as the array streams in", async () => {
    const src = controllable<string>();
    render(<ListHarness start={() => src.iterable} />);

    await act(async () => {
      src.push('{"items":[{"title":"a"}');
      await tick();
    });
    expect(screen.getByTestId("count").textContent).toBe("1");

    await act(async () => {
      src.push(',{"title":"b"}]}');
      await tick();
    });
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("last").textContent).toBe("b");

    await act(async () => {
      src.close();
      await tick();
    });
    expect(screen.getByTestId("done").textContent).toBe("y");
  });
});

function ToolHarness({ start }: { start: StartEventStream }) {
  const { toolCalls, done } = useToolCalls(start, { deps: [] });
  return (
    <div>
      <span data-testid="tname">{toolCalls[0]?.name ?? "-"}</span>
      <span data-testid="targs">{JSON.stringify(toolCalls[0]?.arguments ?? null)}</span>
      <span data-testid="done">{done ? "y" : "n"}</span>
    </div>
  );
}

describe("useToolCalls", () => {
  it("streams OpenAI tool-call arguments as they fill in", async () => {
    const src = controllable<SSELike>();
    render(<ToolHarness start={() => src.iterable} />);

    await act(async () => {
      src.push({
        data: JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_1",
                    function: { name: "get_weather", arguments: '{"city":' },
                  },
                ],
              },
            },
          ],
        }),
      });
      await tick();
    });
    expect(screen.getByTestId("tname").textContent).toBe("get_weather");

    await act(async () => {
      src.push({
        data: JSON.stringify({
          choices: [
            { delta: { tool_calls: [{ index: 0, function: { arguments: '"London"}' } }] } },
          ],
        }),
      });
      await tick();
    });
    await waitFor(() => expect(screen.getByTestId("targs").textContent).toContain("London"));

    await act(async () => {
      src.close();
      await tick();
    });
    expect(screen.getByTestId("done").textContent).toBe("y");
  });
});
