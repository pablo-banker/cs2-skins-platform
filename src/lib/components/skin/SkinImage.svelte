<script lang="ts">
	import ImageOffIcon from '@lucide/svelte/icons/image-off';
	import { cn } from '$lib/utils';

	/**
	 * Skin artwork in a fixed box.
	 *
	 * The aspect ratio is reserved before anything loads, so a grid never
	 * reflows as images arrive — with a page of skins that is the difference
	 * between a usable list and a jumping one. Weapon art is letterboxed
	 * (`object-contain`) rather than cropped, because a knife and a rifle have
	 * very different proportions and cropping either one loses the skin.
	 */
	let {
		src,
		alt,
		/**
		 * Marks the image as decorative (`alt=""`).
		 *
		 * Set this when the surrounding content already names the skin — a card
		 * that reads "AK-47 Redline" and then announces "AK-47 Redline image"
		 * is worse for a screen reader, not better.
		 */
		decorative = false,
		loading = 'lazy',
		class: className,
		/**
		 * Inset around the artwork. A card can afford the default; a dense
		 * search row cannot, where padding would eat most of a 64px box.
		 */
		imageClass = 'p-3'
	}: {
		src?: string | null;
		alt: string;
		decorative?: boolean;
		loading?: 'lazy' | 'eager';
		class?: string;
		imageClass?: string;
	} = $props();

	let failed = $state(false);

	// A new URL deserves a fresh attempt.
	$effect(() => {
		void src;
		failed = false;
	});

	const showFallback = $derived(!src || failed);
</script>

<div
	class={cn(
		'relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-surface-elevated',
		className
	)}
>
	{#if showFallback}
		<!-- Restrained and quiet: a missing image is not an error to shout about. -->
		<ImageOffIcon class="size-6 text-subtle-foreground" aria-hidden="true" />
		{#if !decorative}
			<span class="sr-only">{alt} — image unavailable</span>
		{/if}
	{:else}
		<img
			{src}
			alt={decorative ? '' : alt}
			{loading}
			decoding="async"
			draggable="false"
			onerror={() => (failed = true)}
			class={cn(
				'size-full object-contain transition-transform duration-200 motion-reduce:transition-none',
				imageClass
			)}
		/>
	{/if}
</div>
