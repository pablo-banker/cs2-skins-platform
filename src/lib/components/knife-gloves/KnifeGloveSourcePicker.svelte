<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { knifeGlovesHref } from '$lib/schemas/knife-gloves';
	import { KNIFE_SLOT_ID } from '$lib/features/recommendations/knife-gloves';
	import type { KnifeGloveSourceOption } from '$lib/types/knife-gloves';

	/**
	 * Choosing what to match against.
	 *
	 * Searches locally over the curated equipment the loader already sent —
	 * roughly fifty-six options. An endpoint to filter fifty-six records would be
	 * a round trip bought for nothing, and the list is small enough that the
	 * whole thing is browsable without searching at all.
	 *
	 * Every option is a **link**, so choosing one is an ordinary navigation: the
	 * URL becomes the selection, the server does the work, and the back button
	 * behaves.
	 */
	let {
		options,
		label = 'Choose skin',
		selectedSlug
	}: {
		options: KnifeGloveSourceOption[];
		label?: string;
		/** Marks the current source, when the page has one. */
		selectedSlug?: string;
	} = $props();

	let open = $state(false);

	const knives = $derived(options.filter((option) => option.slotId === KNIFE_SLOT_ID));
	const gloves = $derived(options.filter((option) => option.slotId !== KNIFE_SLOT_ID));

	// Matched against weapon and finish together, which is how people describe
	// a skin: "crimson web", "karambit", "sport gloves vice".
	function keywords(option: KnifeGloveSourceOption): string {
		return `${option.weapon} ${option.name}`.trim();
	}
</script>

<Button onclick={() => (open = true)} variant="outline">
	<SearchIcon class="size-4" aria-hidden="true" />
	{label}
</Button>

<Command.Dialog
	bind:open
	title="Choose a knife or gloves"
	description="Search curated knives and gloves"
>
	<Command.Input placeholder="Search knives and gloves…" />
	<Command.List>
		<Command.Empty>No curated knife or gloves matches that.</Command.Empty>

		{#each [{ heading: 'Knives', items: knives }, { heading: 'Gloves', items: gloves }] as group (group.heading)}
			{#if group.items.length > 0}
				<Command.Group heading={group.heading}>
					{#each group.items as option (option.slug)}
						<Command.LinkItem
							href={knifeGlovesHref(option.slug)}
							value={keywords(option)}
							onSelect={() => (open = false)}
						>
							<span class="min-w-0 flex-1 truncate">
								<span class="text-muted-foreground">{option.weapon}</span>
								{#if option.name}
									<span class="text-foreground"> · {option.name}</span>
								{/if}
							</span>
							{#if option.slug === selectedSlug}
								<span class="text-xs text-subtle-foreground">Selected</span>
							{/if}
						</Command.LinkItem>
					{/each}
				</Command.Group>
			{/if}
		{/each}
	</Command.List>
</Command.Dialog>
