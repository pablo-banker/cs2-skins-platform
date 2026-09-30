import { describe, expect, it } from 'vitest';
import {
	isSearchable,
	normalizeSearchQuery,
	skinSearchQuerySchema,
	SEARCH_MAX_QUERY_LENGTH,
	SEARCH_MIN_QUERY_LENGTH,
	SEARCH_RESULT_LIMIT
} from './search';

describe('skinSearchQuerySchema', () => {
	it('accepts a real query and trims it', () => {
		const parsed = skinSearchQuerySchema.safeParse({ q: '  redline  ' });

		expect(parsed.success).toBe(true);
		expect(parsed.data?.q).toBe('redline');
	});

	it('rejects a query below the minimum length', () => {
		expect(skinSearchQuerySchema.safeParse({ q: '' }).success).toBe(false);
		expect(skinSearchQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
		expect(skinSearchQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
	});

	it('accepts exactly the minimum length', () => {
		expect(skinSearchQuerySchema.safeParse({ q: 'ak' }).success).toBe(true);
	});

	it('rejects an abusively long query', () => {
		const long = 'a'.repeat(SEARCH_MAX_QUERY_LENGTH + 1);

		expect(skinSearchQuerySchema.safeParse({ q: long }).success).toBe(false);
		expect(
			skinSearchQuerySchema.safeParse({ q: 'a'.repeat(SEARCH_MAX_QUERY_LENGTH) }).success
		).toBe(true);
	});
});

describe('normalizeSearchQuery', () => {
	it('collapses queries that mean the same thing into one cache key', () => {
		expect(normalizeSearchQuery('  ReDLine ')).toBe('redline');
		expect(normalizeSearchQuery('AK-47   Redline')).toBe('ak-47 redline');
		expect(normalizeSearchQuery('AK-47 Redline')).toBe(normalizeSearchQuery('ak-47  redline'));
	});
});

describe('isSearchable', () => {
	it('is false below the threshold, so no request is made', () => {
		expect(isSearchable('')).toBe(false);
		expect(isSearchable(' a ')).toBe(false);
	});

	it('is true from the threshold up', () => {
		expect(isSearchable('ak')).toBe(true);
		expect(isSearchable('redline')).toBe(true);
	});

	it('is false beyond the maximum length', () => {
		expect(isSearchable('a'.repeat(SEARCH_MAX_QUERY_LENGTH + 1))).toBe(false);
	});
});

describe('search limits', () => {
	it('keeps the dialog to one readable page of results', () => {
		expect(SEARCH_RESULT_LIMIT).toBe(10);
		expect(SEARCH_MIN_QUERY_LENGTH).toBe(2);
	});
});
