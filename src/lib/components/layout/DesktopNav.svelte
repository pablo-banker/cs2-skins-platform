<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { isActiveRoute, mainNav } from '$lib/config/site';
</script>

<!--
	Full-height nav items so the active indicator can sit on the header's own
	bottom border, the way a tab strip does. Active is a thin amber rule plus a
	brighter label — enough to locate yourself, far short of a filled orange
	block.
-->
<nav aria-label="Main" class="hidden h-full md:block">
	<ul class="flex h-full items-stretch gap-1">
		{#each mainNav as item (item.href)}
			{@const active = isActiveRoute(page.url.pathname, item.href)}
			<li class="flex">
				<a
					href={resolve(item.href)}
					aria-current={active ? 'page' : undefined}
					class="relative flex items-center px-3 text-sm font-medium transition-colors focus-visible:ring-2
						focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:outline-none
						{active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
				>
					{item.label}
					{#if active}
						<span class="absolute inset-x-3 -bottom-px h-0.5 bg-primary" aria-hidden="true"></span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
