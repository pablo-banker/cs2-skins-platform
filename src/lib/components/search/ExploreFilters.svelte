<script lang="ts">
	import { resolve } from '$app/paths';
	import FilterSelect from './FilterSelect.svelte';
	import { buildExploreUrl } from '$lib/features/skins/explore-url';
	import type { ExploreQuery } from '$lib/schemas/explore';
	import type { ExploreFilterOptions } from '$lib/features/skins/explore-options';

	/**
	 * The catalog filter set, shared by the desktop sidebar and the mobile
	 * sheet. One definition, so the two can never offer different filters.
	 *
	 * Every control navigates to a URL; nothing is held in client state.
	 */
	let {
		query,
		options,
		onNavigate
	}: {
		query: ExploreQuery;
		options: ExploreFilterOptions;
		/** Lets the mobile sheet close itself once a filter is chosen. */
		onNavigate?: () => void;
	} = $props();

	/**
	 * StatTrak and Souvenir are "only" filters: checked narrows to skins that
	 * offer that finish, unchecked means any. There is no "exclude" state —
	 * nobody browses for skins that are specifically not StatTrak.
	 */
	const toggles = $derived([
		{ param: 'stattrak' as const, label: 'StatTrak only', active: query.stattrak },
		{ param: 'souvenir' as const, label: 'Souvenir only', active: query.souvenir }
	]);
</script>

<div class="space-y-5">
	<FilterSelect
		label="Weapon"
		param="weapon"
		options={options.weapons}
		{query}
		anyLabel="Any weapon"
	/>
	<FilterSelect
		label="Category"
		param="weaponType"
		options={options.weaponTypes}
		{query}
		anyLabel="Any category"
	/>
	<FilterSelect
		label="Exterior"
		param="wear"
		options={options.wears}
		{query}
		anyLabel="Any exterior"
	/>
	<FilterSelect
		label="Rarity"
		param="rarity"
		options={options.rarities}
		{query}
		anyLabel="Any rarity"
	/>
	<FilterSelect
		label="Collection"
		param="collection"
		options={options.collections}
		{query}
		anyLabel="Any collection"
	/>

	<div class="space-y-2">
		<span class="block text-xs font-medium text-muted-foreground">Finish</span>
		{#each toggles as toggle (toggle.param)}
			<a
				href={resolve(
					buildExploreUrl(query, {
						[toggle.param]: toggle.active ? undefined : 'true'
					}) as '/explore'
				)}
				onclick={onNavigate}
				aria-current={toggle.active ? 'true' : undefined}
				class="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
					{toggle.active ? 'border-primary/50 bg-primary-subtle text-foreground' : 'text-muted-foreground'}"
			>
				<span
					class="flex size-4 shrink-0 items-center justify-center rounded-sm border border-border
						{toggle.active ? 'border-primary bg-primary' : ''}"
					aria-hidden="true"
				>
					{#if toggle.active}
						<svg viewBox="0 0 10 8" class="size-2.5 fill-current text-primary-foreground">
							<path d="M9 1 3.5 6.5 1 4" stroke="currentColor" stroke-width="2" fill="none" />
						</svg>
					{/if}
				</span>
				{toggle.label}
				{#if toggle.active}<span class="sr-only">(active)</span>{/if}
			</a>
		{/each}
	</div>
</div>
