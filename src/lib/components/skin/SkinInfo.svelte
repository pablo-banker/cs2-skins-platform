<script lang="ts">
	import SkinRarity from './SkinRarity.svelte';
	import { variantEdition } from '$lib/features/skins/variant-selection';
	import type { Skin, SkinVariant } from '$lib/types/skin';

	/**
	 * The objective catalog facts about the selected variant.
	 *
	 * Presentation only — it fetches nothing and knows nothing about upstream.
	 * Technical identifiers (catalog ids, market hash names, paint indexes) and
	 * float ranges are deliberately absent: they identify items for our code,
	 * they do not inform a purchase.
	 */
	let { skin, variant }: { skin: Skin; variant: SkinVariant } = $props();

	const editionLabel = $derived(
		{ normal: 'Normal', stattrak: 'StatTrak', souvenir: 'Souvenir' }[variantEdition(variant)]
	);

	const rows = $derived(
		[
			skin.weaponType && { label: 'Category', value: skin.weaponType },
			skin.collection && { label: 'Collection', value: skin.collection },
			variant.wear && { label: 'Exterior', value: variant.wear },
			{ label: 'Edition', value: editionLabel },
			variant.phase && { label: 'Phase', value: variant.phase }
		].filter(Boolean) as { label: string; value: string }[]
	);
</script>

<section class="space-y-3" aria-labelledby="skin-info-heading">
	<h2 id="skin-info-heading" class="text-base font-semibold text-foreground">Skin information</h2>

	<dl class="divide-y divide-border rounded-lg border border-border bg-surface">
		{#each rows as row (row.label)}
			<div class="flex items-center justify-between gap-4 px-4 py-2.5">
				<dt class="text-sm text-muted-foreground">{row.label}</dt>
				<dd class="text-right text-sm text-foreground">{row.value}</dd>
			</div>
		{/each}

		{#if skin.rarity}
			<div class="flex items-center justify-between gap-4 px-4 py-2.5">
				<dt class="text-sm text-muted-foreground">Rarity</dt>
				<dd class="text-right"><SkinRarity rarity={skin.rarity} class="text-sm" /></dd>
			</div>
		{/if}
	</dl>
</section>
