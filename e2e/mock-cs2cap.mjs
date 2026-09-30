/**
 * A stand-in for the CS2Cap API, used only by end-to-end tests.
 *
 * End-to-end runs must not depend on a third party being up, and CI must never
 * hold a real API key — so `CS2CAP_BASE_URL` points the integration here and
 * the catalog becomes a small, predictable fixture. The shapes below mirror
 * the documented responses; nothing here is fetched.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_CS2CAP_PORT ?? 4180);

const WEARS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

const SKINS = [
	{
		weapon: 'AK-47',
		name: 'Redline',
		type: 'Assault Rifle',
		rarity: 'Classified',
		collection: 'The Phoenix Collection'
	},
	{
		weapon: 'AK-47',
		name: 'Asiimov',
		type: 'Assault Rifle',
		rarity: 'Covert',
		collection: 'The Phoenix Collection'
	},
	{
		weapon: 'AK-47',
		name: 'Vulcan',
		type: 'Assault Rifle',
		rarity: 'Covert',
		collection: 'The Huntsman Collection'
	},
	{
		weapon: 'AWP',
		name: 'Asiimov',
		type: 'Sniper Rifle',
		rarity: 'Covert',
		collection: 'The Phoenix Collection'
	},
	{
		weapon: 'AWP',
		name: 'Neo-Noir',
		type: 'Sniper Rifle',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	},
	{
		weapon: 'M4A1-S',
		name: 'Printstream',
		type: 'Rifle',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	},
	{
		weapon: 'Glock-18',
		name: 'Fade',
		type: 'Pistol',
		rarity: 'Restricted',
		collection: 'The Assault Collection'
	},
	{
		weapon: 'USP-S',
		name: 'Cortex',
		type: 'Pistol',
		rarity: 'Classified',
		collection: 'The Clutch Collection'
	}
];

/**
 * The skins the editorial kits name.
 *
 * `/kits` resolves its dataset against the catalog, so the fixture has to
 * contain what the dataset references or the page cannot render. Weapon,
 * finish, type and rarity match the real catalog entries these kits were
 * curated from.
 */
const KIT_SKINS = [
	{ weapon: 'AWP', name: 'Redline', type: 'Sniper Rifle', rarity: 'Classified' },
	{ weapon: 'M4A1-S', name: 'Hot Rod', type: 'Assault Rifle', rarity: 'Classified' },
	{ weapon: 'Glock-18', name: 'Candy Apple', type: 'Pistol', rarity: 'Mil-Spec Grade' },
	{ weapon: 'USP-S', name: 'Check Engine', type: 'Pistol', rarity: 'Mil-Spec Grade' },
	{ weapon: 'AWP', name: 'Printstream', type: 'Sniper Rifle', rarity: 'Covert' },
	{ weapon: 'USP-S', name: 'Whiteout', type: 'Pistol', rarity: 'Classified' },
	{ weapon: 'AK-47', name: 'Slate', type: 'Assault Rifle', rarity: 'Restricted' },
	{ weapon: 'AK-47', name: 'Blue Laminate', type: 'Assault Rifle', rarity: 'Restricted' },
	{ weapon: 'M4A1-S', name: 'Bright Water', type: 'Assault Rifle', rarity: 'Restricted' },
	{ weapon: 'AWP', name: 'Silk Tiger', type: 'Sniper Rifle', rarity: 'Classified' },
	{ weapon: 'Glock-18', name: 'Ocean Topo', type: 'Pistol', rarity: 'Industrial Grade' },
	{ weapon: 'USP-S', name: 'Blueprint', type: 'Pistol', rarity: 'Mil-Spec Grade' },
	{ weapon: 'AK-47', name: 'Black Laminate', type: 'Assault Rifle', rarity: 'Mil-Spec Grade' },
	{ weapon: 'AWP', name: 'Graphite', type: 'Sniper Rifle', rarity: 'Classified' },
	{ weapon: 'M4A1-S', name: 'Basilisk', type: 'Assault Rifle', rarity: 'Restricted' },
	{ weapon: 'USP-S', name: 'Night Ops', type: 'Pistol', rarity: 'Mil-Spec Grade' },
	{ weapon: 'Glock-18', name: 'Night', type: 'Pistol', rarity: 'Industrial Grade' }
];

for (const skin of KIT_SKINS) {
	SKINS.push({ ...skin, collection: 'The Clutch Collection' });
}

/**
 * A knife and a pair of gloves.
 *
 * The loadout builder's Knife and Gloves slots match on `item_subtype`, not on
 * a base name, so the fixture needs at least one of each for those slots to be
 * testable at all.
 */
SKINS.push(
	{
		weapon: 'Karambit',
		name: 'Doppler',
		type: 'Knife',
		subtype: 'Knives',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	},
	{
		weapon: 'Sport Gloves',
		name: 'Vice',
		type: 'Wearable',
		subtype: 'Gloves',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	}
);

/**
 * What Smart Loadout needs to be able to generate anything.
 *
 * The generator draws only on the curated visual dataset, so a colour is
 * offered on `/smart-loadout` only when **every** required Smart Core entry has
 * a curated skin in that colour. The fixture above already covers red for the
 * Glock-18, AK-47, USP-S, M4A1-S and AWP; these fill the two gaps — a Desert
 * Eagle, and a knife and gloves for the optional extras.
 *
 * Every entry below is a real record in `skin-visual-metadata.json`. Inventing
 * one here would make the suite pass against a dataset the product does not
 * have.
 */
SKINS.push(
	// Desert Eagle: red, one with a `dark` style and one without, which is what
	// makes the colour+style fallback observable.
	{
		weapon: 'Desert Eagle',
		name: 'Code Red',
		type: 'Pistol',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	},
	{
		weapon: 'Desert Eagle',
		name: 'Crimson Web',
		type: 'Pistol',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	},
	{
		weapon: 'Karambit',
		name: 'Crimson Web',
		type: 'Knife',
		subtype: 'Knives',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	},
	{
		weapon: 'Sport Gloves',
		name: 'Red Racer',
		type: 'Wearable',
		subtype: 'Gloves',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	}
);

/**
 * A second knife family and a second glove family, both curated red-and-dark.
 *
 * Visual recommendations group by **Builder slot**, so one Karambit cannot
 * demonstrate that a knife recommends other knives — the Knife slot holds
 * twenty base names. These two also give the cross-slot matcher a knife and a
 * pair of gloves strong enough to survive the one-per-slot cut, which is what
 * makes the knife -> gloves journey testable.
 *
 * Both are real records in `skin-visual-metadata.json`.
 */
SKINS.push(
	{
		weapon: 'M9 Bayonet',
		name: 'Crimson Web',
		type: 'Knife',
		subtype: 'Knives',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	},
	{
		weapon: 'Specialist Gloves',
		name: 'Crimson Web',
		type: 'Wearable',
		subtype: 'Gloves',
		rarity: 'Covert',
		collection: 'The Clutch Collection'
	}
);

// Enough distinct skins that pagination has more than one page (24 per page).
for (let i = 0; i < 30; i++) {
	SKINS.push({
		weapon: 'Desert Eagle',
		name: `Sample ${String(i + 1).padStart(2, '0')}`,
		type: 'Pistol',
		rarity: i % 2 === 0 ? 'Mil-Spec Grade' : 'Restricted',
		collection: 'The Assault Collection'
	});
}

let nextId = 1000;

const items = SKINS.flatMap((skin) =>
	WEARS.flatMap((wear) => {
		const base = {
			item_type: 'Weapon',
			// The builder's Knife and Gloves slots match on this; everything
			// else falls back to the firearm grouping it belongs to.
			item_subtype: skin.subtype ?? 'Rifles',
			weapon_type: skin.type,
			base_name: skin.weapon,
			skin_name: skin.name,
			wear_name: wear,
			collection: skin.collection,
			rarity_name: skin.rarity,
			rarity_color: 'eb4b4b',
			min_float: 0,
			max_float: 1,
			image_url: null
		};

		const rows = [
			{
				...base,
				item_id: nextId++,
				market_hash_name: `${skin.weapon} | ${skin.name} (${wear})`,
				is_stattrak: false,
				is_souvenir: false
			}
		];

		// One StatTrak and one Souvenir skin, so those filters have something
		// to find and something to exclude.
		if (skin.weapon === 'AK-47' && skin.name === 'Redline') {
			rows.push({
				...base,
				item_id: nextId++,
				market_hash_name: `StatTrak™ ${skin.weapon} | ${skin.name} (${wear})`,
				is_stattrak: true,
				is_souvenir: false
			});
		}

		if (skin.weapon === 'USP-S' && skin.name === 'Cortex') {
			rows.push({
				...base,
				item_id: nextId++,
				market_hash_name: `Souvenir ${skin.weapon} | ${skin.name} (${wear})`,
				is_stattrak: false,
				is_souvenir: true
			});
		}

		return rows;
	})
);

/** A handful of marketplaces, including two modes of one brand. */
const providers = {
	Steam: { key: 'steam', logo: null, market_type: 'OFFICIAL', health: { status: 'up' } },
	'Skins.com': { key: 'skinscom', logo: null, market_type: 'P2P', health: { status: 'up' } },
	CSFloat: { key: 'csfloat', logo: null, market_type: 'P2P', health: { status: 'up' } },
	'CS.MONEY - Market': {
		key: 'csmoney_m',
		logo: null,
		market_type: 'HYBRID',
		health: { status: 'up' }
	},
	'CS.MONEY - Trade': {
		key: 'csmoney_t',
		logo: null,
		market_type: 'TRADING',
		health: { status: 'up' }
	}
};

/**
 * Items nothing is currently listed for.
 *
 * One skin with no quotes, so the kit that contains it exercises the degraded
 * path: per-item "no current prices", no kit total, no purchase plan — while
 * every other kit still prices completely.
 */
const UNPRICED_ITEM_IDS = new Set(
	items
		.filter((item) => item.base_name === 'AWP' && item.skin_name === 'Silk Tiger')
		.map((item) => item.item_id)
);

/**
 * Prices derived from the item id, so every variant has its own — switching
 * exterior or edition must visibly change the numbers.
 *
 * Steam quotes everything, so a kit can have a complete Steam comparison, and
 * it undercuts the rest on odd item ids only. That makes the cheapest plan for
 * a mixed kit span two marketplaces while Skins.com — which quotes everything
 * at the base price — can still supply the whole kit on its own. Without that
 * asymmetry the two purchase strategies would always agree and neither would
 * be worth testing.
 */
function quotesFor(itemId) {
	if (UNPRICED_ITEM_IDS.has(itemId)) return [];

	const base = 10000 + (itemId % 97) * 137;

	return [
		{ provider: 'skinscom', delta: 0 },
		{ provider: 'steam', delta: itemId % 2 === 1 ? -60 : 900 },
		{ provider: 'csfloat', delta: 45 },
		{ provider: 'csmoney_m', delta: 160 },
		{ provider: 'csmoney_t', delta: 320 }
	].map(({ provider, delta }) => ({
		provider,
		item_id: itemId,
		market_hash_name: `item-${itemId}`,
		lowest_ask: base + delta,
		quantity: 12,
		link: `https://cs2c.app/r/${provider}/${itemId}`,
		last_updated: new Date().toISOString(),
		stale: false
	}));
}

/** Thirty daily candles trending gently down. */
function candlesFor(itemId) {
	const base = 10000 + (itemId % 97) * 137;
	const day = 86_400;
	const start = Math.floor(Date.now() / 1000 / day) * day - 29 * day;

	return Array.from({ length: 30 }, (_, index) => {
		const close = base + (29 - index) * 12;

		return {
			t: start + index * day,
			o: close + 5,
			h: close + 40,
			l: close - 40,
			c: close,
			v: 20,
			q: 100,
			providers: { o: 'skinscom', h: 'csfloat', l: 'skinscom', c: 'skinscom' }
		};
	});
}

const metadata = {
	catalog: { total_items: items.length },
	filters: {
		item_type: ['Weapon'],
		item_subtype: [...new Set(SKINS.map((s) => s.subtype ?? 'Rifles'))],
		weapon_type: [...new Set(SKINS.map((s) => s.type))],
		wear_name: [...WEARS].reverse(),
		phase: [],
		collection: [...new Set(SKINS.map((s) => s.collection))],
		rarity_name: [...new Set(SKINS.map((s) => s.rarity))],
		rarity_color: ['eb4b4b'],
		style_name: []
	}
};

/** Reads a JSON request body, or `undefined` when there is not one. */
async function readJson(request) {
	const chunks = [];
	for await (const chunk of request) chunks.push(chunk);
	if (chunks.length === 0) return undefined;

	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8'));
	} catch {
		return undefined;
	}
}

const server = createServer(async (request, response) => {
	const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
	const send = (status, body) => {
		response.writeHead(status, { 'content-type': 'application/json' });
		response.end(JSON.stringify(body));
	};

	/**
	 * `POST /v1/prices/batch`, in the shape the published OpenAPI contract
	 * describes — quotes nested under their item, and **no `link` field**,
	 * which is the one real difference from the per-item endpoint.
	 */
	if (url.pathname === '/v1/prices/batch') {
		if (request.method !== 'POST') return send(405, { code: 'METHOD_NOT_ALLOWED' });

		const body = await readJson(request);
		const itemIds = Array.isArray(body?.item_ids) ? body.item_ids : [];

		if (itemIds.length === 0) {
			return send(422, { code: 'VALIDATION_ERROR', detail: 'item_ids' });
		}

		if (itemIds.length > 100) {
			return send(400, { code: 'BAD_REQUEST', detail: 'Batch size exceeded' });
		}

		const found = [];
		const notFound = [];

		for (const itemId of itemIds) {
			const quotes = quotesFor(itemId).filter(
				(quote) => body?.exclude_stale !== true || !quote.stale
			);

			if (quotes.length === 0) {
				notFound.push(itemId);
				continue;
			}

			found.push({
				item_id: itemId,
				market_hash_name: `item-${itemId}`,
				phase: null,
				quotes: quotes.map(({ provider, lowest_ask, quantity, last_updated, stale }) => ({
					provider,
					lowest_ask,
					quantity,
					last_updated,
					stale
				}))
			});
		}

		return send(200, {
			meta: {
				currency: body?.currency ?? 'BRL',
				requested_item_count: itemIds.length,
				found_item_count: found.length,
				providers_queried: Object.values(providers).map((entry) => entry.key),
				generated_at: new Date().toISOString()
			},
			items: found,
			items_not_found: notFound,
			names_not_found: []
		});
	}

	if (url.pathname === '/v1/items/metadata') {
		return send(200, metadata);
	}

	if (url.pathname === '/v1/providers') {
		return send(200, providers);
	}

	if (url.pathname === '/v1/prices') {
		const itemId = Number(url.searchParams.get('item_id'));
		if (!Number.isFinite(itemId)) return send(422, { code: 'VALIDATION_ERROR', detail: 'item_id' });

		const quotes = quotesFor(itemId);

		return send(200, {
			meta: {
				currency: url.searchParams.get('currency') ?? 'BRL',
				filters: {},
				providers_queried: quotes.map((quote) => quote.provider)
			},
			items: quotes,
			pagination: {
				limit: quotes.length,
				offset: 0,
				total: quotes.length,
				has_next: false,
				has_prev: false
			}
		});
	}

	if (url.pathname === '/v1/prices/candles') {
		const itemId = Number(url.searchParams.get('item_id'));
		if (!Number.isFinite(itemId)) return send(422, { code: 'VALIDATION_ERROR', detail: 'item_id' });

		const data = candlesFor(itemId);

		return send(200, {
			meta: {
				item_id: itemId,
				market_hash_name: `item-${itemId}`,
				currency: url.searchParams.get('currency') ?? 'BRL',
				interval: '1d',
				start: new Date(data[0].t * 1000).toISOString(),
				end: new Date((data.at(-1).t + 86_400) * 1000).toISOString()
			},
			data
		});
	}

	if (url.pathname === '/v1/items') {
		const itemType = url.searchParams.get('item_type');
		const matched = itemType ? items.filter((item) => item.item_type === itemType) : items;

		return send(200, {
			items: matched,
			pagination: {
				limit: matched.length,
				offset: 0,
				total: matched.length,
				has_next: false,
				has_prev: false
			}
		});
	}

	return send(404, { code: 'NOT_FOUND', detail: 'Not found' });
});

server.listen(PORT, () => {
	console.log(`mock cs2cap listening on http://localhost:${PORT}/v1`);
});
