import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtlCache } from './ttl-cache';

const TTL = 60_000;

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

/** Resolves only when `release()` is called, so overlap is deterministic. */
function deferred<T>() {
	let release!: (value: T) => void;
	let fail!: (reason: unknown) => void;

	const promise = new Promise<T>((resolve, reject) => {
		release = resolve;
		fail = reject;
	});

	return { promise, release, fail };
}

describe('TtlCache.getOrLoad', () => {
	it('loads on a miss and returns the value', async () => {
		const cache = new TtlCache();
		const load = vi.fn().mockResolvedValue('redline');

		await expect(cache.getOrLoad('k', TTL, load)).resolves.toBe('redline');
		expect(load).toHaveBeenCalledTimes(1);
		expect(cache.stats()).toMatchObject({ misses: 1, hits: 0, size: 1 });
	});

	it('serves the second identical call from cache without loading again', async () => {
		const cache = new TtlCache();
		const load = vi.fn().mockResolvedValue('redline');

		await cache.getOrLoad('k', TTL, load);
		await expect(cache.getOrLoad('k', TTL, load)).resolves.toBe('redline');

		expect(load).toHaveBeenCalledTimes(1);
		expect(cache.stats()).toMatchObject({ hits: 1, misses: 1 });
	});

	it('reloads once the TTL has passed', async () => {
		const cache = new TtlCache();
		const load = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

		await cache.getOrLoad('k', TTL, load);
		vi.advanceTimersByTime(TTL + 1);

		await expect(cache.getOrLoad('k', TTL, load)).resolves.toBe('second');
		expect(load).toHaveBeenCalledTimes(2);
		expect(cache.stats().expirations).toBe(1);
	});

	it('still serves a value that has not quite expired', async () => {
		const cache = new TtlCache();
		const load = vi.fn().mockResolvedValue('first');

		await cache.getOrLoad('k', TTL, load);
		vi.advanceTimersByTime(TTL - 1);

		await expect(cache.getOrLoad('k', TTL, load)).resolves.toBe('first');
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('keeps different keys independent', async () => {
		const cache = new TtlCache();
		const load = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');

		await expect(cache.getOrLoad('a', TTL, load)).resolves.toBe('a');
		await expect(cache.getOrLoad('b', TTL, load)).resolves.toBe('b');
		expect(load).toHaveBeenCalledTimes(2);
	});
});

describe('TtlCache error handling', () => {
	it('does not cache a rejected load, so the next call may retry upstream', async () => {
		const cache = new TtlCache();
		const load = vi
			.fn()
			.mockRejectedValueOnce(new Error('429 rate limited'))
			.mockResolvedValueOnce('recovered');

		await expect(cache.getOrLoad('k', TTL, load)).rejects.toThrow('429 rate limited');
		expect(cache.stats().size).toBe(0);

		await expect(cache.getOrLoad('k', TTL, load)).resolves.toBe('recovered');
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('treats a synchronous throw in the loader as a failed load', async () => {
		const cache = new TtlCache();
		const load = vi.fn(() => {
			throw new Error('bad config');
		});

		await expect(cache.getOrLoad('k', TTL, load)).rejects.toThrow('bad config');
		expect(cache.stats()).toMatchObject({ size: 0, inFlight: 0 });
	});

	it('clears the in-flight entry after a failure so the key is not wedged', async () => {
		const cache = new TtlCache();
		const first = deferred<string>();
		const load = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce('ok');

		const pending = cache.getOrLoad('k', TTL, load);
		expect(cache.stats().inFlight).toBe(1);

		first.fail(new Error('upstream down'));
		await expect(pending).rejects.toThrow('upstream down');
		expect(cache.stats().inFlight).toBe(0);

		await expect(cache.getOrLoad('k', TTL, load)).resolves.toBe('ok');
	});
});

describe('TtlCache in-flight deduplication', () => {
	it('collapses ten concurrent calls for one key into a single load', async () => {
		const cache = new TtlCache();
		const gate = deferred<string>();
		const load = vi.fn().mockReturnValue(gate.promise);

		const callers = Array.from({ length: 10 }, () => cache.getOrLoad('k', TTL, load));
		expect(load).toHaveBeenCalledTimes(1);
		expect(cache.stats()).toMatchObject({ misses: 1, coalesced: 9, inFlight: 1 });

		gate.release('one upstream call');

		await expect(Promise.all(callers)).resolves.toEqual(
			Array.from({ length: 10 }, () => 'one upstream call')
		);
		expect(load).toHaveBeenCalledTimes(1);
		expect(cache.stats().inFlight).toBe(0);
	});

	it('does not deduplicate across different keys', async () => {
		const cache = new TtlCache();
		const load = vi.fn().mockResolvedValue('value');

		await Promise.all([cache.getOrLoad('a', TTL, load), cache.getOrLoad('b', TTL, load)]);

		expect(load).toHaveBeenCalledTimes(2);
		expect(cache.stats().coalesced).toBe(0);
	});

	it('shares one rejection with every coalesced caller', async () => {
		const cache = new TtlCache();
		const gate = deferred<string>();
		const load = vi.fn().mockReturnValue(gate.promise);

		const callers = [cache.getOrLoad('k', TTL, load), cache.getOrLoad('k', TTL, load)];
		gate.fail(new Error('timeout'));

		await expect(Promise.allSettled(callers)).resolves.toEqual([
			expect.objectContaining({ status: 'rejected' }),
			expect.objectContaining({ status: 'rejected' })
		]);
		expect(load).toHaveBeenCalledTimes(1);
		expect(cache.stats().size).toBe(0);
	});
});

describe('TtlCache bounds', () => {
	it('never exceeds its maximum entry count', async () => {
		const cache = new TtlCache({ maxEntries: 3 });

		for (let i = 0; i < 25; i++) {
			await cache.getOrLoad(`key-${i}`, TTL, async () => i);
		}

		expect(cache.stats().size).toBeLessThanOrEqual(3);
		expect(cache.stats().evictions).toBeGreaterThan(0);
	});

	it('evicts the least recently used entry, not the least recently written', async () => {
		const cache = new TtlCache({ maxEntries: 3 });
		const load = (value: string) => async () => value;

		await cache.getOrLoad('a', TTL, load('a'));
		await cache.getOrLoad('b', TTL, load('b'));

		// Touching 'a' makes 'b' the least recently used.
		await cache.getOrLoad('a', TTL, load('a'));

		const reload = vi.fn(load('c'));
		await cache.getOrLoad('c', TTL, reload);

		const aLoader = vi.fn(load('a-again'));
		await expect(cache.getOrLoad('a', TTL, aLoader)).resolves.toBe('a');
		expect(aLoader).not.toHaveBeenCalled();
	});

	it('drops expired entries before evicting a live one', async () => {
		// Capacity 2, so the third write is the one that has to make room.
		const cache = new TtlCache({ maxEntries: 2 });

		await cache.getOrLoad('short', 1_000, async () => 'short');
		await cache.getOrLoad('long-a', TTL, async () => 'long-a');
		vi.advanceTimersByTime(2_000);

		await cache.getOrLoad('long-b', TTL, async () => 'long-b');

		// The expired entry made room, so the live one survived untouched.
		expect(cache.stats().expirations).toBe(1);
		expect(cache.stats().evictions).toBe(0);

		const longALoader = vi.fn(async () => 'reloaded');
		await expect(cache.getOrLoad('long-a', TTL, longALoader)).resolves.toBe('long-a');
		expect(longALoader).not.toHaveBeenCalled();
	});
});

describe('TtlCache.clear and delete', () => {
	it('clear empties the cache and resets the counters', async () => {
		const cache = new TtlCache();
		const load = vi.fn().mockResolvedValue('value');

		await cache.getOrLoad('k', TTL, load);
		await cache.getOrLoad('k', TTL, load);
		cache.clear();

		expect(cache.stats()).toMatchObject({ size: 0, hits: 0, misses: 0 });

		await cache.getOrLoad('k', TTL, load);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('delete removes a single key and reports whether it was there', async () => {
		const cache = new TtlCache();
		await cache.getOrLoad('k', TTL, async () => 'value');

		expect(cache.delete('k')).toBe(true);
		expect(cache.delete('k')).toBe(false);
		expect(cache.stats().size).toBe(0);
	});
});
