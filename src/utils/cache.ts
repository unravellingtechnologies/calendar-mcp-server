/**
 * Caching utilities for calendar events
 */

import NodeCache from 'node-cache';

// Create a cache instance with default TTL of 5 minutes
const eventCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every minute
  useClones: false // Don't clone objects for better performance
});

export interface CacheKey {
  provider: string;
  startDate: string;
  endDate: string;
  calendarIds?: string[];
  filters?: {
    title?: string;
    location?: string;
  };
}

/**
 * Generates a cache key for event queries
 */
export function generateCacheKey(key: CacheKey): string {
  const { provider, startDate, endDate, calendarIds, filters } = key;
  
  const keyParts = [
    provider,
    startDate,
    endDate,
    calendarIds ? calendarIds.sort().join(',') : 'all',
    filters ? JSON.stringify(filters) : 'no-filters'
  ];
  
  return keyParts.join('|');
}

/**
 * Gets cached events
 */
export function getCachedEvents(key: CacheKey): any[] | undefined {
  const cacheKey = generateCacheKey(key);
  return eventCache.get(cacheKey);
}

/**
 * Sets cached events
 */
export function setCachedEvents(key: CacheKey, events: any[], ttl?: number): void {
  const cacheKey = generateCacheKey(key);
  if (ttl !== undefined) {
    eventCache.set(cacheKey, events, ttl);
  } else {
    eventCache.set(cacheKey, events);
  }
}

/**
 * Invalidates cache entries for a specific provider
 */
export function invalidateProviderCache(provider: string): void {
  const keys = eventCache.keys();
  const providerKeys = keys.filter(key => key.startsWith(`${provider}|`));
  eventCache.del(providerKeys);
}

/**
 * Invalidates all cache entries
 */
export function clearCache(): void {
  eventCache.flushAll();
}

/**
 * Gets cache statistics
 */
export function getCacheStats(): {
  keys: number;
  hits: number;
  misses: number;
  hitRate: number;
} {
  const stats = eventCache.getStats();
  return {
    keys: stats.keys || 0,
    hits: stats.hits || 0,
    misses: stats.misses || 0,
    hitRate: (stats.hits || 0) / ((stats.hits || 0) + (stats.misses || 0)) || 0
  };
}

/**
 * Checks if cache is enabled
 */
export function isCacheEnabled(): boolean {
  return process.env.CACHE_ENABLED !== 'false';
}
