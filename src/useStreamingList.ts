import { selectPath } from "./core.js";
import type { DeepPartial, StartStream, UseStreamingObjectOptions } from "./types.js";
import { useStreamingObject } from "./useStreamingObject.js";

export interface UseStreamingListOptions<T>
  extends Omit<UseStreamingObjectOptions<T[]>, "validate"> {
  /** Dot-path to the array within the streamed object (omit if the root is the array). */
  path?: string;
}

export interface StreamingListResult<T> {
  /** The array items parsed so far — grows (and the tail fills in) as the stream arrives. */
  items: DeepPartial<T>[];
  done: boolean;
  error: Error | undefined;
  abort: () => void;
}

/**
 * Stream a JSON array and render rows as they arrive.
 *
 * ```tsx
 * const { items, done } = useStreamingList<Suggestion>(startStream, { path: "suggestions" });
 * return <ul>{items.map((s, i) => <li key={i}>{s.title}</li>)}</ul>;
 * ```
 */
export function useStreamingList<T = unknown>(
  startStream: StartStream,
  options?: UseStreamingListOptions<T>,
): StreamingListResult<T> {
  const { path, ...rest } = options ?? {};
  const { data, done, error, abort } = useStreamingObject<null, T[]>(null, startStream, rest);
  const selected = selectPath(data, path);
  const items = (Array.isArray(selected) ? selected : []) as DeepPartial<T>[];
  return { items, done, error, abort };
}
