/**
 * HTTP Client Module
 *
 * Provides a fetch-based HTTP client with error handling.
 */

import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from './errors.js';
import { type UploadFile, createMultipartStream } from './upload.js';

export interface HttpClientOptions {
  /** Base URL for API requests */
  baseUrl?: string;
  /** Default headers to include in all requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  /** HTTP method */
  method?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** Whether to return the raw response for streaming */
  stream?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeout: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    this.timeout = options.timeout ?? 30000;
    this.fetchFn = options.fetch ?? fetch;
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const headers = { ...this.defaultHeaders, ...options.headers };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout ?? this.timeout
    );

    try {
      const requestInit: RequestInit = {
        method: options.method ?? 'GET',
        headers,
        signal: controller.signal,
      };
      if (options.body !== undefined) {
        requestInit.body = JSON.stringify(options.body);
      }
      const response = await this.fetchFn(url, requestInit);

      clearTimeout(timeoutId);

      if (options.stream) {
        if (!response.ok) {
          await this.handleErrorResponse(response);
        }
        return response as unknown as T;
      }

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      return undefined as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout', 0, { message: 'Request timed out' });
        }
        throw new ApiError(error.message, 0, { message: error.message });
      }

      throw new ApiError('Unknown error', 0, {});
    }
  }

  async upload<T = unknown>(
    path: string,
    files: UploadFile[],
    options: RequestOptions & { formFields?: Record<string, string> } = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const { body, contentType } = createMultipartStream(files, options.formFields);

    const { 'Content-Type': _, ...baseHeaders } = this.defaultHeaders;
    const headers = { ...baseHeaders, ...options.headers, 'Content-Type': contentType };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout ?? this.timeout,
    );

    try {
      const response = await this.fetchFn(url, {
        method: options.method ?? 'POST',
        headers,
        body,
        signal: controller.signal,
        // duplex is required for streaming request bodies in Node.js
        duplex: 'half' as never,
      });
      clearTimeout(timeoutId);

      if (!response.ok) await this.handleErrorResponse(response);
      if (response.status === 204) return undefined as T;

      const ct = response.headers.get('content-type');
      if (ct?.includes('application/json')) return (await response.json()) as T;
      return undefined as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) throw error;
      if (error instanceof Error) {
        if (error.name === 'AbortError')
          throw new ApiError('Request timeout', 0, { message: 'Request timed out' });
        throw new ApiError(error.message, 0, { message: error.message });
      }
      throw new ApiError('Unknown error', 0, {});
    }
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    // Ensure base URL ends with / so relative paths append correctly.
    // new URL("/documents", "https://host/v2") would discard /v2,
    // but new URL("documents", "https://host/v2/") preserves it.
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/';
    const relativePath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(relativePath, base);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let body: Record<string, unknown> = {};

    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = (await response.json()) as Record<string, unknown>;
      }
    } catch {
      // Ignore JSON parsing errors
    }

    const bodyMessage = body['message'];
    const bodyError = body['error'];
    const message =
      typeof bodyMessage === 'string'
        ? bodyMessage
        : typeof bodyError === 'string'
          ? bodyError
          : `Request failed with status ${response.status}`;

    switch (response.status) {
      case 401:
        throw new AuthenticationError(message, body);
      case 403:
        throw new AuthorizationError(message, body);
      case 404:
        throw new NotFoundError(message, body);
      case 422:
        throw new ValidationError(message, body);
      case 429:
        const retryAfter = response.headers.get('retry-after');
        throw new RateLimitError(
          message,
          body,
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );
      default:
        throw new ApiError(message, response.status, body);
    }
  }
}
