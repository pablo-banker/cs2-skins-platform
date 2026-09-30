<script lang="ts">
	import { cn } from '$lib/utils';

	/**
	 * Marks the cheapest usable quote in a comparison.
	 *
	 * **Success green, not brand amber.** The design system reserves amber for
	 * navigation and primary actions, and green for a positive economic
	 * outcome — and a best price is exactly that. Keeping the two apart is what
	 * lets a visitor scan a comparison table and know that green means money
	 * saved, everywhere, without learning a second colour language.
	 *
	 * The label is always rendered: colour alone would leave the meaning
	 * invisible to anyone who cannot separate green from the surface.
	 */
	let { class: className }: { class?: string } = $props();
</script>

<span
	class={cn(
		'inline-flex items-center rounded-sm bg-success-subtle px-1.5 py-0.5 text-xs font-medium text-success',
		className
	)}
>
	Best price
</span>
