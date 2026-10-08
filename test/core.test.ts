import { describe, expect, it, vi } from "vitest";
import { StreamStore, computeStatus, runStream, selectPath } from "../src/core.js";
import type { SchemaLike } from "../src/types.js";

/** A stream the test drives chunk by chunk. */
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

describe("computeStatus", () => {
  it("marks all but the last present field ready while streaming", () => {
    expect(computeStatus({ a: 1, b: 2 }, false)).toEqual({ a: true, b: false });
  });
  it("marks every present field ready when done", () => {
    expect(computeStatus({ a: 1, b: 2 }, true)).toEqual({ a: true, b: true });
  });
  it("returns an empty status for non-objects", () => {
    expect(computeStatus("x", false)).toEqual({});
    expect(computeStatus(undefined, true)).toEqual({});
  });
});

describe("selectPath", () => {
  it("navigates a dot-path", () => {
    expect(selectPath({ a: { b: [1, 2] } }, "a.b")).toEqual([1, 2]);
  });
  it("returns the whole value with no path", () => {
    expect(selectPath({ a: 1 })).toEqual({ a: 1 });
  });
  it("returns undefined for a missing path", () => {
    expect(selectPath({ a: 1 }, "a.b.c")).toBeUndefined();
  });
});

describe("StreamStore", () => {
  it("notifies subscribers on update and keeps a stable snapshot", () => {
    const store = new StreamStore<{ a: number }>();
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first); // stable until change
    const cb = vi.fn();
    const unsub = store.subscribe(cb);
    store.update({ done: true });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().done).toBe(true);
    expect(store.getSnapshot()).not.toBe(first);
    unsub();
    store.update({ done: false });
    expect(cb).toHaveBeenCalledTimes(1); // no longer subscribed
  });
});

describe("runStream", () => {
  it("pushes progressive snapshots, then a validated final value and done", async () => {
    const store = new StreamStore<{ name: string; age: number }>();
    const ctl = new AbortController();
    const src = controllable<string>();
    const onDone = vi.fn();

    const schema: SchemaLike<{ name: string; age: number }> = {
      safeParse: (d) => ({ success: true, data: d as { name: string; age: number } }),
    };

    const done = runStream(schema, () => src.iterable, ctl.signal, store, { onDone });

    src.push('{"name":"Ada"');
    await tick();
    expect(store.getSnapshot().data).toEqual({ name: "Ada" });
    expect(store.getSnapshot().done).toBe(false);

    src.push(',"age":36}');
    await tick();
    expect(store.getSnapshot().data).toEqual({ name: "Ada", age: 36 });

    src.close();
    await done;
    expect(store.getSnapshot().done).toBe(true);
    expect(store.getSnapshot().data).toEqual({ name: "Ada", age: 36 });
    expect(store.getSnapshot().status).toEqual({ name: true, age: true });
    expect(onDone).toHaveBeenCalledWith({ name: "Ada", age: 36 });
  });

  it("surfaces an error and sets done, calling onError", async () => {
    const store = new StreamStore<unknown>();
    const ctl = new AbortController();
    const onError = vi.fn();
    async function* boom(): AsyncGenerator<string> {
      yield '{"a":1}';
      throw new Error("stream failed");
    }
    await runStream(null, () => boom(), ctl.signal, store, { onError });
    expect(store.getSnapshot().error?.message).toBe("stream failed");
    expect(store.getSnapshot().done).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("stops updating once aborted (no error surfaced)", async () => {
    const store = new StreamStore<unknown>();
    const ctl = new AbortController();
    const src = controllable<string>();
    const onError = vi.fn();
    const done = runStream(null, () => src.iterable, ctl.signal, store, { onError });

    src.push('{"a":1}');
    await tick();
    expect(store.getSnapshot().data).toEqual({ a: 1 });

    ctl.abort();
    src.push('{"a":1,"b":2}');
    src.close();
    await done;

    expect(store.getSnapshot().data).toEqual({ a: 1 }); // no post-abort update
    expect(store.getSnapshot().done).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });
});
