<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { resolve } from '$app/paths';
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';
	import SkinWearBadge from '$lib/components/skin/SkinWearBadge.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { skinVariantSearch } from '$lib/features/skins/variant-selection';
	import type { LoadoutSlotConfig } from '$lib/config/loadout';
	import type { LoadoutSkinOption, PricedLoadoutItem } from '$lib/types/loadout';
	import type { SkinSelection } from '$lib/schemas/skin-detail';

	/**
	 * One place in the loadout: empty, or holding a skin.
	 *
	 * **Empty is a choice, not a loading state.** A skeleton here would say
	 * "something is coming"; nothing is coming until someone picks a skin. So
	 * the empty state is a real, obviously pressable control that says what
	 * pressing it does.
	 *
	 * Once filled the slot carries its own actions, so it stops being one big
	 * button — Change and Remove nested inside a slot-sized button would be
	 * invalid markup and unusable with a keyboard.
	 */
	let {
		config,
		option,
		variant = {},
		price,
		onchoose,
		onremove
	}: {
		config: LoadoutSlotConfig;
		/** The chosen skin, when this slot is filled. */
		option?: LoadoutSkinOption;
		variant?: SkinSelection;
		/** Set once prices have been calculated for the current loadout. */
		price?: PricedLoadoutItem;
		onchoose: () => void;
		onremove: () => void;
	} = $props();

	const wear = $derived(variant.wear);
	const edition = $derived(variant.edition);

	const href = $derived(
		option
			? `${resolve('/skins/[slug]', { slug: option.slug })}${skinVariantSearch(option, variant)}`
			: ''
	);

	// A vanilla knife has no finish, so the weapon name is the whole identity.
	const finish = $derived(option ? option.name || option.weapon : '');
</script>

{#if !option}
	<button
		type="button"
		onclick={onchoose}
		class="flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/50 p-4 text-center transition-colors hover:border-muted-foreground/50 hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
	>
		<span class="text-sm font-medium text-foreground">{config.label}</span>
		<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
			<PlusIcon class="size-3.5" aria-hidden="true" />
			Choose skin
		</span>
		<span class="sr-only">for the {config.label} slot</span>
	</button>
{:else}
	<div
		class="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-muted-foreground/40 motion-reduce:transition-none"
	>
		<div class="flex items-start gap-3">
			<SkinImage
				src={option.imageUrl}
				alt={option.fullName}
				decorative
				class="w-20 shrink-0 rounded-sm bg-surface-elevated"
				imageClass="p-1"
			/>

			<div class="min-w-0 flex-1">
				<p class="truncate text-xs text-muted-foreground">{config.label}</p>
				<!--
					The skin name is the link, not the whole slot: the slot also
					holds buttons, and a link wrapping them would swallow them.
				-->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					{href}
					class="block truncate text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					{finish}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->

				<span class="mt-1 flex flex-wrap items-center gap-2">
					{#if wear}
						<SkinWearBadge {wear} />
					{/if}
					{#if edition === 'stattrak'}
						<span class="text-xs text-subtle-foreground">StatTrak</span>
					{:else if edition === 'souvenir'}
						<span class="text-xs text-subtle-foreground">Souvenir</span>
					{/if}
					{#if variant.phase}
						<span class="text-xs text-subtle-foreground">{variant.phase}</span>
					{/if}
					<SkinRarity rarity={option.rarity} />
				</span>
			</div>
		</div>

		{#if price}
			<div class="text-sm">
				{#if price.state === 'priced' && price.bestPriceMinor !== undefined}
					<PriceDisplay amountMinor={price.bestPriceMinor} currency={price.currency} size="sm" />
					<span class="mt-0.5 block truncate text-xs text-subtle-foreground">
						{price.providerName ?? price.providerId}
					</span>
				{:else if price.state === 'no-quotes'}
					<span class="text-muted-foreground">No current prices</span>
				{:else}
					<span class="text-muted-foreground">Price temporarily unavailable</span>
				{/if}
			</div>
		{/if}

		<!--
			Labelled rather than padded with a hidden span: a row of buttons all
			reading "Change" is useless out of context, and a screen reader
			should hear the slot, not "ChangeAK-47 skin" run together.
		-->
		<div class="mt-auto flex gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={onchoose}
				class="flex-1"
				aria-label="Change {config.label} skin"
			>
				Change
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onclick={onremove}
				aria-label="Remove {finish} from the {config.label} slot"
			>
				Remove
			</Button>
		</div>
	</div>
{/if}
