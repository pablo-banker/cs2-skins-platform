<script lang="ts">
	import { resolve } from '$app/paths';
	import KitImageStack from './KitImageStack.svelte';
	import type { ResolvedKit } from '$lib/types/kit';

	/**
	 * A kit in the catalog grid.
	 *
	 * Shows what the kit *is* — its skins, its name, its direction and how many
	 * pieces it has. It deliberately shows **no price**: totals depend on live
	 * market data, and an editorial file cannot promise a number.
	 */
	let { kit }: { kit: ResolvedKit } = $props();

	// Restrained: a row of bulky badges would fight the images for attention.
	const direction = $derived(
		kit.tags.map((tag) => tag[0].toUpperCase() + tag.slice(1)).join(' · ')
	);
</script>

<a
	href={resolve('/kits/[slug]', { slug: kit.slug })}
	class="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
>
	<div class="border-b border-border">
		<KitImageStack items={kit.items} />
	</div>

	<div class="flex flex-1 flex-col gap-2 p-4">
		<div class="flex items-baseline justify-between gap-3">
			<h3 class="text-base font-semibold tracking-tight text-foreground">{kit.name}</h3>
			<span class="shrink-0 text-xs text-subtle-foreground">
				{kit.items.length} skins
			</span>
		</div>

		<p class="text-sm text-muted-foreground">{kit.description}</p>
		<p class="mt-auto pt-1 text-xs text-subtle-foreground">{direction}</p>
	</div>
</a>
