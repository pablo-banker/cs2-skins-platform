/**
 * Fixtures for the developer component preview.
 *
 * Controlled, local, and never shipped: this file exists only for the
 * dev-only route beside it. Nothing here is production data, no CS2Cap call is
 * made to render it, and none of it belongs in
 * `src/lib/data/skin-visual-metadata.json`.
 */
import type { Skin, SkinVariant } from '$lib/types/skin';
import type { MarketProvider } from '$lib/types/provider';
import type { MarketQuote } from '$lib/types/market';

/**
 * A real CDN image, used here only to check that letterboxing and proportions
 * look right against genuine artwork. Production components must work without
 * any URL at all, which the "no image" cases below exercise.
 */
const AK_IMAGE =
	'https://cdn.cs2c.app/images/econ/default_generated/weapon_ak47_cu_ak47_cobra_light_png.png';

function variant(overrides: Partial<SkinVariant> = {}): SkinVariant {
	return {
		itemId: 1,
		marketHashName: 'Preview Item',
		wear: 'Field-Tested',
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

export const rifle: Skin = {
	id: 'ak-47-redline',
	weapon: 'AK-47',
	name: 'Redline',
	fullName: 'AK-47 | Redline',
	imageUrl: AK_IMAGE,
	rarity: { name: 'Classified', color: '#D32CE6' },
	collection: 'The Phoenix Collection',
	weaponType: 'Assault Rifle',
	variants: [variant({ itemId: 12632, marketHashName: 'AK-47 | Redline (Field-Tested)' })]
};

/** No artwork — exercises the fallback without breaking the grid. */
export const noImage: Skin = {
	...rifle,
	id: 'awp-neo-noir',
	weapon: 'AWP',
	name: 'Neo-Noir',
	fullName: 'AWP | Neo-Noir',
	imageUrl: undefined,
	rarity: { name: 'Covert', color: '#EB4B4B' },
	weaponType: 'Sniper Rifle'
};

/** A knife: different proportions, a phase, and a ★ in the weapon name. */
export const knife: Skin = {
	id: 'karambit-doppler',
	weapon: '★ Karambit',
	name: 'Doppler',
	fullName: '★ Karambit | Doppler',
	rarity: { name: 'Extraordinary' },
	weaponType: 'Knife',
	variants: []
};

/** Gloves have no wear-free variant and an unfamiliar rarity name. */
export const gloves: Skin = {
	id: 'specialist-gloves-crimson-kimono',
	weapon: 'Specialist Gloves',
	name: 'Crimson Kimono',
	fullName: 'Specialist Gloves | Crimson Kimono',
	rarity: { name: 'Master' },
	weaponType: 'Gloves',
	variants: []
};

/** The longest realistic identity, to prove the card does not overflow. */
export const longName: Skin = {
	id: 'm4a1-s-player-two',
	weapon: 'M4A1-S',
	name: 'Welcome to the Jungle Commemorative Edition',
	fullName: 'M4A1-S | Welcome to the Jungle Commemorative Edition',
	rarity: { name: 'Mil-Spec Grade' },
	weaponType: 'Rifle',
	variants: []
};

/** An unrecognised rarity, to prove the neutral fallback still reads. */
export const unknownRarity: Skin = {
	...noImage,
	id: 'glock-18-fade',
	weapon: 'Glock-18',
	name: 'Fade',
	fullName: 'Glock-18 | Fade',
	rarity: { name: 'Mythical Ultra Rare' }
};

export const variants = {
	fieldTested: variant(),
	statTrak: variant({ itemId: 12633, statTrak: true, wear: 'Minimal Wear' }),
	souvenir: variant({ itemId: 45208, souvenir: true }),
	phased: variant({ itemId: 999, wear: 'Factory New', phase: 'Phase 2' })
};

export const providers: MarketProvider[] = [
	{
		id: 'csfloat',
		name: 'CSFloat',
		logoUrl: 'https://cdn.cs2c.app/images/providers/csfloat.png',
		marketType: 'P2P',
		status: 'up'
	},
	{
		id: 'skinport',
		name: 'Skinport',
		logoUrl: 'https://cdn.cs2c.app/images/providers/skinport.png',
		marketType: 'P2P',
		status: 'up'
	},
	{
		id: 'nologo',
		name: 'Quiet Market',
		marketType: 'STORE',
		status: 'degraded'
	}
];

function quote(overrides: Partial<MarketQuote> = {}): MarketQuote {
	return {
		providerId: 'csfloat',
		itemId: 12632,
		priceMinor: 12873,
		currency: 'BRL',
		quantity: 3603,
		updatedAt: '2026-09-20T05:33:52Z',
		stale: false,
		redirectUrl: 'https://cs2c.app/r/csfloat/12632',
		...overrides
	};
}

export const quotes = {
	best: quote({ providerId: 'skinport', priceMinor: 12828 }),
	normal: quote(),
	noLink: quote({ providerId: 'nologo', priceMinor: 16400, redirectUrl: undefined }),
	zero: quote({ providerId: 'nologo', priceMinor: 0, redirectUrl: undefined })
};
