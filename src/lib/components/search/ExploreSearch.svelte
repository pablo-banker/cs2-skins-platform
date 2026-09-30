<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { exploreParams } from '$lib/features/skins/explore-url';
	import type { ExploreQuery } from '$lib/schemas/explore';

	/**
	 * The catalog text filter for Explore.
	 *
	 * A plain `GET` form, so searching works without JavaScript and every
	 * search lands on a real, shareable URL. This is not the global search
	 * dialog — it filters this page and nothing else.
	 *
	 * Submission is explicit. Searching on every keystroke would fill the
	 * visitor's history with half-typed words and hit the catalog for each one.
	 */
	let { query }: { query: ExploreQuery } = $props();

	// Other filters ride along as hidden fields, so searching narrows the
	// current view instead of resetting it. `page` is deliberately absent:
	// a new search starts at page one.
	const carried = $derived(
		[...exploreParams(query).entries()].filter(([key]) => key !== 'q' && key !== 'page')
	);
</script>

<form method="GET" action="/explore" class="flex w-full gap-2" role="search">
	{#each carried as [key, value] (key)}
		<input type="hidden" name={key} {value} />
	{/each}

	<div class="relative flex-1">
		<SearchIcon
			class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground"
			aria-hidden="true"
		/>
		<label class="sr-only" for="explore-search">Search skins</label>
		<Input
			id="explore-search"
			type="search"
			name="q"
			value={query.q ?? ''}
			placeholder="Search skins, e.g. Redline"
			class="pl-9"
		/>
	</div>

	<Button type="submit">Search</Button>

	{#if query.q}
		<Button
			variant="ghost"
			href="/explore{exploreParams({ ...query, q: undefined, page: 1 }).toString()
				? `?${exploreParams({ ...query, q: undefined, page: 1 })}`
				: ''}"
		>
			<XIcon class="size-4" aria-hidden="true" />
			<span class="sr-only">Clear search</span>
		</Button>
	{/if}
</form>
