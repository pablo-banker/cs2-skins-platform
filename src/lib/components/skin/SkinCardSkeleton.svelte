<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	/**
	 * Placeholder for a skin card.
	 *
	 * Matches the real card's structure — same border, same 4:3 image box,
	 * same padding and text heights — so a grid does not reflow when the real
	 * cards arrive.
	 */
	let { class: className }: { class?: string } = $props();
</script>

<div
	class={cn('flex flex-col overflow-hidden rounded-lg border border-border bg-card', className)}
	aria-hidden="true"
>
	<Skeleton class="aspect-[4/3] w-full rounded-none" />
	<div class="flex flex-1 flex-col gap-3 p-3">
		<div class="space-y-1.5">
			<Skeleton class="h-3 w-12" />
			<Skeleton class="h-4 w-24" />
		</div>
		<Skeleton class="h-5 w-20" />
		<div class="mt-auto flex items-end justify-between gap-2 pt-1">
			<div class="space-y-1">
				<Skeleton class="h-3 w-8" />
				<Skeleton class="h-5 w-24" />
			</div>
			<Skeleton class="h-3 w-16" />
		</div>
	</div>
</div>
