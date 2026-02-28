import { CACHE_TTL_MS } from '$lib/constants';

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
	const entry = cache.get(key) as CacheEntry<T> | undefined;
	if (!entry) return null;
	if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
		cache.delete(key);
		return null;
	}
	return entry.data;
}

export function setCache<T>(key: string, data: T): void {
	cache.set(key, { data, timestamp: Date.now() });
}
