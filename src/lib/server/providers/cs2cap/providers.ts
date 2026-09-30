/**
 * CS2Cap provider directory (`GET /providers`).
 *
 * The marketplaces we show are whatever CS2Cap reports — no hardcoded list of
 * Steam/CSFloat/Skinport anywhere in the app.
 */
import type { MarketProvider } from '$lib/types/provider';
import { requestCs2Cap, type Cs2CapRequestOptions } from './client';
import { toMarketProvider } from './mappers';
import { cs2capProvidersResponseSchema } from './schemas';

/** Every marketplace CS2Cap covers, sorted by display name. */
export async function listProviders(options: Cs2CapRequestOptions = {}): Promise<MarketProvider[]> {
	const response = await requestCs2Cap(
		'/providers',
		{ schema: cs2capProvidersResponseSchema },
		options
	);

	return Object.entries(response)
		.map(([displayName, info]) => toMarketProvider(displayName, info))
		.sort((a, b) => a.name.localeCompare(b.name));
}
