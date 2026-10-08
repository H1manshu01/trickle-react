import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { StreamStore, runStream } from "./core.js";
import type {
  InferSchema,
  SchemaLike,
  StartStream,
  StreamingObjectResult,
  UseStreamingObjectOptions,
} from "./types.js";

/**
 * Stream a structured object from an LLM and render it as it fills in.
 *
 * ```tsx
 * const User = z.object({ name: z.string(), city: z.string(), age: z.number() });
 *
 * function Profile() {
 *   const { data, status, done } = useStreamingObject(User, (signal) =>
 *     sse("/api/profile", { method: "POST", body, signal }),
 *   );
 *   return (
 *     <>
 *       <Field label="Name" value={data.name} loading={!status.name} />
 *       <Field label="City" value={data.city} loading={!status.city} />
 *       {done && <Badge>complete</Badge>}
 *     </>
 *   );
 * }
 * ```
 *
 * `data` is a `DeepPartial<T>` that updates on every chunk; `status.field` turns
 * true once that field has arrived and won't change again; `done` flips when the
 * stream completes. The stream is aborted automatically on unmount or when
 * `deps` change, and the value validates against `schema` at the end (if given).
 */
export function useStreamingObject<
  S extends SchemaLike<unknown> | null | undefined,
  T = InferSchema<S>,
>(
  schema: S,
  startStream: StartStream,
  options?: UseStreamingObjectOptions<T>,
): StreamingObjectResult<T> {
  const storeRef = useRef<StreamStore<T> | null>(null);
  if (storeRef.current === null) storeRef.current = new StreamStore<T>();
  const store = storeRef.current;

  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  // Latest values read inside the effect without making it a dependency.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const startRef = useRef(startStream);
  startRef.current = startStream;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const enabled = options?.enabled ?? true;
  const deps = options?.deps ?? [];

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    store.setController(controller);
    store.reset();
    void runStream(
      schemaRef.current as SchemaLike<T> | null | undefined,
      startRef.current,
      controller.signal,
      store,
      optionsRef.current ?? {},
    );
    return () => controller.abort();
  }, [store, enabled, ...deps]);

  const abort = useCallback(() => store.abort(), [store]);

  return { data: state.data, status: state.status, done: state.done, error: state.error, abort };
}
