<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Select from '$lib/components/ui/select';
	import { buildExploreUrl } from '$lib/features/skins/explore-url';
	import type { ExploreQuery, ExploreSort } from '$lib/schemas/explore';

	/**
	 * Result ordering.
	 *
	 * Only sorts we can perform over the complete filtered set are offered —
	 * there is no "lowest price" here because Explore loads no prices, and
	 * offering one that silently reordered a single page would be a lie.
	 */
	let { query }: { query: ExploreQuery } = $props();

	const labels: Record<ExploreSort, string> = {
		relevance: 'Relevance',
		'name-asc': 'Name A–Z',
		'name-desc': 'Name Z–A'
	};

	function select(value: string) {
		goto(resolve(buildExploreUrl(query, { sort: value }) as '/explore'), { keepFocus: true });
	}
</script>

<div class="flex items-center gap-2">
	<span class="shrink-0 text-xs font-medium text-muted-foreground" id="explore-sort-label">
		Sort
	</span>
	<Select.Root type="single" value={query.sort} onValueChange={select}>
		<Select.Trigger class="w-40" aria-labelledby="explore-sort-label">
			{labels[query.sort]}
		</Select.Trigger>
		<Select.Content>
			{#each Object.entries(labels) as [value, label] (value)}
				<Select.Item {value}>{label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
