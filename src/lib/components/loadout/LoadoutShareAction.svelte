<script lang="ts">
	import LinkIcon from '@lucide/svelte/icons/link';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { shareUrl } from '$lib/features/loadout/share';
	import type { Loadout } from '$lib/types/loadout';

	/**
	 * Turns the current loadout into a link and puts it on the clipboard.
	 *
	 * The link carries the loadout itself, so there is nothing to store and
	 * nothing to expire. It carries **no prices** — those change, and a link
	 * promising yesterday's total would be a lie by the time anyone opened it.
	 *
	 * The encoded URL is never rendered by default: it is thousands of
	 * characters and a permanent wall of base64 in the sidebar helps nobody. It
	 * appears only as a fallback, when the clipboard is unavailable and there
	 * is otherwise no way to get the link out.
	 */
	let { loadout, origin }: { loadout: Loadout; origin: string } = $props();

	type CopyState = 'idle' | 'copied' | 'fallback' | 'too-large';

	let copyState = $state<CopyState>('idle');
	let fallbackUrl = $state('');
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	const empty = $derived(loadout.selections.length === 0);

	// Anything that changes the loadout invalidates the last copy's feedback:
	// "Copied" beside a different loadout would be describing the wrong link.
	$effect(() => {
		void loadout;
		clearTimeout(resetTimer);
		copyState = 'idle';
		fallbackUrl = '';

		return () => clearTimeout(resetTimer);
	});

	async function share() {
		const url = shareUrl(loadout, origin);

		// Impossible with 37 valid slots, but a broken link is worse than a
		// refusal, so it is checked rather than assumed.
		if (!url) {
			copyState = 'too-large';
			return;
		}

		try {
			await navigator.clipboard.writeText(url);
			copyState = 'copied';

			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => (copyState = 'idle'), 2500);
		} catch {
			// No clipboard permission, or no clipboard at all. Show the link so
			// it can still be copied by hand.
			fallbackUrl = url;
			copyState = 'fallback';
		}
	}
</script>

<div class="space-y-2">
	<Button
		variant="outline"
		size="sm"
		class="w-full"
		disabled={empty}
		onclick={share}
		aria-label="Copy a link to this loadout"
	>
		{#if copyState === 'copied'}
			<CheckIcon class="size-3.5" aria-hidden="true" />
			Link copied
		{:else}
			<LinkIcon class="size-3.5" aria-hidden="true" />
			Share loadout
		{/if}
	</Button>

	<!--
		One live region for every outcome, so a screen reader hears the result
		once rather than being narrated at on each render.
	-->
	<p class="text-xs text-subtle-foreground" aria-live="polite">
		{#if copyState === 'copied'}
			Link copied to your clipboard.
		{:else if copyState === 'fallback'}
			Copy this link:
		{:else if copyState === 'too-large'}
			This loadout is too large to share.
		{/if}
	</p>

	{#if copyState === 'fallback'}
		<Input
			value={fallbackUrl}
			readonly
			aria-label="Share link"
			class="font-mono text-xs"
			onfocus={(event) => event.currentTarget.select()}
		/>
	{/if}
</div>
