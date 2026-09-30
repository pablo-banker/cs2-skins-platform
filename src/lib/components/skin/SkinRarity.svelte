<script lang="ts">
	import { rarityIndicatorClass } from '$lib/config/rarity';
	import { cn } from '$lib/utils';
	import type { SkinRarity } from '$lib/types/skin';

	/**
	 * Rarity as a small dot plus its name.
	 *
	 * Deliberately tiny. Rarity is a useful signal, not the subject of the
	 * card — painting a whole surface purple would fight the skin image for
	 * attention and lose the product its hero. The name is always rendered, so
	 * the colour is reinforcement rather than the only carrier of meaning
	 * (Covert red and our danger red are close enough to confuse).
	 */
	let { rarity, class: className }: { rarity?: SkinRarity | null; class?: string } = $props();
</script>

{#if rarity?.name}
	<span class={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
		<span
			class={cn('size-1.5 shrink-0 rounded-full', rarityIndicatorClass(rarity))}
			aria-hidden="true"
		></span>
		{rarity.name}
	</span>
{/if}
