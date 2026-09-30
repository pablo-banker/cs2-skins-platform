import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCatalogMetadata, getSkinDetail } from './catalog';
import { serverCache } from '../cache/ttl-cache';
import type { Skin } from '$lib/types/skin';

// The service's job is orchestration — delegate, cache, normalize — so the
// CS2Cap integration is mocked out entirely. Nothing here touches the network.
vi.mock('../providers/cs2cap/items', () => ({
	getSkinByName: vi.fn(),
	getCatalogFilters: vi.fn()
}));

const { getSkinByName, getCatalogFilters } = await import('../providers/cs2cap/items');

function skin(overrides: Partial<Skin> = {}): Skin {
	return {
		id: 'ak-47-redline',
		weapon: 'AK-47',
		name: 'Redline',
		fullName: 'AK-47 | Redline',
		variants: [
			{
				itemId: 12632,
				marketHashName: 'AK-47 | Redline (Field-Tested)',
				wear: 'Field-Tested',
				statTrak: false,
				souvenir: false
			}
		],
		...overrides
	};
}

beforeEach(() => {
	vi.mocked(getSkinByName).mockReset();
	vi.mocked(getCatalogFilters).mockReset();
	serverCache.clear();
});

describe('getSkinDetail', () => {
	it('uses the complete lookup path, never the paginated search', async () => {
		vi.mocked(getSkinByName).mockResolvedValue(skin());

		const detail = await getSkinDetail({ weapon: 'AK-47', name: 'Redline' });

		expect(getSkinByName).toHaveBeenCalledWith({ weapon: 'AK-47', name: 'Redline' }, {});
		expect(detail?.fullName).toBe('AK-47 | Redline');
	});

	it('caches a resolved skin', async () => {
		vi.mocked(getSkinByName).mockResolvedValue(skin());

		await getSkinDetail({ weapon: 'AK-47', name: 'Redline' });
		await getSkinDetail({ weapon: 'ak-47', name: 'redline' });

		expect(getSkinByName).toHaveBeenCalledTimes(1);
	});

	it('returns undefined when the catalog has no such skin', async () => {
		vi.mocked(getSkinByName).mockResolvedValue(undefined);

		await expect(getSkinDetail({ weapon: 'AK-47', name: 'Nope' })).resolves.toBeUndefined();
	});
});

describe('getCatalogMetadata', () => {
	it('caches the filter vocabulary across calls', async () => {
		vi.mocked(getCatalogFilters).mockResolvedValue({
			totalItems: 38837,
			itemTypes: ['Weapon'],
			itemSubtypes: ['Rifles'],
			weaponTypes: ['Assault Rifle'],
			wears: ['Factory New'],
			phases: [],
			collections: ['The Phoenix Collection'],
			rarities: ['Classified'],
			styles: []
		});

		const first = await getCatalogMetadata();
		const second = await getCatalogMetadata();

		expect(getCatalogFilters).toHaveBeenCalledTimes(1);
		expect(second).toBe(first);
		expect(first.weaponTypes).toEqual(['Assault Rifle']);
	});
});
