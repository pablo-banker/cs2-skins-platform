<script lang="ts">
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';

	/**
	 * One row in the search dialog.
	 *
	 * Denser than a `SkinCard` on purpose — this is a navigator, so the job is
	 * to identify a skin at a glance, not to present it. No prices, no
	 * providers, no variant list.
	 */
	let {
		weapon,
		name,
		imageUrl,
		rarityName,
		wear
	}: {
		weapon: string;
		name: string;
		imageUrl?: string;
		rarityName?: string;
		wear?: string;
	} = $props();
</script>

<SkinImage
	src={imageUrl}
	alt={`${weapon} | ${name}`}
	decorative
	class="aspect-[4/3] w-16 shrink-0 rounded-sm"
	imageClass="p-0.5"
/>

<span class="min-w-0 flex-1">
	<span class="block truncate text-xs text-muted-foreground">{weapon}</span>
	<span class="block truncate text-sm font-medium text-foreground">{name}</span>
	{#if wear || rarityName}
		<span class="flex items-center gap-2">
			{#if wear}
				<span class="truncate text-xs text-subtle-foreground">{wear}</span>
			{/if}
			{#if rarityName}
				<SkinRarity rarity={{ name: rarityName }} />
			{/if}
		</span>
	{/if}
</span>
