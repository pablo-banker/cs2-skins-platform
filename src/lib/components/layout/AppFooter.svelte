<script lang="ts">
	import { resolve } from '$app/paths';
	import PageContainer from './PageContainer.svelte';
	import { mainNav, site } from '$lib/config/site';
</script>

<!--
	Deliberately small. There are no legal pages, no social accounts and no
	company yet, so there is nothing honest to put here beyond what the product
	is and where to go next.
-->
<footer class="mt-auto border-t border-border bg-surface">
	<PageContainer class="flex flex-col gap-8 py-10 sm:flex-row sm:justify-between">
		<div class="max-w-sm space-y-2">
			<p class="text-sm font-semibold tracking-tight text-foreground">{site.name}</p>
			<p class="text-sm text-muted-foreground">{site.description}</p>
		</div>

		<nav aria-label="Footer">
			<ul class="flex flex-col gap-2 sm:items-end">
				{#each mainNav as item (item.href)}
					<li>
						<a
							href={resolve(item.href)}
							class="rounded-sm text-sm text-muted-foreground transition-colors
								hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</PageContainer>
</footer>
