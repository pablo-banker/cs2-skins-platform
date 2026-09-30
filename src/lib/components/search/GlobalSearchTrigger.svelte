<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';

	/**
	 * Opens global search from the header.
	 *
	 * A button, not an input: clicking it opens a dialog, and an element that
	 * looks editable but is not would be a small lie told on every page. It
	 * reads as a search field on wide screens and collapses to an icon where
	 * the navigation needs the room.
	 *
	 * The shortcut hint is decoration — the accessible name carries the
	 * meaning on its own.
	 */
	let {
		onopen,
		/** Exposed so the dialog can hand focus back here when it closes. */
		ref = $bindable(null)
	}: { onopen: () => void; ref?: HTMLElement | null } = $props();
</script>

<button
	bind:this={ref}
	type="button"
	onclick={onopen}
	aria-label="Search skins"
	aria-keyshortcuts="Control+K Meta+K"
	class="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:w-56 lg:px-3"
>
	<SearchIcon class="size-4 shrink-0" aria-hidden="true" />
	<span class="hidden flex-1 text-left lg:inline" aria-hidden="true">Search skins…</span>
	<kbd
		class="hidden rounded-sm border border-border bg-surface-elevated px-1.5 py-0.5 font-sans text-[0.6875rem] text-subtle-foreground lg:inline"
		aria-hidden="true"
	>
		Ctrl K
	</kbd>
</button>
