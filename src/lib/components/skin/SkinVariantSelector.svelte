<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		availableEditions,
		availablePhases,
		availableWears,
		skinVariantSearch,
		variantEdition
	} from '$lib/features/skins/variant-selection';
	import type { SkinEdition } from '$lib/schemas/skin-detail';
	import type { Skin, SkinVariant } from '$lib/types/skin';

	/**
	 * Choosing which version of a skin to price.
	 *
	 * Every option is a real link to a real variant: shareable, in the browser
	 * history, and working without JavaScript. Options are built from the
	 * variants the skin actually has, so the selector can never offer an
	 * exterior or edition that cannot be bought.
	 *
	 * A control with only one possible value is not rendered — a disabled
	 * dropdown teaches nothing.
	 */
	let { skin, variant }: { skin: Skin; variant: SkinVariant } = $props();

	const editionLabels: Record<SkinEdition, string> = {
		normal: 'Normal',
		stattrak: 'StatTrak',
		souvenir: 'Souvenir'
	};

	const edition = $derived(variantEdition(variant));
	const editions = $derived(availableEditions(skin));
	// Exteriors are listed for the chosen edition: StatTrak and Souvenir do not
	// always cover the same conditions as the plain version.
	const wears = $derived(availableWears(skin, edition));
	const phases = $derived(availablePhases(skin, edition));

	/** The URL that selects a variant, keeping the rest of the choice intact. */
	function href(changes: { wear?: string; edition?: SkinEdition; phase?: string }) {
		const search = skinVariantSearch(skin, {
			wear: changes.wear ?? variant.wear,
			edition: changes.edition ?? edition,
			phase: changes.phase ?? variant.phase,
			...changes
		});

		return `${resolve('/skins/[slug]', { slug: skin.id })}${search}`;
	}

	const optionClass = (active: boolean) =>
		`focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
			active
				? 'border-primary bg-primary-subtle text-foreground'
				: 'border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
		}`;
</script>

<!--
	Every link below is a skin route built by `href()`, which resolves it through
	`resolve('/skins/[slug]', …)` before appending the variant query. The lint rule
	cannot see through the helper.
-->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<div class="space-y-4">
	{#if editions.length > 1}
		<div class="space-y-2">
			<span class="block text-xs font-medium text-muted-foreground" id="edition-label">
				Edition
			</span>
			<div class="flex flex-wrap gap-2" role="group" aria-labelledby="edition-label">
				{#each editions as option (option)}
					<a
						href={href({ edition: option })}
						aria-current={option === edition ? 'true' : undefined}
						class={optionClass(option === edition)}
					>
						{editionLabels[option]}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	{#if wears.length > 1}
		<div class="space-y-2">
			<span class="block text-xs font-medium text-muted-foreground" id="exterior-label">
				Exterior
			</span>
			<div class="flex flex-wrap gap-2" role="group" aria-labelledby="exterior-label">
				{#each wears as option (option)}
					<a
						href={href({ wear: option })}
						aria-current={option === variant.wear ? 'true' : undefined}
						class={optionClass(option === variant.wear)}
					>
						{option}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	{#if phases.length > 1}
		<div class="space-y-2">
			<span class="block text-xs font-medium text-muted-foreground" id="phase-label">Phase</span>
			<div class="flex flex-wrap gap-2" role="group" aria-labelledby="phase-label">
				{#each phases as option (option)}
					<a
						href={href({ phase: option })}
						aria-current={option === variant.phase ? 'true' : undefined}
						class={optionClass(option === variant.phase)}
					>
						{option}
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
