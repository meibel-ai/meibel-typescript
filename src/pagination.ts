/**
 * Pagination Module
 *
 * Provides async iterators for paginated API responses.
 */

/**
 * Simple pagination helper that yields individual items from paginated responses.
 *
 * @example
 * ```typescript
 * async function* listUsers(): AsyncIterable<User> {
 *   yield* paginate<User>(async (cursor) => {
 *     const response = await http.request('/users', { params: { cursor } });
 *     return { items: response.users, nextCursor: response.next_cursor };
 *   });
 * }
 *
 * for await (const user of listUsers()) {
 *   console.log(user.name);
 * }
 * ```
 */
export async function* paginate<TItem>(
  fetchPage: (cursor?: string) => Promise<{ items: TItem[]; nextCursor?: string | null }>
): AsyncIterable<TItem> {
  let cursor: string | undefined;

  while (true) {
    const result = await fetchPage(cursor);

    for (const item of result.items) {
      if (item !== undefined) {
        yield item;
      }
    }

    if (!result.nextCursor) {
      break;
    }
    cursor = result.nextCursor;
  }
}

export interface PaginationConfig<T, TItem> {
  /** Function to fetch a page of results */
  fetchPage: (cursor?: string) => Promise<T>;
  /** Function to extract items from the response */
  getItems: (response: T) => TItem[];
  /** Function to get the next cursor from the response */
  getNextCursor: (response: T) => string | null | undefined;
}

/**
 * Async iterator for cursor-based pagination.
 *
 * @example
 * ```typescript
 * const iterator = new PaginatedIterator({
 *   fetchPage: (cursor) => client.listUsers({ cursor }),
 *   getItems: (response) => response.users,
 *   getNextCursor: (response) => response.next_cursor,
 * });
 *
 * for await (const user of iterator) {
 *   console.log(user.name);
 * }
 * ```
 */
export class PaginatedIterator<T, TItem> implements AsyncIterable<TItem> {
  private readonly config: PaginationConfig<T, TItem>;
  private currentCursor: string | undefined;
  private currentItems: TItem[] = [];
  private currentIndex = 0;
  private exhausted = false;

  constructor(config: PaginationConfig<T, TItem>) {
    this.config = config;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<TItem> {
    while (!this.exhausted) {
      // Fetch next page if we've exhausted current items
      if (this.currentIndex >= this.currentItems.length) {
        const response = await this.config.fetchPage(this.currentCursor);
        this.currentItems = this.config.getItems(response);
        this.currentIndex = 0;

        const nextCursor = this.config.getNextCursor(response);
        if (nextCursor) {
          this.currentCursor = nextCursor;
        } else {
          this.exhausted = true;
        }

        // If page is empty, we're done
        if (this.currentItems.length === 0) {
          return;
        }
      }

      // Yield items from current page
      while (this.currentIndex < this.currentItems.length) {
        const item = this.currentItems[this.currentIndex++];
        if (item !== undefined) {
          yield item;
        }
      }
    }
  }

  /**
   * Collect all items into an array.
   * Use with caution on large datasets.
   */
  async toArray(): Promise<TItem[]> {
    const items: TItem[] = [];
    for await (const item of this) {
      items.push(item);
    }
    return items;
  }

  /**
   * Take up to n items from the iterator.
   */
  async take(n: number): Promise<TItem[]> {
    const items: TItem[] = [];
    for await (const item of this) {
      items.push(item);
      if (items.length >= n) {
        break;
      }
    }
    return items;
  }
}

export interface OffsetPaginationConfig<T, TItem> {
  /** Function to fetch a page of results */
  fetchPage: (offset: number, limit: number) => Promise<T>;
  /** Function to extract items from the response */
  getItems: (response: T) => TItem[];
  /** Function to get total count (optional, for optimization) */
  getTotal?: (response: T) => number | undefined;
  /** Page size */
  limit: number;
}

/**
 * Async iterator for offset-based pagination.
 *
 * @example
 * ```typescript
 * const iterator = new OffsetPaginatedIterator({
 *   fetchPage: (offset, limit) => client.listUsers({ offset, limit }),
 *   getItems: (response) => response.users,
 *   getTotal: (response) => response.total,
 *   limit: 100,
 * });
 *
 * for await (const user of iterator) {
 *   console.log(user.name);
 * }
 * ```
 */
export class OffsetPaginatedIterator<T, TItem> implements AsyncIterable<TItem> {
  private readonly config: OffsetPaginationConfig<T, TItem>;
  private currentOffset = 0;
  private currentItems: TItem[] = [];
  private currentIndex = 0;
  private exhausted = false;
  private total: number | undefined;

  constructor(config: OffsetPaginationConfig<T, TItem>) {
    this.config = config;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<TItem> {
    while (!this.exhausted) {
      // Fetch next page if we've exhausted current items
      if (this.currentIndex >= this.currentItems.length) {
        // Check if we've reached the total
        if (this.total !== undefined && this.currentOffset >= this.total) {
          return;
        }

        const response = await this.config.fetchPage(
          this.currentOffset,
          this.config.limit
        );
        this.currentItems = this.config.getItems(response);
        this.currentIndex = 0;

        // Update total if available
        if (this.config.getTotal) {
          this.total = this.config.getTotal(response);
        }

        // If page is empty or smaller than limit, we're done after this
        if (this.currentItems.length < this.config.limit) {
          this.exhausted = true;
        }

        // Update offset for next page
        this.currentOffset += this.currentItems.length;

        // If page is empty, we're done
        if (this.currentItems.length === 0) {
          return;
        }
      }

      // Yield items from current page
      while (this.currentIndex < this.currentItems.length) {
        const item = this.currentItems[this.currentIndex++];
        if (item !== undefined) {
          yield item;
        }
      }
    }
  }

  /**
   * Collect all items into an array.
   * Use with caution on large datasets.
   */
  async toArray(): Promise<TItem[]> {
    const items: TItem[] = [];
    for await (const item of this) {
      items.push(item);
    }
    return items;
  }

  /**
   * Take up to n items from the iterator.
   */
  async take(n: number): Promise<TItem[]> {
    const items: TItem[] = [];
    for await (const item of this) {
      items.push(item);
      if (items.length >= n) {
        break;
      }
    }
    return items;
  }
}
