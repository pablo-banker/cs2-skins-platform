<script lang="ts">
	import { cn } from '$lib/utils';

	/**
	 * The exterior of a variant: Factory New through Battle-Scarred.
	 *
	 * Neutral on purpose. Wear is a property of the item, not a judgement
	 * about it — colouring Battle-Scarred as a warning would tell the visitor
	 * something untrue about a perfectly good skin.
	 */
	let { wear, class: className }: { wear?: string | null; class?: string } = $props();
</script>

{#if wear}
	<span
		class={cn(
			'inline-flex items-center rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground',
			className
		)}
	>
		{wear}
	</span>
{/if}
