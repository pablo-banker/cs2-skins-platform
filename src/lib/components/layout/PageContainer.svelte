<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	/**
	 * The horizontal frame every page sits in.
	 *
	 * It owns the gutters and the maximum width so routes never invent their
	 * own, which is what keeps the header's edges aligned with the content
	 * beneath it. Gutters step 16 → 24 → 32px across the breakpoints; the cap
	 * is wide enough for a dense comparison table and short of the point where
	 * a line of content stops feeling related to the one above it.
	 */
	let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<div class={cn('mx-auto w-full max-w-app px-4 sm:px-6 lg:px-8', className)}>
	{@render children()}
</div>
