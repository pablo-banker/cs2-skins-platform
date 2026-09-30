<script lang="ts">
	import MenuIcon from '@lucide/svelte/icons/menu';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Sheet from '$lib/components/ui/sheet';
	import { isActiveRoute, mainNav, site } from '$lib/config/site';

	let open = $state(false);

	// Close on selection: the sheet would otherwise stay over the page the
	// visitor just asked for.
	function handleNavigate() {
		open = false;
	}
</script>

<!--
	The Sheet primitive owns focus trapping, escape-to-close and the overlay —
	all the parts of a drawer that are easy to get subtly wrong by hand.
-->
<Sheet.Root bind:open>
	<Sheet.Trigger
		class="inline-flex size-9 items-center justify-center rounded-md
			text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring
			focus-visible:outline-none md:hidden"
	>
		<MenuIcon class="size-5" aria-hidden="true" />
		<span class="sr-only">Open menu</span>
	</Sheet.Trigger>

	<Sheet.Content side="right" class="w-72">
		<Sheet.Header class="border-b border-border">
			<Sheet.Title class="text-base font-semibold tracking-tight">{site.name}</Sheet.Title>
			<Sheet.Description class="sr-only">Main navigation</Sheet.Description>
		</Sheet.Header>

		<nav aria-label="Main" class="px-2 pb-4">
			<ul class="flex flex-col gap-1">
				{#each mainNav as item (item.href)}
					{@const active = isActiveRoute(page.url.pathname, item.href)}
					<li>
						<a
							href={resolve(item.href)}
							aria-current={active ? 'page' : undefined}
							onclick={handleNavigate}
							class="flex items-center rounded-md border-l-2 px-3 py-2.5 text-sm
								font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
								{active
								? 'border-primary bg-surface-hover text-foreground'
								: 'border-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground'}"
						>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</Sheet.Content>
</Sheet.Root>
