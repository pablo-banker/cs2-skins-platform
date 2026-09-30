/**
 * The builder's session state.
 *
 * A **factory**, not a module-level store: `/build` owns one of these and
 * nothing else in the product can reach it. A global builder would mean a
 * second `/build` tab shared state with the first, and would outlive the page
 * that created it.
 *
 * The state itself stays plainly serializable — canonical selections, no
 * functions, no Maps, no live catalog objects — because that is what gets
 * written to storage and encoded into a link.
 */
import {
	clearLoadout,
	clearSlot,
	EMPTY_LOADOUT,
	loadoutFingerprint,
	selectSkin,
	selectionForSlot
} from './selection';
import { LOADOUT_SLOTS } from '$lib/config/loadout';
import type { Loadout, LoadoutPricingResult, LoadoutSkinOption } from '$lib/types/loadout';
import type { ResolvedLoadoutSelection } from '$lib/server/services/loadout';
import type { SkinSelection } from '$lib/schemas/skin-detail';

export type PricingStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

/**
 * Where the loadout on screen came from.
 *
 * `shared` is the one that changes behaviour: someone else's loadout is shown
 * but not adopted, so it must not overwrite whatever this visitor had saved
 * until they actually change something.
 */
export type LoadoutOrigin = 'empty' | 'local' | 'shared';

/**
 * How far restoration has got.
 *
 * The whole reason this exists is that the builder starts empty and a saved
 * loadout arrives a moment later. Automatic saving must not run in that
 * window, or opening `/build` would write an empty loadout over the one the
 * visitor spent ten minutes on. Nothing persists until `ready`.
 */
export type HydrationState = 'restoring' | 'ready';

export function createLoadoutBuilder() {
	let loadout = $state<Loadout>(EMPTY_LOADOUT);

	/**
	 * What the picker or the resolver told us about each chosen skin — image,
	 * finish name, the variants it has. Display data, kept beside the loadout
	 * rather than in it: a saved loadout is a set of references, and a cached
	 * catalog row is not part of what someone chose.
	 */
	let options = $state<Record<string, LoadoutSkinOption>>({});

	let pricing = $state<LoadoutPricingResult | undefined>(undefined);
	let loading = $state(false);
	let failed = $state(false);

	let hydration = $state<HydrationState>('restoring');
	let origin = $state<LoadoutOrigin>('empty');
	/**
	 * Set when a save exists but could not be restored — the catalog was
	 * unreachable. The builder works for this session, but writing its empty
	 * state back would delete a loadout that is probably still perfectly good.
	 * Cleared the moment the visitor makes a deliberate change.
	 */
	let unrestored = $state(false);
	/** Selections a restore could not bring back. Cleared on the first edit. */
	let rejectedCount = $state(0);

	const fingerprint = $derived(loadoutFingerprint(loadout));

	/**
	 * Whether the displayed prices still describe what is on screen.
	 *
	 * Compared by fingerprint rather than cleared from each code path that
	 * edits the loadout — so a future edit path cannot forget to invalidate.
	 * If the string differs, the totals are stale, whatever changed them.
	 */
	const status = $derived<PricingStatus>(
		loading
			? 'loading'
			: failed
				? 'error'
				: !pricing
					? 'idle'
					: pricing.fingerprint === fingerprint
						? 'ready'
						: 'stale'
	);

	/**
	 * Marks the loadout as this visitor's own.
	 *
	 * Viewing a shared link is read-only; changing anything in it is a decision
	 * to make it yours, and from that moment it saves like any other loadout.
	 */
	function adopt() {
		failed = false;
		rejectedCount = 0;
		unrestored = false;
		// Whatever it was — someone else's link, or nothing at all — editing it
		// makes it this visitor's loadout, on this device. `clear` overrides
		// this back to empty immediately afterwards.
		origin = 'local';
	}

	return {
		get loadout() {
			return loadout;
		},
		get fingerprint() {
			return fingerprint;
		},
		get pricing() {
			// Only ever hand out prices that describe the current loadout.
			// Anything else is an old answer to a question nobody is asking.
			return status === 'ready' ? pricing : undefined;
		},
		get status() {
			return status;
		},
		get filledCount() {
			return loadout.selections.length;
		},
		get slotCount() {
			return LOADOUT_SLOTS.length;
		},
		get hydration() {
			return hydration;
		},
		get origin() {
			return origin;
		},
		get rejectedCount() {
			return rejectedCount;
		},

		/**
		 * The selections to write to storage, or nothing when writing would be
		 * wrong.
		 *
		 * The single gate in front of persistence, so no caller has to remember
		 * the rules: nothing is saved while restoration is still running, and
		 * nothing is saved for a shared loadout the visitor has only looked at.
		 */
		get persistable(): Loadout['selections'] | undefined {
			if (hydration !== 'ready' || origin === 'shared' || unrestored) return undefined;

			return loadout.selections;
		},

		selectionFor(slotId: string) {
			return selectionForSlot(loadout, slotId);
		},

		optionFor(slotId: string): LoadoutSkinOption | undefined {
			return options[slotId];
		},

		/**
		 * Replaces everything at once, as one state transition.
		 *
		 * Restoration is not thirty-seven separate choices: replaying it as
		 * repeated `select` calls would emit an intermediate state after each
		 * one, each of them a different loadout, each eligible to be saved.
		 */
		hydrate(restored: readonly ResolvedLoadoutSelection[], from: LoadoutOrigin, rejected = 0) {
			unrestored = false;
			loadout = {
				selections: restored.map((entry) => ({
					slotId: entry.slotId,
					skinSlug: entry.option.slug,
					variant: entry.variant
				}))
			};

			options = Object.fromEntries(restored.map((entry) => [entry.slotId, entry.option]));

			// A restored loadout is never a priced one. Whatever the last
			// session saw is someone else's number by now.
			pricing = undefined;
			loading = false;
			failed = false;

			origin = restored.length === 0 && from !== 'shared' ? 'empty' : from;
			rejectedCount = rejected;
			hydration = 'ready';
		},

		/** Nothing to restore: start empty and let saving begin. */
		startEmpty() {
			hydration = 'ready';
			origin = 'empty';
			unrestored = false;
		},

		/**
		 * There was a save, but it could not be restored.
		 *
		 * Usable for this session, and deliberately **not** written back: an
		 * empty builder is not what the visitor saved, and a catalog outage is
		 * no reason to take their loadout away.
		 */
		startUnrestored() {
			hydration = 'ready';
			origin = 'empty';
			unrestored = true;
		},

		select(slotId: string, option: LoadoutSkinOption, variant: SkinSelection) {
			adopt();
			loadout = selectSkin(loadout, slotId, option.slug, variant);
			options = { ...options, [slotId]: option };
		},

		remove(slotId: string) {
			adopt();
			loadout = clearSlot(loadout, slotId);

			const next = { ...options };
			delete next[slotId];
			options = next;
		},

		clear() {
			adopt();
			loadout = clearLoadout();
			options = {};
			pricing = undefined;
			origin = 'empty';
		},

		/** Marks a pricing request as started. Guards against double-submits. */
		startPricing(): boolean {
			if (loading || hydration !== 'ready' || loadout.selections.length === 0) return false;

			loading = true;
			failed = false;

			return true;
		},

		finishPricing(result: LoadoutPricingResult) {
			pricing = result;
			loading = false;
			failed = false;
		},

		failPricing() {
			loading = false;
			failed = true;
		}
	};
}

export type LoadoutBuilder = ReturnType<typeof createLoadoutBuilder>;
