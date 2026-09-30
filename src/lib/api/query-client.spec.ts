import { describe, expect, it } from 'vitest';
import { createQueryClient } from './query-client';

describe('createQueryClient', () => {
	it('applies the project-wide query defaults', () => {
		const queries = createQueryClient().getDefaultOptions().queries;

		expect(queries?.staleTime).toBe(60_000);
		expect(queries?.retry).toBe(2);
		expect(queries?.refetchOnWindowFocus).toBe(false);
	});

	it('returns a new client per call so SSR renders never share a cache', () => {
		expect(createQueryClient()).not.toBe(createQueryClient());
	});
});
