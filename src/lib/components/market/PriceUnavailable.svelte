<script lang="ts">
	import { cn } from '$lib/utils';

	/**
	 * Shown where a price would go when there is no usable one.
	 *
	 * Neutral wording on purpose: we know we have no price to show, which is
	 * not the same as knowing the marketplace is down. Claiming the second
	 * would be telling the visitor something we have not verified.
	 */
	let { class: className }: { class?: string } = $props();
</script>

<span class={cn('text-sm text-muted-foreground', className)}>Price unavailable</span>
