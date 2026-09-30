<script lang="ts">
	import { AreaChart } from 'layerchart';
	import { DISPLAY_CURRENCY, formatMoney, minorUnitScale } from '$lib/formatters/currency';
	import {
		historyRange,
		summariseHistory,
		HISTORY_RANGES,
		type HistoryRange
	} from '$lib/features/skins/price-history';
	import type { PriceHistoryPoint } from '$lib/types/price-history';

	/**
	 * Thirty days of daily closes for one variant.
	 *
	 * A restrained area chart — a price trend for someone buying a skin, not a
	 * trading terminal. No candles, no volume panel, no indicators.
	 *
	 * Both ranges come from the same loaded series, so switching between them
	 * costs nothing and never touches the network.
	 */
	let { points, currency = DISPLAY_CURRENCY }: { points: PriceHistoryPoint[]; currency?: string } =
		$props();

	let range = $state<HistoryRange>(30);

	const visible = $derived(historyRange(points, range));
	const summary = $derived(summariseHistory(visible));

	// The chart's scales work in major units so its axis reads like money;
	// every exact figure below it is formatted from the minor-unit source.
	const scale = $derived(minorUnitScale(currency));
	const series = $derived(
		visible.map((point) => ({
			date: new Date(point.timestamp),
			value: point.close / scale
		}))
	);

	/**
	 * The chart shows the price *range*, not the distance from zero.
	 *
	 * Anchoring at zero would flatten a month of real movement into a
	 * straight line — for a skin that trades around R$ 130, a R$ 27 swing is
	 * the whole story. A little headroom keeps the line off the edges.
	 */
	const yDomain = $derived.by(() => {
		if (series.length === 0) return undefined;

		const values = series.map((point) => point.value);
		const low = Math.min(...values);
		const high = Math.max(...values);
		const margin = (high - low || high || 1) * 0.15;

		return [Math.max(0, low - margin), high + margin] as [number, number];
	});

	const changeTone = $derived(
		!summary || summary.change === 0
			? 'text-muted-foreground'
			: summary.change < 0
				? 'text-success'
				: 'text-foreground'
	);
</script>

<section class="space-y-4" aria-labelledby="price-history-heading">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 id="price-history-heading" class="text-base font-semibold text-foreground">
			Price history
		</h2>

		<div
			class="inline-flex rounded-md border border-border p-0.5"
			role="group"
			aria-label="History range"
		>
			{#each HISTORY_RANGES as option (option)}
				<button
					type="button"
					onclick={() => (range = option)}
					aria-pressed={range === option}
					class="rounded-sm px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
						{range === option
						? 'bg-surface-hover text-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					{option}D
				</button>
			{/each}
		</div>
	</div>

	{#if visible.length === 0}
		<p
			class="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted-foreground"
		>
			Price history unavailable.
		</p>
	{:else}
		<!--
			The chart is the picture; these are the numbers. Anyone who cannot
			use the chart — screen reader, no pointer — still gets every value
			that matters.
		-->
		{#if summary}
			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div>
					<dt class="text-xs text-subtle-foreground">Latest</dt>
					<dd class="font-mono text-sm text-foreground tabular-nums">
						{formatMoney(summary.current, currency)}
					</dd>
				</div>
				<div>
					<dt class="text-xs text-subtle-foreground">{range}-day low</dt>
					<dd class="font-mono text-sm text-foreground tabular-nums">
						{formatMoney(summary.low, currency)}
					</dd>
				</div>
				<div>
					<dt class="text-xs text-subtle-foreground">{range}-day high</dt>
					<dd class="font-mono text-sm text-foreground tabular-nums">
						{formatMoney(summary.high, currency)}
					</dd>
				</div>
				<div>
					<dt class="text-xs text-subtle-foreground">Change</dt>
					<dd class="{changeTone} font-mono text-sm tabular-nums">
						{summary.change > 0 ? '+' : ''}{formatMoney(summary.change, currency)}
					</dd>
				</div>
			</dl>
		{/if}

		<div class="rounded-lg border border-border bg-surface p-3">
			<!--
				`overflow-hidden` is load-bearing, not cosmetic. The chart's SVG
				is `overflow: visible`, and the area path closes to a baseline
				far below the plot — its box runs thousands of pixels past the
				chart and hit-tests over everything after it, which silently
				makes links below the chart unclickable.
			-->
			<div class="h-56 w-full overflow-hidden">
				<AreaChart
					data={series}
					x="date"
					y="value"
					{yDomain}
					padding={{ left: 56, bottom: 24, top: 8, right: 8 }}
					props={{
						area: { line: { class: 'stroke-primary stroke-2' }, class: 'fill-primary/15' },
						xAxis: {
							// Fewer ticks than data points, or a month of daily
							// candles prints the same date several times over.
							ticks: 5,
							format: (value: Date) =>
								value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
						},
						yAxis: { format: (value: number) => formatMoney(Math.round(value * scale), currency) }
					}}
				/>
			</div>
		</div>
	{/if}
</section>
