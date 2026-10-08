import type { DependencyList } from "react";

/** A value where every property (recursively) may be absent — a streaming partial. */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Minimal shape of a schema we rely on (e.g. a Zod schema) — no hard dependency. */
export interface SchemaLike<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error?: unknown };
}

/** Infer the output type of a {@link SchemaLike}. */
export type InferSchema<S> = S extends SchemaLike<infer T> ? T : unknown;

/** A source of raw chunks that together form a JSON document as it streams in. */
export type StreamSource = AsyncIterable<string | Uint8Array>;

/** Opens the stream. Receives an `AbortSignal` that fires on unmount / re-run / `abort()`. */
export type StartStream = (signal: AbortSignal) => StreamSource | Promise<StreamSource>;

/** Per-field readiness. A field is ready once it has arrived and won't change again. */
export type FieldStatus<T> = { [K in keyof T]?: boolean } & Record<string, boolean>;

export interface StreamState<T> {
  /** The best-effort value parsed so far — fills in as the stream arrives. */
  data: DeepPartial<T>;
  /** Per-field readiness flags derived from the partial. */
  status: FieldStatus<T>;
  /** Whether the stream has finished (successfully or with an error). */
  done: boolean;
  /** The error, if the stream failed. Aborts are not errors. */
  error: Error | undefined;
}

export interface UseStreamingObjectOptions<T> {
  /** Start the stream only when true. Default true. */
  enabled?: boolean;
  /** Re-open the stream when any of these change (like an effect dependency list). Default `[]`. */
  deps?: DependencyList;
  /** Run the schema's `safeParse` on the final value. Default true when a schema is given. */
  validate?: boolean;
  /** Called once with the final value when the stream completes successfully. */
  onDone?: (data: DeepPartial<T>) => void;
  /** Called if the stream fails (not on abort). */
  onError?: (error: Error) => void;
}

export interface StreamingObjectResult<T> {
  data: DeepPartial<T>;
  status: FieldStatus<T>;
  done: boolean;
  error: Error | undefined;
  /** Abort the in-flight stream. */
  abort: () => void;
}
