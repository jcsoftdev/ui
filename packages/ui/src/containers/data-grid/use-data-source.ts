"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { BlockCache, type DataSource } from "./data-source.js";
import type { Filters, SortRule } from "./types.js";

export interface DataSourceParams {
  sort: readonly SortRule[];
  filters: Filters;
  search: string;
  blockSize: number;
  maxBlocks?: number;
  /** Rows currently shown: `[start, end)` of the sorted, filtered result. */
  range: { start: number; end: number };
}

export interface DataSourceView<T> {
  /** Row count reported by the server; null until the first response. */
  total: number | null;
  rowAt: (index: number) => T | undefined;
  /** A request is in flight for the shown range. */
  loading: boolean;
  /** The shown range failed to load. */
  failed: boolean;
  retry: () => void;
  /** Changes whenever a block settles. */
  version: number;
}

/**
 * Drives a `DataSource`: one `BlockCache` per sort / filter / search / block size, blocks fetched
 * for the shown range, late responses of an older query dropped.
 */
export function useDataSource<T>(
  source: DataSource<T> | undefined,
  params: DataSourceParams,
): DataSourceView<T> {
  const { sort, filters, search, blockSize, maxBlocks = 20, range } = params;
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const query = JSON.stringify({ sort, filters, search });

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new cache per query, block size or source; sort and filters are tracked through `query`.
  const cache = useMemo(
    () => new BlockCache<T>(blockSize, maxBlocks),
    [source, query, blockSize, maxBlocks],
  );
  const controllers = useRef(new Set<AbortController>());
  const latest = useRef({ sort, filters, search });
  latest.current = { sort, filters, search };

  const fetchMissing = useCallback(
    (start: number, end: number) => {
      if (!source) return;
      for (const block of cache.missing(start, end)) {
        cache.markLoading(block);
        const controller = new AbortController();
        const startRow = block * cache.blockSize;
        source
          .getRows(
            {
              startRow,
              endRow: startRow + cache.blockSize,
              sort: [...latest.current.sort],
              filters: latest.current.filters,
              search: latest.current.search,
            },
            { signal: controller.signal },
          )
          .then((result) => {
            if (controller.signal.aborted) return;
            cache.setBlock(block, result.rows, result.total, cache.blocksFor(start, end));
            bump();
          })
          .catch(() => {
            if (controller.signal.aborted) return;
            cache.markError(block);
            bump();
          });
        controllers.current.add(controller);
      }
      bump();
    },
    [source, cache],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new cache means a new query, so the requests of the previous one are cancelled.
  useEffect(
    () => () => {
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
    },
    [cache],
  );

  const { start, end } = range;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the effect when a block settles, to chase a changed range.
  useEffect(() => {
    if (!source) return;
    const wantEnd = cache.total === null ? Math.max(end, start + cache.blockSize) : end;
    const missing = cache.missing(start, wantEnd);
    if (missing.length > 0) fetchMissing(start, wantEnd);
    else cache.touch(cache.blocksFor(start, wantEnd));
  }, [source, cache, start, end, fetchMissing, version]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` marks that blocks settled, so readers re-run.
  const rowAt = useCallback((index: number) => cache.getRow(index), [cache, version]);

  const retry = useCallback(() => {
    cache.retry(start, Math.max(end, start + 1));
    fetchMissing(start, Math.max(end, start + 1));
  }, [cache, start, end, fetchMissing]);

  return {
    total: cache.total,
    rowAt,
    loading:
      cache.isLoading(start, Math.max(end, start + 1)) ||
      (source !== undefined && cache.total === null && !cache.hasError(0, 1)),
    failed:
      cache.hasError(start, Math.max(end, start + 1)) ||
      (cache.total === null && cache.hasError(0, 1)),
    retry,
    version,
  };
}
