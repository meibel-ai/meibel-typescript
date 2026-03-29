/**
 * Error Classes Module
 *
 * Provides typed error classes for API error handling.
 */

/**
 * Base error class for all API errors.
 */
export class ApiError extends Error {
  /** HTTP status code */
  readonly status: number;
  /** Response body */
  readonly body: Record<string, unknown>;
  /** Error code from the API response */
  readonly code: string | undefined;

  constructor(
    message: string,
    status: number,
    body: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    const bodyCode = body['code'];
    this.code = typeof bodyCode === 'string' ? bodyCode : undefined;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      body: this.body,
    };
  }
}

/**
 * Error thrown when authentication fails (401).
 */
export class AuthenticationError extends ApiError {
  constructor(message: string, body: Record<string, unknown> = {}) {
    super(message, 401, body);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when authorization fails (403).
 */
export class AuthorizationError extends ApiError {
  constructor(message: string, body: Record<string, unknown> = {}) {
    super(message, 403, body);
    this.name = 'AuthorizationError';
  }
}

/**
 * Error thrown when a resource is not found (404).
 */
export class NotFoundError extends ApiError {
  constructor(message: string, body: Record<string, unknown> = {}) {
    super(message, 404, body);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when validation fails (422).
 */
export class ValidationError extends ApiError {
  /** Validation errors by field */
  readonly errors: Record<string, string[]>;

  constructor(message: string, body: Record<string, unknown> = {}) {
    super(message, 422, body);
    this.name = 'ValidationError';

    // Extract field errors if present
    this.errors = {};
    const bodyErrors = body['errors'];
    if (bodyErrors && typeof bodyErrors === 'object') {
      for (const [field, messages] of Object.entries(bodyErrors)) {
        if (Array.isArray(messages)) {
          this.errors[field] = messages.map(String);
        } else if (typeof messages === 'string') {
          this.errors[field] = [messages];
        }
      }
    }
  }
}

/**
 * Error thrown when rate limit is exceeded (429).
 */
export class RateLimitError extends ApiError {
  /** Seconds until the rate limit resets */
  readonly retryAfter: number | undefined;

  constructor(
    message: string,
    body: Record<string, unknown> = {},
    retryAfter?: number
  ) {
    super(message, 429, body);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when the server encounters an error (5xx).
 */
export class ServerError extends ApiError {
  constructor(
    message: string,
    status: number,
    body: Record<string, unknown> = {}
  ) {
    super(message, status, body);
    this.name = 'ServerError';
  }
}

/**
 * Error thrown when a request times out.
 */
export class TimeoutError extends ApiError {
  constructor(message = 'Request timed out') {
    super(message, 0, { message });
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when a network error occurs.
 */
export class NetworkError extends ApiError {
  constructor(message = 'Network error') {
    super(message, 0, { message });
    this.name = 'NetworkError';
  }
}
