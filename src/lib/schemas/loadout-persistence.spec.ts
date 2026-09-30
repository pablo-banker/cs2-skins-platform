import { describe, expect, it } from 'vitest';
import {
	BUILDER_STORAGE_KEY,
	loadoutResolveRequestSchema,
	persistedLoadoutSchema,
	PERSISTED_LOADOUT_VERSION
} from './loadout-persistence';
import { LOADOUT_SLOTS } from '$lib/config/loadout';

function selection(overrides: Record<string, unknown> = {}) {
	return {
		slotId: 'ak-47',
		skinSlug: 'ak-47-redline',
		variant: { wear: 'Field-Tested' },
		...overrides
	};
}

function payload(overrides: Record<string, unknown> = {}) {
	return { version: PERSISTED_LOADOUT_VERSION, selections: [selection()], ...overrides };
}

describe('the storage key', () => {
	it('is namespaced and versioned', () => {
		// A future format lives beside this one rather than reinterpreting it.
		expect(BUILDER_STORAGE_KEY).toBe('cs2-skins:builder:v1');
	});
});

describe('persistedLoadoutSchema', () => {
	it('accepts a well-formed v1 payload', () => {
		expect(persistedLoadoutSchema.safeParse(payload()).success).toBe(true);
	});

	it('accepts a selection with no variant preference', () => {
		const parsed = persistedLoadoutSchema.safeParse(
			payload({ selections: [{ slotId: 'knife', skinSlug: 'bayonet' }] })
		);

		expect(parsed.success).toBe(true);
		expect(parsed.data?.selections[0].variant).toEqual({});
	});

	it('accepts an empty list, so an older build’s payload still reads', () => {
		expect(persistedLoadoutSchema.safeParse(payload({ selections: [] })).success).toBe(true);
	});

	it('rejects a missing version', () => {
		expect(persistedLoadoutSchema.safeParse({ selections: [selection()] }).success).toBe(false);
	});

	it('rejects a version this build does not understand', () => {
		// Never reinterpreted as v1: a future payload means something else.
		expect(persistedLoadoutSchema.safeParse(payload({ version: 2 })).success).toBe(false);
		expect(persistedLoadoutSchema.safeParse(payload({ version: '1' })).success).toBe(false);
	});

	it('rejects malformed selections', () => {
		expect(persistedLoadoutSchema.safeParse(payload({ selections: 'nope' })).success).toBe(false);
		expect(persistedLoadoutSchema.safeParse(payload({ selections: [{}] })).success).toBe(false);
		expect(
			persistedLoadoutSchema.safeParse(payload({ selections: [selection({ skinSlug: 'AK 47' })] }))
				.success
		).toBe(false);
	});

	it('rejects the same slot twice', () => {
		expect(
			persistedLoadoutSchema.safeParse(payload({ selections: [selection(), selection()] })).success
		).toBe(false);
	});

	it('rejects more selections than there are slots', () => {
		const many = Array.from({ length: LOADOUT_SLOTS.length + 1 }, (_, index) =>
			selection({ slotId: `slot-${index}` })
		);

		expect(persistedLoadoutSchema.safeParse(payload({ selections: many })).success).toBe(false);
	});

	it('rejects an upstream catalog id', () => {
		// Saved identity is ours; an item id would tie a loadout to someone
		// else's numbering.
		expect(
			persistedLoadoutSchema.safeParse(payload({ selections: [selection({ itemId: 12632 })] }))
				.success
		).toBe(false);
	});

	it('rejects market data of every shape', () => {
		for (const extra of [
			{ bestPriceMinor: 12815 },
			{ currency: 'BRL' },
			{ providerId: 'csfloat' },
			{ pricedAt: '2026-09-23T00:00:00Z' },
			{ quotes: [] }
		]) {
			expect(
				persistedLoadoutSchema.safeParse(payload({ selections: [selection(extra)] })).success,
				JSON.stringify(extra)
			).toBe(false);
		}
	});

	it('rejects a total alongside the selections', () => {
		expect(
			persistedLoadoutSchema.safeParse(payload({ total: { priceMinor: 1, currency: 'BRL' } }))
				.success
		).toBe(false);
	});

	it('rejects an unknown variant field', () => {
		expect(
			persistedLoadoutSchema.safeParse(
				payload({ selections: [selection({ variant: { wear: 'Field-Tested', float: 0.2 } })] })
			).success
		).toBe(false);
	});
});

describe('loadoutResolveRequestSchema', () => {
	it('accepts selections to resolve', () => {
		expect(loadoutResolveRequestSchema.safeParse({ selections: [selection()] }).success).toBe(true);
	});

	it('accepts an empty list — restoring nothing is not an error', () => {
		expect(loadoutResolveRequestSchema.safeParse({ selections: [] }).success).toBe(true);
	});

	it('leaves per-selection judgement to the resolver', () => {
		// Duplicates are a recovery question, not a malformed request: pricing
		// rejects them, restoring reports them.
		expect(
			loadoutResolveRequestSchema.safeParse({ selections: [selection(), selection()] }).success
		).toBe(true);
	});

	it('still rejects nonsense and unknown fields', () => {
		expect(
			loadoutResolveRequestSchema.safeParse({ selections: [{ slotId: 'ak-47' }] }).success
		).toBe(false);
		expect(
			loadoutResolveRequestSchema.safeParse({ selections: [selection()], budget: 1 }).success
		).toBe(false);
	});
});
