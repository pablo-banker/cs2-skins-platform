<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Select from '$lib/components/ui/select';
	import { buildExploreUrl, type ExploreChanges } from '$lib/features/skins/explore-url';
	import type { ExploreParam, ExploreQuery } from '$lib/schemas/explore';
	import { resolve } from '$app/paths';

	/**
	 * One catalog filter as a select.
	 *
	 * Weapons, collections and rarities have dozens to hundreds of values;
	 * a select keeps the sidebar compact where a checkbox list would not fit.
	 * Choosing a value navigates — the URL stays the source of truth — and
	 * because it is a navigation, back and forward work as expected.
	 */
	let {
		label,
		param,
		options,
		query,
		anyLabel = 'Any'
	}: {
		label: string;
		param: ExploreParam;
		options: string[];
		query: ExploreQuery;
		anyLabel?: string;
	} = $props();

	const ANY = '__any__';
	const current = $derived((query[param] as string | undefined) ?? ANY);

	function select(value: string) {
		const changes = { [param]: value === ANY ? undefined : value } as ExploreChanges;

		goto(resolve(buildExploreUrl(query, changes) as '/explore'), { keepFocus: true });
	}
</script>

<div class="space-y-1.5">
	<span class="block text-xs font-medium text-muted-foreground" id="filter-{param}">
		{label}
	</span>
	<Select.Root type="single" value={current} onValueChange={select}>
		<Select.Trigger class="w-full" aria-labelledby="filter-{param}">
			{current === ANY ? anyLabel : current}
		</Select.Trigger>
		<Select.Content>
			<Select.Item value={ANY}>{anyLabel}</Select.Item>
			{#each options as option (option)}
				<Select.Item value={option}>{option}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
