<script lang="ts">
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import type { ResolvedKitItem } from '$lib/types/kit';

	/**
	 * A kit's cover, composed from the skins it contains.
	 *
	 * No generated artwork and no stored collages — the skins are the picture,
	 * laid out in CSS. The first four items are used, so editorial order in the
	 * JSON decides what a kit looks like on a card.
	 */
	let { items }: { items: ResolvedKitItem[] } = $props();

	const cover = $derived(items.slice(0, 4));
</script>

<div class="grid grid-cols-2 gap-px bg-surface-elevated" aria-hidden="true">
	{#each cover as item (item.variant.itemId)}
		<SkinImage
			src={item.variant.imageUrl ?? item.skin.imageUrl}
			alt={item.skin.fullName}
			decorative
			class="aspect-[5/3] bg-card"
			imageClass="p-2"
		/>
	{/each}
</div>
