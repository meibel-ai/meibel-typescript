/**
 * Streaming Module
 *
 * Provides async iterators for Server-Sent Events (SSE) streams.
 */

export interface SSEEvent {
  /** Event type (from "event:" field) */
  event: string | undefined;
  /** Event data (from "data:" field) */
  data: string;
  /** Event ID (from "id:" field) */
  id: string | undefined;
  /** Retry interval in ms (from "retry:" field) */
  retry: number | undefined;
}

/**
 * Parse SSE events from a text stream.
 *
 * @param stream - ReadableStream of text chunks
 * @returns AsyncIterable of SSE events
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const event = parseSSEEvent(buffer);
          if (event) {
            yield event;
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete events (separated by double newline)
      const events = buffer.split(/\n\n/);
      buffer = events.pop() ?? '';

      for (const eventText of events) {
        const event = parseSSEEvent(eventText);
        if (event) {
          yield event;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a single SSE event from text.
 */
function parseSSEEvent(text: string): SSEEvent | null {
  const lines = text.split('\n');
  let event: string | undefined;
  let data: string[] = [];
  let id: string | undefined;
  let retry: number | undefined;

  for (const line of lines) {
    // Skip comments
    if (line.startsWith(':')) {
      continue;
    }

    // Empty line ends the event
    if (line === '') {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      // Field with no value
      continue;
    }

    const field = line.slice(0, colonIndex);
    // Skip leading space after colon if present
    let value = line.slice(colonIndex + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    switch (field) {
      case 'event':
        event = value;
        break;
      case 'data':
        data.push(value);
        break;
      case 'id':
        id = value;
        break;
      case 'retry':
        const retryValue = parseInt(value, 10);
        if (!isNaN(retryValue)) {
          retry = retryValue;
        }
        break;
    }
  }

  // Must have data to be a valid event
  if (data.length === 0) {
    return null;
  }

  return {
    event,
    data: data.join('\n'),
    id,
    retry,
  };
}

/**
 * Async iterator for typed SSE events.
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/stream');
 * const iterator = new SSEIterator<MessageEvent>(response.body!, {
 *   parse: (data) => JSON.parse(data) as MessageEvent,
 *   filter: (event) => event.event !== 'ping',
 * });
 *
 * for await (const message of iterator) {
 *   console.log(message);
 * }
 * ```
 */
export class SSEIterator<T> implements AsyncIterable<T> {
  private readonly stream: ReadableStream<Uint8Array>;
  private readonly options: SSEIteratorOptions<T>;

  constructor(
    stream: ReadableStream<Uint8Array>,
    options: SSEIteratorOptions<T> = {}
  ) {
    this.stream = stream;
    this.options = options;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    const { parse, filter, onError } = this.options;

    for await (const event of parseSSEStream(this.stream)) {
      // Apply filter if provided
      if (filter && !filter(event)) {
        continue;
      }

      // Parse the data
      try {
        const parsed = parse ? parse(event.data) : (event.data as unknown as T);
        yield parsed;
      } catch (error) {
        if (onError) {
          onError(error as Error, event);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Collect all events into an array.
   * Use with caution on long-running streams.
   */
  async toArray(): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) {
      items.push(item);
    }
    return items;
  }

  /**
   * Take up to n events from the stream.
   */
  async take(n: number): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) {
      items.push(item);
      if (items.length >= n) {
        break;
      }
    }
    return items;
  }
}

export interface SSEIteratorOptions<T> {
  /** Parse the event data string into the target type */
  parse?: (data: string) => T;
  /** Filter events (return true to include) */
  filter?: (event: SSEEvent) => boolean;
  /** Handle parse errors (if not provided, errors are thrown) */
  onError?: (error: Error, event: SSEEvent) => void;
}

/**
 * Create an SSE iterator that parses JSON events.
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/stream');
 * for await (const event of jsonSSEIterator<MessageEvent>(response.body!)) {
 *   console.log(event);
 * }
 * ```
 */
export function jsonSSEIterator<T>(
  stream: ReadableStream<Uint8Array>,
  options: Omit<SSEIteratorOptions<T>, 'parse'> = {}
): SSEIterator<T> {
  return new SSEIterator<T>(stream, {
    ...options,
    parse: (data) => JSON.parse(data) as T,
  });
}

/**
 * Stream SSE events from a Response object, parsing JSON data.
 *
 * @example
 * ```typescript
 * const response = await client.http.request('/events', { stream: true });
 * for await (const event of streamSSE<MessageEvent>(response)) {
 *   console.log(event);
 * }
 * ```
 */
export async function* streamSSE<T = unknown>(
  response: Response
): AsyncIterable<T> {
  if (!response.body) {
    return;
  }

  for await (const event of parseSSEStream(response.body)) {
    try {
      const parsed = JSON.parse(event.data) as T;
      yield parsed;
    } catch {
      // If JSON parsing fails, yield the raw data cast to T
      yield event.data as unknown as T;
    }
  }
}
