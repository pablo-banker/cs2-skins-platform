import { describe, expect, it } from 'vitest';
import { createLoadoutBuilder } from './builder.svelte';
import type { ResolvedLoadoutSelection } from '$lib/server/services/loadout';
import type { LoadoutPricingResult, LoadoutSkinOption } from '$lib/types/loadout';

function option(slug: string, weapon = 'AK-47', name = 'Redline'): LoadoutSkinOption {
	return {
		slug,
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		variants: [
			{ itemId: 101, wear: 'Factory New', statTrak: false, souvenir: false },
			{ itemId: 102, wear: 'Field-Tested', statTrak: false, souvenir: false }
		]
	};
}

function resolved(slotId: string, slug: string, wear = 'Field-Tested'): ResolvedLoadoutSelection {
	return { slotId, option: option(slug), variant: { wear, edition: 'normal' } };
}

function pricingFor(fingerprint: string): LoadoutPricingResult {
	return {
		items: [],
		total: { priceMinor: 12815, currency: 'BRL' },
		complete: true,
		fingerprint
	};
}

/**
 * The bug this file exists to prevent.
 *
 * A builder starts empty and its saved loadout arrives a moment later. If
 * automatic saving runs in that window, opening `/build` overwrites the
 * loadout someone spent ten minutes on with nothing at all. `persistable` is
 * the gate, and these pin it shut.
 */
describe('hydration cannot destroy a saved loadout', () => {
	it('offers nothing to persist before restoration finishes', () => {
		const builder = createLoadoutBuilder();

		expect(builder.hydration).toBe('restoring');
		expect(builder.persistable).toBeUndefined();
	});

	it('still offers nothing after an edit made during restoration', () => {
		// Whatever happens in that window, nothing gets written over the save.
		const builder = createLoadoutBuilder();

		builder.select('ak-47', option('ak-47-redline'), { wear: 'Field-Tested' });

		expect(builder.hydration).toBe('restoring');
		expect(builder.persistable).toBeUndefined();
	});

	it('refuses pricing until restoration is resolved', () => {
		const builder = createLoadoutBuilder();

		builder.select('ak-47', option('ak-47-redline'), { wear: 'Field-Tested' });

		expect(builder.startPricing()).toBe(false);
	});

	it('begins offering state to persist only once restoration completes', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([resolved('ak-47', 'ak-47-redline')], 'local');

		expect(builder.hydration).toBe('ready');
		expect(builder.persistable).toHaveLength(1);
	});

	it('offers an empty loadout to persist only after an explicit empty start', () => {
		const builder = createLoadoutBuilder();

		builder.startEmpty();

		expect(builder.persistable).toEqual([]);
	});
});

describe('hydrate', () => {
	it('replaces everything in one transition', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([resolved('ak-47', 'ak-47-redline'), resolved('knife', 'bayonet')], 'local');

		expect(builder.filledCount).toBe(2);
		expect(builder.selectionFor('ak-47')?.skinSlug).toBe('ak-47-redline');
		expect(builder.optionFor('knife')?.slug).toBe('bayonet');
	});

	it('restores the exact variant', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate(
			[
				{
					slotId: 'knife',
					option: option('karambit-doppler'),
					variant: { wear: 'Factory New', edition: 'stattrak', phase: 'Phase 2' }
				}
			],
			'shared'
		);

		expect(builder.selectionFor('knife')?.variant).toEqual({
			wear: 'Factory New',
			edition: 'stattrak',
			phase: 'Phase 2'
		});
	});

	it('produces canonical selections, with nothing unserializable in them', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([resolved('ak-47', 'ak-47-redline')], 'local');

		expect(JSON.parse(JSON.stringify(builder.persistable))).toEqual([
			{
				slotId: 'ak-47',
				skinSlug: 'ak-47-redline',
				variant: { wear: 'Field-Tested', edition: 'normal' }
			}
		]);
	});

	it('discards any pricing that was on screen', () => {
		// A restored loadout is never a priced one; the last session's total is
		// someone else's number by now.
		const builder = createLoadoutBuilder();

		builder.startEmpty();
		builder.select('ak-47', option('ak-47-redline'), { wear: 'Field-Tested' });
		builder.finishPricing(pricingFor(builder.fingerprint));
		expect(builder.status).toBe('ready');

		builder.hydrate([resolved('ak-47', 'ak-47-redline')], 'local');

		expect(builder.status).toBe('idle');
		expect(builder.pricing).toBeUndefined();
	});

	it('carries the count of what could not be restored', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([resolved('ak-47', 'ak-47-redline')], 'local', 2);

		expect(builder.rejectedCount).toBe(2);
	});
});

describe('a shared loadout', () => {
	it('is shown but not adopted', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([resolved('ak-47', 'ak-47-redline')], 'shared');

		expect(builder.origin).toBe('shared');
		expect(builder.filledCount).toBe(1);
		// Nothing to write: this is someone else's loadout until it is changed.
		expect(builder.persistable).toBeUndefined();
	});

	it('becomes the visitor’s own the moment they change it', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([resolved('ak-47', 'ak-47-redline')], 'shared');
		builder.select('awp', option('awp-asiimov', 'AWP', 'Asiimov'), { wear: 'Field-Tested' });

		expect(builder.origin).toBe('local');
		expect(builder.persistable).toHaveLength(2);
	});

	it('is adopted by removing from it too', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([resolved('ak-47', 'ak-47-redline'), resolved('knife', 'bayonet')], 'shared');
		builder.remove('ak-47');

		expect(builder.origin).toBe('local');
		expect(builder.persistable).toHaveLength(1);
	});

	it('is adopted by clearing it, leaving an empty loadout to save', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([resolved('ak-47', 'ak-47-redline')], 'shared');
		builder.clear();

		expect(builder.origin).toBe('empty');
		// An empty list, which the writer turns into "no saved loadout".
		expect(builder.persistable).toEqual([]);
	});

	it('drops the recovery notice once the visitor takes it over', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([resolved('ak-47', 'ak-47-redline')], 'shared', 1);
		expect(builder.rejectedCount).toBe(1);

		builder.select('awp', option('awp-asiimov', 'AWP', 'Asiimov'), { wear: 'Field-Tested' });

		expect(builder.rejectedCount).toBe(0);
	});
});

describe('origin', () => {
	it('is empty for a builder with nothing in it', () => {
		const builder = createLoadoutBuilder();

		builder.startEmpty();

		expect(builder.origin).toBe('empty');
	});

	it('is local once something is chosen', () => {
		const builder = createLoadoutBuilder();

		builder.startEmpty();
		builder.select('ak-47', option('ak-47-redline'), { wear: 'Field-Tested' });

		expect(builder.origin).toBe('local');
	});

	it('falls back to empty when a restore brings nothing back', () => {
		const builder = createLoadoutBuilder();

		builder.hydrate([], 'local', 3);

		expect(builder.origin).toBe('empty');
		expect(builder.rejectedCount).toBe(3);
	});
});

describe('pricing staleness still governs totals', () => {
	it('keeps a total only while it describes the current loadout', () => {
		const builder = createLoadoutBuilder();

		builder.startEmpty();
		builder.select('ak-47', option('ak-47-redline'), { wear: 'Field-Tested' });
		builder.finishPricing(pricingFor(builder.fingerprint));
		expect(builder.pricing).toBeDefined();

		builder.select('ak-47', option('ak-47-redline'), { wear: 'Factory New' });

		expect(builder.status).toBe('stale');
		expect(builder.pricing).toBeUndefined();
	});

	it('does not change what is persisted when prices are checked', () => {
		// Selections did not change, so there is nothing new to write.
		const builder = createLoadoutBuilder();

		builder.startEmpty();
		builder.select('ak-47', option('ak-47-redline'), { wear: 'Field-Tested' });

		const before = JSON.stringify(builder.persistable);
		builder.finishPricing(pricingFor(builder.fingerprint));

		expect(JSON.stringify(builder.persistable)).toBe(before);
	});
});

describe('a save that could not be restored', () => {
	it('leaves the builder usable but withholds it from storage', () => {
		// A catalog outage must not cost someone their loadout.
		const builder = createLoadoutBuilder();

		builder.startUnrestored();

		expect(builder.hydration).toBe('ready');
		expect(builder.persistable).toBeUndefined();
	});

	it('resumes saving once the visitor makes a deliberate change', () => {
		const builder = createLoadoutBuilder();

		builder.startUnrestored();
		builder.select('ak-47', option('ak-47-redline'), { wear: 'Field-Tested' });

		expect(builder.persistable).toHaveLength(1);
	});

	it('resumes saving if a later restore succeeds', () => {
		const builder = createLoadoutBuilder();

		builder.startUnrestored();
		builder.hydrate([resolved('ak-47', 'ak-47-redline')], 'local');

		expect(builder.persistable).toHaveLength(1);
	});
});
