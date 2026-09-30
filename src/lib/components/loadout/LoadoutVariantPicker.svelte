<script lang="ts">
	import {
		availableEditions,
		availablePhases,
		availableWears,
		resolveVariant,
		variantEdition
	} from '$lib/features/skins/variant-selection';
	import type { LoadoutSkinOption } from '$lib/types/loadout';
	import type { SkinSelection } from '$lib/schemas/skin-detail';

	/**
	 * Choosing the exact version of a skin, inside the picker.
	 *
	 * Reuses the **logic** the skin page uses — the same `resolveVariant`,
	 * the same available-option helpers — but not its UI: `SkinVariantSelector`
	 * renders links, because there a variant change is a navigation. Here it is
	 * client state in a dialog, so links would be wrong.
	 *
	 * Controls appear only where there is a real choice: one exterior means no
	 * exterior control, and no phased finish means no phase control. An option
	 * that would resolve to nothing is never offered.
	 */
	let { option, selection = $bindable() }: { option: LoadoutSkinOption; selection: SkinSelection } =
		$props();

	const editions = $derived(availableEditions(option));
	// Wears and phases are scoped to the chosen edition, because a StatTrak
	// finish does not always exist in the same exteriors as the plain one.
	const wears = $derived(availableWears(option, selection.edition));
	const phases = $derived(availablePhases(option, selection.edition));

	/** The variant the current selection actually lands on. */
	const resolved = $derived(resolveVariant(option, selection));

	function choose(next: SkinSelection) {
		// Re-resolve so the controls always show a combination that exists:
		// switching to StatTrak when the current exterior has none moves the
		// exterior too, rather than leaving an impossible pair on screen.
		const variant = resolveVariant(option, { ...selection, ...next });
		if (!variant) return;

		selection = {
			wear: variant.wear,
			edition: variantEdition(variant),
			phase: variant.phase
		};
	}

	const groupClass = 'flex flex-wrap gap-1.5 rounded-md border border-border p-1';
	const optionClass = (active: boolean) =>
		`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none ${
			active ? 'bg-surface-hover text-foreground' : 'text-muted-foreground hover:text-foreground'
		}`;
</script>

<div class="space-y-3">
	{#if editions.length > 1}
		<div class="space-y-1.5">
			<span class="block text-xs font-medium text-muted-foreground" id="builder-edition-label">
				Edition
			</span>
			<div class={groupClass} role="group" aria-labelledby="builder-edition-label">
				{#each editions as edition (edition)}
					<button
						type="button"
						onclick={() => choose({ edition })}
						aria-pressed={selection.edition === edition}
						class={optionClass(selection.edition === edition)}
					>
						{edition === 'normal' ? 'Normal' : edition === 'stattrak' ? 'StatTrak' : 'Souvenir'}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if wears.length > 1}
		<div class="space-y-1.5">
			<span class="block text-xs font-medium text-muted-foreground" id="builder-wear-label">
				Exterior
			</span>
			<div class={groupClass} role="group" aria-labelledby="builder-wear-label">
				{#each wears as wear (wear)}
					<button
						type="button"
						onclick={() => choose({ wear })}
						aria-pressed={selection.wear === wear}
						class={optionClass(selection.wear === wear)}
					>
						{wear}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if phases.length > 1}
		<div class="space-y-1.5">
			<span class="block text-xs font-medium text-muted-foreground" id="builder-phase-label">
				Phase
			</span>
			<div class={groupClass} role="group" aria-labelledby="builder-phase-label">
				{#each phases as phase (phase)}
					<button
						type="button"
						onclick={() => choose({ phase })}
						aria-pressed={selection.phase === phase}
						class={optionClass(selection.phase === phase)}
					>
						{phase}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if editions.length <= 1 && wears.length <= 1 && phases.length <= 1}
		<!--
			Nothing to choose between. Saying so is better than an empty space
			where controls might have been.
		-->
		<p class="text-xs text-muted-foreground">
			{#if resolved?.wear}
				Sold only as {resolved.wear}.
			{:else}
				This skin has one version.
			{/if}
		</p>
	{/if}
</div>
