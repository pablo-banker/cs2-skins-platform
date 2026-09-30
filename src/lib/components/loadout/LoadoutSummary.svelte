<script lang="ts">
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadoutPriceSummary from './LoadoutPriceSummary.svelte';
	import LoadoutShareAction from './LoadoutShareAction.svelte';
	import type { Loadout, LoadoutPricingResult } from '$lib/types/loadout';
	import type {
		HydrationState,
		LoadoutOrigin,
		PricingStatus
	} from '$lib/features/loadout/builder.svelte';

	/**
	 * The loadout at a glance: how much of it is filled, what it costs, and the
	 * things you can do to the whole of it.
	 *
	 * Progress is a count, not a score. "12 / 37" tells someone how much of the
	 * inventory they have chosen; a percentage or a badge would imply that
	 * filling every slot is the goal, and nobody buys thirty-seven skins.
	 *
	 * Share and Clear live here rather than beside the slots, because they act
	 * on the loadout rather than on any one place in it.
	 */
	let {
		loadout,
		filled,
		total,
		status,
		pricing,
		hydration = 'ready',
		origin = 'empty',
		/** Saved or shared selections that no longer resolve. */
		rejectedCount = 0,
		shareOrigin = '',
		/** True when this device has a saved loadout that clearing would replace. */
		hasLocalSave = false,
		oncalculate,
		onclear
	}: {
		loadout: Loadout;
		filled: number;
		total: number;
		status: PricingStatus;
		pricing?: LoadoutPricingResult;
		hydration?: HydrationState;
		origin?: LoadoutOrigin;
		rejectedCount?: number;
		/** Page origin, so the share link works wherever this is running. */
		shareOrigin?: string;
		hasLocalSave?: boolean;
		oncalculate: () => void;
		onclear: () => void;
	} = $props();

	let confirming = $state(false);

	function clear() {
		confirming = false;
		onclear();
	}
</script>

<section
	class="space-y-4 rounded-lg border border-border bg-surface p-4"
	aria-labelledby="loadout-summary-heading"
>
	<div class="space-y-1">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 id="loadout-summary-heading" class="text-base font-semibold text-foreground">
				Your loadout
			</h2>

			{#if origin === 'shared'}
				<!--
					Named, not just coloured: "shared" has to be legible to
					someone who cannot tell this chip from any other.
				-->
				<span
					class="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
				>
					<Share2Icon class="size-3" aria-hidden="true" />
					Shared loadout
				</span>
			{/if}
		</div>

		<!--
			Not a live region: the count changes on every selection, and having
			that announced each time is noise. The pricing status below is the
			one thing worth interrupting for.
		-->
		<p class="font-mono text-sm text-muted-foreground tabular-nums">
			{#if hydration === 'restoring'}
				Restoring your loadout…
			{:else}
				{filled} / {total} slots filled
			{/if}
		</p>
	</div>

	{#if rejectedCount > 0}
		<!--
			Said plainly rather than dropped quietly: coming back with four of
			five skins and no explanation is lying by omission.
		-->
		<p
			class="flex gap-2 rounded-md border border-border bg-surface-elevated p-2 text-xs text-muted-foreground"
		>
			<TriangleAlertIcon class="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
			<span>
				{#if rejectedCount === 1}
					Your loadout was restored, but 1 saved selection is no longer available.
				{:else}
					Your loadout was restored, but {rejectedCount} saved selections are no longer available.
				{/if}
			</span>
		</p>
	{/if}

	<LoadoutPriceSummary {status} {pricing} selectionCount={filled} {oncalculate} />

	{#if filled > 0}
		<LoadoutShareAction {loadout} origin={shareOrigin} />

		<!--
			Confirmed because it is not undoable: one stray click would lose a
			loadout someone spent minutes assembling, along with its save.
		-->
		<Button variant="ghost" size="sm" class="w-full" onclick={() => (confirming = true)}>
			Clear loadout
		</Button>

		<Dialog.Root bind:open={confirming}>
			<Dialog.Content class="sm:max-w-sm">
				<Dialog.Header>
					<Dialog.Title>Clear your loadout?</Dialog.Title>
					<Dialog.Description>
						{#if origin === 'shared' && hasLocalSave}
							<!--
								Clearing counts as adopting: the empty result becomes
								what is saved here. Someone clearing a link they were
								only looking at would not expect to lose their own
								loadout, so it is said outright rather than discovered.
							-->
							Clearing this shared loadout will also replace the loadout saved on this device. This removes
							all {filled} selected {filled === 1 ? 'skin' : 'skins'} and cannot be undone.
						{:else}
							This removes all {filled} selected {filled === 1 ? 'skin' : 'skins'}, here and from
							this device. It cannot be undone.
						{/if}
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Button variant="ghost" onclick={() => (confirming = false)}>Keep loadout</Button>
					<Button variant="destructive" onclick={clear}>Clear loadout</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{/if}

	{#if origin === 'local' && filled > 0}
		<!-- Quiet, and stated once. Not a status that flashes after every edit. -->
		<p class="text-xs text-subtle-foreground">Saved on this device.</p>
	{/if}
</section>
