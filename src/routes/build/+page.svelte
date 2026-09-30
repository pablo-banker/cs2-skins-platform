<script lang="ts">
	import { page as appPage } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import LoadoutSection from '$lib/components/loadout/LoadoutSection.svelte';
	import LoadoutSlot from '$lib/components/loadout/LoadoutSlot.svelte';
	import LoadoutSkinPicker from '$lib/components/loadout/LoadoutSkinPicker.svelte';
	import LoadoutSummary from '$lib/components/loadout/LoadoutSummary.svelte';
	import { createLoadoutBuilder } from '$lib/features/loadout/builder.svelte';
	import { orderedSelections } from '$lib/features/loadout/selection';
	import { readPersistedLoadout, writePersistedLoadout } from '$lib/features/loadout/persistence';
	import { SHARE_PARAM } from '$lib/features/loadout/share';
	import { pageTitle } from '$lib/config/site';
	import type { LoadoutSlotConfig } from '$lib/config/loadout';
	import type { LoadoutPricingResult, LoadoutSkinOption } from '$lib/types/loadout';
	import type { LoadoutResolution } from '$lib/server/services/loadout';
	import type { SkinSelection } from '$lib/schemas/skin-detail';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/**
	 * The builder's state, owned by this page.
	 *
	 * One current loadout, kept on this device. There is no account and no
	 * server-side store, so "saved" means saved in this browser — which is
	 * what the summary says.
	 */
	const builder = createLoadoutBuilder();

	/**
	 * A shared link is already decoded and resolved by the time this renders,
	 * so it is hydrated **synchronously** rather than in an effect: the first
	 * paint is the shared loadout, on the server, with no empty builder
	 * flashing first and no client waterfall.
	 *
	 * Read once on purpose. A share link always arrives as a fresh document —
	 * nothing in the product links to one — so there is no later `data.shared`
	 * to react to, and reacting would mean re-hydrating over someone's edits.
	 */
	// svelte-ignore state_referenced_locally
	const sharedOnLoad = data.shared;

	if (sharedOnLoad.state === 'loaded') {
		builder.hydrate(sharedOnLoad.selections, 'shared', sharedOnLoad.rejected.length);
	}

	let pickerSlot = $state<LoadoutSlotConfig | undefined>(undefined);
	let pickerOpen = $state(false);
	// Dismissed rather than assigned from `data`, so it follows a navigation to
	// a different share link instead of freezing at the first one.
	let shareNoticeDismissed = $state(false);
	const shareFailed = $derived(data.shared.state === 'invalid' && !shareNoticeDismissed);

	const canonical = $derived(new URL(resolve('/build'), appPage.url.origin).href);

	/**
	 * Restoration, once, on the client.
	 *
	 * **A shared link wins.** Following one is a deliberate navigation to
	 * someone else's loadout, so it is what gets shown — and it is shown
	 * without touching this visitor's own save, which stays exactly where it
	 * was until they change something.
	 *
	 * Everything else reads the device's save and asks the server to turn it
	 * back into real catalog data. Until that resolves the builder stays in its
	 * restoring state, so an edit cannot race an older loadout landing on top
	 * of it — and, crucially, nothing is written back during the window when
	 * the builder is still empty.
	 */
	$effect(() => {
		// The shared case was handled synchronously above, and reading this
		// visitor's own save would be exactly the overwrite we are avoiding.
		if (data.shared.state === 'loaded') return;

		let cancelled = false;
		const saved = readPersistedLoadout();

		if (!saved || saved.length === 0) {
			builder.startEmpty();
			return;
		}

		(async () => {
			try {
				const response = await fetch('/api/build/resolve', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ selections: saved })
				});

				if (!response.ok) throw new Error('resolve-failed');

				const resolution = (await response.json()) as LoadoutResolution;
				if (cancelled) return;

				builder.hydrate(resolution.selections, 'local', resolution.rejected.length);
			} catch {
				// The catalog is unreachable. Usable for this session, with the
				// save left exactly where it is — an outage is no reason to take
				// someone's loadout away.
				if (!cancelled) builder.startUnrestored();
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	/**
	 * Saving, automatically, once there is something safe to save.
	 *
	 * `persistable` is the gate: it withholds everything while restoration is
	 * running, and while a shared loadout is only being looked at. Without it
	 * the very first render — an empty builder — would overwrite a saved
	 * loadout before it had a chance to load.
	 */
	$effect(() => {
		const selections = builder.persistable;
		if (!selections) return;

		writePersistedLoadout(selections);
	});

	/**
	 * Drops the share payload from the address bar once the loadout stops being
	 * the shared one.
	 *
	 * Leaving it would mean the URL described a loadout that is no longer on
	 * screen — and copying it would share something the visitor never built.
	 * Other query parameters are left alone.
	 */
	$effect(() => {
		if (builder.origin === 'shared' || !appPage.url.searchParams.has(SHARE_PARAM)) return;

		const next = new URL(appPage.url);
		next.searchParams.delete(SHARE_PARAM);

		// Rewriting the current URL, not navigating to a route: `resolve()`
		// takes a route id and there is no route to name here — the path is the
		// one already on screen, minus a query parameter.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(`${next.pathname}${next.search}`, appPage.state);
	});

	/**
	 * Whether this device already holds a saved loadout.
	 *
	 * Only matters while a shared loadout is being viewed: clearing it counts
	 * as adoption, so it would replace whatever was saved here — and that is
	 * worth saying before someone does it rather than after.
	 */
	let hasLocalSave = $state(false);

	$effect(() => {
		if (builder.origin !== 'shared') return;

		hasLocalSave = (readPersistedLoadout() ?? []).length > 0;
	});

	function openPicker(slot: LoadoutSlotConfig) {
		pickerSlot = slot;
		pickerOpen = true;
	}

	function select(option: LoadoutSkinOption, variant: SkinSelection) {
		shareNoticeDismissed = true;
		if (pickerSlot) builder.select(pickerSlot.id, option, variant);
	}

	/**
	 * Asks the server what the current selections cost.
	 *
	 * The one place in the builder that touches market data, and only because
	 * someone pressed the button. Prices are never saved and never shared, so
	 * this starts from nothing after every reload.
	 */
	async function calculate() {
		if (!builder.startPricing()) return;

		try {
			const response = await fetch('/api/build/prices', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ selections: orderedSelections(builder.loadout) })
			});

			if (!response.ok) throw new Error('pricing-unavailable');

			builder.finishPricing((await response.json()) as LoadoutPricingResult);
		} catch {
			// The selections are untouched: a failed price check must not cost
			// someone the loadout they just built.
			builder.failPricing();
		}
	}

	function filledIn(slots: readonly LoadoutSlotConfig[]): number {
		return slots.filter((slot) => builder.selectionFor(slot.id)).length;
	}

	const pricesBySlot = $derived(
		new Map((builder.pricing?.items ?? []).map((item) => [item.slotId, item]))
	);
</script>

<svelte:head>
	<title>{pageTitle('Build a CS2 Loadout')}</title>
	<meta
		name="description"
		content="Pick a skin for every weapon in your CS2 loadout, choose the exact exterior, and compare what the whole set costs across marketplaces right now."
	/>
	<!--
		Canonical is always plain `/build`. A shared loadout is a state of this
		page, not a separate product to index — and the payload has no business
		in a title, a description or a preview card.
	-->
	<link rel="canonical" href={canonical} />
</svelte:head>

<PageContainer class="space-y-8">
	<header class="max-w-2xl space-y-2">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
			Build your loadout
		</h1>
		<p class="text-sm text-muted-foreground">
			Choose a skin for each weapon you care about, then check what the set costs at current
			marketplace prices. Your loadout is kept in this browser and can be shared as a link.
		</p>

		{#if shareFailed}
			<p class="rounded-md border border-border bg-surface p-2 text-sm text-muted-foreground">
				This shared loadout could not be loaded.
			</p>
		{/if}
	</header>

	<div class="grid gap-8 lg:grid-cols-[1fr_minmax(0,20rem)] lg:items-start">
		<div class="space-y-8">
			{#each data.sections as section (section.category)}
				<LoadoutSection
					id={section.category}
					label={section.label}
					slots={section.slots}
					filled={filledIn(section.slots)}
				>
					{#snippet card(config)}
						<LoadoutSlot
							{config}
							option={builder.optionFor(config.id)}
							variant={builder.selectionFor(config.id)?.variant ?? {}}
							price={pricesBySlot.get(config.id)}
							onchoose={() => openPicker(config)}
							onremove={() => builder.remove(config.id)}
						/>
					{/snippet}
				</LoadoutSection>
			{/each}
		</div>

		<!--
			Sticky on desktop, where there is room beside the slots. On mobile it
			simply comes first: a permanently docked panel would cover the very
			slots someone is trying to fill.
		-->
		<div class="order-first lg:sticky lg:top-20 lg:order-none">
			<LoadoutSummary
				loadout={builder.loadout}
				filled={builder.filledCount}
				total={data.slotCount}
				status={builder.status}
				pricing={builder.pricing}
				hydration={builder.hydration}
				origin={builder.origin}
				rejectedCount={builder.rejectedCount}
				shareOrigin={appPage.url.origin}
				{hasLocalSave}
				oncalculate={calculate}
				onclear={() => builder.clear()}
			/>
		</div>
	</div>
</PageContainer>

{#if pickerSlot}
	{#key pickerSlot.id}
		<LoadoutSkinPicker
			slot={pickerSlot}
			bind:open={pickerOpen}
			current={builder.optionFor(pickerSlot.id)}
			currentVariant={builder.selectionFor(pickerSlot.id)?.variant}
			onselect={select}
		/>
	{/key}
{/if}
