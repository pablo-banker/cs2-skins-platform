import { afterEach, describe, expect, it } from 'vitest';
import { cacheKeys } from './keys';

describe('cacheKeys determinism', () => {
	it('produces the same key regardless of property order', () => {
		const a = cacheKeys.catalogSearch({ q: 'redline', wear: 'Field-Tested', limit: 20 });
		const b = cacheKeys.catalogSearch({ limit: 20, wear: 'Field-Tested', q: 'redline' });

		expect(a).toBe(b);
	});

	it('ignores case and surrounding whitespace, which upstream also ignores', () => {
		expect(cacheKeys.catalogSearch({ q: '  ReDLine  ' })).toBe(
			cacheKeys.catalogSearch({ q: 'redline' })
		);
		expect(cacheKeys.catalogSkin('AK-47', 'Redline')).toBe(
			cacheKeys.catalogSkin('ak-47', 'redline')
		);
	});

	it('collapses repeated whitespace inside a query', () => {
		expect(cacheKeys.catalogSearch({ q: 'AK-47   |   Redline' })).toBe(
			cacheKeys.catalogSearch({ q: 'AK-47 | Redline' })
		);
	});

	it('drops empty and nullish values instead of letting them split a key', () => {
		const withEmpties = cacheKeys.catalogSearch({
			q: 'redline',
			wear: undefined,
			rarity: null,
			collection: ''
		});

		expect(withEmpties).toBe(cacheKeys.catalogSearch({ q: 'redline' }));
	});

	it('keeps genuinely different queries apart', () => {
		expect(cacheKeys.catalogSearch({ q: 'redline' })).not.toBe(
			cacheKeys.catalogSearch({ q: 'vulcan' })
		);
		expect(cacheKeys.catalogSearch({ q: 'redline', offset: 0 })).not.toBe(
			cacheKeys.catalogSearch({ q: 'redline', offset: 40 })
		);
		expect(cacheKeys.catalogSearch({ q: 'redline', statTrak: true })).not.toBe(
			cacheKeys.catalogSearch({ q: 'redline', statTrak: false })
		);
	});

	it('treats provider order as meaningless for prices', () => {
		const base = { itemId: 12632, currency: 'BRL', excludeStale: true };

		expect(cacheKeys.prices({ ...base, providerIds: ['steam', 'csfloat'] })).toBe(
			cacheKeys.prices({ ...base, providerIds: ['csfloat', 'steam'] })
		);
	});

	it('separates currencies, staleness and history windows', () => {
		const base = { itemId: 12632, currency: 'BRL', excludeStale: true };

		expect(cacheKeys.prices(base)).not.toBe(cacheKeys.prices({ ...base, currency: 'USD' }));
		expect(cacheKeys.prices(base)).not.toBe(cacheKeys.prices({ ...base, excludeStale: false }));

		const history = { itemId: 12632, currency: 'BRL', interval: '1d', lookbackDays: 30 };
		expect(cacheKeys.priceHistory(history)).not.toBe(
			cacheKeys.priceHistory({ ...history, lookbackDays: 7 })
		);
	});

	it('namespaces keys so catalog and market entries cannot collide', () => {
		expect(cacheKeys.catalogMetadata()).toMatch(/^catalog:/);
		expect(cacheKeys.providers()).toMatch(/^market:/);
		expect(cacheKeys.catalogSkin('AK-47', 'Redline')).not.toBe(
			cacheKeys.prices({ itemId: 12632, currency: 'BRL', excludeStale: true })
		);
	});
});

describe('cacheKeys secrecy', () => {
	const originalKey = process.env.CS2CAP_API_KEY;

	afterEach(() => {
		if (originalKey === undefined) delete process.env.CS2CAP_API_KEY;
		else process.env.CS2CAP_API_KEY = originalKey;
	});

	it('never pulls a credential into a key', () => {
		process.env.CS2CAP_API_KEY = 'sk_live_supersecret_value';

		const keys = [
			cacheKeys.catalogSearch({ q: 'redline' }),
			cacheKeys.catalogSkin('AK-47', 'Redline'),
			cacheKeys.catalogMetadata(),
			cacheKeys.providers(),
			cacheKeys.prices({ itemId: 12632, currency: 'BRL', excludeStale: true }),
			cacheKeys.priceHistory({ itemId: 12632, currency: 'BRL', interval: '1d', lookbackDays: 30 })
		];

		for (const key of keys) {
			expect(key).not.toContain('sk_live_supersecret_value');
			expect(key.toLowerCase()).not.toContain('authorization');
			expect(key.toLowerCase()).not.toContain('bearer');
		}
	});
});
