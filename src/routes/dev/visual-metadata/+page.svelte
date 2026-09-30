<script lang="ts">
	import { onMount } from 'svelte';
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { SKIN_COLORS, SKIN_STYLES } from '$lib/types/visual-metadata';
	import type { CurationResponse, CurationSkin } from '$lib/schemas/visual-curation';
	import type { SkinColor, SkinStyle } from '$lib/types/visual-metadata';

	/**
	 * The visual curation workspace.
	 *
	 * Development only. A tool for looking at skins and writing down what they
	 * look like — efficient rather than polished, because the only user is
	 * whoever is doing the curating.
	 *
	 * **It classifies nothing.** Every value is chosen by a person looking at
	 * the image beside it; there is no suggestion, no inference from the name,
	 * and no automation of the judgement. Saving writes the same record shape
	 * production validates, so a bad classification cannot get in.
	 */
	let data = $state<CurationResponse | undefined>(undefined);
	let loading = $state(true);
	let failed = $state(false);

	let weapon = $state('');
	let status = $state<'all' | 'curated' | 'uncurated'>('all');
	let search = $state('');

	let index = $state(0);
	let primary = $state<SkinColor[]>([]);
	let secondary = $state<SkinColor[]>([]);
	let styles = $state<SkinStyle[]>([]);
	let dirty = $state(false);
	let saved = $state('');

	const current = $derived<CurationSkin | undefined>(data?.skins[index]);

	async function load() {
		loading = true;
		failed = false;

		const params = [`status=${status}`, 'limit=500'];
		if (weapon) params.push(`weapon=${encodeURIComponent(weapon)}`);
		if (search.trim()) params.push(`q=${encodeURIComponent(search.trim())}`);

		try {
			const response = await fetch(`/api/dev/visual-metadata?${params.join('&')}`);
			if (!response.ok) throw new Error('failed');

			data = (await response.json()) as CurationResponse;
			index = 0;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	onMount(load);

	// Moving to another skin loads its existing classification, so editing an
	// already-curated record starts from what is there rather than from blank.
	$effect(() => {
		const skin = current;
		if (!skin) return;

		primary = [...(skin.metadata?.primaryColors ?? [])];
		secondary = [...(skin.metadata?.secondaryColors ?? [])];
		styles = [...(skin.metadata?.styles ?? [])];
		dirty = false;
	});

	function toggle<T>(list: T[], value: T): T[] {
		dirty = true;

		return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
	}

	/** Refuses to walk away from unsaved edits without a word. */
	function move(delta: number) {
		if (dirty && !confirm('Discard unsaved changes to this skin?')) return;

		const total = data?.skins.length ?? 0;
		if (total === 0) return;

		index = (index + delta + total) % total;
	}

	function nextUncurated() {
		const skins = data?.skins ?? [];
		if (dirty && !confirm('Discard unsaved changes to this skin?')) return;

		for (let step = 1; step <= skins.length; step++) {
			const candidate = (index + step) % skins.length;

			if (!skins[candidate].metadata) {
				index = candidate;
				return;
			}
		}
	}

	async function save() {
		if (!current) return;

		const response = await fetch('/api/dev/visual-metadata', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				key: current.key,
				weapon: current.weapon,
				skinName: current.skinName,
				primaryColors: primary,
				secondaryColors: secondary,
				styles
			})
		});

		if (!response.ok) {
			saved = 'Rejected — a record needs a primary colour or a style.';
			return;
		}

		const result = (await response.json()) as { curatedTotal: number };

		// Reflect the save locally so coverage and the uncurated walk stay
		// truthful without refetching five hundred skins.
		if (data && current) {
			current.metadata = {
				key: current.key,
				weapon: current.weapon,
				skinName: current.skinName,
				primaryColors: [...primary],
				secondaryColors: [...secondary],
				styles: [...styles]
			};
			data.curatedTotal = result.curatedTotal;
		}

		dirty = false;
		saved = `Saved ${current.key}`;
	}

	const chip = (active: boolean) =>
		`rounded-sm border px-2 py-1 text-xs ${
			active
				? 'border-primary bg-primary-subtle text-foreground'
				: 'border-border text-muted-foreground'
		}`;
</script>

<svelte:head><title>Visual metadata curation</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5 p-6">
	<header class="space-y-1">
		<h1 class="text-xl font-semibold text-foreground">Visual metadata curation</h1>
		<p class="font-mono text-sm text-muted-foreground tabular-nums">
			{#if data}
				{data.curatedTotal} / {data.catalogTotal} curated · {data.matched} match this filter
			{:else}
				Loading…
			{/if}
		</p>
		<p class="text-xs text-subtle-foreground">
			Development only. Classify from the image, never from the name.
		</p>
	</header>

	<div class="flex flex-wrap items-end gap-2">
		<label class="text-xs text-muted-foreground">
			Weapon
			<select
				bind:value={weapon}
				class="mt-1 block rounded-md border border-border bg-surface p-1.5 text-sm text-foreground"
			>
				<option value="">All</option>
				{#each data?.weapons ?? [] as name (name)}<option value={name}>{name}</option>{/each}
			</select>
		</label>

		<label class="text-xs text-muted-foreground">
			Status
			<select
				bind:value={status}
				class="mt-1 block rounded-md border border-border bg-surface p-1.5 text-sm text-foreground"
			>
				<option value="all">All</option>
				<option value="uncurated">Uncurated</option>
				<option value="curated">Curated</option>
			</select>
		</label>

		<label class="text-xs text-muted-foreground">
			Search
			<Input bind:value={search} placeholder="Finish name" class="mt-1 w-48" />
		</label>

		<Button size="sm" onclick={load}>Apply</Button>
	</div>

	{#if loading}
		<p class="text-sm text-muted-foreground">Loading catalog…</p>
	{:else if failed}
		<p class="text-sm text-muted-foreground">Could not load the catalog.</p>
	{:else if !current}
		<p class="text-sm text-muted-foreground">Nothing matches this filter.</p>
	{:else}
		<div class="grid gap-5 sm:grid-cols-[320px_1fr]">
			<div class="space-y-2">
				<SkinImage
					src={current.imageUrl}
					alt={current.fullName}
					class="rounded-lg border border-border bg-surface-elevated"
				/>
				<p class="text-xs text-muted-foreground">{current.weapon}</p>
				<p class="text-base font-medium text-foreground">{current.skinName || '(vanilla)'}</p>
				<p class="font-mono text-xs text-subtle-foreground">{current.key}</p>
				<p class="text-xs {current.metadata ? 'text-success' : 'text-warning'}">
					{current.metadata ? 'Curated' : 'Not yet curated'}
					· {index + 1} / {data?.skins.length}
				</p>
			</div>

			<div class="space-y-4">
				<fieldset class="space-y-1.5">
					<legend class="text-xs font-medium text-muted-foreground">
						Primary colours — what defines it at a glance
					</legend>
					<div class="flex flex-wrap gap-1.5">
						{#each SKIN_COLORS as color (color)}
							<button
								type="button"
								class={chip(primary.includes(color))}
								onclick={() => (primary = toggle(primary, color))}
							>
								{color}
							</button>
						{/each}
					</div>
				</fieldset>

				<fieldset class="space-y-1.5">
					<legend class="text-xs font-medium text-muted-foreground">
						Secondary colours — present and worth matching, not every pixel
					</legend>
					<div class="flex flex-wrap gap-1.5">
						{#each SKIN_COLORS as color (color)}
							<button
								type="button"
								class={chip(secondary.includes(color))}
								onclick={() => (secondary = toggle(secondary, color))}
							>
								{color}
							</button>
						{/each}
					</div>
				</fieldset>

				<fieldset class="space-y-1.5">
					<legend class="text-xs font-medium text-muted-foreground">
						Styles — leave blank when ambiguous
					</legend>
					<div class="flex flex-wrap gap-1.5">
						{#each SKIN_STYLES as style (style)}
							<button
								type="button"
								class={chip(styles.includes(style))}
								onclick={() => (styles = toggle(styles, style))}
							>
								{style}
							</button>
						{/each}
					</div>
				</fieldset>

				<div class="flex flex-wrap gap-2">
					<Button variant="outline" size="sm" onclick={() => move(-1)}>Previous</Button>
					<Button size="sm" onclick={save} disabled={primary.length === 0 && styles.length === 0}>
						Save
					</Button>
					<Button variant="outline" size="sm" onclick={() => move(1)}>Next</Button>
					<Button variant="ghost" size="sm" onclick={nextUncurated}>Next uncurated</Button>
				</div>

				<p class="text-xs text-subtle-foreground" aria-live="polite">
					{dirty ? 'Unsaved changes.' : saved}
				</p>
			</div>
		</div>
	{/if}
</div>
