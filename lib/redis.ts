/**
 * lib/redis.ts — Upstash Redis HTTP client (server-only)
 *
 * Upstash Redis uses a REST API, making it compatible with serverless and
 * edge runtimes that don't support persistent TCP connections.
 *
 * Usage:
 *   import { redis, CACHE_TTL } from '@/lib/redis';
 *
 *   // Write with TTL
 *   await redis.set('key', JSON.stringify(data), { ex: CACHE_TTL.nodes });
 *
 *   // Read
 *   const cached = await redis.get<string>('key');
 */

import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    'Upstash Redis env vars missing. Add to .env.local:\n' +
    'UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io\n' +
    'UPSTASH_REDIS_REST_TOKEN=<your-token>'
  );
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/** Cache TTL constants (seconds) */
export const CACHE_TTL = {
  /** Sensor nodes — refresh every 30 s (near real-time) */
  nodes: 30,
  /** Analytics summary — refresh every 5 min */
  analytics: 300,
  /** Broadcasts list — refresh every 2 min */
  broadcasts: 120,
  /** Alert feed — refresh every 60 s */
  alerts: 60,
  /** Reports list — refresh every 2 min */
  reports: 120,
  /** Users list — refresh every 5 min */
  users: 300,
  /** Blogs list — refresh every 10 min */
  blogs: 600,
} as const;

/**
 * Cache-aside helper — tries Redis first, falls back to `fetcher`, then
 * writes the result back to Redis before returning.
 *
 * @param key    Redis key
 * @param ttl    Seconds until expiry
 * @param fetcher Async function that returns fresh data when cache misses
 *
 * @example
 *   const nodes = await withCache('nodes:all', CACHE_TTL.nodes, () =>
 *     javaFetch<JavaSensorDto[]>('/sensors', { token })
 *   );
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
  } catch {
    // Redis unavailable — fall through to fetcher (fail-open)
    console.warn(`[redis] cache read failed for key "${key}" — falling back to source`);
  }

  const fresh = await fetcher();

  try {
    await redis.set(key, JSON.stringify(fresh), { ex: ttl });
  } catch {
    console.warn(`[redis] cache write failed for key "${key}"`);
  }

  return fresh;
}

/**
 * Invalidate one or more cache keys (e.g. after a mutation).
 *
 * @example
 *   await invalidate('broadcasts:all', 'analytics:summary');
 */
export async function invalidate(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    console.warn('[redis] cache invalidation failed for keys:', keys);
  }
}
