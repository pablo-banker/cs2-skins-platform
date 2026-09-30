<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	/**
	 * Placeholder for a provider row.
	 *
	 * Mirrors the real row's box — same border, padding and heights — so the
	 * comparison does not jump when the quotes arrive.
	 */
	let { class: className }: { class?: string } = $props();
</script>

<div
	class={cn(
		'flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5',
		className
	)}
	aria-hidden="true"
>
	<Skeleton class="size-7 shrink-0 rounded-sm" />
	<div class="flex-1 space-y-1.5">
		<Skeleton class="h-3.5 w-24" />
		<Skeleton class="h-3 w-12" />
	</div>
	<Skeleton class="h-4 w-20 shrink-0" />
</div>
