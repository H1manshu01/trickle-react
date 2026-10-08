import { type DependencyList, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  type OpenAIStreamChunk,
  type StreamedToolCall,
  streamOpenAIToolCalls,
} from "trickle-json/openai";
import type { SSELike } from "./provider.js";

export type { StreamedToolCall } from "trickle-json/openai";

/** Opens a stream of SSE events (e.g. from `sse-wire`). */
export type StartEventStream = (
  signal: AbortSignal,
) => AsyncIterable<SSELike> | Promise<AsyncIterable<SSELike>>;

export interface UseToolCallsOptions {
  enabled?: boolean;
  deps?: DependencyList;
  onDone?: (toolCalls: StreamedToolCall[]) => void;
  onError?: (error: Error) => void;
}

export interface UseToolCallsResult {
  /** Tool/function calls, with `arguments` parsed best-effort as they fill in. */
  toolCalls: StreamedToolCall[];
  done: boolean;
  error: Error | undefined;
  abort: () => void;
}

interface ToolCallsState {
  toolCalls: StreamedToolCall[];
  done: boolean;
  error: Error | undefined;
}

const INITIAL: ToolCallsState = { toolCalls: [], done: false, error: undefined };

class ToolCallsStore {
  private state: ToolCallsState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private controller: AbortController | null = null;

  readonly subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };
  readonly getSnapshot = () => this.state;
  readonly getServerSnapshot = () => INITIAL;
  private set(next: ToolCallsState) {
    this.state = next;
    for (const l of this.listeners) l();
  }
  reset() {
    this.set(INITIAL);
  }
  update(patch: Partial<ToolCallsState>) {
    this.set({ ...this.state, ...patch });
  }
  setController(c: AbortController | null) {
    this.controller = c;
  }
  abort() {
    this.controller?.abort();
  }
}

async function* eventsToChunks(events: AsyncIterable<SSELike>): AsyncGenerator<OpenAIStreamChunk> {
  for await (const ev of events) {
    const data = ev.data?.trim();
    if (!data || data === "[DONE]") continue;
    try {
      yield JSON.parse(data) as OpenAIStreamChunk;
    } catch {
      /* ignore a malformed event */
    }
  }
}

/**
 * Stream OpenAI tool/function calls into React, with each call's `arguments`
 * parsed best-effort as they arrive. Pass a stream of SSE events (e.g. from
 * `sse-wire`); built on trickle-json's `streamOpenAIToolCalls`.
 *
 * ```tsx
 * const { toolCalls, done } = useToolCalls((signal) =>
 *   sse("/api/agent", { method: "POST", body, signal }),
 * );
 * // toolCalls[0].name, toolCalls[0].arguments (fills in live)
 * ```
 */
export function useToolCalls(
  startStream: StartEventStream,
  options?: UseToolCallsOptions,
): UseToolCallsResult {
  const storeRef = useRef<ToolCallsStore | null>(null);
  if (storeRef.current === null) storeRef.current = new ToolCallsStore();
  const store = storeRef.current;

  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

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
    const opts = optionsRef.current ?? {};
    (async () => {
      try {
        const source = await startRef.current(controller.signal);
        for await (const calls of streamOpenAIToolCalls(eventsToChunks(source))) {
          if (controller.signal.aborted) return;
          store.update({ toolCalls: calls });
        }
        if (controller.signal.aborted) return;
        store.update({ done: true });
        opts.onDone?.(store.getSnapshot().toolCalls);
      } catch (err) {
        if (controller.signal.aborted) return;
        const error = err instanceof Error ? err : new Error(String(err));
        store.update({ done: true, error });
        opts.onError?.(error);
      }
    })();
    return () => controller.abort();
  }, [store, enabled, ...deps]);

  const abort = useCallback(() => store.abort(), [store]);

  return { toolCalls: state.toolCalls, done: state.done, error: state.error, abort };
}
