/**
 * Framework-agnostic core: an external store the React hooks subscribe to via
 * `useSyncExternalStore` (for tearing-free concurrent rendering), plus the
 * async loop that drives trickle-json and the per-field status derivation.
 */
import { StreamingJsonParser } from "trickle-json";
import type {
  DeepPartial,
  FieldStatus,
  SchemaLike,
  StartStream,
  StreamState,
  UseStreamingObjectOptions,
} from "./types.js";

const EMPTY_OBJECT = {} as DeepPartial<unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Derive per-field readiness from a partial. During streaming, the last field
 * present is assumed to still be filling in, so it is not ready yet; once the
 * stream is `done`, every present field is ready.
 */
export function computeStatus<T>(data: unknown, done: boolean): FieldStatus<T> {
  const status: Record<string, boolean> = {};
  if (!isPlainObject(data)) return status as FieldStatus<T>;
  const keys = Object.keys(data);
  const present = keys.filter((k) => data[k] !== undefined);
  const last = present[present.length - 1];
  for (const k of keys) {
    const here = data[k] !== undefined;
    status[k] = done ? here : here && k !== last;
  }
  return status as FieldStatus<T>;
}

/** The external store backing one hook instance. */
export class StreamStore<T> {
  private state: StreamState<T>;
  private readonly listeners = new Set<() => void>();
  private controller: AbortController | null = null;

  constructor() {
    this.state = this.initial();
  }

  private initial(): StreamState<T> {
    return {
      data: EMPTY_OBJECT as DeepPartial<T>,
      status: {} as FieldStatus<T>,
      done: false,
      error: undefined,
    };
  }

  readonly subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };

  readonly getSnapshot = (): StreamState<T> => this.state;

  // SSR: a stable empty snapshot (no streaming on the server).
  readonly getServerSnapshot = (): StreamState<T> => SERVER_SNAPSHOT as StreamState<T>;

  private set(next: StreamState<T>): void {
    this.state = next;
    for (const l of this.listeners) l();
  }

  reset(): void {
    this.set(this.initial());
  }

  setController(controller: AbortController | null): void {
    this.controller = controller;
  }

  abort(): void {
    this.controller?.abort();
  }

  update(patch: Partial<StreamState<T>>): void {
    this.set({ ...this.state, ...patch });
  }
}

const SERVER_SNAPSHOT: StreamState<unknown> = {
  data: EMPTY_OBJECT,
  status: {},
  done: false,
  error: undefined,
};

/**
 * Consume the stream, writing each chunk into trickle-json and pushing a fresh
 * snapshot into the store. Validates the final value against the schema if one
 * was given. Aborts are swallowed (not surfaced as errors).
 */
export async function runStream<T>(
  schema: SchemaLike<T> | null | undefined,
  startStream: StartStream,
  signal: AbortSignal,
  store: StreamStore<T>,
  options: UseStreamingObjectOptions<T>,
): Promise<void> {
  const parser = new StreamingJsonParser();
  const decoder = new TextDecoder();
  try {
    const source = await startStream(signal);
    for await (const chunk of source) {
      if (signal.aborted) return;
      const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      const snapshot = (parser.write(text) ?? EMPTY_OBJECT) as DeepPartial<T>;
      store.update({ data: snapshot, status: computeStatus<T>(snapshot, false) });
    }
    if (signal.aborted) return;

    let final = (parser.end() ?? EMPTY_OBJECT) as DeepPartial<T>;
    if (schema && options.validate !== false) {
      const result = schema.safeParse(final);
      if (result.success) final = result.data as DeepPartial<T>;
    }
    store.update({
      data: final,
      status: computeStatus<T>(final, true),
      done: true,
      error: undefined,
    });
    options.onDone?.(final);
  } catch (err) {
    if (signal.aborted) return;
    const error = err instanceof Error ? err : new Error(String(err));
    store.update({ done: true, error });
    options.onError?.(error);
  }
}

/** Read a dot-path (e.g. `"result.items"`) out of a value; `undefined` if absent. */
export function selectPath(data: unknown, path?: string): unknown {
  if (!path) return data;
  let cur: unknown = data;
  for (const part of path.split(".")) {
    if (!isPlainObject(cur) && !Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
