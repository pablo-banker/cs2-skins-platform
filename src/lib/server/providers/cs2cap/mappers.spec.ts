import { describe, expect, it } from 'vitest';
import {
	groupItemsIntoSkins,
	sortQuotesByPrice,
	toCatalogFilters,
	toMarketProvider,
	toMarketQuote,
	toPriceHistory,
	toSkinSlug,
	toSkinVariant
} from './mappers';
import type { Cs2CapItem, Cs2CapMarketItem } from './schemas';

/** Catalog rows shaped like the documented `GET /items` payload. */
function catalogItem(overrides: Partial<Cs2CapItem> & { item_id: number }): Cs2CapItem {
	return {
		market_hash_name: 'AK-47 | Redline (Field-Tested)',
		base_name: 'AK-47',
		skin_name: 'Redline',
		wear_name: 'Field-Tested',
		weapon_type: 'Assault Rifle',
		collection: 'The Huntsman Collection',
		rarity_name: 'Classified',
		rarity_color: 'd32ce6',
		is_stattrak: false,
		is_souvenir: false,
		min_float: 0.1,
		max_float: 0.7,
		image_url: 'https://cdn.cs2c.app/images/redline.png',
		...overrides
	};
}

function marketItem(overrides: Partial<Cs2CapMarketItem> = {}): Cs2CapMarketItem {
	return {
		provider: 'csfloat',
		item_id: 156,
		market_hash_name: 'AK-47 | Redline (Field-Tested)',
		lowest_ask: 14250,
		quantity: 7,
		link: 'https://cs2c.app/r/csfloat/156',
		last_updated: '2026-03-05T05:33:52.037775Z',
		timestamp: '2026-03-04T22:19:37.184309Z',
		stale: false,
		...overrides
	};
}

describe('toSkinVariant', () => {
	it('maps a catalog row onto our variant shape', () => {
		const variant = toSkinVariant(
			catalogItem({ item_id: 156 }) as Cs2CapItem & { item_id: number }
		);

		expect(variant).toEqual({
			itemId: 156,
			marketHashName: 'AK-47 | Redline (Field-Tested)',
			wear: 'Field-Tested',
			statTrak: false,
			souvenir: false,
			phase: undefined,
			minFloat: 0.1,
			maxFloat: 0.7,
			imageUrl: 'https://cdn.cs2c.app/images/redline.png'
		});
	});

	it('treats a null wear as absent rather than null', () => {
		const variant = toSkinVariant(
			catalogItem({ item_id: 9, wear_name: null, phase: null }) as Cs2CapItem & { item_id: number }
		);

		expect(variant.wear).toBeUndefined();
	});
});

describe('groupItemsIntoSkins', () => {
	it('groups every wear of one skin into a single product-level skin', () => {
		const skins = groupItemsIntoSkins([
			catalogItem({
				item_id: 1,
				wear_name: 'Factory New',
				market_hash_name: 'AK-47 | Redline (Factory New)'
			}),
			catalogItem({
				item_id: 2,
				wear_name: 'Minimal Wear',
				market_hash_name: 'AK-47 | Redline (Minimal Wear)'
			}),
			catalogItem({ item_id: 3, wear_name: 'Field-Tested' })
		]);

		expect(skins).toHaveLength(1);
		expect(skins[0].fullName).toBe('AK-47 | Redline');
		expect(skins[0].variants.map((v) => v.wear)).toEqual([
			'Factory New',
			'Minimal Wear',
			'Field-Tested'
		]);
		expect(skins[0].variants.map((v) => v.itemId)).toEqual([1, 2, 3]);
	});

	it('keeps StatTrak and Souvenir as distinct variants of the same skin', () => {
		const skins = groupItemsIntoSkins([
			catalogItem({ item_id: 3 }),
			catalogItem({
				item_id: 4,
				is_stattrak: true,
				market_hash_name: 'StatTrak™ AK-47 | Redline (Field-Tested)'
			}),
			catalogItem({
				item_id: 5,
				is_souvenir: true,
				market_hash_name: 'Souvenir AK-47 | Redline (Field-Tested)'
			})
		]);

		expect(skins).toHaveLength(1);
		expect(skins[0].variants).toHaveLength(3);
		expect(skins[0].variants.map((v) => [v.itemId, v.statTrak, v.souvenir])).toEqual([
			[3, false, false],
			[4, true, false],
			[5, false, true]
		]);
	});

	it('never merges different skins or different weapons', () => {
		const skins = groupItemsIntoSkins([
			catalogItem({ item_id: 1 }),
			catalogItem({ item_id: 2, skin_name: 'Vulcan', market_hash_name: 'AK-47 | Vulcan (FT)' }),
			catalogItem({
				item_id: 3,
				base_name: 'M4A1-S',
				skin_name: 'Redline',
				market_hash_name: 'M4A1-S | Redline (FT)'
			})
		]);

		expect(skins.map((skin) => skin.fullName)).toEqual([
			'AK-47 | Redline',
			'AK-47 | Vulcan',
			'M4A1-S | Redline'
		]);
	});

	it('drops entries without a catalog id, because nothing can be priced without one', () => {
		const skins = groupItemsIntoSkins([
			catalogItem({ item_id: 1 }),
			{ ...catalogItem({ item_id: 0 }), item_id: null }
		]);

		expect(skins).toHaveLength(1);
		expect(skins[0].variants).toHaveLength(1);
	});

	it('keeps non-skin catalog entries separate, one group each', () => {
		const skins = groupItemsIntoSkins([
			{
				item_id: 77,
				market_hash_name: 'Fracture Case',
				base_name: null,
				skin_name: null
			},
			{
				item_id: 78,
				market_hash_name: 'Operation Bravo Case',
				base_name: null,
				skin_name: null
			}
		]);

		expect(skins).toHaveLength(2);
		expect(skins[0].fullName).toBe('Fracture Case');
		expect(skins[0].name).toBe('');
	});

	it('normalizes a bare rarity hex and ignores a non-hex alias', () => {
		const [withHex] = groupItemsIntoSkins([catalogItem({ item_id: 1, rarity_color: 'eb4b4b' })]);
		const [withAlias] = groupItemsIntoSkins([catalogItem({ item_id: 2, rarity_color: 'red' })]);

		expect(withHex.rarity).toEqual({ name: 'Classified', color: '#EB4B4B' });
		expect(withAlias.rarity).toEqual({ name: 'Classified' });
	});

	it('fills missing skin-level detail from a later variant without overwriting the first', () => {
		const skins = groupItemsIntoSkins([
			catalogItem({ item_id: 1, image_url: null, collection: null }),
			catalogItem({
				item_id: 2,
				image_url: 'https://cdn.cs2c.app/late.png',
				collection: 'Huntsman'
			})
		]);

		expect(skins[0].imageUrl).toBe('https://cdn.cs2c.app/late.png');
		expect(skins[0].collection).toBe('Huntsman');
	});
});

describe('toSkinSlug', () => {
	it('builds a URL-safe slug', () => {
		expect(toSkinSlug('AK-47', 'Redline')).toBe('ak-47-redline');
		expect(toSkinSlug('★ Karambit', 'Doppler')).toBe('karambit-doppler');
	});
});

describe('toMarketQuote', () => {
	it('preserves the ask exactly as integer minor units', () => {
		const quote = toMarketQuote(marketItem({ lowest_ask: 14250 }), 'BRL');

		expect(quote.priceMinor).toBe(14250);
		expect(Number.isInteger(quote.priceMinor)).toBe(true);
		expect(quote.currency).toBe('BRL');
	});

	it('maps the tracked link and prefers last_updated for freshness', () => {
		const quote = toMarketQuote(marketItem(), 'BRL');

		expect(quote.redirectUrl).toBe('https://cs2c.app/r/csfloat/156');
		expect(quote.updatedAt).toBe('2026-03-05T05:33:52.037775Z');
		expect(quote.providerId).toBe('csfloat');
	});

	it('falls back to timestamp when last_updated is absent', () => {
		const quote = toMarketQuote(marketItem({ last_updated: null }), 'BRL');

		expect(quote.updatedAt).toBe('2026-03-04T22:19:37.184309Z');
	});

	it('carries the stale flag through instead of hiding it', () => {
		expect(toMarketQuote(marketItem({ stale: true }), 'BRL').stale).toBe(true);
		expect(toMarketQuote(marketItem({ stale: false }), 'BRL').stale).toBe(false);
	});

	it('leaves the redirect url absent when upstream omits it', () => {
		expect(toMarketQuote(marketItem({ link: null }), 'BRL').redirectUrl).toBeUndefined();
	});
});

describe('sortQuotesByPrice', () => {
	it('puts the cheapest ask first and breaks ties on available quantity', () => {
		const quotes = [
			toMarketQuote(marketItem({ provider: 'steam', lowest_ask: 11500, quantity: 3 }), 'BRL'),
			toMarketQuote(marketItem({ provider: 'skinport', lowest_ask: 8700, quantity: 1 }), 'BRL'),
			toMarketQuote(marketItem({ provider: 'csfloat', lowest_ask: 8700, quantity: 9 }), 'BRL')
		];

		expect(sortQuotesByPrice(quotes).map((quote) => quote.providerId)).toEqual([
			'csfloat',
			'skinport',
			'steam'
		]);
	});
});

describe('toMarketProvider', () => {
	it('combines the display-name key with the stable provider key', () => {
		const provider = toMarketProvider('Youpin898', {
			key: 'youpin',
			logo: 'https://cdn.cs2c.app/images/providers/youpin.png',
			market_type: 'P2P',
			health: { status: 'up', last_checked_at: '2026-05-09T14:36:20.999290+00:00' }
		});

		expect(provider).toEqual({
			id: 'youpin',
			name: 'Youpin898',
			logoUrl: 'https://cdn.cs2c.app/images/providers/youpin.png',
			marketType: 'P2P',
			status: 'up',
			lastCheckedAt: '2026-05-09T14:36:20.999290+00:00'
		});
	});

	it('degrades an unrecognised status to unknown rather than trusting it', () => {
		const provider = toMarketProvider('Some Market', {
			key: 'some',
			health: { status: 'reticulating-splines' }
		});

		expect(provider.status).toBe('unknown');
	});
});

describe('toPriceHistory', () => {
	it('converts unix buckets to ISO timestamps and keeps minor units intact', () => {
		const history = toPriceHistory({
			meta: {
				item_id: 156,
				market_hash_name: 'AK-47 | Redline (Field-Tested)',
				currency: 'BRL',
				interval: '1d',
				start: '2026-01-20T00:00:00Z',
				end: '2026-01-22T00:00:00Z'
			},
			data: [
				{ t: 1768867200, o: 2508, h: 2535, l: 2460, c: 2516, v: 24, q: 179 },
				{ t: 1768953600, o: 2522, h: 2560, l: 2490, c: 2544, v: 18, q: 176 }
			]
		});

		expect(history.itemId).toBe(156);
		expect(history.currency).toBe('BRL');
		expect(history.interval).toBe('1d');
		expect(history.points[0]).toEqual({
			timestamp: '2026-01-20T00:00:00.000Z',
			open: 2508,
			high: 2535,
			low: 2460,
			close: 2516,
			volume: 24,
			listings: 179
		});
	});

	it('returns points oldest first regardless of upstream order', () => {
		const history = toPriceHistory({
			meta: {
				item_id: 1,
				market_hash_name: 'x',
				currency: 'BRL',
				interval: '1d',
				start: '2026-01-20T00:00:00Z',
				end: '2026-01-22T00:00:00Z'
			},
			data: [
				{ t: 1768953600, o: 2, h: 2, l: 2, c: 2 },
				{ t: 1768867200, o: 1, h: 1, l: 1, c: 1 }
			]
		});

		expect(history.points.map((point) => point.close)).toEqual([1, 2]);
		expect(history.points[0].volume).toBeUndefined();
	});
});

describe('toCatalogFilters', () => {
	it('renames the upstream filter buckets into our vocabulary', () => {
		const filters = toCatalogFilters({
			catalog: { total_items: 38837 },
			filters: {
				item_type: ['Weapon'],
				item_subtype: ['Rifles'],
				weapon_type: ['Assault Rifle'],
				wear_name: ['Factory New'],
				phase: ['Phase 1'],
				collection: ['The Fever Collection'],
				rarity_name: ['Covert'],
				style_name: ['Custom Paint Job']
			}
		});

		expect(filters.totalItems).toBe(38837);
		expect(filters.weaponTypes).toEqual(['Assault Rifle']);
		expect(filters.wears).toEqual(['Factory New']);
		expect(filters.rarities).toEqual(['Covert']);
	});
});
