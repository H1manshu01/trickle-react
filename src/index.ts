/**
 * trickle-react — React hooks for streaming structured output from LLMs.
 *
 * `useStreamingObject(schema, startStream)` gives you a typed object that fills
 * in live, with per-field loading status; `useStreamingList` streams array rows;
 * `useToolCalls` streams function-call arguments. The adoption layer over the
 * streaming structured-output suite:
 *
 *   fetch → SSE (sse-wire) → parse partial JSON (trickle-json) → repair/coerce (coerce-json)
 *
 * Built on trickle-json. `react` is a peer dependency; `zod` and `coerce-json`
 * are optional peers.
 */
export { useStreamingObject } from "./useStreamingObject.js";
export { useStreamingList } from "./useStreamingList.js";
export { useToolCalls } from "./useToolCalls.js";
export { computeStatus, selectPath } from "./core.js";
export { anthropicText, fromSSE, openAIContent } from "./provider.js";

export type {
  DeepPartial,
  FieldStatus,
  InferSchema,
  SchemaLike,
  StartStream,
  StreamingObjectResult,
  StreamSource,
  StreamState,
  UseStreamingObjectOptions,
} from "./types.js";
export type { StreamingListResult, UseStreamingListOptions } from "./useStreamingList.js";
export type {
  StartEventStream,
  StreamedToolCall,
  UseToolCallsOptions,
  UseToolCallsResult,
} from "./useToolCalls.js";
export type { SSELike } from "./provider.js";
