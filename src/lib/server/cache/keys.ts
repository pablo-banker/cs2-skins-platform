/**
 * Deterministic cache keys.
 *
 * Two requests that mean the same thing must produce the same string, whatever
 * order their properties were written in and whatever case the visitor typed.
 * Otherwise the cache quietly stops working and nobody notices except the
 * quota.
 *
 * Keys are built only from the arguments passed in. No environment value, no
 * API key and no credential ever reaches a key — a cache key can end up in a
 * diagnostic or a log line, so it holds request shape and nothing else.
 */

type KeyValue = string | number | boolean | string[] | null | undefined;

/**
 * CS2Cap matches these filters case-insensitively, so `Redline` and `redline`
 * are the same request and must share a key.
 */
function normalizeText(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeValue(value: Exclude<KeyValue, null | undefined>): string {
	if (Array.isArray(value)) {
		// Provider order is not part of the request's meaning.
		return [...value].map(normalizeText).sort().join(',');
	}

	return typeof value === 'string' ? normalizeText(value) : String(value);
}

/** Sorted `k=v` pairs, with empty values dropped so they cannot split a key. */
function stableParams(params: Record<string, KeyValue>): string {
	return Object.entries(params)
		.filter(([, value]) => value !== undefined && value !== null && value !== '')
		.map(([key, value]) => `${key}=${normalizeValue(value as Exclude<KeyValue, null | undefined>)}`)
		.sort()
		.join(':');
}

export const cacheKeys = {
	catalogSearch(params: Record<string, KeyValue>): string {
		return `catalog:search:${stableParams(params)}`;
	},

	catalogSkin(weapon: string, name: string): string {
		return `catalog:skin:${normalizeText(weapon)}|${normalizeText(name)}`;
	},

	catalogMetadata(): string {
		return 'catalog:metadata';
	},

	catalogIndex(itemType: string): string {
		return `catalog:index:type=${normalizeText(itemType)}`;
	},

	providers(): string {
		return 'market:providers';
	},

	prices(params: {
		itemId: number;
		currency: string;
		providerIds?: string[];
		excludeStale: boolean;
	}): string {
		return `market:prices:${stableParams({
			item: params.itemId,
			currency: params.currency,
			providers: params.providerIds,
			excludeStale: params.excludeStale
		})}`;
	},

	/**
	 * One whole batch lookup.
	 *
	 * Keyed on the **sorted unique** ids, so the same set of items in a
	 * different order is the same request — a kit and a reordered kit must not
	 * cost two upstream calls.
	 */
	pricesBatch(params: {
		itemIds: number[];
		currency: string;
		providerIds?: string[];
		excludeStale: boolean;
	}): string {
		const items = [...new Set(params.itemIds)].sort((a, b) => a - b).join(',');

		return `market:prices:batch:${stableParams({
			items,
			currency: params.currency,
			providers: params.providerIds,
			excludeStale: params.excludeStale
		})}`;
	},

	priceHistory(params: {
		itemId: number;
		currency: string;
		interval: string;
		lookbackDays: number;
	}): string {
		return `market:history:${stableParams({
			item: params.itemId,
			currency: params.currency,
			interval: params.interval,
			lookback: params.lookbackDays
		})}`;
	}
};
