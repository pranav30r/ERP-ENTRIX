import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, CanceledError, ensureAuthenticated } from '../services/api';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cacheStore = new Map<string, CacheEntry<any>>();
const TTL_MS = 30_000; // 30 seconds

export function invalidateCache(keyPrefix?: string) {
  if (!keyPrefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(keyPrefix)) {
      cacheStore.delete(key);
    }
  }
}

export function clearAllCache() {
  cacheStore.clear();
}

interface UseCachedFetchOptions {
  params?: Record<string, any>;
  ttl?: number;
  enabled?: boolean;
}

interface UseCachedFetchResult<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  refetch: (bypassCache?: boolean) => Promise<T | null>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export function useCachedFetch<T>(
  url: string,
  options: UseCachedFetchOptions = {}
): UseCachedFetchResult<T> {
  const { params, ttl = TTL_MS, enabled = true } = options;
  const paramStr = params ? JSON.stringify(params) : '';
  const cacheKey = `${url}:${paramStr}`;

  const cached = cacheStore.get(cacheKey);

  const [data, setData] = useState<T | null>(cached ? (cached.data as T) : null);
  const [loading, setLoading] = useState<boolean>(!cached && enabled);
  const [refreshing, setRefreshing] = useState<boolean>(Boolean(cached) && enabled);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (bypassCache: boolean = false): Promise<T | null> => {
      if (!enabled) return null;

      const currentCached = cacheStore.get(cacheKey);
      const isFresh = currentCached ? Date.now() - currentCached.timestamp < ttl : false;

      if (!bypassCache && isFresh && currentCached) {
        setData(currentCached.data);
        setLoading(false);
        setRefreshing(false);
        return currentCached.data;
      }

      // If we have stale cache, show it immediately but flag refreshing
      if (currentCached) {
        setData(currentCached.data);
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await ensureAuthenticated();
        const res = await apiClient.get<T>(url, {
          params,
          signal: controller.signal
        });

        const fetched = res.data;
        cacheStore.set(cacheKey, { data: fetched, timestamp: Date.now() });
        setData(fetched);
        setError(null);
        return fetched;
      } catch (err: any) {
        if (err instanceof CanceledError || err?.name === 'CanceledError') {
          // Ignore cancellation
          return null;
        }
        setError(err);
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [url, cacheKey, ttl, enabled, params]
  );

  useEffect(() => {
    if (enabled) {
      fetchData(false);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, enabled]);

  return {
    data,
    loading,
    refreshing,
    error,
    refetch: (bypassCache = true) => fetchData(bypassCache),
    setData
  };
}
