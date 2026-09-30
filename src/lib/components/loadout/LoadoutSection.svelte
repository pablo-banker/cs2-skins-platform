<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LoadoutSlotConfig } from '$lib/config/loadout';

	/**
	 * One category of slots.
	 *
	 * A plain labelled region rather than an accordion: a builder whose
	 * sections collapse can hide a skin someone already chose, and "where did
	 * my AK go" is a worse problem than a long page. Scrolling is fine.
	 */
	let {
		id,
		label,
		slots,
		filled,
		card
	}: {
		id: string;
		label: string;
		slots: readonly LoadoutSlotConfig[];
		/** How many of this section's slots hold a skin. */
		filled: number;
		/** Renders one slot. Named `card` because `slot` is reserved markup. */
		card: Snippet<[LoadoutSlotConfig]>;
	} = $props();
</script>

<section class="space-y-3" aria-labelledby="{id}-heading">
	<div class="flex items-baseline justify-between gap-3">
		<h2 id="{id}-heading" class="text-base font-semibold text-foreground">{label}</h2>
		<span class="font-mono text-xs text-subtle-foreground tabular-nums">
			{filled} / {slots.length}
		</span>
	</div>

	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
		{#each slots as slotConfig (slotConfig.id)}
			{@render card(slotConfig)}
		{/each}
	</div>
</section>
