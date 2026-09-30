<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DesktopNav from './DesktopNav.svelte';
	import MobileNav from './MobileNav.svelte';
	import PageContainer from './PageContainer.svelte';
	import GlobalSearch from '$lib/components/search/GlobalSearch.svelte';
	import { site } from '$lib/config/site';
</script>

<!--
	Sticky, 64px, solid. No blur and no shadow: the design system asks the
	chrome to stay quiet so the skins can carry the page, and a single border
	separates header from content more honestly than a glass panel does.
-->
<header class="sticky top-0 z-40 h-16 border-b border-border bg-background">
	<PageContainer class="flex h-full items-center justify-between gap-3 lg:gap-6">
		<a
			href={resolve('/')}
			class="shrink-0 rounded-sm text-base font-semibold tracking-tight text-foreground
				transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		>
			{site.name}
		</a>

		<DesktopNav />

		<!--
			Search composes itself: the header places it and owns no search
			behaviour. It sits between navigation and the menu so it is reachable
			directly on every screen size rather than hidden inside the menu.
		-->
		<div class="flex items-center gap-1 sm:gap-2">
			<GlobalSearch />

			<!--
				An icon rather than a fifth nav label. The header already carries
				four sections and a search field; a "Wishlist" word would push
				the whole row past comfortable on a tablet for something most
				visits do not use. No count badge — hydrating a number from
				`localStorage` purely for decoration would trade a real hydration
				risk for nothing.
			-->
			<a
				href={resolve('/wishlist')}
				aria-label="Wishlist"
				aria-current={page.url.pathname === '/wishlist' ? 'page' : undefined}
				class="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground
					transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring
					focus-visible:outline-none aria-[current=page]:text-foreground"
			>
				<HeartIcon class="size-5" aria-hidden="true" />
			</a>

			<MobileNav />
		</div>
	</PageContainer>
</header>
