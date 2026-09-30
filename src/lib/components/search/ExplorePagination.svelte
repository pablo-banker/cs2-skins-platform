<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { resolve } from '$app/paths';
	import { buildExploreUrl } from '$lib/features/skins/explore-url';
	import type { ExploreQuery } from '$lib/schemas/explore';

	/**
	 * Page navigation.
	 *
	 * Real links, so pages are shareable and middle-click works. A control
	 * with nowhere to go is rendered as plain text rather than a disabled
	 * link — a link that does nothing is worse than no link.
	 */
	let { query, page, pageCount }: { query: ExploreQuery; page: number; pageCount: number } =
		$props();

	/** A short window around the current page, always including first and last. */
	const pages = $derived(
		[1, page - 1, page, page + 1, pageCount]
			.filter((candidate) => candidate >= 1 && candidate <= pageCount)
			.sort((a, b) => a - b)
			.filter((candidate, index, all) => all.indexOf(candidate) === index)
	);

	const href = (target: number) =>
		resolve(buildExploreUrl(query, { page: target > 1 ? target : undefined }) as '/explore');
</script>

{#if pageCount > 1}
	<nav aria-label="Pagination" class="flex flex-wrap items-center justify-center gap-1">
		{#if page > 1}
			<a
				href={href(page - 1)}
				rel="prev"
				class="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			>
				<ChevronLeftIcon class="size-4" aria-hidden="true" />
				Previous
			</a>
		{:else}
			<span
				class="inline-flex h-9 items-center gap-1 px-3 text-sm text-subtle-foreground"
				aria-hidden="true"
			>
				<ChevronLeftIcon class="size-4" />
				Previous
			</span>
		{/if}

		{#each pages as target, index (target)}
			{#if index > 0 && target - pages[index - 1] > 1}
				<span class="px-1 text-sm text-subtle-foreground" aria-hidden="true">…</span>
			{/if}

			{#if target === page}
				<span
					aria-current="page"
					class="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-primary bg-primary-subtle px-2 text-sm font-medium text-foreground"
				>
					{target}
					<span class="sr-only">(current page)</span>
				</span>
			{:else}
				<a
					href={href(target)}
					class="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					{target}
					<span class="sr-only">Page {target}</span>
				</a>
			{/if}
		{/each}

		{#if page < pageCount}
			<a
				href={href(page + 1)}
				rel="next"
				class="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			>
				Next
				<ChevronRightIcon class="size-4" aria-hidden="true" />
			</a>
		{:else}
			<span
				class="inline-flex h-9 items-center gap-1 px-3 text-sm text-subtle-foreground"
				aria-hidden="true"
			>
				Next
				<ChevronRightIcon class="size-4" />
			</span>
		{/if}
	</nav>
{/if}
