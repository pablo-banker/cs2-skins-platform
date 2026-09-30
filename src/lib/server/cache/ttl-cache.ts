/**
 * A small process-local TTL cache with in-flight request coalescing.
 *
 * **Best-effort and process-local.** It lives in one Node process's memory and
 * dies with it. Deployed across several instances or serverless workers, each
 * gets its own copy and they will not agree — which is fine, because nothing
 * here is a source of truth. Distributed caching is not a problem we have yet.
 *
 * Nothing is persisted: no files, no database, no filesystem.
 */
import { CACHE_MAX_ENTRIES } from './config';

type CacheEntry = {
	value: unknown;
	expiresAt: number;
};

export type TtlCacheStats = {
	/** Reads served from a live entry. */
	hits: number;
	/** Reads that invoked the loader. */
	misses: number;
	/** Reads that joined a load already in flight — no upstream request. */
	coalesced: number;
	/** Entries dropped because the cache was full. */
	evictions: number;
	/** Entries dropped because their TTL had passed. */
	expirations: number;
	/** Live entries currently held. */
	size: number;
	/** Loads currently in flight. */
	inFlight: number;
};

export type TtlCacheOptions = {
	maxEntries?: number;
};

export class TtlCache {
	readonly #entries = new Map<string, CacheEntry>();
	readonly #inFlight = new Map<string, Promise<unknown>>();
	readonly #maxEntries: number;

	#hits = 0;
	#misses = 0;
	#coalesced = 0;
	#evictions = 0;
	#expirations = 0;

	constructor(options: TtlCacheOptions = {}) {
		this.#maxEntries = Math.max(1, options.maxEntries ?? CACHE_MAX_ENTRIES);
	}

	/**
	 * Returns the cached value for `key`, loading it if necessary.
	 *
	 * Concurrent calls for the same key share one load: ten simultaneous
	 * requests for an uncached price produce one CS2Cap request, not ten.
	 *
	 * A rejected load is **never cached** — the error propagates to every
	 * caller waiting on it, and the next call is free to try upstream again.
	 * Caching a 429 or a timeout would turn a blip into an outage.
	 */
	async getOrLoad<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
		const cached = this.#read(key);

		if (cached) {
			this.#hits++;
			return cached.value as T;
		}

		const pending = this.#inFlight.get(key) as Promise<T> | undefined;

		if (pending) {
			this.#coalesced++;
			return pending;
		}

		this.#misses++;

		const inFlight = (async () => {
			// A synchronous throw inside `load` becomes a rejection here, so it
			// takes the same path as any other failure: nothing is written.
			const value = await load();
			this.#write(key, value, ttlMs);
			return value;
		})().finally(() => {
			this.#inFlight.delete(key);
		});

		this.#inFlight.set(key, inFlight);

		return inFlight;
	}

	/** Drops one entry. Returns whether it was there. */
	delete(key: string): boolean {
		return this.#entries.delete(key);
	}

	/**
	 * Empties the cache and resets statistics.
	 *
	 * In-flight loads are deliberately left alone: their callers are already
	 * waiting on them, and their results simply will not be cached.
	 */
	clear(): void {
		this.#entries.clear();
		this.#hits = 0;
		this.#misses = 0;
		this.#coalesced = 0;
		this.#evictions = 0;
		this.#expirations = 0;
	}

	stats(): TtlCacheStats {
		return {
			hits: this.#hits,
			misses: this.#misses,
			coalesced: this.#coalesced,
			evictions: this.#evictions,
			expirations: this.#expirations,
			size: this.#entries.size,
			inFlight: this.#inFlight.size
		};
	}

	/** Reads a live entry, dropping it if its TTL has passed. */
	#read(key: string): CacheEntry | undefined {
		const entry = this.#entries.get(key);
		if (!entry) return undefined;

		if (entry.expiresAt <= Date.now()) {
			this.#entries.delete(key);
			this.#expirations++;
			return undefined;
		}

		// Re-insert to move the key to the end of the Map's iteration order,
		// which is what makes eviction least-recently-*used* rather than
		// least-recently-written.
		this.#entries.delete(key);
		this.#entries.set(key, entry);

		return entry;
	}

	#write(key: string, value: unknown, ttlMs: number): void {
		if (ttlMs <= 0) return;

		this.#entries.delete(key);
		this.#evictIfFull();
		this.#entries.set(key, { value, expiresAt: Date.now() + ttlMs });
	}

	/** Expired entries go first; only then does the least-recently-used one. */
	#evictIfFull(): void {
		if (this.#entries.size < this.#maxEntries) return;

		const now = Date.now();

		for (const [key, entry] of this.#entries) {
			if (entry.expiresAt <= now) {
				this.#entries.delete(key);
				this.#expirations++;
			}
		}

		while (this.#entries.size >= this.#maxEntries) {
			const oldest = this.#entries.keys().next().value;
			if (oldest === undefined) break;

			this.#entries.delete(oldest);
			this.#evictions++;
		}
	}
}

/**
 * The cache the application services share.
 *
 * One instance per process, created on first import. Tests build their own
 * `TtlCache` or call `clear()` on this one.
 */
export const serverCache = new TtlCache();
