<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import SearchIcon from '@lucide/svelte/icons/search';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';
	import LoadoutVariantPicker from './LoadoutVariantPicker.svelte';
	import { resolveVariant, variantEdition } from '$lib/features/skins/variant-selection';
	import type { LoadoutSlotConfig } from '$lib/config/loadout';
	import type { LoadoutSkinOption, LoadoutSkinPage } from '$lib/types/loadout';
	import type { SkinSelection } from '$lib/schemas/skin-detail';

	/**
	 * Choosing a skin for one slot.
	 *
	 * Two steps in one dialog: pick the skin, then pick the exact version.
	 * Committing a representative variant on the first click would be guessing
	 * — a builder selection is an exact item, and which exterior someone wants
	 * is most of the decision.
	 *
	 * **Nothing here mutates the loadout.** The draft lives in this component
	 * until `Add to loadout`; closing the dialog throws it away. And nothing
	 * here asks for a price: browsing the catalog is free, and a picker that
	 * quietly priced every option would spend a metered quota on window
	 * shopping.
	 */
	let {
		slot,
		open = $bindable(false),
		/** The skin already in this slot, so reopening starts where it left off. */
		current,
		currentVariant,
		onselect
	}: {
		slot: LoadoutSlotConfig;
		open?: boolean;
		current?: LoadoutSkinOption;
		currentVariant?: SkinSelection;
		onselect: (option: LoadoutSkinOption, variant: SkinSelection) => void;
	} = $props();

	let input = $state('');
	let page = $state(1);
	let draft = $state<LoadoutSkinOption | undefined>(undefined);
	let draftVariant = $state<SkinSelection>({});

	// Typing is separated from fetching so the field stays responsive while a
	// request is in flight. The endpoint reads an in-memory index, so the
	// debounce is short — it exists to avoid a request per keystroke, not to
	// protect anything expensive.
	let debounced = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const value = input;
		clearTimeout(timer);
		timer = setTimeout(() => {
			debounced = value;
			page = 1;
		}, 150);

		return () => clearTimeout(timer);
	});

	// Opening the dialog resets the browse state and picks up whatever is
	// already in the slot, so "Change" starts from the current skin.
	$effect(() => {
		if (!open) return;

		input = '';
		debounced = '';
		page = 1;
		draft = current;
		draftVariant = currentVariant ?? {};
	});

	const query = $derived(debounced.trim());

	const results = createQuery(() => ({
		// Deterministic and fully describes the request: same slot, query and
		// page means the same answer, and no key is ever regenerated.
		queryKey: ['loadout-skins', slot.id, query, page],
		enabled: open,
		queryFn: async ({ signal }: { signal: AbortSignal }): Promise<LoadoutSkinPage> => {
			const search =
				`slot=${encodeURIComponent(slot.id)}&page=${page}` +
				(query ? `&q=${encodeURIComponent(query)}` : '');

			const response = await fetch(`/api/build/skins?${search}`, { signal });
			if (!response.ok) throw new Error('skins-unavailable');

			return response.json();
		}
	}));

	const options = $derived(results.data?.options ?? []);
	const pageCount = $derived(results.data?.pageCount ?? 1);

	/** The exact variant the draft currently resolves to. */
	const resolved = $derived(draft ? resolveVariant(draft, draftVariant) : undefined);

	function chooseSkin(option: LoadoutSkinOption) {
		draft = option;

		// Start from the variant a card would show, then let the controls
		// refine it — rather than from nothing, which would mean the confirm
		// button did something unpredictable.
		const variant = resolveVariant(option, {});
		draftVariant = variant
			? { wear: variant.wear, edition: variantEdition(variant), phase: variant.phase }
			: {};
	}

	function confirm() {
		if (!draft || !resolved) return;

		onselect(draft, {
			wear: resolved.wear,
			edition: variantEdition(resolved),
			phase: resolved.phase
		});

		open = false;
	}

	/** A vanilla knife has no finish, so its weapon name is the whole identity. */
	function label(option: LoadoutSkinOption): string {
		return option.name || option.weapon;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90dvh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
		<Dialog.Header class="border-b border-border p-4">
			<Dialog.Title>Choose a {slot.label} skin</Dialog.Title>
			<Dialog.Description>
				Search the catalog, then pick the exact version you want.
			</Dialog.Description>
		</Dialog.Header>

		<div class="border-b border-border p-4">
			<label class="sr-only" for="loadout-picker-search">Search {slot.label} skins</label>
			<div class="relative">
				<SearchIcon
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					id="loadout-picker-search"
					bind:value={input}
					placeholder="Search {slot.label} skins"
					autocomplete="off"
					class="pl-9"
				/>
			</div>
		</div>

		<div class="max-h-[40dvh] overflow-y-auto p-2" aria-busy={results.isFetching}>
			{#if results.isPending}
				<ul class="space-y-1">
					{#each { length: 5 }, index (index)}
						<li class="flex items-center gap-3 p-2">
							<Skeleton class="size-12 shrink-0 rounded-sm" />
							<Skeleton class="h-4 w-40" />
						</li>
					{/each}
				</ul>
			{:else if results.isError}
				<p class="p-6 text-center text-sm text-muted-foreground">We couldn't load skins.</p>
			{:else if options.length === 0}
				<p class="p-6 text-center text-sm text-muted-foreground">
					No {slot.label} skins match “{query}”.
				</p>
			{:else}
				<ul class="space-y-1">
					{#each options as option (option.slug)}
						<li>
							<button
								type="button"
								onclick={() => chooseSkin(option)}
								aria-pressed={draft?.slug === option.slug}
								class="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none {draft?.slug ===
								option.slug
									? 'bg-surface-hover'
									: ''}"
							>
								<SkinImage
									src={option.imageUrl}
									alt={option.fullName}
									decorative
									class="w-14 shrink-0 rounded-sm bg-surface-elevated"
									imageClass="p-1"
								/>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-xs text-muted-foreground">{option.weapon}</span>
									<span class="block truncate text-sm font-medium text-foreground">
										{label(option)}
									</span>
								</span>
								<SkinRarity rarity={option.rarity} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if pageCount > 1}
			<nav
				class="flex items-center justify-between gap-3 border-t border-border px-4 py-2"
				aria-label="Skin results"
			>
				<Button
					variant="outline"
					size="sm"
					disabled={page <= 1}
					onclick={() => (page = Math.max(1, page - 1))}
				>
					Previous
				</Button>
				<span class="text-xs text-muted-foreground" aria-live="polite">
					Page {results.data?.page ?? page} of {pageCount}
				</span>
				<Button
					variant="outline"
					size="sm"
					disabled={page >= pageCount}
					onclick={() => (page = Math.min(pageCount, page + 1))}
				>
					Next
				</Button>
			</nav>
		{/if}

		<div class="space-y-4 border-t border-border p-4">
			{#if draft}
				<div class="flex items-center gap-3">
					<SkinImage
						src={draft.imageUrl}
						alt={draft.fullName}
						decorative
						class="w-14 shrink-0 rounded-sm bg-surface-elevated"
						imageClass="p-1"
					/>
					<div class="min-w-0">
						<p class="truncate text-xs text-muted-foreground">{draft.weapon}</p>
						<p class="truncate text-sm font-medium text-foreground">{label(draft)}</p>
					</div>
				</div>

				<LoadoutVariantPicker option={draft} bind:selection={draftVariant} />
			{:else}
				<p class="text-sm text-muted-foreground">Pick a skin to choose its exterior.</p>
			{/if}

			<div class="flex justify-end gap-2">
				<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
				<Button disabled={!resolved} onclick={confirm}>
					{current ? 'Replace skin' : 'Add to loadout'}
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
