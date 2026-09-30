<script lang="ts">
	import type { Component } from 'svelte';
	import type { ResolvedPathname } from '$app/types';

	/**
	 * One thing someone can do here, as a card that is entirely a link.
	 *
	 * Deliberately small: a heading, a sentence and an icon. The homepage's job
	 * is to say what exists and get out of the way — a card that explains the
	 * builder's thirty-seven slots is a card nobody finishes reading.
	 *
	 * `href` arrives resolved, because the page knows the route and a
	 * presentational card does not.
	 */
	let {
		title,
		description,
		href,
		icon: Icon
	}: {
		title: string;
		description: string;
		href: ResolvedPathname;
		icon: Component<{ class?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
	} = $props();
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve --
	`href` is a ResolvedPathname: the caller resolved it. -->
<a
	{href}
	class="group flex flex-col gap-2 rounded-lg border border-border bg-card p-5 transition-colors
		hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
		motion-reduce:transition-none"
>
	<Icon
		class="size-5 text-muted-foreground transition-colors group-hover:text-primary"
		aria-hidden="true"
	/>

	<h3 class="text-base font-semibold tracking-tight text-foreground">{title}</h3>
	<p class="text-sm text-muted-foreground">{description}</p>
</a>
