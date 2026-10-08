// Server-side data: the async source contract and the block cache behind infinite scrolling.
import type { Filters, SortRule } from "./types.js";

export interface DataSourceRequest {
  /** First row index, inclusive. */
  startRow: number;
  /** One past the last row index. */
  endRow: number;
  sort: SortRule[];
  filters: Filters;
  /** Quick search text. */
  search: string;
}

export interface DataSourceResult<T> {
  rows: readonly T[];
  /** Row count of the whole (sorted, filtered) result set. */
  total: number;
}

export interface DataSource<T> {
  /** Resolves the rows of `[startRow, endRow)`; sort, filters and search are applied by the server. */
  getRows(
    request: DataSourceRequest,
    options: { signal: AbortSignal },
  ): Promise<DataSourceResult<T>>;
  /** Rows per request in infinite mode (`pageSize` is used in paginated mode). 50 by default. */
  blockSize?: number;
}

export type BlockStatus = "idle" | "loading" | "loaded" | "error";

interface Block<T> {
  status: Exclude<BlockStatus, "idle">;
  rows: readonly T[];
}

/**
 * Fixed-size blocks of rows fetched on demand. Loaded blocks beyond `maxBlocks` are evicted least
 * recently used first, never the ones in the range being shown.
 */
export class BlockCache<T> {
  readonly blockSize: number;
  readonly maxBlocks: number;
  total: number | null = null;
  private readonly blocks = new Map<number, Block<T>>();

  constructor(blockSize: number, maxBlocks = 20) {
    this.blockSize = Math.max(1, Math.floor(blockSize));
    this.maxBlocks = Math.max(1, Math.floor(maxBlocks));
  }

  blockOf(index: number): number {
    return Math.floor(index / this.blockSize);
  }

  /** Block numbers that cover `[start, end)`, clamped to the known total. */
  blocksFor(start: number, end: number): number[] {
    const last = this.total === null ? end : Math.min(end, this.total);
    if (last <= start) return [];
    const out: number[] = [];
    for (let block = this.blockOf(start); block <= this.blockOf(last - 1); block += 1) {
      out.push(block);
    }
    return out;
  }

  status(block: number): BlockStatus {
    return this.blocks.get(block)?.status ?? "idle";
  }

  getRow(index: number): T | undefined {
    const block = this.blocks.get(this.blockOf(index));
    if (block?.status !== "loaded") return undefined;
    return block.rows[index - this.blockOf(index) * this.blockSize];
  }

  /** Blocks of the range that nobody has asked for yet (errors are only retried explicitly). */
  missing(start: number, end: number): number[] {
    return this.blocksFor(start, end).filter((block) => this.status(block) === "idle");
  }

  markLoading(block: number): void {
    this.blocks.set(block, { status: "loading", rows: [] });
  }

  markError(block: number): void {
    this.blocks.set(block, { status: "error", rows: [] });
  }

  /** Clears error blocks of the range so `missing` offers them again. */
  retry(start: number, end: number): void {
    for (const block of this.blocksFor(start, end)) {
      if (this.status(block) === "error") this.blocks.delete(block);
    }
  }

  hasError(start: number, end: number): boolean {
    return this.blocksFor(start, end).some((block) => this.status(block) === "error");
  }

  isLoading(start: number, end: number): boolean {
    return this.blocksFor(start, end).some((block) => this.status(block) === "loading");
  }

  /** Stores a response, learns the total and evicts old blocks outside `keep`. */
  setBlock(block: number, rows: readonly T[], total: number, keep: readonly number[] = []): void {
    this.total = total;
    this.blocks.delete(block);
    this.blocks.set(block, { status: "loaded", rows });
    this.evict(new Set([...keep, block]));
  }

  /** Marks blocks as recently used. */
  touch(blocks: readonly number[]): void {
    for (const block of blocks) {
      const entry = this.blocks.get(block);
      if (entry?.status === "loaded") {
        this.blocks.delete(block);
        this.blocks.set(block, entry);
      }
    }
  }

  loadedBlocks(): number[] {
    return [...this.blocks.entries()].filter(([, b]) => b.status === "loaded").map(([n]) => n);
  }

  clear(): void {
    this.blocks.clear();
    this.total = null;
  }

  private evict(keep: ReadonlySet<number>): void {
    const loaded = this.loadedBlocks();
    let excess = loaded.length - this.maxBlocks;
    for (const block of loaded) {
      if (excess <= 0) break;
      if (keep.has(block)) continue;
      this.blocks.delete(block);
      excess -= 1;
    }
  }
}
