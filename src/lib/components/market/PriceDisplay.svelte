<script lang="ts">
	import PriceUnavailable from './PriceUnavailable.svelte';
	import { DISPLAY_CURRENCY, formatMoney, isDisplayableAmount } from '$lib/formatters/currency';
	import { cn } from '$lib/utils';

	/**
	 * A price, in the monospace face reserved for market data.
	 *
	 * Takes **integer minor units** and a currency, never a decimal — the
	 * conversion happens in the shared formatter so every price in the product
	 * renders identically.
	 *
	 * An amount that is not a real offer (zero, negative, fractional) falls
	 * through to an unavailable state rather than rendering. Showing
	 * "R$ 0,00" as a price would be worse than showing nothing.
	 */
	let {
		amountMinor,
		currency = DISPLAY_CURRENCY,
		/** Small lead-in such as "From". Omit for a bare price. */
		label,
		size = 'md',
		class: className
	}: {
		amountMinor?: number | null;
		currency?: string;
		label?: string;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	} = $props();

	const sizes = {
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-xl'
	} as const;
</script>

{#if isDisplayableAmount(amountMinor)}
	<span class={cn('flex flex-col gap-0.5', className)}>
		{#if label}
			<span class="text-xs text-subtle-foreground">{label}</span>
		{/if}
		<span class={cn('font-mono font-medium text-foreground tabular-nums', sizes[size])}>
			{formatMoney(amountMinor, currency)}
		</span>
	</span>
{:else}
	<PriceUnavailable class={className} />
{/if}
